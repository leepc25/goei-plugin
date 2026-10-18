// 참고 자료 모으기 (원본 REFERENCE_CORE). 위키·괴담넷·괴담톡이 같이 쓴다.
// 봇 설명, 작가 노트, 제목과 같은 이름의 로어북, 글에 이름이 나온 로어북, 상시 참고(📜Faction·🙂Roster),
// 그 로어북들 속 이름으로 한 번 더 찾은 2차 참조를 모아 "[종류: 출처]\n내용" 블록으로 만든다.
import { evaluate, type CbsEnv } from './cbs';
import { readScene, stripSceneCard } from './dispatch';
import { hasCall, stripCall } from './phone';
import type { Chat, LoreEntry } from './types';
import { cleanOutput, hasWorldTags } from './world/tags';
import { buildRegistry, referenceEntries, type Registry } from './world/registry';

export type RefKind = 'base' | 'primary' | 'active' | 'direct' | 'secondary';

export interface RefRow {
  kind: RefKind;
  sources: string[];
  content: string;
  required: boolean;
}

export interface RefSource {
  char: { name?: string; desc?: string; globalLore?: LoreEntry[] };
  chat: Chat;
}

/** 참고 자료로 쓰면 안 되는 내부 로어북 */
const INTERNAL = new Set([
  'World catalog', 'Agent roster', 'Directive', 'Faction display', 'Start trigger', 'LB Backend', 'GNet', 'Wiki', 'Phone',
  'Phone tabs', 'Settings', '⚙️설정', '괴이봇 플러그인 매니페스트', '괴이봇 명부', 'Plugin manifest', 'Directory', 'WIKI_DIAGNOSTIC',
]);
export const ACTIVE_BOOKS = ['📜Faction', '🙂Roster'];

export function allowedBook(e: LoreEntry): boolean {
  const name = String(e.comment ?? '');
  const text = String(e.content ?? '');
  if (!name || INTERNAL.has(name) || name.startsWith('WIKI｜') || /^lightboard/i.test(name) || name.startsWith('toon.')) return false;
  return !text.includes('@@SECTION') && !text.includes('[NW_PRIVATE_BEGIN]');
}

/** 다른 기능의 표식을 지운다 (원본 RC.strip) */
export function stripModules(text: string): string {
  return text
    .replace(/\[MODULE_CONTEXT_BEGIN\][\s\S]*?\[MODULE_CONTEXT_END\]/g, '')
    .replace(/\[NW_PRIVATE_BEGIN\][\s\S]*?\[NW_PRIVATE_END\]/g, '')
    .replace(/<lightboard-namuwiki[\s>][\s\S]*?<\/lightboard-namuwiki>/g, '')
    .replace(/\[LBDATA START\][\s\S]*?\[LBDATA END\]/g, '')
    .replace(/<gnet-data>[\s\S]*?<\/gnet-data>/g, '')
    .replace(/<lb-[\w-]+[\s\S]*?<\/lb-[\w-]+>/g, '')
    .replace(/◈[^◈\n]*◈/g, '')
    .trim();
}

export function cbsEnv(src: RefSource): CbsEnv {
  return { vars: src.chat.scriptstate ?? {}, char: src.char.name, charDesc: src.char.desc, user: '주인공' };
}

function allBooks(src: RefSource): LoreEntry[] {
  const local = Array.isArray(src.chat.localLore) ? (src.chat.localLore as LoreEntry[]) : [];
  return [...(src.char.globalLore ?? []), ...local];
}

/** 이름이 정확히 같은 로어북 내용 (CBS 해석, 표식 제거) */
function readBook(books: LoreEntry[], name: string, env: CbsEnv): string[] {
  const key = name.trim().toLowerCase();
  return books
    .filter((e) => String(e.comment ?? '').trim().toLowerCase() === key && allowedBook(e))
    .map((e) => stripModules(evaluate(String(e.content ?? ''), env)))
    .filter(Boolean);
}

/** 이름이 정확히 같은 로어북 내용 (괴담톡 인물 원문) */
export function bookText(src: RefSource, name: string): string {
  return name.trim() ? readBook(allBooks(src), name, cbsEnv(src)).join('\n\n') : '';
}

export function hasBook(src: RefSource, name: string): boolean {
  return readBook(allBooks(src), name, cbsEnv(src)).length > 0;
}

export interface CollectOptions {
  /** 제목과 같은 이름의 로어북 (위키) */
  primaryNames?: string[];
  /** 이름을 찾아볼 글 (제목, 작성 지침, 최근 본문) */
  text: string;
  description?: boolean;
  authors?: boolean;
  active?: boolean;
  related?: boolean;
  secondary?: boolean;
  /** 위키: base·primary·active가 필수. 그 밖: direct가 필수 */
  scope: 'wiki' | 'gnet' | 'phone';
  registry?: Registry;
  /** 활성 로어북 앞에 넣는 앱 자료 (괴담넷 "현재 발생 상황" 등) */
  extra?: { source: string; content: string }[];
}

export function collectRefs(src: RefSource, o: CollectOptions): RefRow[] {
  const env = cbsEnv(src);
  const books = allBooks(src);
  const registry = o.registry ?? buildRegistry(src.char.globalLore);
  const rows: RefRow[] = [];
  const add = (kind: RefKind, source: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    const rank: RefKind[] = ['base', 'primary', 'active', 'direct', 'secondary'];
    const same = rows.find((r) => r.content === text);
    if (same) {
      if (!same.sources.includes(source)) same.sources.push(source);
      if (o.scope === 'wiki' && rank.indexOf(kind) < rank.indexOf(same.kind)) same.kind = kind;
      same.required = same.required || required(kind);
      return;
    }
    rows.push({ kind, sources: [source], content: text, required: required(kind) });
  };
  const required = (kind: RefKind) => (o.scope === 'wiki' ? kind === 'base' || kind === 'primary' || kind === 'active' : kind === 'base' || kind === 'direct');

  if (o.description !== false && src.char.desc) add('base', '봇 설명', stripModules(evaluate(src.char.desc, env)));
  const note = typeof src.chat.note === 'string' ? src.chat.note : '';
  if (o.authors !== false && note.trim()) add('base', '작가 노트', stripModules(evaluate(note, env)));
  const seen = new Set<string>();
  const pull = (kind: RefKind, name: string) => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    for (const c of readBook(books, name, env)) add(kind, name, c);
  };
  for (const n of o.primaryNames ?? []) pull('primary', n);
  if (o.active !== false) for (const x of o.extra ?? []) add('active', x.source, x.content);
  if (o.active !== false) for (const n of ACTIVE_BOOKS) pull('active', n);
  if (o.related !== false) for (const e of referenceEntries(registry, o.text)) if (e.lore) pull('direct', e.lore);
  if (o.secondary) {
    const hop = rows.filter((r) => r.kind === 'primary' || r.kind === 'direct').map((r) => r.content).join('\n');
    for (const e of referenceEntries(registry, hop)) if (e.lore) pull('secondary', e.lore);
  }
  return rows;
}

/** 개수 제한: 필수가 아닌 2차 참조, 그다음 직접 참조부터 뺀다 */
export function limitRefs(rows: RefRow[], max: number): RefRow[] {
  const out = rows.slice();
  for (const kind of ['secondary', 'direct'] as RefKind[]) {
    for (let i = out.length - 1; i >= 0 && out.length > max; i--) if (out[i].kind === kind && !out[i].required) out.splice(i, 1);
  }
  return out;
}

const KIND_LABEL: Record<RefKind, string> = { base: '공통', primary: '주제 원본', active: '활성 로어북', direct: '관련 로어북', secondary: '2차 참조' };

export function refText(rows: RefRow[]): string {
  return rows.map((r) => `[${KIND_LABEL[r.kind]}: ${r.sources.join(' / ')}]\n${r.content}`).join('\n\n');
}

// ── 최근 본문 ──

export interface Turn {
  user: string;
  char: string[];
}

function messageText(data: string): string {
  let t = String(data ?? '');
  if (t.includes('%%SCENE_CARD:')) {
    const s = readScene(t);
    t = s ? `[이동] 목표: ${s.target} / 투입: ${s.party}` : stripSceneCard(t);
  }
  if (hasCall(t)) t = stripCall(t).replace(/\{\{user\}\}/gi, '주인공');
  if (hasWorldTags(t)) t = cleanOutput(t);
  return stripModules(t);
}

/** 유저 메시지가 턴을 시작하고 뒤따르는 응답이 그 턴에 붙는다. 마지막 n턴 */
export function recentTurns(chat: Chat, n: number): Turn[] {
  const turns: Turn[] = [];
  for (const m of chat.message ?? []) {
    const text = messageText(m.data);
    if (!text || /%GNET_|%LB_SETTINGS|%PHONE_CALL_PENDING%/.test(m.data)) continue;
    if (m.role === 'user') turns.push({ user: text, char: [] });
    else if (turns.length) turns[turns.length - 1].char.push(text);
    else turns.push({ user: '', char: [text] });
  }
  return turns.slice(-Math.max(1, n));
}

export function storyText(turns: Turn[]): string {
  return turns
    .flatMap((t) => [...(t.user ? [`[user]\n${t.user}`] : []), ...t.char.map((c) => `[char]\n${c}`)])
    .join('\n\n');
}

/** 소속 코드(A00~E00, 새 세력 F00~)를 보는 소속 기준 이름으로 (원본 TM.prepareAffiliations) */
export function factionCodesToNames(text: string, names: Record<string, string>): string {
  return text.replace(/(?<![\w])([A-Z]00)(?![\w])/g, (code) => names[code] ?? code);
}

/** 로어북의 @@SECTION 이름\n…\n@@END 블록들 */
export function policySections(lore: LoreEntry[] | undefined, comment: string): Record<string, string> {
  const raw = (lore ?? []).find((e) => e.comment === comment)?.content;
  const out: Record<string, string> = {};
  if (typeof raw !== 'string') return out;
  for (const m of raw.matchAll(/@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END/g)) out[m[1].trim()] = m[2];
  return out;
}
