// 전화 (docs/필드_기능_설계.md 6-3): 통화 가능 조건을 코드가 판정한다.
export type Link = 'escape' | 'phone' | 'none';
export interface CallInput {
  /** 상대 본편 상태 */
  state?: string;
  /** 상대가 일과상 응답 가능한 시간대인가 (자리에 있거나 휴대폰을 가진 때) */
  available: boolean;
  inAnomaly: boolean;
  /** 괴이 안일 때 신호 (3-2) */
  link?: Link;
  inCombat?: boolean;
}
export function canCall(i: CallInput): { ok: boolean; reason?: string } {
  if (/사망|실종/.test(i.state ?? '')) return { ok: false, reason: '연결되지 않는다.' };
  if (/격리/.test(i.state ?? '')) return { ok: false, reason: '받을 수 없는 곳에 있다.' };
  if (i.inCombat) return { ok: false, reason: '지금은 받을 수 없는 상황이다.' };
  if (i.inAnomaly && i.link !== 'phone') return { ok: false, reason: '신호가 닿지 않는다.' };
  if (!i.available) return { ok: false, reason: '받지 않는다.' };
  return { ok: true };
}
