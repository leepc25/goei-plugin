// crypto.randomUUID 는 보안 문맥(https·localhost)에서만 있다. http 로 띄운 자체 서버 Risu 등에서는 undefined 라
// 필드 장부·방문 기록·필드 거래가 조용히 버려졌다 (QC 2026-10-28). ui/phone.ts·ui/field.ts 와 같은 대체 id 를 쓴다
export const uid = (): string => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);
