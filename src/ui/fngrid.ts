// 기능별 「넘길 내용」·「넘길 양」 격자 (게시판 넷·괴담톡이 같이 쓴다. 값과 이름은 core/reffn.ts 한 곳).
// 줄 = 기능(요청 종류). 조작은 세부 값과 같은 통로(adv-set 「기능:열쇠=값」)로 보낸다 (ui/advanced.ts handleAdvanced).
import { advItem } from '../core/advanced';
import { FN_AMOUNTS, REF_CHIP_KEYS, REF_FNS, fnChipOn, fnHistory, fnHistoryRange, fnHistorySetKey, fnNum, fnSetKey, type FnFeature } from '../core/reffn';
import { ckWide, sameStep, type CkActs, type CkBand, type CkNum } from './setrow';

type State = Record<string, unknown> | undefined;
const ADV_ACTS: CkActs = { set: 'adv-set', num: 'adv-set' };
/** 세부 값 줄과 같은 폭으로 움직인다: 토큰 상한처럼 큰 수는 500, 나머지는 1 */
const num = (n: number, lo: number, hi: number): CkNum => ({ n, lo, hi, step: hi >= 10000 ? 500 : 1, lg: true });

/** 칩 이름 (세부 값 표 「참조」 칩의 이름 그대로: 괴담톡의 다섯째는 「인물 로어북」) */
export const refChipLabels = (f: FnFeature): string[] => REF_CHIP_KEYS.map((k) => advItem(f, k)?.label ?? k);

/** 기능 표 (넘길 내용) + 양 표 (넘길 양). foot = 격자 아래 설명(helpBox) */
export function fnGrids(f: FnFeature, state: State, foot: { refs: string; amount: string }, busy = false): string {
  const fns = REF_FNS[f];
  const labels = fns.map((x) => x.label);
  const refs: CkBand = {
    title: '넘길 내용', groups: [{ name: '', opts: refChipLabels(f), kind: 'check' }],
    marks: fns.map(({ key }) => REF_CHIP_KEYS.map((c) => fnChipOn(state, f, key, c))),
    acts: fns.map(({ key }) => REF_CHIP_KEYS.map((c) => `${f}:${fnSetKey(key, c)}=${fnChipOn(state, f, key, c) ? '0' : '1'}`)),
    foot: foot.refs,
  };
  const T = FN_AMOUNTS.turns;
  const B = FN_AMOUNTS.budget;
  const amount: CkBand = {
    title: '넘길 양', groups: [
      { name: T.label, opts: [T.unit], kind: 'num' },
      { name: '지난 기록', opts: ['개'], kind: 'num' },
      { name: B.label, opts: [B.unit], kind: 'num' },
    ],
    marks: fns.map(({ key }) => {
      const h = fnHistoryRange(f, key);
      return [num(fnNum(state, f, key, 'turns'), T.min, T.max), num(fnHistory(state, f, key), h.min, h.max), num(fnNum(state, f, key, 'budget'), B.min, B.max)];
    }),
    acts: fns.map(({ key }) => [`${f}:${fnSetKey(key, 'turns')}`, `${f}:${fnHistorySetKey(f, key)}`, `${f}:${fnSetKey(key, 'budget')}`]),
    foot: foot.amount,
  };
  return ckWide([refs], labels, busy, ADV_ACTS) + sameStep(ckWide([amount], labels, busy, ADV_ACTS));
}
