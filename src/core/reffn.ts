// 기능별 「넘길 내용」과 양 (2026-11-13 사용자: 「같이 쓰는 값」이 메뉴 안 모든 기능에 똑같이 넘어간다 → 기능별로 나눈다).
// 게시판(gn)·괴담톡(ph)이 같이 쓰는 한 가지 틀. 값을 읽는 곳도 화면도 이 파일의 이름만 쓴다.
//  - 기능 표: 줄 = 기능, 칸 = 넘길 내용 여섯 칩. 메뉴의 칩(게시판은 게시판마다)과 기능 표 둘 다 켜진 것만 넘긴다.
//  - 양 표: 줄 = 기능, 칸 = 챗로그·요청 토큰 상한. 따로 정하지 않은 기능은 그 메뉴의 값(챗로그 포함·요청 토큰 상한)을 그대로 쓴다.
// 「상시 로어북」으로 무엇을 넘길지는 여기서 정하지 않는다 (호출 › 로어북 호출의 「로어북 선택」 한 곳).
import { advNum, refToggles, type RefToggles } from './advanced';

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
