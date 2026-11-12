// 기능별 「넘길 내용」과 양 (2026-11-13 사용자: 「같이 쓰는 값」이 메뉴 안 모든 기능에 똑같이 넘어간다 → 기능별로 나눈다).
// 게시판(gn)·괴담톡(ph)이 같이 쓰는 한 가지 틀. 값을 읽는 곳도 화면도 이 파일의 이름만 쓴다.
//  - 기능 표: 줄 = 기능, 칸 = 넘길 내용 여섯 칩. 메뉴의 칩(게시판은 게시판마다)과 기능 표 둘 다 켜진 것만 넘긴다.
//  - 양 표: 줄 = 기능, 칸 = 챗로그·요청 토큰 상한. 따로 정하지 않은 기능은 그 메뉴의 값(챗로그 포함·요청 토큰 상한)을 그대로 쓴다.
// 「상시 로어북」으로 무엇을 넘길지는 여기서 정하지 않는다 (호출 › 로어북 호출의 「로어북 선택」 한 곳).
import { advItem, advNum, advVar, refToggles, type RefToggles } from './advanced';

type State = Record<string, unknown> | undefined;

export type FnFeature = 'gn' | 'ph';

/** 넘길 내용 칩 (core/advanced.ts 「참조」 칩과 같은 열쇠·같은 차례) */
export const REF_CHIP_KEYS = ['desc', 'authors', 'persona', 'active', 'related', 'secondary'] as const;
export type RefChip = (typeof REF_CHIP_KEYS)[number];

/** 메뉴마다의 기능 (요청 종류). label 은 화면 줄 이름 */
export const REF_FNS: Record<FnFeature, { key: string; label: string }[]> = {
  gn: [
    { key: 'refresh', label: '새로고침' },
    { key: 'post', label: '글 쓰기' },
    { key: 'comment', label: '댓글' },
    { key: 'dm', label: '쪽지' },
  ],
  ph: [
    { key: 'reply', label: '답장' },
    { key: 'check', label: '새 메시지 확인' },
    { key: 'view', label: '보기 전용 방' },
  ],
};
export const isRefFn = (f: FnFeature, fn: string): boolean => REF_FNS[f].some((x) => x.key === fn);

/** 기능 표·양 표의 값이 사는 변수. 게시판 것은 `$lb_cfg_lb-gn.adv_` 로 시작해 네 게시판이 같이 쓴다 (core/boards.ts boardShared) */
const PREFIX: Record<FnFeature, string> = { gn: '$lb_cfg_lb-gn.adv_fn_', ph: '$ph_adv_fn_' };
export const fnVar = (f: FnFeature, fn: string, key: string): string => `${PREFIX[f]}${fn}_${key}`;
/** 기본값 저장(새 채팅 기본값)에 받을 변수인가 */
export const isFnVar = (name: string): boolean => name.startsWith(PREFIX.gn) || name.startsWith(PREFIX.ph);

/** 기능 표 칩의 기본값: 메뉴 칩의 기본값과 같다 (손대지 않으면 지금 동작 그대로) */
const CHIP_DEF: Record<RefChip, boolean> = { desc: true, authors: true, persona: true, active: true, related: true, secondary: false };

/** 기능 표의 한 칸이 켜져 있나 */
export function fnChipOn(state: State, f: FnFeature, fn: string, chip: RefChip): boolean {
  const v = state?.[fnVar(f, fn, chip)];
  return v === '1' || v === '0' ? v === '1' : CHIP_DEF[chip];
}

const TOGGLE: Record<RefChip, keyof RefToggles> = { desc: 'description', authors: 'authors', persona: 'persona', active: 'active', related: 'related', secondary: 'secondary' };

/** 이 기능의 요청에 넘길 것: 메뉴의 칩과 기능 표가 둘 다 켜진 것만 */
export function fnRefToggles(state: State, f: FnFeature, fn: string): RefToggles {
  const out = { ...refToggles(state, f) };
  for (const chip of REF_CHIP_KEYS) out[TOGGLE[chip]] = out[TOGGLE[chip]] && fnChipOn(state, f, fn, chip);
  return out;
}

/** 요청에 실제로 넘길 것 (요청문을 만드는 곳은 이것만 부른다).
 *  게시판: 게시판 표(게시판마다의 칩)와 기능 표 둘 다 켜진 것만.
 *  괴담톡: 기능 표만 본다 — 괴담톡은 메뉴가 하나라 메뉴 칩을 화면에서 뺐고, 옛 메뉴 칩($ph_adv_desc … $ph_related)은 읽지 않는다
 *  (메뉴 칩의 2차 참조 기본값이 끔이라 겹쳐 보면 기능 표의 2차 참조 칸이 쓸모없어진다) */
export function fnRefs(state: State, f: FnFeature, fn: string): RefToggles {
  if (f !== 'ph') return fnRefToggles(state, f, fn);
  const out = {} as RefToggles;
  for (const chip of REF_CHIP_KEYS) out[TOGGLE[chip]] = fnChipOn(state, f, fn, chip);
  return out;
}

/** 양 표의 칸 */
export const FN_AMOUNTS = {
  turns: { label: '챗로그', min: 0, max: 200, unit: '턴', zero: '안 봄' },
  budget: { label: '요청 토큰 상한', min: 0, max: 200000, unit: '토큰', zero: '생성 공통 값 따름' },
} as const;
export type FnAmount = keyof typeof FN_AMOUNTS;

/** 기능이 따로 정한 값. 없거나 틀리면 null */
export function fnOwnNum(state: State, f: FnFeature, fn: string, key: FnAmount): number | null {
  const raw = state?.[fnVar(f, fn, key)];
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= FN_AMOUNTS[key].min && n <= FN_AMOUNTS[key].max ? n : null;
}

/** 이 기능의 양. 따로 정하지 않았으면 그 메뉴의 값 (챗로그 포함·요청 토큰 상한) */
export function fnNum(state: State, f: FnFeature, fn: string, key: FnAmount): number {
  return fnOwnNum(state, f, fn, key) ?? advNum(state, f, key);
}

/** 이 기능의 요청 토큰 상한. 0이면 생성 공통 값, 그것도 0이면 제한 없음(0) (core/advanced.ts budgetFor 와 같은 규칙) */
export const fnBudget = (state: State, f: FnFeature, fn: string): number => fnNum(state, f, fn, 'budget') || advNum(state, 'gen', 'budget');

/** 양 표의 「지난 기록」 칸: 기능마다 세는 것이 다르다.
 *  adv = 세부 값 표(core/advanced.ts)의 그 값 하나를 그대로 쓴다 (이름·범위·기본값도 그 표).
 *  그 밖은 기능이 따로 갖는 값(fnVar 의 history): 정하지 않았으면 base(세부 값 표의 값)를, base 가 없으면 def 를 쓴다 */
type FnHist = { adv: string } | { min: number; max: number; unit: string; def: number; base?: string };
export const FN_HISTORY: Record<FnFeature, Record<string, FnHist>> = {
  gn: {
    refresh: { adv: 'refresh_posts' },
    // 글 쓰기 때 다른 글 활동으로 넘기는 게시판 글 (전에는 새로고침의 글 수를 빌려 썼다)
    post: { min: 1, max: 200, unit: '개', def: 10 },
    comment: { adv: 'comments' },
    dm: { adv: 'dm_history' },
  },
  ph: {
    reply: { min: 10, max: 1000, unit: '개', def: 100, base: 'room_history' },
    check: { min: 10, max: 1000, unit: '개', def: 100, base: 'room_history' },
    // 보기 전용 방: 같은 종류의 앞 방 말풍선 (전에는 30개로 굳어 있었다)
    view: { min: 1, max: 300, unit: '개', def: 30 },
  },
};
/** 「지난 기록」 칸의 범위 */
export function fnHistoryRange(f: FnFeature, fn: string): { min: number; max: number; unit: string } {
  const h = FN_HISTORY[f][fn];
  if (!h) return { min: 0, max: 0, unit: '' };
  if (!('adv' in h)) return { min: h.min, max: h.max, unit: h.unit };
  const item = advItem(f, h.adv);
  return { min: item?.min ?? 0, max: item?.max ?? 0, unit: item?.unit ?? '' };
}
/** 「지난 기록」 칸의 값이 사는 변수 */
export function fnHistoryVar(f: FnFeature, fn: string): string {
  const h = FN_HISTORY[f][fn];
  const item = h && 'adv' in h ? advItem(f, h.adv) : undefined;
  return item ? advVar(f, item) : fnVar(f, fn, 'history');
}
/** 이 기능의 지난 기록 수 */
export function fnHistory(state: State, f: FnFeature, fn: string): number {
  const h = FN_HISTORY[f][fn];
  if (!h) return 0;
  if ('adv' in h) return advNum(state, f, h.adv);
  const raw = state?.[fnVar(f, fn, 'history')];
  const n = raw === undefined || raw === null || String(raw).trim() === '' ? NaN : Number(raw);
  if (Number.isInteger(n) && n >= h.min && n <= h.max) return n;
  return h.base ? advNum(state, f, h.base) : h.def;
}

/** 화면의 칸이 보내는 열쇠 (adv-set 의 「기능:열쇠=값」에서 열쇠). 세부 값 표의 값을 그대로 쓰는 칸은 그 표의 열쇠 */
export const fnSetKey = (fn: string, key: RefChip | FnAmount | 'history'): string => `fn_${fn}_${key}`;
export function fnHistorySetKey(f: FnFeature, fn: string): string {
  const h = FN_HISTORY[f][fn];
  return h && 'adv' in h ? h.adv : fnSetKey(fn, 'history');
}
/** 「fn_기능_칸」과 받은 글 → 저장할 [변수, 값]. 칩은 '1'·'0', 수는 범위 안으로 맞춘 정수, 빈 칸은 '' (= 따로 정하지 않음). 모르는 열쇠·틀린 값은 null */
export function fnSet(f: FnFeature, key: string, raw: string): [string, string] | null {
  const m = /^fn_([a-z]+)_([a-z]+)$/.exec(key);
  if (!m || !isRefFn(f, m[1])) return null;
  const [, fn, k] = m;
  const v = raw.trim();
  if ((REF_CHIP_KEYS as readonly string[]).includes(k)) return v === '1' || v === '0' ? [fnVar(f, fn, k), v] : null;
  const h = FN_HISTORY[f][fn];
  const range = k === 'turns' || k === 'budget' ? FN_AMOUNTS[k] : k === 'history' && h && !('adv' in h) ? h : null;
  if (!range) return null;
  if (v === '') return [fnVar(f, fn, k), ''];
  const n = Number(v);
  return Number.isFinite(n) ? [fnVar(f, fn, k), String(Math.min(range.max, Math.max(range.min, Math.round(n))))] : null;
}
