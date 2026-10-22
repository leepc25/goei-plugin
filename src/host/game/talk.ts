// 게임 NPC 자유 대화의 플러그인 쪽 (다리 bridge.talk). 사용자가 게임 대화창에 글을 보낼 때만 불린다.
// 모델은 runModel(allowPlugins: true, 플러그인 제공 모델도 됨), 인물 시트는 지금 채팅 카드의 로어북을 이 채팅 변수로 풀어서 준다.
// 본편 채팅·로어북에는 아무것도 쓰지 않는다.
import type { GameTalk } from '../../game/bridge';
import { bookText, messageText } from '../../core/refs';
import { runModel } from '../llm';
import { loadContext } from '../risu';

export const gameTalk: GameTalk = {
  model: (messages, which) => runModel(messages, which === 'aux' ? 'aux' : 'main'),
  async lore(name) {
    const ctx = await loadContext().catch(() => null);
    if (!ctx) return null;
    return bookText({ char: ctx.char, chat: ctx.chat }, name) || null;
  },
  async recent(n) {
    const ctx = await loadContext().catch(() => null);
    if (!ctx) return [];
    const msgs = (ctx.chat.message ?? []).slice(-Math.max(1, Math.min(n, 4)));
    return msgs
      .map((m) => {
        const t = messageText(String((m as { data?: unknown }).data ?? '')).replace(/\s+/g, ' ').trim();
        if (!t) return '';
        return `${(m as { role?: string }).role === 'user' ? '주인공' : ctx.char.name ?? '봇'}: ${t.length > 300 ? `${t.slice(0, 300)}…` : t}`;
      })
      .filter(Boolean);
  },
};
