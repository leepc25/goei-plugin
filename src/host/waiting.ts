// 본편 응답을 기다리는 중인가: 요청이 나가면 켜고, 응답이 붙거나 너무 오래되면 끈다 (게임 연출에만 쓴다)
let on = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const subs = new Set<(w: boolean, late?: boolean) => void>();

/** 시간이 다 됐을 때 「아직 답을 만드는 중인가」를 묻는 함수 (host/usebox.ts 가 리수 화면을 보고 답한다). 없거나 못 물으면 끈다 */
let probe: (() => Promise<boolean>) | null = null;
export function setWaitingProbe(fn: (() => Promise<boolean>) | null): void {
  probe = fn;
}
/** 처음 기다리는 시간 · 아직 만드는 중이면 다시 물을 때까지의 시간 */
export const WAIT_MS = 180_000;
export const WAIT_AGAIN_MS = 30_000;

/** 시간이 다 됐다: 아직 만드는 중이면 더 기다리고(답이 3분보다 늦어도 기다림이 중간에 꺼지지 않게, 11-14 재검토), 아니면 늦게 끈다 */
async function expire(mine: ReturnType<typeof setTimeout> | undefined): Promise<void> {
  let busy = false;
  try {
    busy = !!probe && (await probe());
  } catch { /* 못 물으면 끈다 */ }
  // 묻는 사이 기다림이 바뀌었으면(답이 왔거나 새 요청) 손대지 않는다
  if (timer !== mine || !on) return;
  if (busy) {
    const t: ReturnType<typeof setTimeout> = setTimeout(() => void expire(t), WAIT_AGAIN_MS);
    timer = t;
    return;
  }
  setWaiting(false, true);
}

/** late: 응답 알림 없이 시간이 다 돼 꺼졌다 (요청 실패·중단으로 본다) */
export function setWaiting(w: boolean, late = false): void {
  clearTimeout(timer);
  timer = undefined;
  // 응답 알림을 놓쳐도 계속 켜져 있지 않게
  if (w) {
    const t: ReturnType<typeof setTimeout> = setTimeout(() => void expire(t), WAIT_MS);
    timer = t;
  }
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
