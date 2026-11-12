// 상태창 칸 정의 (2026-10-27 설계안 7절): 칸 10개, 칸마다 사용·표시.
// 사용을 끈 칸은 태그에서 아예 빠진다 (빈 칸 유지를 요구하지 않음). 모양은 `[Previous status]` 블록이 모델에 알려 준다.
// 칸 구성은 채팅 변수 `$st_col_<id>` (on=사용·표시, hide=사용·숨김, off=미사용), 바뀐 기록은 `$st_col_log` (메시지 N부터 이 칸들).
// 파서(status.ts)는 지금 칸 구성과 기록된 구성으로 먼저 읽고, 칸 수가 안 맞으면 알려진 모양(6·8·9·10)으로 읽는다.
import { guideOr } from '../guides';

export type ColId = 'date' | 'time' | 'weather' | 'temp' | 'place' | 'target' | 'companions' | 'deployed' | 'identity' | 'wallet' | 'points';
export type ColMode = 'on' | 'hide' | 'off';

export interface ColDef {
  id: ColId;
  label: string;
  /** 지침 형식 줄의 영문 토큰 */
  token: string;
  /** 사용을 끌 수 없는 칸 (시간 계산·장면·위키 연결) */
  locked: boolean;
  /** 플러그인이 값을 채우거나 읽어 기능을 돌리는 칸: 끄면 그 기능도 꺼진다 */
  feature?: string;
}

export const STATUS_COLS: ColDef[] = [
  { id: 'date', label: '날짜', token: 'YYYY.MM.DD', locked: true },
  { id: 'time', label: '시각', token: 'HH:MM AM/PM', locked: true },
  { id: 'weather', label: '날씨', token: 'weather', locked: false },
  { id: 'temp', label: '기온', token: 'temperature', locked: false },
  { id: 'place', label: '위치', token: 'location', locked: true },
  { id: 'target', label: '목표', token: 'anomaly', locked: false, feature: '로어 고르기(목표 괴이)' },
  { id: 'companions', label: '동행', token: 'companions', locked: false, feature: '장면 인물 고르기' },
  { id: 'deployed', label: '투입', token: 'deployed', locked: false, feature: '투입 판정' },
  { id: 'identity', label: '신분', token: 'identity', locked: false, feature: '유저 신분(조직/직급) 추적' },
  { id: 'wallet', label: '잔고', token: 'balance', locked: false, feature: '가계부' },
  // 백일몽 포인트 (2026-11-08 사용자): 기본은 자동 — 신분이 백일몽일 때만 칸이 들어가고 아니면 칸 자체가 빠진다 (POINTS_ON_VAR)
  { id: 'points', label: '포인트', token: 'points', locked: false, feature: '백일몽 포인트' },
];
export const COL_IDS: ColId[] = STATUS_COLS.map((c) => c.id);
export const colDef = (id: ColId): ColDef => STATUS_COLS.find((c) => c.id === id)!;

export const colVar = (id: ColId) => `$st_col_${id}`;
export const COL_LOG_VAR = '$st_col_log';
export const COL_VAR_RE = /^\$st_col_(date|time|weather|temp|place|target|companions|deployed|identity|wallet|points)$/;
/** 포인트 칸 「자동」일 때 켜짐 여부 ('1' = 신분이 백일몽). 응답마다 body.ts 가 마지막 신분으로 맞춘다 */
export const POINTS_ON_VAR = '$st_points_on';
/** 포인트를 쓰는 조직 (상태창 신분 칸 「조직/직급」의 조직, 시작 소속) */
export const POINTS_ORG = '백일몽';
/** 신분·소속 글이 백일몽인가 (「백일몽/사원」「백일몽 주식회사」) */
export const isPointsOrg = (identity: string) => String(identity ?? '').split(/[/／]/)[0].trim().startsWith(POINTS_ORG);
/** 포인트 칸만 쓰는 모드: 자동 (사용자가 사용·사용 안 함을 고르기 전 기본) */
export const AUTO = 'auto';
/** 자동 + 상태창 상자에서 숨김 */
export const AUTO_HIDE = 'autohide';
/** 포인트 칸이 자동인가 (고른 값이 없거나 auto·autohide) */
export const pointsAuto = (vars: Record<string, unknown> | undefined) => !isMode(vars?.[colVar('points')]);

export type ColConfig = Record<ColId, ColMode>;

const isMode = (v: unknown): v is ColMode => v === 'on' || v === 'hide' || v === 'off';

/** 칸 구성 읽기 (채팅 변수 또는 기본값 표). 없거나 틀린 칸은 on, 잠긴 칸은 off 가 될 수 없다 */
export function colConfig(vars: Record<string, unknown> | undefined): ColConfig {
  const v = vars ?? {};
  const out = {} as ColConfig;
  for (const c of STATUS_COLS) {
    const m = v[colVar(c.id)];
    // 포인트 칸: 고른 값이 없거나 「자동」이면 신분이 백일몽일 때만 사용
    const mode: ColMode = isMode(m) ? m : c.id === 'points' ? (v[POINTS_ON_VAR] !== '1' ? 'off' : m === AUTO_HIDE ? 'hide' : 'on') : 'on';
    out[c.id] = c.locked && mode === 'off' ? 'hide' : mode;
  }
  return out;
}

/** 사용하는 칸 (태그에 들어가는 칸) 순서대로 */
export function usedCols(cfg: ColConfig): ColId[] {
  return COL_IDS.filter((id) => cfg[id] !== 'off');
}

/** 상태창 상자에서 숨기는 칸 */
export function hiddenCols(cfg: ColConfig): Set<ColId> {
  return new Set(COL_IDS.filter((id) => cfg[id] !== 'on'));
}

/** 칸 구성 기록 한 줄: 메시지 from 개째부터 이 칸들 */
export interface ColLogEntry {
  from: number;
  cols: ColId[];
}

export function colLog(vars: Record<string, unknown> | undefined): ColLogEntry[] {
  const raw = vars?.[COL_LOG_VAR];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list
      .filter((e): e is ColLogEntry => !!e && typeof e === 'object' && Number.isInteger((e as ColLogEntry).from) && Array.isArray((e as ColLogEntry).cols))
      .map((e) => ({ from: e.from, cols: e.cols.filter((c): c is ColId => COL_IDS.includes(c as ColId)) }))
      .filter((e) => e.cols.length >= 3);
  } catch {
    return [];
  }
}

/** 칸 구성이 바뀔 때 기록에 더한다 (같은 구성이면 그대로). 최근 20개만 */
export function withColLog(vars: Record<string, unknown> | undefined, messageCount: number, cols: ColId[]): string {
  // 기록이 비어 있으면 지금(바뀌기 전) 구성을 0번부터로 먼저 남긴다 (11-08 전수점검): 기본값과 다른 구성으로 시작한 채팅의 옛 응답을
  // 알려진 모양(앞에서부터 N칸)으로 잘못 읽지 않게
  const seed = colLog(vars);
  const prev = usedCols(colConfig(vars));
  const log = !seed.length && messageCount > 0 && prev.join() !== cols.join() ? [{ from: 0, cols: prev }] : seed;
  const last = log.at(-1);
  if (last && last.cols.join() === cols.join()) return JSON.stringify(log);
  const next = last && last.from === messageCount ? [...log.slice(0, -1), { from: messageCount, cols }] : [...log, { from: messageCount, cols }];
  return JSON.stringify(next.slice(-20));
}

/** 알려진 옛 모양 (6칸 2025 · 8칸 동행·투입 · 9칸 신분 · 10칸 잔고) */
export const KNOWN_SHAPES: ColId[][] = [
  COL_IDS.slice(0, 6),
  COL_IDS.slice(0, 8),
  COL_IDS.slice(0, 9),
  COL_IDS.slice(0, 10),
  COL_IDS.slice(0, 11),
];

// ── 파서가 쓰는 「지금 채팅의 모양」 (setActiveWorld 처럼 호출 시점에 맞춰 둔다) ──

let active: ColId[][] = [];

/** 이 채팅의 칸 구성(지금 + 기록)을 파서에 알린다. 최근 것이 앞 */
export function setStatusColumns(vars: Record<string, unknown> | undefined): void {
  const cur = usedCols(colConfig(vars));
  const log = colLog(vars).map((e) => e.cols).reverse();
  const seen = new Set<string>();
  active = [cur, ...log].filter((s) => !seen.has(s.join()) && seen.add(s.join()));
}

/** 칸 수에 맞는 모양: 지금 구성 → 기록 → 알려진 모양. 없으면 null */
export function shapeFor(count: number): ColId[] | null {
  return active.find((s) => s.length === count) ?? KNOWN_SHAPES.find((s) => s.length === count) ?? null;
}

/** 파서가 지금 쓰는 모양 (시험용) */
export const activeShapes = () => active;

// ── 줄 만들기 ──

export const NONE = '없음';

/** 값 → 태그 한 줄. 빈 값은 없음 */
export function formatStatusLine(values: Partial<Record<ColId, string>>, cols: ColId[]): string {
  const cell = (id: ColId) => {
    const v = (values[id] ?? '').replace(/[|\]\n\r]/g, ' ').trim();
    return v || NONE;
  };
  return `[▣|${cols.map(cell).join('|')}]`;
}

/** 잔고 칸 표기: 숫자만 (1230000). 음수는 -붙임 */
export const walletCell = (n: number) => String(Math.trunc(n));

/** 잔고 칸 읽기: 「₩1,230,000」「1230000원」「-5,000」 → 숫자. 못 읽으면 null */
export function parseWalletCell(text: string): number | null {
  const t = String(text ?? '').replace(/[\s,₩원won]/gi, '');
  if (!/^[-−+]?\d+$/.test(t)) return null;
  const n = Number(t.replace('−', '-'));
  return Number.isSafeInteger(n) ? n : null;
}

// ── 지침 조립 (🏷️Tag 의 `{status_section}` 자리) ──

const RULE: Record<ColId, string> = {
  date: '',
  time: '',
  weather: '',
  temp: '',
  place: '',
  target: "Anomaly = the exact Korean name of {{user}}'s current encounter, visit, or assigned target, including briefing and travel; otherwise `없음`.",
  companions: 'Companions = the named individuals currently travelling together with {{user}}, most important first, exact Korean names as used in the story, separated by `,`. `없음` if none. Only people who are physically with {{user}} right now; do not list unnamed crowds or groups.',
  deployed: 'Deployed = `투입` only while {{user}} (or the party {{user}} leads) is physically inside an anomaly site on an operation. `없음` during briefing, preparation, travel to the site, and after leaving or being evacuated.',
  identity: "Identity = {{user}}'s current organization and rank in Korean as `조직/직급` (e.g. `관리국/신입`, `가짜 관리국/대리`, `백일몽/사원`, `프리랜서/5급`, `민간인/-`). Copy it unchanged every turn unless the story actually changes it (promotion, transfer, defection).",
  points: "Points = {{user}}'s Baekilmong welfare points, digits only (e.g. `250`). A separate company scrip, never cash: points and won never convert, and points are spent only at the Baekilmong point shop (Welfare Mall). Every employee starts at 0 and holds only what the story has actually given (a stated grant, a per-grade clear reward, minus purchases). Copy it from `[Previous status]` and change it only by point amounts written in the story; never invent a balance that no sentence has granted.",
  wallet: "Balance = {{user}}'s current cash in won, digits only (e.g. `1230000`, no symbol or separators). Copy it from `[Previous status]` and change it only by amounts the story states explicitly. Whenever money changes hands in the scene, write the exact amount in the prose so the ledger can record it.",
};

const EXAMPLE_A: Record<ColId, string> = { date: '2025.01.01', time: '02:47 AM', weather: '☀️', temp: '4°C', place: '서울 종로구 거리', target: NONE, companions: NONE, deployed: NONE, identity: '관리국/신입', wallet: '1230000', points: '0' };
const EXAMPLE_B: Record<ColId, string> = { date: '2025.01.01', time: '10:15 PM', weather: '🌫️', temp: '9°C', place: '명일 아파트 3층 복도', target: '명일 아파트', companions: '쟈알디,에일린', deployed: '투입', identity: '관리국/요원', wallet: '1180000', points: '250' };

/** 🏷️Tag 지침의 상태창 절: 칸 구성에서 형식 줄·규칙·예시를 만든다 */
export function statusSection(cols: ColId[]): string {
  const fmt = `[▣|${cols.map((id) => colDef(id).token).join('|')}]`;
  // 칸 규칙·고정 줄은 지침 「메인 요청에 붙는 글」 STATUS.RULE.* 절. 절이 없으면 여기 남긴 글
  const rules = cols.map((id) => (RULE[id] ? guideOr('Main', `STATUS.RULE.${id.toUpperCase()}`, RULE[id]) : '')).filter(Boolean).map((r) => `- ${r}`);
  // 포인트 칸이 있으면 백일몽 소속이라 예시 신분도 백일몽으로
  const ex = (v: Record<ColId, string>) => `[▣|${cols.map((id) => (id === 'identity' && cols.includes('points') ? '백일몽/사원' : v[id])).join('|')}]`;
  return [
    '## Status',
    fmt,
    '',
    guideOr('Main', 'STATUS.RULE.ONE_LINE', '- Output exactly one [▣] at the very end of every response, as the final line.'),
    guideOr('Main', 'STATUS.RULE.FIELDS', () => `- Fields in order: ${cols.map((id) => colDef(id).label).join(' | ')}. Never add, drop or reorder fields.`, { labels: cols.map((id) => colDef(id).label).join(' | ') }),
    ...rules,
    guideOr('Main', 'STATUS.RULE.PREVIOUS', '- The status line of the previous scene is provided in a `[Previous status]` block just before the latest user input. Continue from it: advance the time and update the other fields. Older responses do not carry their status lines.'),
    `- Example${cols.includes('target') ? ' (no current anomaly)' : ''}:`,
    ex(EXAMPLE_A),
    ...(cols.includes('target') || cols.includes('companions') || cols.includes('deployed') ? [`- Example (inside an anomaly${cols.includes('companions') ? ' with two companions' : ''}):`, ex(EXAMPLE_B)] : []),
  ].join('\n');
}

export const STATUS_SECTION_MARK = '{status_section}';

/** 지침 글의 `{status_section}` 자리를 채운다 (없으면 그대로) */
export function fillStatusSection(text: string, cols: ColId[]): string {
  return text.includes(STATUS_SECTION_MARK) ? text.split(STATUS_SECTION_MARK).join(statusSection(cols)) : text;
}
