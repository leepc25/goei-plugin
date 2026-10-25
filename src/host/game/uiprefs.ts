// 게임 안 설정(화면·소리·조작)을 이 채팅 변수 $hq_ui에 둔다 (2026-10-25 사용자: 메인 설정 → 필드에서도 고치고 새 채팅 기본값으로 저장).
// 게임을 연 채팅에만 쓴다 (도중에 다른 채팅을 골라도 옮겨 가지 않는다).
import type { GameUiPrefs } from '../../game/bridge';
import { loadContext, updateChat } from '../risu';

export const HQ_UI = '$hq_ui';

export function createUiPrefs(): GameUiPrefs {
  const opening = loadContext();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: string | null = null;
  const flush = async () => {
    timer = null;
    const text = pending;
    pending = null;
    const c = await opening;
    if (!c || text === null) return;
    await updateChat(c.charIndex, c.chatIndex, (chat) => (chat.scriptstate?.[HQ_UI] === text ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [HQ_UI]: text } }));
  };
  return {
    async load() {
      const c = await opening;
      const v = c?.chat.scriptstate?.[HQ_UI];
      return typeof v === 'string' && v ? v : null;
    },
    save(text) {
      // 밀대를 끄는 동안 여러 번 오니 모아서 한 번
      pending = text;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush().catch((e) => console.log(`[goei] 게임 설정을 저장하지 못했어요: ${String(e)}`)), 600);
    },
  };
}
