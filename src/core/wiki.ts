// 괴담위키: 원본 Namuwiki 모듈과 같은 저장 형식·프롬프트·검사 규칙.
// 문서는 채팅 로어북 "WIKI｜제목" 항목(키 없음, 비활성)에 meta + <lightboard-namuwiki> 본문으로 둔다.
import { advNum, advOn, genSettings, refToggles } from './advanced';
import { related, type Focus } from './focus';
import { tokens } from './gnet';
import { trimPrevious, trimRelated, trimSecondary, trimTurns } from './budget';
import { collectRefs, factionCodesToNames, hasBook, limitRefs, policySections, recentTurns, refText, storyText, type RefSource } from './refs';
import type { Chat, LoreEntry } from './types';
import { buildRegistry, resolveName, type Registry } from './world/registry';

export const WIKI_PREFIX = 'WIKI｜';
export type WikiMode = 'expand' | 'faithful';
export type WikiLength = 'short' | 'standard' | 'detailed';

export interface WikiSettings {
  mode: WikiMode;
  model: 'main' | 'aux';
  length: WikiLength;
  refreshPrevious: boolean;
  chatTurns: number;
  referenceCount: number;
}

/** 원본 Settings 로어북 기본값 */
export const WIKI_DEFAULTS: WikiSettings = { mode: 'expand', model: 'main', length: 'detailed', refreshPrevious: true, chatTurns: 8, referenceCount: 20 };

export function wikiSettings(state: Record<string, unknown> | undefined): WikiSettings {
  const s = state ?? {};
  const pick = <T extends string>(key: string, allowed: readonly T[], def: T): T => (allowed.includes(s[key] as T) ? (s[key] as T) : def);
  return {
    ...WIKI_DEFAULTS,
    mode: pick('$nw_mode', ['expand', 'faithful'] as const, WIKI_DEFAULTS.mode),
    model: pick('$nw_model', ['main', 'aux'] as const, WIKI_DEFAULTS.model),
    length: pick('$nw_length', ['short', 'standard', 'detailed'] as const, WIKI_DEFAULTS.length),
    refreshPrevious: s['$nw_refresh_previous'] !== '0',
    chatTurns: advNum(s, 'nw', 'turns'),
    referenceCount: advNum(s, 'nw', 'ref_count'),
  };
}

export interface WikiMeta {
  title: string;
  mode: WikiMode;
  model: string;
  created: number;
  length: WikiLength;
  sources: string[];
  primarySources: string[];
  writingRequest: string;
  direct: boolean;
}

export interface WikiDoc {
  title: string;
  meta: WikiMeta | null;
  body: string;
  /** 카드에 미리 넣어 둔 기본 문서 (채팅에 같은 제목이 없을 때만) */
  base?: boolean;
}

export class WikiError extends Error {}

// ── 제목 ──

export function validTitle(t: string): boolean {
  return !!t.trim() && [...t].length <= 300 && !/[\r\n<>]/.test(t) && !t.includes('{{') && !t.includes('}}') && !t.startsWith(WIKI_PREFIX);
}

const QUALIFIERS = new Set(['기업', '회사', '기관', '조직', '인물', '장소']);

function exactTopic(r: Registry, src: RefSource, title: string): [string, boolean] {
  const entries = resolveName(r, title);
  const names = [...new Map(entries.filter((e) => e.lore).map((e) => [e.lore.toLowerCase(), e.lore])).values()];
  if (names.length === 1) return [names[0], true];
  if (entries.length) return [title, true];
  if (hasBook(src, title)) return [title, true];
  return [title, false];
}

/** 별칭을 정식 이름으로 ("Sora Land" → "소라 랜드"), "(기업)" 같은 꼬리말은 떼고 다시 찾는다 */
export function canonicalTitle(r: Registry, src: RefSource, title: string): { title: string; known: boolean } {
  const t = title.trim();
  const [name, known] = exactTopic(r, src, t);
  if (known) return { title: name, known };
  const m = /^(.*?)\s*\(([^()]*)\)$/.exec(t);
  if (m && QUALIFIERS.has(m[2].trim())) {
    const [n2, k2] = exactTopic(r, src, m[1].trim());
    if (k2) return { title: n2, known: true };
  }
  return { title: t, known: false };
}

// ── 저장 ──

function localLore(chat: Chat): LoreEntry[] {
  return Array.isArray(chat.localLore) ? (chat.localLore as LoreEntry[]) : [];
}

export function parseDocContent(title: string, content: string): WikiDoc | null {
  const body = /<lightboard-namuwiki[\s>][\s\S]*?<\/lightboard-namuwiki>/.exec(content)?.[0];
  if (!body) return null;
  let meta: WikiMeta | null = null;
  const m = /<!--NW_META:([\s\S]*?)-->/.exec(content);
  if (m) {
    try {
      meta = JSON.parse(m[1].replace(/-\\u002d/g, '--')) as WikiMeta;
    } catch {
      meta = null;
    }
  }
  return { title, meta, body };
}

function docsIn(entries: LoreEntry[]): WikiDoc[] {
  const out: WikiDoc[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const name = String(e.comment ?? '');
    if (!name.startsWith(WIKI_PREFIX)) continue;
    const title = name.slice(WIKI_PREFIX.length);
    if (seen.has(title)) continue;
    const doc = parseDocContent(title, String(e.content ?? ''));
    if (doc) {
      seen.add(title);
      out.push(doc);
    }
  }
  return out;
}

// 카드 기본 문서는 크고(수백 개) 거의 안 바뀌므로 카드 로어북마다 한 번만 읽는다
const baseCache = new WeakMap<object, WikiDoc[]>();
export function baseDocs(lore: unknown): WikiDoc[] {
  if (!Array.isArray(lore)) return [];
  let docs = baseCache.get(lore);
  if (!docs) {
    docs = docsIn(lore as LoreEntry[]).map((d) => ({ ...d, base: true }));
    baseCache.set(lore, docs);
  }
  return docs;
}

/** 저장된 문서 목록: 채팅 문서(처음 만든 순서) 다음에 카드 기본 문서. 같은 제목은 채팅 문서가 이긴다 */
export function listDocs(chat: Chat, lore?: unknown): WikiDoc[] {
  const mine = docsIn(localLore(chat));
  if (lore === undefined) return mine;
  const have = new Set(mine.map((d) => d.title));
  return [...mine, ...baseDocs(lore).filter((d) => !have.has(d.title))];
}

export function findDoc(chat: Chat, title: string, lore?: unknown): WikiDoc | null {
  return listDocs(chat, lore).find((d) => d.title === title) ?? null;
}

export function docContent(meta: WikiMeta, body: string): string {
  const json = JSON.stringify(meta).replace(/--/g, '-\\u002d');
  return `[NW_PRIVATE_BEGIN]\n<!--NW_META:${json}-->\n${body}\n[NW_PRIVATE_END]`;
}

/** 같은 제목이 있으면 바꾸고, 없으면 뒤에 붙인다 */
export function saveDoc(chat: Chat, meta: WikiMeta, body: string): Chat {
  const lore = localLore(chat).slice();
  const name = WIKI_PREFIX + meta.title;
  const content = docContent(meta, body);
  const i = lore.findIndex((e) => e.comment === name);
  const entry: LoreEntry = {
    key: '', secondkey: '', comment: name, content, mode: 'normal', insertorder: 0, alwaysActive: false, selective: false, useRegex: false,
  };
  if (i >= 0) lore[i] = { ...lore[i], ...entry };
  else lore.push(entry);
  return { ...chat, localLore: lore };
}

export function deleteDoc(chat: Chat, title: string): Chat {
  return { ...chat, localLore: localLore(chat).filter((e) => e.comment !== WIKI_PREFIX + title) };
}

// ── 프롬프트 ──

const REQUIRED = ['NW.GUIDE', 'NW.EXPAND', 'NW.FAITHFUL', 'NW.LENGTH_SHORT', 'NW.LENGTH_STANDARD', 'NW.LENGTH_DETAILED', 'NW.LINKS_OPEN', 'NW.FORMAT'];

export interface WikiRequest {
  title: string;
  /** 링크로 들어온 하위 문서가 물려받는 원본 자료 이름 */
  inherited: string[];
  previous: string | null;
  writingRequest: string;
  direct: boolean;
}

export interface WikiPrompt {
  messages: { role: 'system' | 'user'; content: string }[];
  sources: string[];
  primarySources: string[];
}

export function wikiPrompt(src: RefSource, req: WikiRequest, s: WikiSettings, factionNames: Record<string, string>, registry?: Registry): WikiPrompt {
  const sec = policySections(src.char.globalLore, 'Wiki');
  for (const k of REQUIRED) if (!sec[k]) throw new WikiError(`Wiki 로어북의 ${k} 섹션이 없어요.`);
  const r = registry ?? buildRegistry(src.char.globalLore);
  const n = trimTurns(s.chatTurns);
  const story = n ? storyText(recentTurns(src.chat, n)) : '';
  const primary = [req.title, ...(hasBook(src, req.title) ? [] : req.inherited)];
  const t = refToggles(src.chat.scriptstate, 'nw');
  const rows = limitRefs(
    collectRefs(src, {
      scope: 'wiki', primaryNames: primary, text: `${req.title}\n${req.writingRequest}\n${story}`, registry: r, description: t.description, authors: t.authors,
      persona: t.persona, active: t.active, related: t.related && !trimRelated(), secondary: t.secondary && !trimSecondary(),
    }),
    s.referenceCount,
  );
  const previous = trimPrevious() ? null : req.previous;
  const lengthKey = { short: 'NW.LENGTH_SHORT', standard: 'NW.LENGTH_STANDARD', detailed: 'NW.LENGTH_DETAILED' }[s.length];
  const system = [sec['NW.GUIDE'], sec[s.mode === 'faithful' ? 'NW.FAITHFUL' : 'NW.EXPAND'], sec[lengthKey], sec['NW.LINKS_OPEN'], sec['NW.FORMAT']];
  if (story && sec['NW.HISTORY']) system.push(sec['NW.HISTORY']);
  if (previous && sec['NW.PREVIOUS']) system.push(sec['NW.PREVIOUS']);
  const language = genSettings(src.chat.scriptstate).language;
  if (language) system.push(language);
  let user = `문서 제목: ${req.title}\n\n[참고 자료]\n${refText(rows)}`;
  if (story) user += `\n\n[최근 챗로그]\n${story}`;
  if (previous) user += `\n\n[이전 위키 — 원본 사실과 최근 확인된 본문을 우선]\n${innerBody(previous)}`;
  if (req.writingRequest.trim()) user += `\n\n[사용자 작성 지침]\n${req.writingRequest.trim()}`;
  const sources = [...new Set(rows.flatMap((x) => x.sources))];
  const primarySources = [...new Set(rows.filter((x) => x.kind === 'primary').flatMap((x) => x.sources))];
  return {
    messages: [
      { role: 'system', content: factionCodesToNames(system.join('\n'), factionNames) },
      { role: 'user', content: factionCodesToNames(user, factionNames) },
    ],
    sources,
    primarySources,
  };
}

export function innerBody(body: string): string {
  return body.replace(/^<lightboard-namuwiki[^>]*>\s*/, '').replace(/\s*<\/lightboard-namuwiki>\s*$/, '');
}

// ── 응답 검사·정리 ──

const ARROW = /➡️|➡︎|➡/g;

/** 응답에서 문서 블록만 꺼내고, 제목을 고정하고, 잘못된 링크 표시를 지운다 */
export function acceptArticle(raw: string, title: string, canon: (t: string) => string): string {
  const text = raw.trim();
  if (!text) throw new WikiError('모델이 빈 응답을 보냈어요.');
  const m = /<lightboard-namuwiki[\s>][\s\S]*?<\/lightboard-namuwiki>/.exec(text);
  if (!m) {
    if (/<lightboard-namuwiki[\s>]/.test(text)) throw new WikiError('문서가 끝까지 오지 않았어요 (닫는 태그 없음). 응답 길이 한도에 걸렸을 수 있어요. 분량을 줄이거나 다시 시도해 주세요.');
    throw new WikiError('위키 형식(<lightboard-namuwiki>)이 아닌 응답이에요.');
  }
  let body = m[0];
  if (!body.includes('[Paragraph]')) throw new WikiError('본문 문단([Paragraph])이 없는 응답이에요.');
  body = body.replace(ARROW, '➡️').replace(/\{\{/g, '&#123;&#123;').replace(/\}\}/g, '&#125;&#125;');
  const safeTitle = title.replace(/"/g, '&quot;');
  body = body.replace(/^<lightboard-namuwiki([^>]*)>/, (_all, attrs: string) => {
    const rest = attrs.replace(/\sdoc_title="[^"]*"/, '');
    return `<lightboard-namuwiki doc_title="${safeTitle}"${rest}>`;
  });
  return reviewLinks(body, title, canon);
}

/** 원본 reviewLinks: 빈 것, 자기 자신, 중복, 괄호·막대가 든 링크는 표시만 지우고 글은 남긴다 */
export function reviewLinks(body: string, title: string, canon: (t: string) => string): string {
  const seen = new Set<string>();
  const self = canon(title);
  return body.replace(/➡️([^➡\n]{0,120}?)➡️/g, (_all, label: string) => {
    const t = label.trim();
    if (!t || /[[\]|]/.test(t) || !validTitle(t)) return label;
    const c = canon(t);
    if (c === self || seen.has(c)) return label;
    seen.add(c);
    return `➡️${t}➡️`;
  });
}

// ── 화면 ──

export interface RenderOptions {
  /** 저장된 문서가 있는 링크인지 */
  saved: (title: string) => boolean;
  canon: (title: string) => string;
  /** 정보 상자 맨 위에 넣을 사진 주소 (그 항목의 카드 에셋) */
  photo?: string | null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** 모델이 이미 바꿔 둔 &#123; 같은 것은 살린다 */
const escText = (s: string) => esc(s.replace(/&#12[35];/g, (m) => (m === '&#123;' ? '{' : '}')));

function attrs(open: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of open.matchAll(/([\w]+)="([^"]*)"/g)) out[m[1]] = m[2].replace(/&quot;/g, '"');
  return out;
}

/** 중괄호 밖의 | 로 나누기 */
function splitFields(s: string, sep = '|'): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function field(f: string): [string, string] {
  const i = f.indexOf(':');
  return i < 0 ? ['', f.trim()] : [f.slice(0, i).trim(), f.slice(i + 1).trim()];
}

export function renderArticle(body: string, o: RenderOptions): { html: string; title: string; related: string[]; recent: string[]; headings: string[] } {
  const open = /^<lightboard-namuwiki[^>]*>/.exec(body)?.[0] ?? '';
  const a = attrs(open);
  const color = /^#[0-9a-fA-F]{3,8}$/.test(a.main_color ?? '') ? a.main_color : '#27685b';
  const notes: string[] = [];
  const inline = (s: string) =>
    escText(s)
      .replace(/➡️([^➡]+?)➡️/g, (_all, t: string) => {
        const raw = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const c = o.canon(raw);
        return `<button class="nw-link${o.saved(c) ? ' on' : ''}" data-action="wiki-open" data-value="${esc(c)}">${t}</button>`;
      })
      .replace(/❗([^❗]+?)❗/g, '<b>$1</b>')
      .replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>')
      .replace(/✂️([^✂]+?)✂️/g, '<s>$1</s>')
      .replace(/📌([^📌]+?)📌/gu, (_all, t: string) => {
        notes.push(t);
        return `<sup class="nw-fn">[${notes.length}]</sup>`;
      });
  const lines = innerBody(body).split('\n');
  type Block = { tag: string; text: string };
  const blocks: Block[] = [];
  for (const line of lines) {
    const m = /^\s*\[(\w+)\](.*)$/.exec(line);
    if (m) blocks.push({ tag: m[1], text: m[2] });
    else if (line.trim() && blocks.length) blocks[blocks.length - 1].text += `\n${line}`;
    else if (line.trim()) blocks.push({ tag: 'Paragraph', text: line });
  }
  const headings: { level: number; title: string; id: string }[] = [];
  let h1 = 0;
  let h2 = 0;
  for (const b of blocks) {
    if (b.tag !== 'Heading') continue;
    const f = Object.fromEntries(splitFields(b.text).map(field));
    const level = f.Level === '2' ? 2 : 1;
    if (level === 1) {
      h1++;
      h2 = 0;
    } else h2++;
    headings.push({ level, title: f.Title ?? '', id: level === 1 ? `${h1}` : `${h1}.${h2}` });
  }
  let hi = 0;
  let list: string[] = [];
  const out: string[] = [];
  const flushList = () => {
    if (list.length) out.push(`<ul class="nw-list">${list.map((x) => `<li>${x}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const b of blocks) {
    if (b.tag !== 'List') flushList();
    switch (b.tag) {
      case 'Infobox': {
        const fields = splitFields(b.text).map(field);
        const head = fields.find(([k]) => k === 'Title')?.[1] ?? a.doc_title ?? '';
        const rows = fields.filter(([k]) => k !== 'Title' && k);
        out.push(`<table class="nw-infobox" style="--nw:${color}"><tr><th colspan="2">${inline(head)}</th></tr>${o.photo ? `<tr><td colspan="2" class="nw-ibphoto"><img src="${esc(o.photo)}" alt=""></td></tr>` : ''}${rows.map(([k, v]) => `<tr><td>${inline(k)}</td><td>${inline(v)}</td></tr>`).join('')}</table>`);
        break;
      }
      case 'Toc':
        if (headings.length) out.push(`<nav class="nw-toc"><b>목차</b>${headings.map((h) => `<a class="l${h.level}" data-action="wiki-jump" data-value="nw-h-${h.id}">${h.id}. ${inline(h.title)}</a>`).join('')}</nav>`);
        break;
      case 'Heading': {
        const h = headings[hi++];
        if (h) out.push(`<h${h.level + 2} class="nw-h" id="nw-h-${h.id}" style="--nw:${color}"><span>${h.id}.</span> ${inline(h.title)}</h${h.level + 2}>`);
        break;
      }
      case 'List':
        list.push(inline(b.text.trim()));
        break;
      case 'Quote': {
        const parts = splitFields(b.text);
        const src = parts.slice(1).map(field).find(([k]) => k === 'Source')?.[1];
        out.push(`<blockquote class="nw-quote">${inline(parts[0])}${src ? `<cite>— ${inline(src)}</cite>` : ''}</blockquote>`);
        break;
      }
      case 'Table':
      case 'CategoryTable': {
        const fields = splitFields(b.text).map(field);
        const cap = fields.find(([k]) => k === 'Caption')?.[1];
        const c2 = fields.find(([k]) => k === 'Color')?.[1];
        const tc = /^#[0-9a-fA-F]{3,8}$/.test(c2 ?? '') ? c2 : color;
        const head = fields.find(([k]) => k === 'Head')?.[1];
        const rows = fields.filter(([k]) => k === 'Row' || k === 'RowHead');
        const cells = (v: string, tagName: string) => v.split(';;').map((x) => `<${tagName}>${inline(x.trim())}</${tagName}>`).join('');
        out.push(`<table class="nw-table${b.tag === 'CategoryTable' ? ' cat' : ''}" style="--nw:${tc}">${cap ? `<caption>${inline(cap)}</caption>` : ''}${head ? `<tr>${cells(head, 'th')}</tr>` : ''}${rows.map(([k, v]) => `<tr>${cells(v, k === 'RowHead' ? 'th' : 'td')}</tr>`).join('')}</table>`);
        break;
      }
      default:
        if (b.text.trim()) out.push(`<p class="nw-p">${inline(b.text.trim()).replace(/\n/g, '<br>')}</p>`);
    }
  }
  flushList();
  if (notes.length) out.push(`<ol class="nw-notes">${notes.map((n) => `<li>${n}</li>`).join('')}</ol>`);
  const links = (keys: string[]) => keys.map((k) => a[k]).filter((t): t is string => !!t && validTitle(t)).map((t) => o.canon(t));
  return { html: out.join(''), title: a.doc_title || '', related: links(['related1', 'related2', 'related3']), recent: links(['recent1', 'recent2', 'recent3']), headings: headings.map((h) => h.title) };
}

// ── 본편 요청에 넣는 문서 (원본 RC.wikiContext, v0.16.27) ──
// 이 채팅에서 쓴 문서를 최근에 만든 것부터 정한 개수만큼. 카드 기본 문서는 넣지 않는다 (원본도 저장 문서만).

export const NW_CONTEXT = '$nw_context';
export const wikiContextOn = (state: Record<string, unknown> | undefined): boolean => String(state?.[NW_CONTEXT] ?? '') === '1';

export function wikiMainContext(chat: Chat, rules: string, focus?: Focus | null, capOverride?: number): string {
  const s = chat.scriptstate;
  const count = advNum(s, 'nw', 'ctx_count');
  const cap = capOverride ?? advNum(s, 'nw', 'ctx_tokens');
  // 본편에 나온 문서만 (v0.16.27): 제목이나 그 항목의 다른 이름이 최근 본편에 나온 문서. 끄면 원본처럼 최근에 쓴 문서부터
  // 로어북 있는 문서는 본편에 그 로어북이 이미 들어가니 기본은 뺀다. 로어북 없이 창작한 문서는 위키가 유일한 출처라 기본은 넣는다.
  // 로어북 있는 주제도 창작으로 내용이 바뀔 수 있어 칩으로 따로 켤 수 있게 했다 (사용자 결정)
  const onlyMentioned = advOn(s, 'nw', 'ctx_focus');
  const withLore = advOn(s, 'nw', 'ctx_lore');
  const created = advOn(s, 'nw', 'ctx_created');
  const docs = listDocs(chat)
    .filter((d) => ((d.meta?.primarySources?.length ?? 0) > 0 ? withLore : created))
    .filter((d) => !onlyMentioned || related(focus, [d.title]) || !!focus?.terms.includes(d.title))
    .map((d, i) => ({ d, at: Number(d.meta?.created) || 0, i }))
    .sort((a, b) => b.at - a.at || b.i - a.i)
    .slice(0, count);
  const kept: Record<string, unknown>[] = [];
  const payload = () => `[MODULE_CONTEXT_BEGIN]\n${rules}\n${JSON.stringify({ feature: 'wiki', records: kept })}\n[MODULE_CONTEXT_END]`;
  for (const { d } of docs) {
    kept.unshift({ kind: 'wiki_reference', title: d.title, mode: d.meta?.mode ?? 'unknown', content: innerBody(d.body) });
    if (cap > 0 && tokens(payload()) > cap) kept.shift();
  }
  return kept.length ? payload() : '';
}

export function wikiContextRules(lore: LoreEntry[] | undefined): string | null {
  return policySections(lore, 'Wiki').MAIN_CONTEXT?.trim() || null;
}
