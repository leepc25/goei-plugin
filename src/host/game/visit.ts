import { uid } from './uid';
import type { GameVisit, VisitState } from '../../game/bridge';
import { cardSnapshot } from '../../core/gamelink';
import { anchorOf, visitRecord, visitRoom, withoutOldLore, withVisitTurn, type VisitTurn } from '../../core/visit';
import { agentLore, parseVisitGroup, visitPrompt, type VisitAgent, type VisitLine } from '../../core/visitPrompt';
import { advValue, budgetFor } from '../../core/advanced';
import { fitPrompt } from '../../core/budget';
import type { RefSource } from '../../core/refs';
import { readDirectory } from '../../core/world';
import { lastStatusFields } from '../../core/world/tags';
import { factionNames, parseCatalog } from '../../core/world/catalog';
import { playerAgent, playerSource } from '../../core/player';
import { loadContext, updateChat, type ChatContext } from '../risu';
import { runModel } from '../llm';
import { readPersona } from '../user';
import { isWaiting } from '../waiting';

/** 마지막 본부 대화 요청과 응답 (설정의 「마지막 요청 보기」) */
export let lastExchange: { at: number; model: 'main' | 'aux'; messages: { role: string; content: string }[]; raw: string; reply: string } | null = null;

function factionNamesOf(c: ChatContext): Record<string, string> {
  try {
    return factionNames(parseCatalog(c.char.globalLore), String(c.chat.scriptstate?.['$st_faction'] ?? ''));
  } catch {
    return {};
  }
}

/** 본편이 멈춘 자리: 마지막 상태창의 위치·목표·시각, 캐릭터로 플레이면 그 요원 상태 */
function sceneOf(c: ChatContext, playerId?: string) {
  const st = lastStatusFields(((c.chat.message ?? []) as { role?: string; data?: string }[]).filter(m => m.role === 'char').slice(-6).map(m => String(m.data ?? '')));
  const me = playerId ? cardSnapshot(c.char, c.chat).agents.find(a => a.id === playerId) : undefined;
  return { place: st?.place, target: st?.target, time: st ? [st.date, st.time].filter(Boolean).join(' ') : undefined, protagonistStatus: me ? [me.state, me.situation].filter(Boolean).join(' · ') : undefined };
}

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
  // 캐릭터로 플레이 중이면 그 요원이 방문자다 (2026-10-22 사용자: 쟈알디로 시작했는데 {{user}}로 나옴). 본인은 만날 상대 목록에서 뺀다
  function stateOf(c: ChatContext): VisitState {
    const me = playerAgent(c.char.globalLore, c.chat.scriptstate);
    return {
      visitor: { agentId: me?.id ?? '', name: me?.name ?? '' },
      agents: cardSnapshot(c.char, c.chat).agents.filter(a => a.id !== me?.id).map(a => ({ ...a, room: visitRoom(a) })),
      turns: visitRecord(c.chat).turns,
    };
  }
  return {
    async state() {
      const c = await context();
      // 옛 판(0.16.42~43)의 로어북 기록 항목은 막간 끼우기로 바뀌어 지운다
      const clean = withoutOldLore(c.chat);
      if (clean !== c.chat) await updateChat(c.charIndex, c.chatIndex, chat => chat.id === c.chat.id ? withoutOldLore(chat) : null).catch(() => null);
      return stateOf(c);
    },
    async send(agentId, input, which, nearby = []) {
      if (busy || isWaiting()) throw new Error('진행 중인 응답이 끝난 뒤 보내 주세요.');
      // *…*로 감싸면 말이 아니라 행동 (2026-10-23 사용자: 행동 지시를 대사로 받아들임)
      const acted = /^\*([^*]+)\*?$/.exec(input.trim());
      const act = !!acted;
      const text = (acted ? acted[1] : input).trim();
      if (!text || text.length > 2000) throw new Error('대화는 1~2000자로 입력해 주세요.');
      busy = true;
      try {
        const c = await context();
        const me = playerAgent(c.char.globalLore, c.chat.scriptstate);
        const a = agentId === me?.id ? undefined : cardSnapshot(c.char, c.chat).agents.find(a => a.id === agentId);
        if (!a || !visitRoom(a)) throw new Error('지금 본부에서 만날 수 없는 요원이에요.');
        const row = readDirectory(c.char.globalLore ?? []).agents.find(r => r.id === agentId);
        // 본편과 같은 방식: 캐릭터로 플레이면 playerSource가 페르소나 자리에 그 요원의 주인공 글(playerBlock)을 넣는다
        const src = playerSource({ char: c.char as RefSource['char'], chat: c.chat, persona: me ? '' : await readPersona() });
        const lore = agentLore(src, row?.lore || a.name);
        if (!lore) throw new Error('요원 설정을 찾지 못해 대화를 시작할 수 없어요.');
        const visitorName = me?.name ?? (String(await risuai.parseRisuChat('{{user}}') ?? '').replace(/\{\{[^}]*\}\}/g, '').trim() || '방문자');
        await context();
        // 이번 막간 = 지금 마지막 메시지 뒤에서 나눈 말 (본편이 한 턴 진행되면 새 막간)
        const anchor = anchorOf(c.chat);
        const now = visitRecord(c.chat).turns.filter(t => (t.anchor ?? '') === anchor);
        const lines = (ts: VisitTurn[]): VisitLine[] => ts.flatMap(t => [{ speaker: t.visitor || visitorName, text: t.user, ...(t.act ? { action: true } : {}) }, { speaker: t.name, text: t.reply }, ...(t.extra ?? []).map(e => ({ speaker: e.name, text: e.line }))]);
        // 이 요원이 말했거나 끼어든 대화는 이 요원과의 대화로 본다
        const withHim = (t: VisitTurn) => t.agentId === agentId || !!t.extra?.some(e => e.agentId === agentId);
        const others = [...new Set(now.filter(t => !withHim(t)).map(t => t.name))];
        // 끼어들 수 있는 요원: 게임이 알려 준 가까운 요원 중 같은 방에서 만날 수 있고 로어북이 있는 사람 (최대 3)
        const room = visitRoom(a);
        const bystanders: VisitAgent[] = [];
        for (const id of [...new Set(nearby)].slice(0, 6)) {
          const b = id !== agentId && id !== me?.id ? cardSnapshot(c.char, c.chat).agents.find(x => x.id === id) : undefined;
          if (!b || visitRoom(b) !== room) continue;
          const r = readDirectory(c.char.globalLore ?? []).agents.find(x => x.id === id);
          const bl = agentLore(src, r?.lore || b.name);
          if (bl) bystanders.push({ id, name: b.name, rank: r?.rank, state: b.state, situation: b.situation, room: room ?? '', lore: bl });
          if (bystanders.length >= 3) break;
        }
        const ss = c.chat.scriptstate;
        const prompt = fitPrompt(budgetFor(ss, 'hq'), () => visitPrompt(src, {
          agent: { id: a.id, name: a.name, rank: row?.rank, state: a.state, situation: a.situation, room: visitRoom(a) ?? '', lore },
          visitor: visitorName,
          conversation: lines(now.filter(withHim)),
          elsewhere: others.map(n => ({ agent: n, lines: lines(now.filter(t => t.name === n && !withHim(t))) })),
          bystanders,
          said: text,
          act,
          scene: sceneOf(c, me?.id),
          skipBooks: me ? [me.lore] : [],
        }, factionNamesOf(c)));
        const model = advValue(ss, 'hq', 'model') === 'main' ? 'main' : 'aux';
        void which;
        const raw = await runModel(prompt.messages, model);
        const got = parseVisitGroup(raw, a.name, prompt.bystanders, prompt.limit);
        const reply = got.line;
        const extra = got.extra.map(e => ({ agentId: bystanders.find(b => b.name === e.speaker)!.id, name: e.speaker, line: e.line }));
        lastExchange = { at: Date.now(), model, messages: prompt.messages, raw, reply: [reply, ...extra.map(e => `${e.name}: ${e.line}`)].join('\n') };
        // If the active chat changes during inference, save only to the captured origin.
        const turn: VisitTurn = { id: uid(), at: Date.now(), agentId, name: a.name, user: text, reply, anchor, room: visitRoom(a) ?? undefined, ...(me ? { visitor: me.name } : {}), ...(act ? { act } : {}), ...(extra.length ? { extra } : {}) };
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
