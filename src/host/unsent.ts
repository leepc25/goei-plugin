// 자동 전송이 막혀 아직 안 보낸 임무 요청·직접 입력: 채팅 속 메시지에 「전송 대기」와 취소 버튼.
// 취소는 그 메시지를 지운다. 이미 보내져 응답을 만드는 중이면 지우지 않는다 (요청 도중 채팅을 저장하면 응답이 사라질 수 있다).
import { isUnsent, setUnsent } from '../core/dispatch';
import type { Chat } from '../core/types';
import { armChatClick, elements, hit, onChatClick } from './chatclicks';
import { updateChat } from './risu';
import { isWaiting } from './waiting';

/** 방금 놓은 마지막 유저 메시지(기록 카드·직접 입력)를 「아직 안 보냄」으로 */
export async function markUnsent(charIndex: number, chatIndex: number): Promise<void> {
  await updateChat(charIndex, chatIndex, (chat) => {
    const list = chat.message ?? [];
    const last = list[list.length - 1];
    if (!last || last.role !== 'user' || typeof last.data !== 'string') return null;
    list[list.length - 1] = { ...last, data: setUnsent(last.data, true) };
    return chat;
  });
}

/** 응답이 붙은 뒤: 남은 「아직 안 보냄」 표시를 끈다. 바꿀 게 없으면 null */
export function clearUnsent(chat: Chat): Chat | null {
  const list = chat.message ?? [];
  if (!list.some((m) => typeof m.data === 'string' && isUnsent(m.data))) return null;
  chat.message = list.map((m) => (typeof m.data === 'string' && isUnsent(m.data) ? { ...m, data: setUnsent(m.data, false) } : m));
  return chat;
}

let busy = false;

onChatClick('unsent', async (_doc, x, y) => {
  if (busy) return false;
  const list = await elements(_doc, '[data-goei-cancel]');
  if (!list.length) return 'idle';
  let on = false;
  for (const el of list) if (await hit(el, x, y)) on = true;
  if (!on || isWaiting()) return false;
  busy = true;
  try {
    const charIndex = await risuai.getCurrentCharacterIndex();
    const chatIndex = await risuai.getCurrentChatIndex();
    await updateChat(charIndex, chatIndex, (chat) => {
      const msgs = chat.message ?? [];
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== 'user' || typeof last.data !== 'string' || !isUnsent(last.data)) return null;
      chat.message = msgs.slice(0, -1);
      return chat;
    });
  } catch (error) {
    console.log(`[goei] 요청 취소 실패: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    busy = false;
  }
  return true;
});

/** 채팅에 안 보낸 카드를 그릴 때 (body.ts display) */
export function unsentShown(): void {
  armChatClick('unsent');
}
