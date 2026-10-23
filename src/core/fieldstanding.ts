// 거점 평판과 거점 반응 (docs/필드_기능_설계.md 13장)
export type Standing = '호의' | '중립' | '경계' | '적대' | '수배';
export const ORDER: Standing[] = ['호의', '중립', '경계', '적대', '수배'];
export type Behavior = 'ignore' | 'watch' | 'warn' | 'expel' | 'attack';

/** 평판을 사건으로 움직인다 (양수 = 나빠짐) */
export function shift(s: Standing, steps: number): Standing {
  const i = Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(s) + steps));
  return ORDER[i];
}
export type Role = 'civilian' | 'security' | 'staff';
/** 방문자 소속이 거점 소속과 다르면 처음부터 방문자로 보인다 (변장·잠입은 만들지 않는다) */
export function reaction(standing: Standing, role: Role, sameFaction: boolean): Behavior {
  if (sameFaction && standing !== '수배') return 'ignore';
  if (standing === '수배') return role === 'civilian' ? 'warn' : 'attack';
  if (standing === '적대') return role === 'security' ? 'expel' : 'warn';
  if (standing === '경계') return role === 'security' ? 'warn' : 'watch';
  return role === 'security' ? 'watch' : 'ignore';
}
export const detected = (standing: Standing, sameFaction: boolean) => !sameFaction && ORDER.indexOf(standing) >= ORDER.indexOf('경계');
