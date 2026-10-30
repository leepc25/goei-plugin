// 기본 능력치 힘·민·체·지·정(1~10, 조작 상태 합 25) → 전투 수치 (docs/설계_능력치_기술피해_안.md 3장, 10-30 키운 안)
// 인물별 값은 BASE_STATS(baseStats.gen.ts, docs/퍽/능력치_55명.json 에서 만듦). 없으면 전부 5(기준).
import { BASE_STATS } from './baseStats.gen';

export interface BaseStats { str: number; dex: number; con: number; int: number; wil: number }
export interface Derived {
  /** 최대 체력 */ hp: number;
  /** 근접(몸)·사격(총·투척)·이능 공격 배율 (1 = 100) */ power: number; aim: number; psi: number;
  /** 받는 피해 배율 */ taken: number;
  /** 이동 속도 배율 */ speed: number;
  /** 기술 쿨 배율 */ cd: number;
  /** 필살 충전 배율 */ sp: number;
  /** 내가 받는 상태 이상 지속 배율 */ statusDur: number;
  /** 괴이 정신 피해 배율 (괴이 체계가 생기면 씀) */ mind: number;
  /** 치명 확률·치명 피해 (모두 같음, 10-30) */ crit: number; critDmg: number;
}
export const NEUTRAL_BASE: BaseStats = { str: 5, dex: 5, con: 5, int: 5, wil: 5 };
export const CRIT = 0.05, CRIT_DMG = 2;

export function baseOf(name: string | undefined): BaseStats {
  return (name && BASE_STATS[name]) || NEUTRAL_BASE;
}
/** NPC·몹 한 명의 힘민체지정 (10-30 사용자): 합 25를 다섯 칸에 무작위로 나눈다. 칸마다 1부터 시작해 0이 되지 않는다(NPC는 한 칸 상한 없음).
 * 이름 있는 55명은 표(baseStats.gen.ts)를 쓴다. 더 세거나 약하게 하는 보정은 전부 퍽으로 한다 */
export function rollBase(rng: () => number, total = 25): BaseStats {
  const v = [1, 1, 1, 1, 1];
  for (let n = total - 5; n > 0; n--) v[Math.min(4, Math.floor(rng() * 5))]++;
  return { str: v[0], dex: v[1], con: v[2], int: v[3], wil: v[4] };
}
export function derive(b: BaseStats): Derived {
  return {
    hp: 500 + b.con * 100,
    power: 1 + (b.str - 5) * 0.08, aim: 1 + (b.dex - 5) * 0.08, psi: 1 + (b.int - 5) * 0.08,
    taken: 1 - (b.con - 5) * 0.02 - (b.wil - 5) * 0.02,
    speed: 1 + (b.dex - 5) * 0.03,
    cd: 1 - (b.int - 5) * 0.04,
    sp: 1 + (b.wil - 5) * 0.06,
    statusDur: 1 - (b.wil - 5) * 0.08,
    mind: 1 - (b.wil - 5) * 0.06,
    crit: CRIT, critDmg: CRIT_DMG,
  };
}
