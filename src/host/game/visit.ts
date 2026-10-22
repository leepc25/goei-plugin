import type { GameVisit, VisitState } from '../../game/bridge';
import { cardSnapshot } from '../../core/gamelink';
import { visitRecord, visitRoom, withVisitTurn, VISIT_LORE } from '../../core/visit';
import { bookText, messageText } from '../../core/refs';
import { readDirectory } from '../../core/world';
import { loadContext, updateChat, type ChatContext } from '../risu';
import { runModel } from '../llm';
import { isWaiting } from '../waiting';

/** One instance per mounted visit; never retarget to a newly selected chat. */
export function createVisit(): GameVisit {
  const opening = loadContext();
  let origin: ChatContext | null = null;
  let busy = false;
  async function context() {
    origin ??= await opening;
    const c = await loadContext();
    if (!c) throw new Error('본부에 연결할 채팅을 열어 주세요.');
    if (!origin) throw new Error('본부를 닫고 채팅에서 다시 열어 주세요.');
    if (c.charIndex !== origin.charIndex || c.chatIndex !== origin.chatIndex || c.char.chaId !== origin.char.chaId || c.chat.id !== origin.chat.id) throw new Error('채팅이 변경됐어요. 본부를 닫고 다시 열어 주세요.');
    return c;
  }
  function stateOf(c: ChatContext): VisitState {
    return { agents: cardSnapshot(c.char, c.chat).agents.map(a => ({ ...a, room: visitRoom(a) })), turns: visitRecord(c.chat).turns };
  }
  return {
    async state() { return stateOf(await context()); },
    async send(agentId, input, which) {
      if (busy || isWaiting()) throw new Error('진행 중인 응답이 끝난 뒤 보내 주세요.');
      const text = input.trim();
      if (!text || text.length > 2000) throw new Error('대화는 1~2000자로 입력해 주세요.');
      busy = true;
      try {
        const c = await context();
        const a = cardSnapshot(c.char, c.chat).agents.find(a => a.id === agentId);
        if (!a || !visitRoom(a)) throw new Error('지금 본부에서 만날 수 없는 요원이에요.');
        const row = readDirectory(c.char.globalLore ?? []).agents.find(r => r.id === agentId);
        const lore = bookText({ char: c.char, chat: c.chat }, row?.lore || a.name);
        if (!lore) throw new Error('요원 설정을 찾지 못해 대화를 시작할 수 없어요.');
        const persona = String(await risuai.parseRisuChat('{{persona}}'));
        const user = String(await risuai.parseRisuChat('{{user}}'));
        await context();
        const recent = (c.chat.message ?? []).slice(-6).map(m => `${m.role}: ${messageText(m.data).slice(0, 2000)}`).join('\n');
        const memory = (Array.isArray(c.chat.localLore) ? c.chat.localLore as { comment?: string; content?: string }[] : []).find(l => l.comment === VISIT_LORE)?.content ?? '';
        const history = visitRecord(c.chat).turns.filter(t => t.agentId === agentId).slice(-8);
        const reply = await runModel([
          { role: 'system', content: `너는 채팅 세계 속 관리국 본부의 ${a.name}이다. 유저는 요원을 조종하는 것이 아니라 자신의 페르소나로 방문했다. 아래 설정과 실제 대화에 근거해 한국어로 자연스럽게 대답하라. 유저의 행동과 대사를 대신 결정하지 마라. 세계 상태 변경 태그나 게임 보상을 출력하지 마라.\n요원 설정:\n${lore.slice(0, 18000)}\n현재 상태: ${a.state}\n상황: ${a.situation}\n방문자: ${user}\n페르소나: ${persona.slice(0, 6000)}\n최근 본편 대화:\n${recent}\n이전 본부 대화 발췌:\n${memory}` },
          ...history.flatMap(t => [{ role: 'user' as const, content: t.user }, { role: 'assistant' as const, content: t.reply }]),
          { role: 'user', content: text },
        ], which === 'aux' ? 'aux' : 'main');
        // If the active chat changes during inference, save only to the captured origin.
        const turn = { id: crypto.randomUUID(), at: Date.now(), agentId, name: a.name, user: text, reply };
        const char = await risuai.getCharacterFromIndex(c.charIndex) as { chaId?: string } | null;
        if (!char || char.chaId !== c.char.chaId) throw new Error('원래 카드가 바뀌어 대화를 저장하지 못했어요.');
        const saved = await updateChat(c.charIndex, c.chatIndex, chat => {
          if (chat.id !== c.chat.id) throw new Error('원래 채팅이 바뀌어 대화를 저장하지 못했어요.');
          return withVisitTurn(chat, turn);
        });
        if (!saved) throw new Error('대화 기록을 저장하지 못했어요.');
        return stateOf({ ...c, chat: saved });
      } finally { busy = false; }
    },
  };
}
