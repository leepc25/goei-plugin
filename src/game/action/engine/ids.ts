// 몸/공격 번호는 모듈별 시작값을 두지 않는다. 새 World·층에서도 살아 있는 참조와 겹치지 않는다.
let bodySequence = 1;
let attackSequence = 1;
export const newBodyId = () => bodySequence++;
/** 외부 저장에서 몸을 복원할 때 기존 번호보다 뒤에서 발급한다. */
export function bumpBodyIds(last: number) {
  if (Number.isSafeInteger(last) && last >= 0) bodySequence = Math.max(bodySequence, last + 1);
}
/** 한 동작의 다단 공격은 필요한 개수만큼 연속 번호를 예약한다. */
export function newAttackId(count = 1): number {
  const id = attackSequence;
  attackSequence += Math.max(1, count);
  return id;
}
