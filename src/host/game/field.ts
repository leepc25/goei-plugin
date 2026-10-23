// 필드 장부 기록 (플러그인 쪽). 사건을 게임을 연 채팅에만 쌓는다: 채팅이 바뀌면 기록하지 않는다.
import type { GameField, GameFieldEvent } from '../../game/bridge';
import { anchorOf } from '../../core/visit';
import { withFieldEvent, type FieldKind } from '../../core/field';
import { loadContext, updateChat } from '../risu';

const KINDS: FieldKind[] = ['move', 'act', 'hurt', 'down', 'kill', 'flee', 'provoke', 'gift', 'trade', 'quest', 'follow', 'unfollow', 'enter_anomaly', 'exit_anomaly', 'enter_site', 'detected', 'appoint', 'call'];

export function createField(): GameField {
  const opening = loadContext();
  let chain: Promise<unknown> = Promise.resolve();
  return {
    record(ev: GameFieldEvent) {
      // 사건 순서가 뒤바뀌지 않게 하나씩 쌓는다
      const run = async () => {
        const origin = await opening;
        if (!origin) return;
        const c = await loadContext();
        if (!c || c.charIndex !== origin.charIndex || c.chatIndex !== origin.chatIndex || c.char.chaId !== origin.char.chaId || c.chat.id !== origin.chat.id) return;
        if (!KINDS.includes(ev.kind as FieldKind)) return;
        const event = { id: crypto.randomUUID(), at: Date.now(), anchor: anchorOf(c.chat), kind: ev.kind as FieldKind, text: ev.text, scene: ev.scene, who: ev.who, weight: ev.weight, fact: ev.fact };
        await updateChat(c.charIndex, c.chatIndex, (chat) => (chat.id === c.chat.id ? withFieldEvent(chat, event) : null));
      };
      const next = chain.then(run, run);
      chain = next.catch(() => {});
      return next;
    },
  };
}
