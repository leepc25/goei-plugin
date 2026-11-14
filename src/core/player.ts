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

/** 이름 뒤에 붙는 조사·서술격 (applyPlayer 이름 바꾸기). 겹쳐 붙을 수 있다 (「에게는」「씨는」「이에게도」) */
const HANGUL_JOSA = [
  '에게서', '한테서', '으로서', '으로써', '이에게', '이한테', '에게', '한테', '에서', '께서', '까지', '부터', '처럼', '보다', '마다', '조차', '마저', '밖에', '만큼', '같이', '하고',
  '로서', '로써', '으로', '이랑', '이나', '이든', '이가', '이는', '이를', '이도', '이의',
  '이라고', '이라는', '이라면', '이라도', '이라서', '라고', '라는', '라면', '라도', '라서',
  '이', '가', '은', '는', '을', '를', '의', '께', '와', '과', '랑', '도', '만', '에', '로', '나', '든', '네', '아', '야', '여',
].join('|');
/** 서술격 (이다·였다·입니다 꼴). 조사 뒤 맨 끝에만 온다 */
const HANGUL_COPULA = ['였[가-힣]{0,3}', '이었[가-힣]{0,3}', '입니[다까]', '이에요', '예요', '이다', '이며', '이고', '이지만', '이니까', '인데', '이야', '이냐', '이네', '이군', '이죠', '이지', '인', '일'].join('|');
/** 이름 바로 뒤에 올 수 있는 꼬리: (씨·님) + 조사 0~3개 + (서술격), 그 뒤는 한글이 아니어야 한다 (「지원팀」「지원이사」는 안 바뀜) */
const HANGUL_TAIL = `(?:씨|님)?(?:${HANGUL_JOSA}){0,3}(?:${HANGUL_COPULA})?(?![가-힣])`;

/** 요청에 넣을 주인공 글 = 그 요원 로어북 그대로 (CBS를 풀고 장식 줄을 뗀다).
 *  11-07 사용자: 페르소나 자리에 지침을 덧붙이지 말고 로어북만 넣을 것. 전에 붙였던 「대사·행동을 쓰지 마라, 서술만 하라」 네 줄이 인물 플레이 응답에서 대사를 없앴다. */
export function playerBlock(lore: LoreEntry[] | undefined, agent: AgentRow, env: CbsEnv): string {
  const entry = (lore ?? []).find((e) => e.mode !== 'folder' && String(e.comment ?? '') === agent.lore);
  return entry ? stripDecorators(evaluate(String(entry.content ?? ''), env)).trim() : '';
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
  if (!placed && !out.some((m) => typeof m?.content === 'string' && m.content.includes(block))) {
    const at = out.findIndex((m) => m?.role === 'system');
    const add = { role: 'system', content: block } as M;
    out = at < 0 ? [add, ...out] : [...out.slice(0, at + 1), add, ...out.slice(at + 1)];
  }
  const n = userName.trim();
  if (n && agentName && n !== agentName && n.length >= 2 && !/^(?:user|나|유저)$/i.test(n)) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 영문 이름은 낱말 경계로만 (Kim → Kimchi 안 바꿈)
    // 한글 이름도 앞이 한글이 아니고 뒤가 끝·비한글·조사·서술격(겹친 것 포함)일 때만 (「지원팀」「강지원」 안 바꿈). 넣은 주인공 글 안은 건드리지 않는다 (전수검사 11-13)
    const re = new RegExp(/^[A-Za-z]/.test(n) ? `\\b${esc}\\b` : `(?<![가-힣])${esc}(?=${HANGUL_TAIL})`, 'g');
    const swap = (text: string) => text.split(block).map((part) => part.replace(re, () => agentName)).join(block);
    out = out.map((m) => {
      if (typeof m?.content !== 'string') return m;
      const content = swap(m.content);
      return content === m.content ? m : { ...m, content };
    });
  }
  return out;
}

/**
 * 「주인공 이미지」를 끈 채 캐릭터로 플레이할 때: Asset 로어북의 「- Characters {name}:」 명단에서 주인공 이름을 뺀다.
 * 명단은 카드에 고정된 글이고 누가 주인공인지는 플러그인만 알아서 요청 직전에 지운다
 */
export function hidePlayerTag<M extends { content?: unknown }>(messages: M[], tagNames: string[]): M[] {
  const drop = new Set(tagNames.filter(Boolean));
  if (!drop.size) return messages;
  const re = /^(- Characters \{name\}: )(.*)$/gm;
  return messages.map((m) => {
    if (typeof m?.content !== 'string' || !m.content.includes('- Characters {name}: ')) return m;
    const content = m.content.replace(re, (_, head: string, list: string) => head + list.split(',').map((s) => s.trim()).filter((s) => s && !drop.has(s)).join(', '));
    return content === m.content ? m : { ...m, content };
  });
}
