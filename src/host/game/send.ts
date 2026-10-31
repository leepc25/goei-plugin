// 본편 응답을 보내기 직전 (10-31 사용자: 필드 한 번 = 막간 한 번). 열린 게임 창에 「필드를 마감하라」고 알리고,
// 정산(가계부 한 줄)·싸움 마감 기록이 다 쌓일 때까지 기다린 뒤 요청에 막간을 끼운다.
const hooks = new Set<() => Promise<void>>();

/** 게임이 등록: 응답을 보내기 직전에 부른다. 등록 해제 함수를 돌려준다 */
export function onBeforeSend(cb: () => Promise<void>): () => void {
  hooks.add(cb);
  return () => void hooks.delete(cb);
}

/** 본편 요청 직전: 열린 게임의 마감을 기다린다 (오래 걸리면 ms 뒤 그냥 진행) */
export async function flushGamesBeforeSend(ms = 3000): Promise<void> {
  if (!hooks.size) return;
  const all = Promise.all([...hooks].map((cb) => cb().catch(() => {})));
  await Promise.race([all, new Promise((r) => setTimeout(r, ms))]);
}
