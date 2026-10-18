// 자동 전송이 막혀 아직 안 보낸 임무 요청: 채팅 속 기록 카드에 「전송을 눌러 주세요」와 취소 버튼.
// 취소는 그 메시지를 지운다. 이미 보내져 응답을 만드는 중이면 지우지 않는다 (요청 도중 채팅을 저장하면 응답이 사라질 수 있다).
import { hasSceneCard, isSceneUnsent, setSceneUnsent } from '../core/dispatch';
import type { Chat } from '../core/types';
import { body } from './overlay';
import { updateChat } from './risu';
import { isWaiting } from './waiting';

/** 방금 놓은 마지막 기록 카드를 「아직 안 보냄」으로 */
export async function markUnsent(charIndex: number, chatIndex: number): Promise<void> {
  await updateChat(charIndex, chatIndex, (chat) => {
    const list = chat.message ?? [];
    const last = list[list.length - 1];
    if (!last || last.role !== 'user' || !hasSceneCard(last.data)) return null;
    list[list.length - 1] = { ...last, data: setSceneUnsent(last.data, true) };
    return chat;
  });
}

/** 응답이 붙은 뒤: 남은 「아직 안 보냄」 표시를 끈다. 바꿀 게 없으면 null */
export function clearUnsent(chat: Chat): Chat | null {
  const list = chat.message ?? [];
  if (!list.some((m) => typeof m.data === 'string' && isSceneUnsent(m.data))) return null;
  chat.message = list.map((m) => (typeof m.data === 'string' && isSceneUnsent(m.data) ? { ...m, data: setSceneUnsent(m.data, false) } : m));
  return chat;
}

let busy = false;
/** 안 보낸 카드를 그린 적이 있을 때만 클릭마다 버튼을 찾는다 (다른 봇·평소에는 아무 일도 안 함) */
let shown = false;
let listening = false;

/** 채팅에 안 보낸 카드를 그릴 때 (body.ts display). 클릭 리스너는 그때 한 번 건다 */
export function unsentShown(): void {
  shown = true;
  if (!listening) void listen();
}

// Risu SafeElement 리스너는 건 요소 안의 이벤트만 받는다 (2026-10 #1610). 채팅 메시지 클릭까지 받으려고 body에 건다
async function listen(): Promise<void> {
  listening = true;
  try {
    const root = await body();
    if (!root) return void (listening = false);
    await root.body.addEventListener('click', ((ev: { clientX?: number; clientY?: number }) => void onClick(root.doc, ev.clientX ?? -1, ev.clientY ?? -1)) as (e: unknown) => void, { passive: true });
  } catch {
    listening = false;
  }
}

async function onClick(doc: NonNullable<Awaited<ReturnType<typeof body>>>['doc'], x: number, y: number): Promise<void> {
  if (!shown || busy) return;
  const list = await risuai.unwarpSafeArray(await doc.querySelectorAll('[data-goei-cancel]')).catch(() => []);
  if (!list.length) return void (shown = false);
  let hit = false;
  for (const el of list) {
    const r = await el.getBoundingClientRect().catch(() => null);
    if (r && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height) hit = true;
  }
  if (!hit || isWaiting()) return;
  busy = true;
  try {
    const charIndex = await risuai.getCurrentCharacterIndex();
    const chatIndex = await risuai.getCurrentChatIndex();
    await updateChat(charIndex, chatIndex, (chat) => {
      const msgs = chat.message ?? [];
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== 'user' || typeof last.data !== 'string' || !isSceneUnsent(last.data)) return null;
      chat.message = msgs.slice(0, -1);
      return chat;
    });
  } catch (error) {
    console.log(`[goei] 요청 취소 실패: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    busy = false;
  }
}
