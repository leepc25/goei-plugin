// 본편 응답을 기다리는 중인가: 요청이 나가면 켜고, 응답이 붙거나 너무 오래되면 끈다 (게임 연출에만 쓴다)
let on = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<(w: boolean, late?: boolean) => void>();

/** late: 응답 알림 없이 시간이 다 돼 꺼졌다 (요청 실패·중단으로 본다) */
export function setWaiting(w: boolean, late = false): void {
  clearTimeout(timer);
  // 응답 알림을 놓쳐도 계속 켜져 있지 않게
  if (w) timer = setTimeout(() => setWaiting(false, true), 180_000);
  if (w === on) return;
  on = w;
  for (const f of subs) f(w, late);
}

export const isWaiting = () => on;

export function onWaiting(cb: (w: boolean, late?: boolean) => void): () => void {
  subs.add(cb);
  return () => void subs.delete(cb);
}
