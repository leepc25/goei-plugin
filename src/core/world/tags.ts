// 모델 출력의 상황판 태그 읽기/지우기. 원본 Lua의 scanAnomalies, scanIncidents, scanMysticSites,
// agParse, stripAnAgMeta, envToEnd, parseWorldMinute와 같은 규칙.
export type AnState = '활성' | '소멸' | '격리' | '클리어';

export interface AnTag {
  region: string;
  name: string;
  state: AnState;
  grade: string;
  deploy: string;
}
export interface InTag {
  region: string;
  name: string;
  state: '진행' | '종료';
  situation: string;
}
export interface MsTag {
  region: string;
  name: string;
  state: '출현' | '소실';
  visitors: string;
}
export interface AgTag {
  who: string;
  state: AgState;
  situation: string;
}

export const AG_STATES = ['휴게', '내근', '외근', '작전투입', '비번', '부상', '실종', '격리', '사망'] as const;
export type AgState = (typeof AG_STATES)[number];

const AG_ALIAS: Record<string, AgState> = {
  대기: '휴게', 작전중: '작전투입', standby: '휴게', idle: '휴게', waiting: '휴게', available: '휴게', pending: '휴게', ready: '휴게',
  deployed: '작전투입', active: '작전투입', operating: '작전투입', 'on mission': '작전투입', engaged: '작전투입', 'in operation': '작전투입',
  injured: '부상', wounded: '부상', hurt: '부상', dead: '사망', kia: '사망', deceased: '사망', killed: '사망', missing: '실종', mia: '실종', lost: '실종',
  quarantine: '격리', quarantined: '격리', isolated: '격리', contaminated: '격리', 'off duty': '비번', offduty: '비번', 'on leave': '비번', leave: '비번', resting: '비번',
};

const AN_LABELS = ['슬롯', '지역', '발생지점', '위치', '이름', '괴이명', '괴이', '명칭', '배치', '작전현황', '작전', '상태', '위협등급', '등급'];

/** "배치: P001" 같은 라벨 붙은 값에서 라벨 떼기 */
export function stripLabel(v: string | undefined): string {
  let s = (v ?? '').trim();
  for (const lb of AN_LABELS) {
    const m = new RegExp(`^${lb}\\s*[:：]\\s*`).exec(s);
    if (m) {
      s = s.slice(m[0].length).trim();
      break;
    }
  }
  return s;
}

export function normGrade(v: string | undefined): string {
  const g = stripLabel(v).toUpperCase().replace(/[^FEDCBAS]/g, '').charAt(0);
  return g;
}

export function normAnState(v: string | undefined): AnState {
  const s = stripLabel(v);
  const low = s.toLowerCase();
  if (s.includes('소멸') || low.includes('fade') || low.includes('vanish')) return '소멸';
  if (s.includes('격리') || low.includes('contain') || low.includes('isolate')) return '격리';
  if (s.includes('클리어') || low.includes('clear') || low.includes('resolve')) return '클리어';
  return '활성';
}

export function normAgState(v: string | undefined): AgState | null {
  const s = (v ?? '').trim();
  if ((AG_STATES as readonly string[]).includes(s)) return s as AgState;
  return AG_ALIAS[s] ?? AG_ALIAS[s.toLowerCase().replace(/\s+/g, ' ')] ?? null;
}

function fields(text: string, kind: string): string[][] {
  const out: string[][] = [];
  const re = new RegExp(`\\[${kind}\\s*\\|([^\\]]*)\\]`, 'g');
  for (const m of text.matchAll(re)) out.push(m[1].split('|').map((s) => s.trim()));
  return out;
}

/** 꼬리에서 읽는다: 모델이 앞에 슬롯 번호를 붙여도 깨지지 않게 */
export function scanAnomalies(text: string): AnTag[] {
  return fields(text, 'AN').flatMap((f) => {
    const n = f.length;
    let region = f[0] ?? '';
    if (/^\d+$/.test(region) && n >= 6) region = f[1] ?? '';
    if (n < 5 || !region) return [];
    return [{ region, name: stripLabel(f[n - 4]), state: normAnState(f[n - 3]), grade: normGrade(f[n - 2]), deploy: stripLabel(f[n - 1]) }];
  });
}

function scanSites<S extends string>(text: string, kind: string, states: readonly S[]) {
  return fields(text, kind).flatMap((f) => {
    const n = f.length;
    let region = f[0] ?? '';
    if (/^\d+$/.test(region) && n >= 5) region = f[1] ?? '';
    const st = stripLabel(f[n - 2]);
    if (n < 4 || !(states as readonly string[]).includes(st)) return [];
    return [{ region, name: stripLabel(f[n - 3]), state: st as S, last: stripLabel(f[n - 1]) }];
  });
}

export function scanIncidents(text: string): InTag[] {
  return scanSites(text, 'IN', ['진행', '종료'] as const).map(({ last, ...t }) => ({ ...t, situation: last }));
}

export function scanMysticSites(text: string): MsTag[] {
  return scanSites(text, 'MS', ['출현', '소실'] as const).map(({ last, ...t }) => ({ ...t, visitors: last }));
}

export function scanAgents(text: string): AgTag[] {
  return fields(text, 'AG').flatMap((f) => {
    const state = normAgState(f[1]);
    return f[0] && state ? [{ who: f[0], state, situation: f[2] ?? '' }] : [];
  });
}

/** [AC|code] 소속 변경 */
export function scanAffiliation(text: string): string | null {
  const m = /\[AC\s*\|\s*(\w+)\s*\]/.exec(text);
  return m ? m[1].toUpperCase() : null;
}

/** 상태창 [▣|YYYY.MM.DD|HH:MM AM|날씨|기온|위치|괴이] */
export interface StatusLine {
  minute: number | null;
  /** 지금 다루는 괴이 이름. '없음'이면 빈 문자열, 상태창이 없거나 형식이 다르면 null */
  target: string | null;
}

export function scanStatus(text: string): StatusLine {
  const all = [...text.matchAll(/\[▣\s*\|([^\]]*)\]/g)];
  let minute: number | null = null;
  let target: string | null = null;
  const tm = /\[▣\s*\|\s*(\d{4})\.(\d{2})\.(\d{2})\s*\|\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])/.exec(text);
  if (tm) {
    let hh = Number(tm[4]);
    const ap = tm[6].toUpperCase();
    if (ap === 'AM' && hh === 12) hh = 0;
    if (ap === 'PM' && hh !== 12) hh += 12;
    minute = Math.floor(Date.UTC(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]), hh, Number(tm[5])) / 60000);
  }
  if (all.length === 1) {
    const f = all[0][1].split('|').map((s) => s.trim());
    if (f.length === 6 && f[5] !== '') target = f[5] === '없음' ? '' : f[5];
  }
  return { minute, target };
}

/** 마지막 상태창 [▣|날짜|시각|날씨|기온|위치|괴이]의 칸들 (간이 상태창 표시용) */
export interface StatusFields { date: string; time: string; weather: string; temp: string; place: string; target: string }

export function lastStatusFields(texts: string[]): StatusFields | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const all = [...(texts[i] ?? '').matchAll(/\[▣\s*\|([^\]]*)\]/g)];
    if (!all.length) continue;
    const f = all[all.length - 1][1].split('|').map((s) => s.trim());
    const [date = '', time = '', weather = '', temp = '', place = '', target = ''] = f;
    return { date, time, weather, temp, place, target: target === '없음' ? '' : target };
  }
  return null;
}

export function hasWorldTags(text: string): boolean {
  return /\[(?:AN|IN|MS|AG)\s*\||\[AC\s*\|/.test(text);
}

const AGE_META = /\{\s*\d+\s*시간\s+\d+\s*분\s*전\s*\}/;
const MARKERS = ['USER 관여 상태', 'RP 시간 제한', 'USER 관여 상태 규칙', 'USER 탐험 상태 규칙', '탐험 추적', '자동 종료'];

/**
 * 저장·표시용 본문: 상황판 태그와 {N시간 N분 전} 메타, [AC] 줄을 지우고 일반 본문은 남긴다.
 * 상태창 [▣] 줄은 본문 맨 끝으로 옮긴다 (원본 envToEnd).
 */
export function cleanOutput(text: string): string {
  const lines = text.split('\n');
  const keep: string[] = [];
  let prev: string | null = null;
  let prevHadTag = false;
  const ageOnly = (l: string | null) => l !== null && new RegExp(`^\\s*${AGE_META.source}\\s*$`).test(l);
  for (const raw of lines) {
    let line = raw;
    if (MARKERS.some((m) => new RegExp(`^\\s*[-*]?\\s*\\[${m}\\]`).test(line))) line = '';
    if (prevHadTag) line = line.replace(new RegExp(`^\\s*${AGE_META.source}\\s*`), '');
    let count = 0;
    line = line.replace(/\[(?:AN|IN|MS|AG)\s*\|[^\]]*\]/g, () => {
      count++;
      return '';
    });
    const hadTag = count > 0;
    if (prev !== null && !(hadTag && ageOnly(prev))) keep.push(prev);
    if (hadTag) line = line.replace(new RegExp(AGE_META.source, 'g'), '');
    prev = line;
    prevHadTag = hadTag;
  }
  if (prev !== null) keep.push(prev);
  const envs: string[] = [];
  const body = keep.filter((l) => {
    if (/^\s*\[▣\s*\|/.test(l)) {
      envs.push(l.trim());
      return false;
    }
    return !/^\s*\[AC\s*\|/.test(l) && !/^\s*\[◎\s*\|/.test(l);
  });
  let s = body.join('\n').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  if (envs.length) s = (s ? `${s}\n` : '') + envs.join('\n');
  return s;
}
