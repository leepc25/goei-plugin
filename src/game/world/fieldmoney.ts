// 필드 돈 정산 (10-31 사용자, F13): 필드 안에서 오간 돈을 가계부 한 줄로. 구입·판매·주움·뜯김·그 밖 수입으로 묶어 합계
export interface PurseLine { amount: number; memo: string }

export function settleLine(list: PurseLine[]): { net: number; memo: string } | null {
  if (!list.length) return null;
  const sum = new Map<string, number>();
  for (const p of list) {
    const k = /뜯김$/.test(p.memo) ? '뜯김' : /떨어뜨린 돈|되찾은 돈/.test(p.memo) ? '주움' : / 팜$/.test(p.memo) ? '판매' : p.amount < 0 ? '구입' : '수입';
    sum.set(k, (sum.get(k) ?? 0) + p.amount);
  }
  const net = list.reduce((n, p) => n + p.amount, 0);
  return { net, memo: `필드 정산: ${[...sum].map(([k, v]) => `${k} ${v < 0 ? '−' : '+'}${Math.abs(v).toLocaleString('en-US')}`).join(' · ')}` };
}
