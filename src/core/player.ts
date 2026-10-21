// 캐릭터로 플레이 (2026-10-21): 페르소나 대신 명부 요원 한 명을 유저가 연기한다.
// 채팅 변수 $st_player = 요원 코드(P001). 새 채팅의 시작 화면에서만 고른다.
// 요원 로어북은 3인칭이고 {{user}}를 쓰지 않아서, 내용은 그대로 두고 「유저가 연기하는 주인공」 틀만 씌운다.
import { evaluate, type CbsEnv } from './cbs';
import { stripDecorators } from './lore';
import type { LoreEntry, ScriptState } from './types';
import { readDirectory, type AgentRow } from './world/directory';

export const PLAYER_KEY = '$st_player';

export const playerId = (state: ScriptState | Record<string, unknown> | undefined): string => {
  const v = String(state?.[PLAYER_KEY] ?? '').trim();
  return /^P\d{3,}$/.test(v) ? v : '';
};

/** 이 채팅에서 유저가 연기하는 요원 (없으면 undefined) */
export function playerAgent(lore: LoreEntry[] | undefined, state: ScriptState | Record<string, unknown> | undefined): AgentRow | undefined {
  const id = playerId(state);
  return id ? readDirectory(lore).agents.find((a) => a.id === id) : undefined;
}

/** 시작 화면에서 고를 수 있는 요원: 그 소속 명단에 보이는 사람 */
export function playableAgents(lore: LoreEntry[] | undefined, faction: string): AgentRow[] {
  return readDirectory(lore).agents.filter((a) => /^P\d{3,}$/.test(a.id) && a.name && a.rosterFor.includes(faction));
}

export const PLAYER_HEAD = '## Player Character';

/** 요청에 넣을 주인공 글: 틀 지침 + 그 요원 로어북 (CBS를 풀고 장식 줄을 뗀다) */
export function playerBlock(lore: LoreEntry[] | undefined, agent: AgentRow, env: CbsEnv): string {
  const entry = (lore ?? []).find((e) => e.mode !== 'folder' && String(e.comment ?? '') === agent.lore);
  const body = entry ? stripDecorators(evaluate(String(entry.content ?? ''), env)).trim() : '';
  const who = agent.english ? `${agent.name} (${agent.english})` : agent.name;
  return [
    PLAYER_HEAD,
    `The user plays ${who}${agent.rank ? `, ${agent.rank}` : ''}. This character is the protagonist (the user-controlled character).`,
    '- Never write this character\'s dialogue, actions, thoughts or decisions. Narrate only the world and other characters\' reactions.',
    '- This character already knows their own background, abilities, relationships and secrets, including anything the lore marks as hidden. Colleagues, superiors and acquaintances already know them and treat them according to the lore below.',
    '- Other characters address and refer to this character by this name.',
    body,
  ].filter(Boolean).join('\n');
}

/** 괴담넷·괴담톡·위키 참고 자료: 캐릭터로 플레이면 페르소나 설명 대신 주인공 글 */
export function playerSource<T extends { char: { name?: string; globalLore?: LoreEntry[] }; chat: { scriptstate?: ScriptState }; persona?: string }>(src: T): T {
  const agent = playerAgent(src.char.globalLore, src.chat.scriptstate);
  if (!agent) return src;
  return { ...src, persona: playerBlock(src.char.globalLore, agent, { vars: src.chat.scriptstate ?? {}, char: src.char.name, user: '주인공' }) };
}

/**
 * 요청 직전: 페르소나 설명 자리를 주인공 글로 바꾼다. 페르소나가 비었거나 요청에서 못 찾으면 첫 시스템 메시지 뒤에 넣는다.
 * 페르소나 이름(사용자가 요원 이름으로 바꾸지 않았을 때)은 요원 이름으로 바꾼다
 */
export function applyPlayer<M extends { role?: unknown; content?: unknown }>(messages: M[], block: string, persona: string, userName: string, agentName: string): M[] {
  if (!block) return messages;
  let out = messages;
  const p = persona.trim();
  let placed = false;
  if (p.length >= 8) {
    out = out.map((m) => {
      if (typeof m?.content !== 'string' || !m.content.includes(p)) return m;
      const content = placed ? m.content.split(p).join('') : m.content.replace(p, () => block);
      placed = true;
      return { ...m, content };
    });
  }
  if (!placed && !out.some((m) => typeof m?.content === 'string' && m.content.includes(PLAYER_HEAD))) {
    const at = out.findIndex((m) => m?.role === 'system');
    const add = { role: 'system', content: block } as M;
    out = at < 0 ? [add, ...out] : [...out.slice(0, at + 1), add, ...out.slice(at + 1)];
  }
  const n = userName.trim();
  if (n && agentName && n !== agentName && n.length >= 2 && !/^(?:user|나|유저)$/i.test(n)) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 영문 이름은 낱말 경계로만 (Kim → Kimchi 안 바꿈)
    const re = new RegExp(/^[A-Za-z]/.test(n) ? `\\b${esc}\\b` : esc, 'g');
    out = out.map((m) => (typeof m?.content === 'string' && re.test(m.content) ? { ...m, content: m.content.replace(re, agentName) } : m));
  }
  return out;
}
