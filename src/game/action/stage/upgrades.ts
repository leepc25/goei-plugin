// 출동 안 강화 선택 (기본기획서 15.2). 곁가지 방 배낭·수호자 처치·싸움 세 판마다 셋 중 하나.
// 출동이 끝나면(귀환·철수·후송) 전부 사라진다. 같은 계열 셋이면 계열 완성 효과.
// 요원 기술 변형(돌진 뒤 추가타 등)은 엔진 동작이 필요해 아직 없다: 지금은 공용 강화만.
import { mix, rng, shuffle } from './rng';

export type UpgradeSet = 'body' | 'fist' | 'rule';
export interface Upgrade {
  id: string;
  set: UpgradeSet;
  label: string;
  text: string;
}

export const UPGRADES: Upgrade[] = [
  { id: 'hp', set: 'body', label: '단단한 몸', text: '최대 체력 +30, 바로 30 회복' },
  { id: 'blood', set: 'body', label: '피의 맛', text: '적을 쓰러뜨릴 때마다 체력 +5' },
  { id: 'ward', set: 'body', label: '부적 두 장', text: '다음 피격 두 번을 막는다' },
  { id: 'power', set: 'fist', label: '무거운 주먹', text: '타격 피해 +20%' },
  { id: 'spirit', set: 'fist', label: '기합', text: '때릴 때마다 필살 게이지가 더 찬다' },
  { id: 'rush', set: 'fist', label: '몰아치기', text: '적을 쓰러뜨린 뒤 3초 동안 피해 +30%' },
  { id: 'quiet', set: 'rule', label: '조용한 발', text: '내는 소리 절반 (침묵의 층)' },
  { id: 'battery', set: 'rule', label: '여분 배터리', text: '빛이 사그라드는 속도 절반 (어둠의 층)' },
  { id: 'master', set: 'rule', label: '만능 열쇠', text: '잠긴 방화셔터 하나를 열쇠 없이 연다' },
  { id: 'scout', set: 'rule', label: '선배의 지도', text: '정비 구역 다락방·열쇠 자리가 지도에 보인다' },
  { id: 'rest', set: 'rule', label: '깊은 잠', text: '다락방 매트에서 한 번 더 쉴 수 있다' },
];
export const UPGRADE_BY_ID: Record<string, Upgrade> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));
export const SET_LABEL: Record<UpgradeSet, string> = { body: '몸', fist: '주먹', rule: '규칙' };
export const SET_BONUS: Record<UpgradeSet, string> = { body: '계열 완성 · 몸: 최대 체력 +50', fist: '계열 완성 · 주먹: 피해 +15%', rule: '계열 완성 · 규칙: 승강기 총애 +1' };

/** 아직 안 고른 것 중 셋 (같은 씨앗·같은 차례면 같은 셋) */
export function upgradeChoices(seed: number, n: number, taken: string[]): Upgrade[] {
  const pool = UPGRADES.filter((u) => !taken.includes(u.id));
  return shuffle(rng(mix(seed, n, 4141)), [...pool]).slice(0, 3);
}

/** 계열마다 고른 수 */
export function setCounts(taken: string[]): Record<UpgradeSet, number> {
  const c: Record<UpgradeSet, number> = { body: 0, fist: 0, rule: 0 };
  for (const id of taken) if (UPGRADE_BY_ID[id]) c[UPGRADE_BY_ID[id].set]++;
  return c;
}

/** 타격 배율 (몰아치기 제외) */
export function powerOf(taken: string[]): number {
  return 1 + (taken.includes('power') ? 0.2 : 0) + (setCounts(taken).fist >= 3 ? 0.15 : 0);
}
