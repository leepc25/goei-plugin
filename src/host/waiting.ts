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

/** 응답을 기다리는 중에 누른 「취소」: 한 번 누르면 막고, 5초 안에 한 번 더 누르면 통과 (전수검사 11-13, 사용자 승인).
 *  리수는 요청 실패·중지를 알려 주지 않아, 실패한 뒤 3분 동안 취소가 안 눌렸다. 기다리는 중이 아니면 늘 통과 */
let askedAt = 0;
export function passWaiting(now = Date.now()): boolean {
  if (!on) return true;
  if (now - askedAt <= 5000) {
    askedAt = 0;
    return true;
  }
  askedAt = now;
  return false;
}

export function onWaiting(cb: (w: boolean, late?: boolean) => void): () => void {
  subs.add(cb);
  return () => void subs.delete(cb);
}
