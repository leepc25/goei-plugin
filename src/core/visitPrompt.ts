// 본부 방문 대화 요청문 (2026-10-22 설계 2판). 괴담톡과 같은 틀: 지침은 카드 「Visit」 로어북 @@SECTION, 자료는 JSON 하나.
// 방문자는 지침 문장이 아니라 자료로 넣는다: 캐릭터로 플레이면 playerSource가 페르소나 자리를 주인공 글로 바꿔 둔다.
import { applyAdvanced, advNum, advOn, genSettings, refToggles } from './advanced';
import { trimRelated, trimSecondary, trimTurns } from './budget';
import { parseJsonPayload } from './gnet';
import { bookText, collectRefs, factionCodesToNames, PERSONA_SOURCE, policySections, recentTurns, type RefSource } from './refs';
import { cleanOutput } from './world/tags';

export const VISIT_BOOK = 'Visit';
export class VisitError extends Error {}

export interface VisitAgent { id: string; name: string; rank?: string; state: string; situation: string; room: string; lore: string }
/** 이번 막간에 오간 말 (말한 사람 이름, 말) */
export interface VisitLine { speaker: string; text: string }
export interface VisitPromptInput {
  agent: VisitAgent;
  /** 방문자 이름 (주인공 요원 이름, 아니면 페르소나 이름) */
  visitor: string;
  /** 이 요원과 이번 막간에 나눈 말 */
  conversation: VisitLine[];
  /** 같은 막간에 다른 요원과 나눈 말 */
  elsewhere: { agent: string; lines: VisitLine[] }[];
  said: string;
  /** 같은 방 가까이 있어 끼어들 수 있는 요원 (설계 2판 7단계). 비면 혼자 답한다 */
  bystanders?: VisitAgent[];
  /** 따로 넣었으니 참고 자료에서 뺄 로어북 (주인공 요원의 로어북) */
  skipBooks?: string[];
}
export interface VisitPrompt { messages: { role: 'system' | 'user'; content: string }[]; limit: number; /** 끼어들기 형식으로 보냈으면 그 요원 이름들 */ bystanders: string[] }

const LANGUAGE = 'Reply in the dominant language of the actual conversation; default to Korean when no conversation is available.';
const ROOM: Record<string, string> = { office: '사무실', lounge: '휴게실', infirmary: '의무실', quarters: '숙소' };

/** 카드에 「Visit」 로어북이 있는지 (없으면 카드 업데이트 안내) */
export const hasVisitGuide = (src: RefSource): boolean => Object.keys(policySections(src.char.globalLore, VISIT_BOOK)).length > 0;

/** 옛 카드(끼어들기 항목 없음)면 혼자 답하는 형식으로 */
export const canInterject = (src: RefSource): boolean => {
  const p = policySections(src.char.globalLore, VISIT_BOOK);
  return p.INTERJECT !== undefined && p.OUTPUT_GROUP !== undefined;
};

function rules(src: RefSource, limit: number, group: boolean): string {
  const p = policySections(src.char.globalLore, VISIT_BOOK);
  const need = group ? ['COMMON', 'REPLY', 'INTERJECT', 'OUTPUT_GROUP'] : ['COMMON', 'REPLY', 'OUTPUT_REPLY'];
  const missing = need.filter((k) => p[k] === undefined);
  if (missing.length) throw new VisitError(Object.keys(p).length ? `Visit 로어북의 ${missing.join(', ')} 항목이 없어요.` : '카드에 본부 대화 지침(Visit 로어북)이 없어요. 설정 → 업데이트로 카드를 업데이트해 주세요.');
  const text = need.map((k) => p[k].replace(/__LIMIT_LINE__/g, String(limit)).replace(/<!--[\s\S]*?-->/g, '').trim());
  return [...text, genSettings(src.chat.scriptstate).language ?? LANGUAGE].join('\n\n');
}

/** 본편 반영 문구 (MAIN_CONTEXT). 없으면 null */
export function visitContextRules(src: { char: { globalLore?: RefSource['char']['globalLore'] } }): string | null {
  return policySections(src.char.globalLore, VISIT_BOOK).MAIN_CONTEXT?.trim() || null;
}

export function visitPrompt(src: RefSource, input: VisitPromptInput, names: Record<string, string> = {}): VisitPrompt {
  const ss = src.chat.scriptstate;
  applyAdvanced(ss);
  const limit = advNum(ss, 'hq', 'line_chars');
  const n = trimTurns(advNum(ss, 'hq', 'turns'));
  const turns = n ? recentTurns(src.chat, n) : [];
  const recentStory: { role: string; text: string; turn: number }[] = [];
  turns.forEach((t, i) => {
    if (t.user) recentStory.push({ role: 'user', text: t.user, turn: i + 1 });
    for (const c of t.char) recentStory.push({ role: 'char', text: c, turn: i + 1 });
  });
  const t = refToggles(ss, 'hq');
  const by = advOn(ss, 'hq', 'interject') && canInterject(src) ? (input.bystanders ?? []).filter((b) => b.name !== input.agent.name) : [];
  const talk = [...input.conversation.map((l) => l.text), input.said].join('\n');
  const rows = collectRefs(src, {
    scope: 'phone', text: `${talk}\n${recentStory.map((m) => m.text).join('\n')}`, description: t.description, authors: t.authors, persona: t.persona,
    active: t.active, related: t.related && !trimRelated(), secondary: t.secondary && !trimSecondary(),
  });
  const universe = { characterDescription: '', authorsNote: '', activeLoreBooks: [] as { source: string; content: string; kind: string }[] };
  let protagonist = '';
  for (const r of rows) {
    if (r.kind === 'base' && r.sources.includes('봇 설명')) universe.characterDescription = r.content;
    else if (r.kind === 'base' && r.sources.includes('작가 노트')) universe.authorsNote = r.content;
    else if (r.kind === 'base' && r.sources.includes(PERSONA_SOURCE)) protagonist = r.content;
    // 대화 상대 요원 글은 agent.lore에, 주인공 요원 글은 protagonist에 이미 있다
    else if (r.content !== input.agent.lore && !by.some((b) => b.lore === r.content) && !r.sources.some((x) => input.skipBooks?.includes(x))) universe.activeLoreBooks.push({ source: r.sources.join(' / '), content: r.content, kind: r.kind });
  }
  const body = {
    agent: { name: input.agent.name, ...(input.agent.rank ? { rank: input.agent.rank } : {}), lore: input.agent.lore, status: input.agent.state, situation: input.agent.situation, where: ROOM[input.agent.room] ?? input.agent.room },
    ...(by.length ? { bystanders: by.map((b) => ({ name: b.name, ...(b.rank ? { rank: b.rank } : {}), lore: b.lore, status: b.state, situation: b.situation })) } : {}),
    protagonist: { name: input.visitor, ...(protagonist ? { lore: protagonist } : {}) },
    universe,
    recentStory,
    ...(advOn(ss, 'hq', 'interlude') && input.elsewhere.length ? { earlierThisInterlude: input.elsewhere } : {}),
    conversation: input.conversation,
    said: input.said,
  };
  return {
    limit,
    bystanders: by.map((b) => b.name),
    messages: [
      { role: 'system', content: factionCodesToNames(rules(src, limit, by.length > 0), names) },
      { role: 'user', content: factionCodesToNames(JSON.stringify(body), names) },
    ],
  };
}

/** 요원 로어북 글 (명부의 로어북 이름, 없으면 이름) */
export const agentLore = (src: RefSource, loreName: string): string => bookText(src, loreName);

const SENTENCE_END = /[.!?…~。！？]["'」』”’)]*$/;

/** 말풍선에 넣을 대사만 남긴다: 지문·생각·이름표·상태 태그를 지우고 limit자 안으로 */
export function cleanLine(text: string, speaker: string, prose = false): string {
  let s = cleanOutput(String(text ?? ''));
  s = s.replace(/<(think|thoughts)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/\*[^*\n]*\*/g, ' ').replace(/[（(][^()（）\n]*[)）]/g, ' ');
  const lines = s.split('\n').map((l) => l.trim()).filter(Boolean);
  // 소설식 응답이면 따옴표 속 대사만 (JSON line 속 따옴표는 인용이라 그대로)
  const quoted = !prose ? [] : lines.flatMap((l) => [...l.matchAll(/[「"“『]([^」"”』]{1,})[」"”』]/g)].map((m) => m[1]));
  s = (quoted.length ? quoted : lines).join(' ');
  const esc = speaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  s = s.replace(new RegExp(`^\\s*${esc}\\s*[:：]\\s*`), '').replace(/^[「"“『]|[」"”』]$/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

export function clipLine(s: string, limit: number): string {
  const chars = [...s];
  if (chars.length <= limit) return s;
  const head = chars.slice(0, limit).join('');
  // 문장 끝에서 자른다. 첫 문장부터 넘치면 글자 수로 자르고 말줄임
  let cut = -1;
  for (let i = head.length; i > 0; i--) if (SENTENCE_END.test(head.slice(0, i))) { cut = i; break; }
  return cut > 0 ? head.slice(0, cut).trim() : `${chars.slice(0, limit - 1).join('').trim()}…`;
}

/** 응답 원문 → 대사. JSON {"line"}이 없어도 지문을 걷어 낸 대사가 남으면 쓴다. 아무것도 없으면 VisitError */
export function parseVisitLine(raw: string, speaker: string, limit: number): string {
  let text = '';
  let prose = false;
  try {
    const v = parseJsonPayload(raw) as { line?: unknown } | null;
    if (v && typeof v === 'object' && typeof v.line === 'string') text = v.line;
  } catch {
    /* JSON이 아니면 원문에서 대사를 찾는다 */
  }
  if (!text) prose = true;
  if (!text) text = String(raw ?? '').replace(/^```[\w-]*\s*|```\s*$/g, '').replace(/^\s*\{[\s\S]*?"line"\s*:\s*"/, '').replace(/"\s*\}\s*$/, '');
  const line = clipLine(cleanLine(text, speaker, prose), limit);
  if (!line) throw new VisitError('모델 응답에서 대사를 찾지 못했어요.');
  return line;
}

export interface VisitReply { line: string; extra: { speaker: string; line: string }[] }

/** 끼어들기 형식 응답 → 상대 요원 대사 + 옆 요원 말 (최대 2). 상대 대사가 없으면 VisitError.
 * JSON이 아니면 혼자 답한 것으로 보고 parseVisitLine으로 */
export function parseVisitGroup(raw: string, speaker: string, bystanders: string[], limit: number): VisitReply {
  type Row = { speaker?: unknown; line?: unknown };
  let rows: Row[] | null = null;
  try {
    const v = parseJsonPayload(raw) as { lines?: unknown; line?: unknown } | null;
    if (v && Array.isArray(v.lines)) rows = (v.lines as unknown[]).filter((r): r is Row => !!r && typeof r === 'object');
    else if (v && typeof v.line === 'string') rows = [{ speaker, line: v.line }];
  } catch {
    /* 아래에서 원문으로 */
  }
  if (!rows) return { line: parseVisitLine(raw, speaker, limit), extra: [] };
  const name = (x: unknown) => String(x ?? '').trim();
  const say = (r: Row) => clipLine(cleanLine(String(r.line ?? ''), name(r.speaker)), limit);
  // 상대 요원 대사: 이름이 맞는 첫 줄, 없으면 이름 없는 첫 줄
  const mine = rows.find((r) => name(r.speaker) === speaker) ?? rows.find((r) => !name(r.speaker));
  const line = mine ? say(mine) : '';
  if (!line) throw new VisitError('모델 응답에서 대사를 찾지 못했어요.');
  const extra: VisitReply['extra'] = [];
  for (const r of rows) {
    const who = name(r.speaker);
    if (r === mine || !bystanders.includes(who) || extra.some((e) => e.speaker === who)) continue;
    const l = say(r);
    if (l) extra.push({ speaker: who, line: l });
    if (extra.length >= 2) break;
  }
  return { line, extra };
}
