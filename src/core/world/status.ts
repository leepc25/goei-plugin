// 상태창 [▣|날짜|시각|날씨|기온|위치|목표(|동행|투입|신분|잔고)]: 원본은 카드 정규식으로 그려서 칸 하나만 어긋나도 통째로 깨졌다.
// 플러그인이 너그럽게 읽는다: 칸이 모자라거나 남아도, 전각 기호·공백이 섞여도, 닫는 괄호가 없어도.
// 칸 구성(statuscols.ts): 이 채팅의 지금 구성·기록된 구성·알려진 모양 중 칸 수가 맞는 것으로 먼저 읽고, 아니면 모양으로 날짜·시각·기온을 찾는다.
import { parseWalletCell, shapeFor, type ColId } from './statuscols';

export interface StatusTag {
  /** 원문 (화면에서 바꿀 자리) */
  raw: string;
  date: string;
  time: string;
  weather: string;
  temp: string;
  place: string;
  /** '없음'이면 빈 문자열 */
  target: string;
  /** 지금 주인공과 같이 있는 이름 있는 인물들 (8칸 상태창의 동행 칸. 칸이 없거나 없음이면 빈 목록) */
  companions: string[];
  /** 투입 칸: 투입이면 true, 없음이면 false, 칸이 없는 옛 6칸 상태창이면 null */
  deployed: boolean | null;
  /** 신분 칸 (9칸 상태창, 2026-10-26): 유저의 `조직/직급`. 없으면 빈 문자열 */
  identity: string;
  /** 잔고 칸 (10칸, 2026-10-27): 숫자만 남긴 글 ('1230000'). 칸이 없거나 못 읽으면 빈 문자열 */
  wallet: string;
}

// 여는 기호: [▣ 【▣ ［▣ (▣ 앞 공백 허용). 닫는 기호가 없으면 줄 끝까지
const TAG_RE = /[[【［]\s*▣\s*[|｜]([^\]】］\r\n]*)(?:[\]】］]|(?=\r?\n|$))/g;
const DATE_RE = /^\d{3,4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}\s*일?(?:\s*[(（]?\s*[일월화수목금토]\s*(?:요일)?\s*[)）]?)?$/;
const TIME_RE = /^(?:(?:오전|오후|AM|PM|am|pm)\s*)?\d{1,2}\s*[:시]\s*\d{0,2}\s*분?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?$/;
const TEMP_RE = /^[-−+]?\s*\d+(?:\.\d+)?\s*(?:°\s*[CcFf]?|℃|도)$/;

export function hasStatusTag(text: string): boolean {
  return typeof text === 'string' && /[[【［]\s*▣\s*[|｜]/.test(text);
}

const none = (t: string) => !t || t === '없음' || t === '-' || t === '—';
const splitNames = (t: string) => (none(t) ? [] : t.split(/[,，、]/).map((n) => n.trim()).filter((n) => n && !none(n)));
const walletText = (t: string) => {
  const n = none(t) ? null : parseWalletCell(t);
  return n === null ? '' : String(n);
};

/** 동행·투입·신분·잔고 칸 (뒤 칸들). 비어 있으면 옛 상태창 */
function extras(x: string[]): { companions: string[]; deployed: boolean | null; identity: string; wallet: string } {
  const d = (x[1] ?? '').trim();
  const id = (x[2] ?? '').trim();
  return { companions: splitNames(x[0] ?? ''), deployed: x.length < 2 ? null : none(d) ? false : /투입|deployed/i.test(d), identity: none(id) ? '' : id, wallet: walletText(x[3] ?? '') };
}

/** 위치 뒤 칸들: 목표(괴이), 동행, 투입, 신분, 잔고. 칸이 더 많으면 목표에 이어 붙이던 옛 방식 대신 뒤 칸은 버린다 */
function tail(rest: string[]): { target: string; companions: string[]; deployed: boolean | null; identity: string; wallet: string } {
  const clean = (t: string) => (t === '없음' || t === '-' || t === '—' ? '' : t);
  const after = rest.slice(1);
  if (after.length <= 1) return { target: clean(after[0] ?? ''), ...extras([]) };
  return { target: clean(after[0]), ...extras(after.slice(1, 5)) };
}

/** 칸 구성대로 이름 붙이기 (구성에 없는 칸은 빈 값, 투입 칸이 없으면 null) */
function byShape(f: string[], shape: ColId[]): Omit<StatusTag, 'raw'> {
  const clean = (t: string) => (none(t) ? '' : t);
  const get = (id: ColId) => {
    const i = shape.indexOf(id);
    return i < 0 ? '' : (f[i] ?? '').trim();
  };
  const d = get('deployed');
  return {
    date: get('date'),
    time: get('time'),
    weather: clean(get('weather')),
    temp: clean(get('temp')),
    place: clean(get('place')),
    target: clean(get('target')),
    companions: splitNames(get('companions')),
    deployed: shape.includes('deployed') ? (none(d) ? false : /투입|deployed/i.test(d)) : null,
    identity: clean(get('identity')),
    wallet: walletText(get('wallet')),
  };
}

/** 칸을 나눠 이름 붙이기. 칸 수가 아는 모양과 맞고 날짜·시각 자리가 맞으면 그 순서대로, 아니면 모양으로 날짜·시각·기온을 먼저 찾는다 */
function fieldsOf(inner: string): Omit<StatusTag, 'raw'> {
  const f = inner.split(/[|｜]/).map((s) => s.trim());
  while (f.length && f[f.length - 1] === '') f.pop();
  const shape = shapeFor(f.length);
  if (shape && DATE_RE.test(f[shape.indexOf('date')] ?? '') && TIME_RE.test(f[shape.indexOf('time')] ?? '')) return byShape(f, shape);
  const rest = [...f];
  const take = (re: RegExp) => {
    const i = rest.findIndex((x) => re.test(x));
    return i < 0 ? '' : rest.splice(i, 1)[0];
  };
  const date = take(DATE_RE);
  const time = take(TIME_RE);
  const temp = take(TEMP_RE);
  // 날씨는 이모지가 있거나 짧은 날씨 낱말. 남은 칸에서 맨 앞
  let weather = '';
  const wi = rest.findIndex((x) => /\p{Extended_Pictographic}/u.test(x) || /^(맑음|흐림|비|눈|안개|구름|소나기|천둥|번개|황사|바람)/.test(x));
  if (wi >= 0 && wi <= 1) weather = rest.splice(wi, 1)[0];
  // 날씨와 기온이 한 칸에 붙어 온 경우 (☀️ 12°C)
  if (!temp && weather) {
    const m = /^(.*?)\s*([-−+]?\d+(?:\.\d+)?\s*(?:°\s*[CcFf]?|℃))$/.exec(weather);
    if (m) return { date, time, weather: m[1], temp: m[2], place: rest[0] ?? '', ...tail(rest) };
  }
  return { date, time, weather, temp, place: rest[0] ?? '', ...tail(rest) };
}

/** 글 속 상태창 태그들 */
export function findStatusTags(text: string): StatusTag[] {
  if (!hasStatusTag(text)) return [];
  return [...text.matchAll(TAG_RE)].map((m) => ({ raw: m[0], ...fieldsOf(m[1]) }));
}

/** 날짜·시각 → 분 (UTC 기준 그레고리력). 읽지 못하면 null */
export function statusMinute(date: string, time: string): number | null {
  const d = /(\d{3,4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.exec(date ?? '');
  if (!d) return null;
  const t = /(\d{1,2})\s*[:시]\s*(\d{1,2})?/.exec(time ?? '');
  let h = t ? Number(t[1]) : 0;
  const min = t?.[2] ? Number(t[2]) : 0;
  const pm = /PM|p\.m\.|오후/i.test(time ?? '');
  const am = /AM|a\.m\.|오전/i.test(time ?? '');
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  const ms = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, min);
  return Number.isFinite(ms) ? Math.floor(ms / 60000) : null;
}

/** 상황판(세계 시뮬)이 꺼져 있거나 아직 시작 전이라 세계 시각이 없을 때: 마지막 상태줄 [▣] 의 날짜·시각 (오전·오후 포함).
 *  날짜가 없으면 그날의 분만. 예전에는 「10:20」 숫자만 읽어 「02:47 PM」을 2시 47분으로 읽었고, 게임 시계(card())는 아예 읽지 않아
 *  상황판을 끈 채팅에서 필드 시계가 --:-- 로 멈춰 있었다 (QC 2026-10-28) */
export function statusClockMinute(st: { date?: string; time?: string } | null): number | null {
  if (!st?.time) return null;
  const abs = statusMinute(st.date ?? '', st.time);
  if (abs !== null) return abs;
  const t = /(\d{1,2})\s*[:시]\s*(\d{1,2})?/.exec(st.time);
  if (!t) return null;
  let h = Number(t[1]);
  const m = t[2] ? Number(t[2]) : 0;
  if (/PM|p\.m\.|오후/i.test(st.time) && h < 12) h += 12;
  if (/AM|a\.m\.|오전/i.test(st.time) && h === 12) h = 0;
  return h > 23 || m > 59 ? null : h * 60 + m;
}

const DAY_MIN = 1440;

/** 「오늘 오전 10:00」·「어제 오후 9:10」·「3월 12일 오후 9:10」 (지금 장면 기준) */
export function sceneLabel(prev: number, now: number): string {
  const p = new Date(prev * 60000);
  const h = p.getUTCHours();
  const clock = `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(p.getUTCMinutes()).padStart(2, '0')}`;
  const days = Math.floor(now / DAY_MIN) - Math.floor(prev / DAY_MIN);
  const when = days === 0 ? '오늘' : days === 1 ? '어제' : days === 2 ? '그저께' : `${p.getUTCFullYear() !== new Date(now * 60000).getUTCFullYear() ? `${p.getUTCFullYear()}년 ` : ''}${p.getUTCMonth() + 1}월 ${p.getUTCDate()}일`;
  return `${when} ${clock}`;
}

/** 흐른 시간: 「2시간 15분」·「1일 2시간 30분」·「5분」. 거꾸로 가면 「-2시간」 */
export function elapsedLabel(from: number, to: number): string {
  let m = to - from;
  const sign = m < 0 ? '-' : '';
  m = Math.abs(m);
  const d = Math.floor(m / DAY_MIN);
  const h = Math.floor((m % DAY_MIN) / 60);
  const mm = m % 60;
  const parts = [d ? `${d}일` : '', h ? `${h}시간` : '', mm ? `${mm}분` : ''].filter(Boolean);
  return parts.length ? sign + parts.join(' ') : '흐르지 않음';
}

/** 시작한 날을 1일째로 */
export function storyDay(start: number, now: number): number {
  return Math.floor(now / DAY_MIN) - Math.floor(start / DAY_MIN) + 1;
}

export interface StatusTimeline {
  /** 상태창 원문 → 바로 앞 장면의 분 */
  prev: Map<string, number>;
  /** 이야기 첫 상태창의 분 */
  start: number | null;
  /** 마지막 상태창 (원문·분). 아직 모으지 못한 새 응답은 이것을 지난 장면으로 */
  last: { raw: string; minute: number } | null;
  /** 모은 상태창 원문 전부 */
  seen: Set<string>;
  /** 상태창 원문 → 바로 앞 상태창의 잔고 (둘 다 읽혔을 때만) */
  prevWallet: Map<string, number>;
  /** 마지막으로 읽힌 잔고 */
  lastWallet: number | null;
}

/** 채팅 응답들의 상태창 시각을 차례로 모아 「지난 장면」을 찾는다 */
export function statusTimeline(texts: string[]): StatusTimeline {
  const prev = new Map<string, number>();
  const prevWallet = new Map<string, number>();
  const seen = new Set<string>();
  let start: number | null = null;
  let last: { raw: string; minute: number } | null = null;
  let lastWallet: number | null = null;
  for (const t of texts) {
    for (const tag of findStatusTags(t)) {
      const m = statusMinute(tag.date, tag.time);
      seen.add(tag.raw.trim());
      const w = tag.wallet ? Number(tag.wallet) : null;
      if (w !== null && lastWallet !== null && !prevWallet.has(tag.raw.trim())) prevWallet.set(tag.raw.trim(), lastWallet);
      if (w !== null) lastWallet = w;
      if (m === null) continue;
      if (start === null) start = m;
      if (last !== null && !prev.has(tag.raw.trim())) prev.set(tag.raw.trim(), last.minute);
      last = { raw: tag.raw.trim(), minute: m };
    }
  }
  return { prev, start, last, seen, prevWallet, lastWallet };
}
