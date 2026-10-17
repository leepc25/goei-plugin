// 「위키」 탭: 목록·검색·작성 화면·문서 보기. 생성은 "위키 작성 시작"·"새로고침"을 눌렀을 때만 한 번 부른다.
// 생성은 창을 닫아도 계속되고, 끝나면 원래 채팅의 로어북에 저장한다.
import { factionNames, parseCatalog } from '../core/world/catalog';
import { buildRegistry, searchRegistry, type Registry } from '../core/world/registry';
import { hasBook, type RefSource } from '../core/refs';
import {
  acceptArticle, canonicalTitle, deleteDoc, findDoc, listDocs, renderArticle, saveDoc, validTitle, wikiPrompt, wikiSettings, WikiError,
  type WikiMeta, type WikiSettings,
} from '../core/wiki';
import { runModel } from '../host/llm';
import { updateChat, type ChatContext } from '../host/risu';

type WikiView = 'home' | 'query' | 'compose' | 'doc';

interface WikiState {
  view: WikiView;
  title: string;
  query: string;
  history: { view: WikiView; title: string; query: string }[];
  /** 작성 화면: 링크로 들어왔으면 부모 문서의 원본 자료를 물려받는다 */
  inherited: string[];
  previousTitle: string | null;
  direct: boolean;
  confirmDelete: string | null;
  failure: { title: string; reason: string; raw: string } | null;
  notice: string;
}

export const wiki: WikiState = {
  view: 'home', title: '', query: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, failure: null, notice: '',
};

export function resetWiki() {
  Object.assign(wiki, { view: 'home', title: '', query: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, notice: '' });
}

interface Job {
  title: string;
  started: number;
}
/** 채팅마다 하나씩 (원본도 한 번에 하나) */
const jobs = new Map<string, Job>();
const chatKey = (ctx: ChatContext) => `${ctx.charIndex}:${ctx.chatIndex}`;

export interface WikiEnv {
  render(): void;
  refresh(): Promise<void>;
  /** 지금 창이 보고 있는 채팅 */
  current(): ChatContext | null;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

let regCache: { lore: unknown; reg: Registry } | null = null;
function registry(ctx: ChatContext): Registry {
  if (!regCache || regCache.lore !== ctx.char.globalLore) regCache = { lore: ctx.char.globalLore, reg: buildRegistry(ctx.char.globalLore) };
  return regCache.reg;
}
const source = (ctx: ChatContext): RefSource => ({ char: ctx.char as RefSource['char'], chat: ctx.chat });
function canon(ctx: ChatContext) {
  const r = registry(ctx);
  const src = source(ctx);
  return (t: string) => canonicalTitle(r, src, t).title;
}

function go(view: WikiView, title = '', query = wiki.query) {
  if (wiki.view !== view || wiki.title !== title) wiki.history.push({ view: wiki.view, title: wiki.title, query: wiki.query });
  if (wiki.history.length > 30) wiki.history.shift();
  wiki.view = view;
  wiki.title = title;
  wiki.query = query;
  wiki.confirmDelete = null;
  wiki.notice = '';
}

/** 제목 열기: 저장된 문서면 보기, 없으면 작성 화면 (열기만으로는 생성하지 않음) */
function openTitle(ctx: ChatContext, raw: string, from: 'link' | 'direct' | 'search') {
  const title = canon(ctx)(raw.trim());
  if (!validTitle(title)) {
    wiki.notice = '쓸 수 없는 제목이에요. 꺾쇠(<>), 줄바꿈, {{ }} 없이 300자 이내로 적어 주세요.';
    return;
  }
  const parent = wiki.view === 'doc' ? findDoc(ctx.chat, wiki.title) : null;
  if (findDoc(ctx.chat, title)) {
    go('doc', title);
    return;
  }
  wiki.inherited = from === 'link' && parent?.meta ? parent.meta.primarySources : [];
  wiki.previousTitle = from === 'link' && parent ? parent.title : null;
  wiki.direct = from !== 'link';
  go('compose', title);
}

function search(ctx: ChatContext, q: string) {
  const query = q.trim();
  if (!query) return;
  const c = canonicalTitle(registry(ctx), source(ctx), query);
  if (findDoc(ctx.chat, c.title)) return go('doc', c.title, query);
  if (c.known) return openTitle(ctx, c.title, 'direct');
  const docs = listDocs(ctx.chat).filter((d) => d.title.toLowerCase().includes(query.toLowerCase()));
  const hits = searchRegistry(registry(ctx), query);
  if (!docs.length && !hits.length) return openTitle(ctx, c.title, 'direct');
  go('query', '', query);
}

// ── 생성 ──

async function generate(ctx: ChatContext, env: WikiEnv, title: string, regenerate: boolean): Promise<void> {
  const key = chatKey(ctx);
  if (jobs.has(key)) {
    wiki.notice = `「${jobs.get(key)!.title}」 문서를 만드는 중이에요. 끝난 뒤 다시 눌러 주세요.`;
    env.render();
    return;
  }
  const s: WikiSettings = wikiSettings(ctx.chat.scriptstate);
  const old = findDoc(ctx.chat, title);
  const inherited = regenerate ? (old?.meta && !old.meta.direct ? old.meta.primarySources : []) : wiki.inherited;
  const direct = regenerate ? !!old?.meta?.direct : wiki.direct;
  const previousDoc = regenerate ? (s.refreshPrevious ? old : null) : wiki.previousTitle ? findDoc(ctx.chat, wiki.previousTitle) : null;
  const writingRequest = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  jobs.set(key, { title, started: Date.now() });
  wiki.failure = null;
  wiki.notice = '';
  env.render();
  try {
    const catalogNames = (() => {
      try {
        return factionNames(parseCatalog(ctx.char.globalLore), String(ctx.chat.scriptstate?.['$st_faction'] ?? ''));
      } catch {
        return {};
      }
    })();
    const prompt = wikiPrompt(source(ctx), { title, inherited, previous: previousDoc?.body ?? null, writingRequest, direct }, s, catalogNames, registry(ctx));
    const raw = await runModel(prompt.messages, s.model);
    let body: string;
    try {
      body = acceptArticle(raw, title, canon(ctx));
    } catch (error) {
      wiki.failure = { title, reason: error instanceof Error ? error.message : String(error), raw };
      throw error;
    }
    const meta: WikiMeta = {
      title, mode: s.mode, model: s.model, created: Math.floor(Date.now() / 1000), length: s.length, sources: prompt.sources,
      primarySources: prompt.primarySources.length ? prompt.primarySources : inherited, writingRequest, direct,
    };
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => saveDoc(chat, meta, body));
    // 아직 그 작성 화면을 보고 있으면 문서로 넘어간다
    const cur = env.current();
    if (cur && chatKey(cur) === key && (wiki.view === 'compose' || wiki.view === 'doc') && wiki.title === title) wiki.view = 'doc';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    wiki.notice = `「${title}」 문서를 만들지 못했어요. ${msg}${old ? ' 기존 문서는 그대로 두었어요.' : ''}`;
    if (!wiki.failure && !(error instanceof WikiError)) wiki.failure = { title, reason: msg, raw: (error as { raw?: string }).raw ?? '' };
  } finally {
    jobs.delete(key);
    await env.refresh();
  }
}

async function setVar(ctx: ChatContext, env: WikiEnv, key: string, value: string) {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [key]: value } }));
  await env.refresh();
}

// ── 화면 ──

function seg(action: string, cur: string, items: [string, string][]): string {
  return `<div class="gx-segs gx-segs-sm">${items.map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${v}" aria-pressed="${cur === v}">${label}</button>`).join('')}</div>`;
}

function busyLine(ctx: ChatContext): string {
  const job = jobs.get(chatKey(ctx));
  return job ? `<div class="nw-busy" role="status"><span class="nw-spin"></span>「${esc(job.title)}」 문서를 작성하는 중이에요. 창을 닫아도 계속돼요.</div>` : '';
}

const SUGGEST = { html: '' };

/** 입력하는 동안 보이는 후보: 저장된 문서, 로어북 이름, 이 제목으로 새로 쓰기 */
export function wikiSuggest(ctx: ChatContext, q: string): string {
  const query = q.trim();
  if (!query) return '';
  const lower = query.toLowerCase();
  const docs = listDocs(ctx.chat).filter((d) => d.title.toLowerCase().includes(lower)).slice(0, 6);
  const hits = searchRegistry(registry(ctx), query).filter((e) => e.lore && !docs.some((d) => d.title === e.lore)).slice(0, 8);
  const items = [
    ...docs.map((d) => `<button class="nw-sugg" data-action="wiki-open" data-value="${esc(d.title)}"><b>${esc(d.title)}</b><span class="gx-badge live">문서 있음</span></button>`),
    ...hits.map((e) => `<button class="nw-sugg" data-action="wiki-open" data-value="${esc(e.lore)}"><b>${esc(e.name)}</b>${e.lore !== e.name ? `<span class="gx-loc">${esc(e.lore)}</span>` : ''}<span class="gx-badge wait">작성 화면</span></button>`),
  ];
  if (!docs.some((d) => d.title === query) && !hits.some((e) => e.lore === query || e.name === query)) {
    items.push(`<button class="nw-sugg" data-action="wiki-write" data-value="${esc(query)}"><b>${esc(query)}</b><span class="gx-badge wait">이 제목으로 새로 쓰기</span></button>`);
  }
  return items.join('');
}

function searchBar(): string {
  // Risu 플러그인 창은 form 제출이 막힌 iframe이라 form을 쓰지 않는다 (Enter·버튼을 직접 처리)
  return `<div class="nw-search"><input class="gx-search" type="search" name="wiki-q" data-input="wiki-query" data-enter="wiki-search" placeholder="문서 제목 검색 또는 새 제목" value="${esc(wiki.query)}" aria-label="위키 검색" autocomplete="off"><button class="gx-mini" data-action="wiki-search" data-take="wiki-q">검색</button></div>
    <div class="nw-suggest" role="listbox">${SUGGEST.html}</div>`;
}

function requestBox(ctx: ChatContext): string {
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  return `<details class="nw-req"${req ? ' open' : ''}><summary>작성 지침${req ? ' · 사용 중' : ''}</summary>
    <textarea class="gx-search nw-reqbox" data-change="wiki-request" rows="3" placeholder="예: 도시전설 게시판 말투로, 목격담 위주로">${esc(req)}</textarea>
    <p class="gx-muted">비우기 전까지 이후 모든 문서 작성에 쓰여요.</p></details>`;
}

function home(ctx: ChatContext): string {
  const s = wikiSettings(ctx.chat.scriptstate);
  const docs = listDocs(ctx.chat).slice().reverse();
  const rows = docs
    .map((d) => {
      const confirm = wiki.confirmDelete === d.title;
      return `<li class="gx-ev"><button class="gx-evmain" data-action="wiki-open" data-value="${esc(d.title)}"><span class="gx-row"><b>${esc(d.title)}</b></span>
        ${d.meta?.created ? `<span class="gx-loc">${new Date(d.meta.created * 1000).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}</span>` : ''}</button>
        <div class="gx-evact"><button class="gx-mini" data-action="wiki-rewrite" data-value="${esc(d.title)}">재작성</button>
        <button class="gx-mini${confirm ? ' danger' : ''}" data-action="wiki-delete" data-value="${esc(d.title)}">${confirm ? '정말 삭제' : '삭제'}</button></div></li>`;
    })
    .join('');
  return `${searchBar()}${requestBox(ctx)}
    <div class="nw-settings">
      <label>분량</label>${seg('wiki-length', s.length, [['short', '짧게'], ['standard', '보통'], ['detailed', '상세']])}
      <label>작성 모드</label>${seg('wiki-mode', s.mode, [['expand', '확장'], ['faithful', '원본 충실']])}
      <label>모델</label>${seg('wiki-model', s.model, [['main', '메인'], ['aux', '보조']])}
    </div>
    <section class="gx-sec"><h2>문서<small>${docs.length}</small></h2>
    ${docs.length ? `<ul class="gx-list gx-evs">${rows}</ul>` : '<p class="gx-none">아직 문서가 없어요. 위에서 제목을 검색하거나 새 제목을 적어 보세요.</p>'}</section>`;
}

function queryView(ctx: ChatContext): string {
  const q = wiki.query.trim();
  const docs = listDocs(ctx.chat).filter((d) => d.title.toLowerCase().includes(q.toLowerCase()));
  const hits = searchRegistry(registry(ctx), q).filter((e) => !docs.some((d) => d.title === (e.lore || e.name)));
  const exact = canon(ctx)(q);
  const shown = new Set([...docs.map((d) => d.title), ...hits.map((e) => e.lore)]);
  return `${searchBar()}
    <section class="gx-sec"><h2>「${esc(q)}」 검색 결과</h2><ul class="gx-list gx-evs">
      ${docs.map((d) => `<li><button class="gx-evmain" data-action="wiki-open" data-value="${esc(d.title)}"><span class="gx-row"><b>${esc(d.title)}</b><span class="gx-badge live">문서 있음</span></span></button></li>`).join('')}
      ${hits.map((e) => (e.lore
        ? `<li><button class="gx-evmain" data-action="wiki-open" data-value="${esc(e.lore)}"><span class="gx-row"><b>${esc(e.name)}</b><span class="gx-badge wait">작성 화면</span></span>${e.lore !== e.name ? `<span class="gx-loc">${esc(e.lore)}</span>` : ''}</button></li>`
        : `<li><div class="gx-evmain"><span class="gx-row"><b>${esc(e.name)}</b><span class="gx-badge">연결 미지정</span></span></div></li>`)).join('')}
      ${shown.has(exact) ? '' : `<li><button class="gx-evmain" data-action="wiki-write" data-value="${esc(q)}"><span class="gx-row"><b>${esc(q)}</b><span class="gx-badge wait">이 제목으로 작성</span></span></button></li>`}
    </ul></section>`;
}

function compose(ctx: ChatContext): string {
  const job = jobs.get(chatKey(ctx));
  const mine = job?.title === wiki.title;
  const lore = hasBook(source(ctx), wiki.title);
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  return `<section class="nw-compose">
    <h2 class="nw-title">${esc(wiki.title)}</h2>
    <p class="gx-muted">${lore ? '같은 이름의 로어북이 있어요. 그 내용을 원본으로 작성해요.' : wiki.inherited.length ? `로어북이 없어서 「${esc(wiki.previousTitle ?? '')}」 문서의 원본 자료(${esc(wiki.inherited.join(', '))})를 이어받아 작성해요.` : '같은 이름의 로어북이 없어요. 대화와 관련 자료를 바탕으로 작성해요.'}</p>
    ${req ? `<p class="gx-hint">작성 지침: ${esc(req)}</p>` : ''}
    <button class="gx-start" data-action="wiki-start" data-value="${esc(wiki.title)}" ${job ? 'disabled' : ''}>${mine ? '작성하는 중…' : '위키 작성 시작'}</button>
  </section>${requestBox(ctx)}`;
}

function docView(ctx: ChatContext): string {
  const doc = findDoc(ctx.chat, wiki.title);
  if (!doc) {
    wiki.view = 'compose';
    return compose(ctx);
  }
  const c = canon(ctx);
  const saved = new Set(listDocs(ctx.chat).map((d) => d.title));
  const r = renderArticle(doc.body, { saved: (t) => saved.has(t), canon: c });
  const job = jobs.get(chatKey(ctx));
  const links = (label: string, list: string[]) =>
    list.length ? `<div class="nw-more"><b>${label}</b>${list.map((t) => `<button class="nw-link${saved.has(t) ? ' on' : ''}" data-action="wiki-open" data-value="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : '';
  const m = doc.meta;
  const info = m
    ? `<details class="nw-meta"><summary>참조 자료</summary><p>${m.mode === 'faithful' ? '원본 충실' : '확장'} · ${({ short: '짧게', standard: '보통', detailed: '상세' } as Record<string, string>)[m.length] ?? m.length} · ${m.model === 'aux' ? '보조 모델' : '메인 모델'}</p>
       ${m.sources.length ? `<p>${esc(m.sources.join(', '))}</p>` : ''}${m.writingRequest ? `<p>작성 지침: ${esc(m.writingRequest)}</p>` : ''}</details>`
    : '';
  return `<article class="nw-doc">
    <header class="nw-dochead"><h2 class="nw-title">${esc(doc.title)}</h2>
      <button class="gx-mini" data-action="wiki-rewrite" data-value="${esc(doc.title)}" ${job ? 'disabled' : ''}>${job?.title === doc.title ? '작성하는 중…' : '↻ 새로고침'}</button></header>
    <div class="nw-body">${r.html}</div>
    ${links('상세 문서', r.related)}${links('관련 문서', r.recent)}${info}
  </article>`;
}

export function wikiTab(ctx: ChatContext): string {
  SUGGEST.html = wiki.view === 'query' ? '' : wikiSuggest(ctx, wiki.query);
  const back = wiki.history.length ? '<button class="gx-mini" data-action="wiki-back">← 뒤로</button>' : '';
  const nav = `<div class="nw-nav">${back}<button class="gx-mini" data-action="wiki-home">목록</button></div>`;
  const view = wiki.view === 'doc' ? docView(ctx) : wiki.view === 'compose' ? compose(ctx) : wiki.view === 'query' ? queryView(ctx) : home(ctx);
  const fail = wiki.failure
    ? `<details class="nw-fail"><summary>최근 실패 원문 (${esc(wiki.failure.title)})</summary><p>${esc(wiki.failure.reason)}</p><textarea class="gx-search" rows="6" readonly>${esc(wiki.failure.raw)}</textarea></details>`
    : '';
  return `<main class="gx-body nw">${wiki.view === 'home' ? '' : nav}${busyLine(ctx)}${wiki.notice ? `<div class="gx-err" role="alert">${esc(wiki.notice)}</div>` : ''}${view}${fail}</main>`;
}

/** 위키 탭의 버튼. 처리했으면 true */
export async function handleWiki(action: string, value: string | undefined, ctx: ChatContext, env: WikiEnv): Promise<boolean> {
  const v = value ?? '';
  switch (action) {
    case 'wiki-home':
      go('home');
      wiki.history = [];
      break;
    case 'wiki-back': {
      const prev = wiki.history.pop();
      if (prev) Object.assign(wiki, prev, { confirmDelete: null, notice: '' });
      break;
    }
    case 'wiki-search':
      search(ctx, v);
      break;
    case 'wiki-open':
      openTitle(ctx, v, wiki.view === 'doc' ? 'link' : 'search');
      break;
    case 'wiki-write':
      openTitle(ctx, v, 'direct');
      break;
    case 'wiki-start':
      if (wiki.view === 'compose' && wiki.title === v) void generate(ctx, env, v, false);
      break;
    case 'wiki-rewrite':
      if (wiki.view !== 'doc') go('doc', v);
      void generate(ctx, env, v, true);
      break;
    case 'wiki-delete':
      if (wiki.confirmDelete !== v) {
        wiki.confirmDelete = v;
        break;
      }
      wiki.confirmDelete = null;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => deleteDoc(chat, v));
      await env.refresh();
      return true;
    case 'wiki-jump': {
      document.getElementById(v)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    case 'wiki-request':
      await setVar(ctx, env, '$nw_writing_request', v.trim());
      return true;
    case 'wiki-length':
    case 'wiki-mode':
    case 'wiki-model':
      await setVar(ctx, env, `$nw_${action.slice(5)}`, v);
      return true;
    default:
      return false;
  }
  env.render();
  return true;
}
