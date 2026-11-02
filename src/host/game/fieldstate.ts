// 필드 가방·가게 재고 (src/game/world/fieldShop.ts FieldState)를 이 채팅 변수 $fd_state에 둔다 (세계 사실은 채팅 귀속, 설계 1장).
// 게임을 연 채팅에만 쓴다 (도중에 다른 채팅을 골라도 옮겨 가지 않는다, wallet.ts와 같음).
import type { GameFieldState } from '../../game/bridge';
import { loadContext, updateChat } from '../risu';

export const FD_STATE = '$fd_state';

export function createFieldState(): GameFieldState {
  const opening = loadContext();
  let chain: Promise<unknown> = Promise.resolve();
  const same = async () => {
    const origin = await opening;
    const c = await loadContext();
    if (!origin || !c || c.charIndex !== origin.charIndex || c.chatIndex !== origin.chatIndex || c.char.chaId !== origin.char.chaId || c.chat.id !== origin.chat.id) return null;
    return c;
  };
  return {
    async load() {
      const c = await same().catch(() => null);
      const v = c?.chat.scriptstate?.[FD_STATE];
      return typeof v === 'string' && v ? v : null;
    },
    save(text) {
      const run = async () => {
        const c = await same();
        if (!c) return;
        await updateChat(c.charIndex, c.chatIndex, (chat) => (chat.id !== c.chat.id || chat.scriptstate?.[FD_STATE] === text ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [FD_STATE]: text } }));
      };
      const next = chain.then(run, run);
      chain = next.catch((e) => console.log(`[goei] 필드 가방을 저장하지 못했어요: ${String(e)}`));
      return next.catch(() => {});
    },
  };
}
