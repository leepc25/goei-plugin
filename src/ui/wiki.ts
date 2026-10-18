// 「위키」 탭: 목록·검색·작성 화면·문서 보기. 생성은 "위키 작성 시작"·"새로고침"을 눌렀을 때만 한 번 부른다.
// 생성은 창을 닫아도 계속되고, 끝나면 원래 채팅의 로어북에 저장한다.
import { factionNames, parseCatalog } from '../core/world/catalog';
import { buildRegistry, searchRegistry, type Registry } from '../core/world/registry';
import { hasBook, type RefSource } from '../core/refs';
import {
  acceptArticle, baseDocs, canonicalTitle, deleteDoc, findDoc, listDocs, renderArticle, saveDoc, validTitle, wikiPrompt, wikiSettings, WikiError,
  type WikiMeta, type WikiSettings,
} from '../core/wiki';
import { runModel } from '../host/llm';
import { saveVarDefaults } from '../host/prefs';
import { ICONS } from './icons';
import { toast } from './toast';
import { imageUrl } from './images';
import { readDirectory } from '../core/world/directory';
import { SIDO_NAME } from '../core/world/geo';
import { factionList } from '../core/factions';
import { updateChat, type ChatContext } from '../host/risu';

type WikiView = 'home' | 'compose' | 'doc' | 'settings' | 'new';
/** 명부 항목 분류: 괴이·특수·거점·인물·조직 */
type Cat = 'an' | 'ms' | 'lm' | 'ag' | 'org';

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
  /** 잠깐 떴다 사라지는 안내 */
  info: string;
  /** 왼쪽 목록이 본문 위로 펼쳐져 있는지 */
  listOpen: boolean;
  newTitle: string;
}

export const wiki: WikiState = {
  view: 'home', title: '', query: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, failure: null, notice: '', info: '', listOpen: false, newTitle: '',
};

export function resetWiki() {
  Object.assign(wiki, { view: 'home', title: '', query: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, notice: '', newTitle: '' });
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
  const parent = wiki.view === 'doc' ? findDoc(ctx.chat, wiki.title, ctx.char.globalLore) : null;
  if (findDoc(ctx.chat, title, ctx.char.globalLore)) {
    go('doc', title);
    return;
  }
  wiki.inherited = from === 'link' && parent?.meta ? parent.meta.primarySources : [];
  wiki.previousTitle = from === 'link' && parent ? parent.title : null;
  wiki.direct = from !== 'link';
  go('compose', title);
}

/** 검색줄 Enter·검색: 정확히 맞는 제목이면 바로 열고, 아무것도 안 맞으면 그 제목으로 작성 화면. 나머지는 왼쪽 목록이 걸러 보여 준다 */
function search(ctx: ChatContext, q: string) {
  const query = q.trim();
  wiki.query = query;
  if (!query) return;
  const c = canonicalTitle(registry(ctx), source(ctx), query);
  if (findDoc(ctx.chat, c.title, ctx.char.globalLore)) return go('doc', c.title, query);
  if (c.known) return openTitle(ctx, c.title, 'direct');
  const lower = query.toLowerCase();
  if (!matches(ctx, query).length && !listDocs(ctx.chat, ctx.char.globalLore).some((d) => d.title.toLowerCase().includes(lower))) return openTitle(ctx, c.title, 'direct');
  // 여러 개가 걸리면 목록을 펼쳐 고르게
  wiki.listOpen = true;
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
  const old = findDoc(ctx.chat, title, ctx.char.globalLore);
  const inherited = regenerate ? (old?.meta && !old.meta.direct ? old.meta.primarySources : []) : wiki.inherited;
  const direct = regenerate ? !!old?.meta?.direct : wiki.direct;
  const previousDoc = regenerate ? (s.refreshPrevious ? old : null) : wiki.previousTitle ? findDoc(ctx.chat, wiki.previousTitle, ctx.char.globalLore) : null;
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
// v0.16.23 (사용자 설계): 왼쪽 세로바는 위키 메인·작성·설정 세 버튼과 펼치기 자리. 세로바 빈 곳을 누르거나 옆으로 밀면
// 작성한 문서 목록(전화번호부처럼 가나다순)이 본문 위로 덮어 펼쳐진다. 본문 칸 크기는 그대로. PC·모바일 같은 구조.
// 명부 항목(괴이·특수·거점·인물·조직)은 검색할 때만 나온다. 첫 화면은 위키 메인 페이지.

interface Entry {
  cat: Cat;
  name: string;
  /** 위키 문서 제목 (정식 이름) */
  title: string;
  sub: string;
  /** 사진 에셋 이름 */
  photo: string;
  terms: string[];
}

const CAT_LABEL: Record<Cat, string> = { an: '괴이', ms: '특수', lm: '거점', ag: '인물', org: '조직' };
const CAT_ICON: Record<Cat, string> = { an: ICONS.info, ms: ICONS.spook, lm: ICONS.pin, ag: ICONS.idcard, org: ICONS.group };

let entryCache: { lore: unknown; list: Entry[] } | null = null;
function entries(ctx: ChatContext): Entry[] {
  if (entryCache && entryCache.lore === ctx.char.globalLore) return entryCache.list;
  const c = canon(ctx);
  const list: Entry[] = [];
  const dir = readDirectory(ctx.char.globalLore);
  for (const [cat, rows] of [['an', dir.anomalies], ['ms', dir.sites]] as const) {
    for (const p of rows) list.push({ cat, name: p.label, title: c(p.lore || p.label), sub: p.english, photo: p.english, terms: [p.label, p.english, ...p.aliases] });
  }
  try {
    for (const l of parseCatalog(ctx.char.globalLore).landmarks) {
      list.push({ cat: 'lm', name: l.name, title: c(l.name), sub: [SIDO_NAME[l.sido] ?? '', l.gu].filter(Boolean).join(' '), photo: '', terms: [l.name, l.english, ...l.aliases] });
    }
  } catch {
    /* 목록 로어북이 없으면 거점만 뺀다 */
  }
  for (const a of dir.agents) list.push({ cat: 'ag', name: a.name, title: c(a.lore || a.name), sub: [a.rank, a.department].filter(Boolean).join(' · ') || a.english, photo: a.english, terms: [a.name, a.english, ...a.aliases] });
  for (const f of factionList(ctx.char.globalLore)) {
    if (f.hidden) continue;
    list.push({ cat: 'org', name: f.name, title: c(f.name), sub: f.affiliation && f.affiliation !== f.name ? f.affiliation : '', photo: f.photo ?? '', terms: [f.name, f.affiliation] });
  }
  // 같은 문서로 이어지는 항목은 하나만
  const seen = new Set<string>();
  const out = list.filter((e) => (seen.has(`${e.cat}|${e.title}`) ? false : (seen.add(`${e.cat}|${e.title}`), true)));
  entryCache = { lore: ctx.char.globalLore, list: out };
  return out;
}

// 같은 문서로 이어지는 항목이 여럿이면 (예: 거점 「관리국 본부」와 조직 「관리국」) 이름이 제목과 같은 쪽
const entryFor = (ctx: ChatContext, title: string) => {
  const all = entries(ctx).filter((e) => e.title === title);
  return all.find((e) => e.name === title) ?? all[0];
};

function matches(ctx: ChatContext, q: string): Entry[] {
  const lower = q.toLowerCase();
  return entries(ctx).filter((e) => e.terms.some((t) => t && t.toLowerCase().includes(lower)));
}

/** 사진(카드 에셋) 또는 분류 아이콘 */
function face(ctx: ChatContext, e: Entry | undefined, cls = ''): string {
  const url = e?.photo ? imageUrl(ctx.char, e.photo) : null;
  return `<span class="ph-avatar nw-ava${cls}${e ? ` k-${e.cat}` : ''}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : e ? CAT_ICON[e.cat] : ICONS.book}</span>`;
}

function seg(action: string, cur: string, items: [string, string][]): string {
  return `<div class="gx-segs gx-segs-sm">${items.map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${v}" aria-pressed="${cur === v}">${label}</button>`).join('')}</div>`;
}

function busyLine(ctx: ChatContext): string {
  const job = jobs.get(chatKey(ctx));
  return job ? `<div class="nw-busy" role="status"><span class="nw-spin"></span>「${esc(job.title)}」 문서를 작성하는 중이에요. 창을 닫아도 계속돼요.</div>` : '';
}

const tool = (action: string, icon: string, label: string, extra = '', short = '') =>
  `<button class="ph-tool" data-action="${action}" aria-label="${label}" title="${label}" ${extra}>${icon}${short ? `<span class="ph-tool-l">${short}</span>` : ''}</button>`;

const blank = (text: string) => `<div class="ph-blank"><p>${text}</p></div>`;

const when = (sec: number) => new Date(sec * 1000).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });

/** 목록 한 줄: 사진, 이름·부제 */
function row(ctx: ChatContext, e: Entry | undefined, title: string, sub?: string): string {
  const on = (wiki.view === 'doc' || wiki.view === 'compose') && wiki.title === title;
  const small = sub ?? (e ? [e.title !== e.name ? e.title : '', e.sub].filter(Boolean).join(' · ') : '');
  return `<li class="ph-row"><button class="ph-main nw-row${on ? ' on' : ''}" data-action="wiki-pick" data-value="${esc(title)}">${face(ctx, e)}
    <span class="ph-who"><b>${esc(e?.name ?? title)}</b>${small ? `<small>${esc(small)}</small>` : ''}</span></button></li>`;
}

// 가나다 (된소리는 예사소리 묶음에, 로마자는 A, 나머지는 #)
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const PLAIN: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' };
const KEYS = [...'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ', 'A', '#'];
export function keyOf(title: string): string {
  const ch = title.trim().charAt(0);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) {
    const j = CHO[Math.floor((c - 0xac00) / 588)];
    return PLAIN[j] ?? j;
  }
  if (CHO.includes(ch)) return PLAIN[ch] ?? ch;
  return /[a-z]/i.test(ch) ? 'A' : '#';
}

function sortedDocs(ctx: ChatContext) {
  return listDocs(ctx.chat, ctx.char.globalLore)
    .map((d) => ({ d, k: KEYS.indexOf(keyOf(d.title)) }))
    .sort((x, y) => x.k - y.k || x.d.title.localeCompare(y.d.title, 'ko'))
    .map((x) => x.d);
}

/** 왼쪽 목록 (검색어를 바꾸면 이것만 다시 그린다) */
export function wikiList(ctx: ChatContext): string {
  const docs = sortedDocs(ctx);
  const saved = new Set(docs.map((d) => d.title));
  const q = wiki.query.trim();
  const dated = (d: (typeof docs)[number]) => {
    const e = entryFor(ctx, d.title);
    return row(ctx, e, d.title, e ? undefined : d.meta?.created ? when(d.meta.created) : '');
  };
  if (q) {
    const lower = q.toLowerCase();
    const mine = docs.filter((d) => d.title.toLowerCase().includes(lower) || entryFor(ctx, d.title)?.terms.some((t) => t && t.toLowerCase().includes(lower)));
    const hits = matches(ctx, q).filter((e) => !saved.has(e.title));
    const exact = canon(ctx)(q);
    const fresh = saved.has(exact) || hits.some((e) => e.title === exact)
      ? ''
      : `<ul class="ph-list"><li class="ph-row"><button class="ph-main nw-row nw-newrow" data-action="wiki-write" data-value="${esc(q)}"><span class="ph-avatar nw-ava">${ICONS.pen}</span><span class="ph-who"><b>「${esc(q)}」</b><small>이 제목으로 새 문서</small></span></button></li></ul>`;
    const docPart = mine.length ? `<h4 class="ph-sec">문서<b>${mine.length}</b></h4><ul class="ph-list">${mine.map(dated).join('')}</ul>` : '';
    const rosterPart = hits.length
      ? `<h4 class="ph-sec">명부<b>${hits.length}</b></h4><ul class="ph-list">${hits.map((e) => row(ctx, e, e.title, [CAT_LABEL[e.cat], e.sub].filter(Boolean).join(' · '))).join('')}</ul>`
      : '';
    return `${fresh}${docPart}${rosterPart}` || blank('검색 결과가 없어요.');
  }
  if (!docs.length) return blank('아직 작성한 문서가 없어요.<br>위에서 이름이나 제목을 검색해 보세요.');
  return KEYS.map((k) => {
    const rows = docs.filter((d) => keyOf(d.title) === k);
    return rows.length ? `<h4 class="ph-sec nw-ksec" data-ksec="${k}">${k}<b>${rows.length}</b></h4><ul class="ph-list">${rows.map(dated).join('')}</ul>` : '';
  }).join('');
}

/** 왼쪽 세로바: 위키 메인·새 문서·설정, 남은 자리는 목록 펼치기 (누르거나 옆으로 밀기) */
function rail(): string {
  const open = wiki.listOpen;
  const label = open ? '목록 접기' : '목록 펼치기';
  return `<nav class="nw-rail" aria-label="위키 메뉴">
    ${tool('wiki-home', ICONS.wiki, '위키 메인', wiki.view === 'home' ? 'aria-pressed="true"' : '')}
    ${tool('wiki-new', ICONS.pen, '새 문서', wiki.view === 'new' ? 'aria-pressed="true"' : '')}
    ${tool('wiki-settings', ICONS.settings, '위키 설정', wiki.view === 'settings' ? 'aria-pressed="true"' : '')}
    <button class="nw-grab" type="button" data-action="wiki-list" aria-expanded="${open}" aria-label="${label}" title="${label}"><span class="nw-grab-ico${open ? '' : ' flip'}">${ICONS.back}</span></button>
  </nav>`;
}

/** 위키 메인: 검색, 최근 문서, 전체 문서 */
function homeView(ctx: ChatContext): string {
  const docs = listDocs(ctx.chat, ctx.char.globalLore);
  const recent = docs.filter((d) => !d.base).sort((a, b) => (b.meta?.created ?? 0) - (a.meta?.created ?? 0)).slice(0, 8);
  const card = (d: (typeof docs)[number]) => {
    const e = entryFor(ctx, d.title);
    const url = e?.photo ? imageUrl(ctx.char, e.photo) : null;
    const sub = [e ? CAT_LABEL[e.cat] : '', d.meta?.created ? when(d.meta.created) : ''].filter(Boolean).join(' · ');
    return `<button class="nw-card" data-action="wiki-pick" data-value="${esc(d.title)}">
      <span class="nw-card-img${e ? ` k-${e.cat}` : ''}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : e ? CAT_ICON[e.cat] : ICONS.book}</span>
      <b>${esc(e?.name ?? d.title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  };
  // 전체 문서: 가나다 묶음마다 한 줄 (자음 + 문서 칩)
  const sorted = sortedDocs(ctx);
  const index = KEYS.map((k) => {
    const list = sorted.filter((d) => keyOf(d.title) === k);
    if (!list.length) return '';
    const items = list.map((d) => {
      const e = entryFor(ctx, d.title);
      return `<button class="nw-chip" data-action="wiki-pick" data-value="${esc(d.title)}">${face(ctx, e, ' xs')}<span>${esc(e?.name ?? d.title)}</span></button>`;
    }).join('');
    return `<div class="nw-irow"><b class="nw-ikey">${k}</b><div class="nw-chips">${items}</div></div>`;
  }).join('');
  return `<div class="nw-home">
    <section class="nw-hero">
      <div class="nw-hero-top"><span class="nw-hero-ico">${ICONS.wiki}</span><div class="nw-hero-t"><h2>괴이위키</h2><small>문서 ${docs.length}개</small></div></div>
      <div class="nw-hero-q"><input class="gx-search" type="search" name="wiki-home-q" data-enter="wiki-search" placeholder="이름·제목 검색" aria-label="위키 검색" autocomplete="off"></div>
    </section>
    <section class="nw-hsec"><h3>최근 작성된 문서</h3>${recent.length ? `<div class="nw-cards">${recent.map(card).join('')}</div>` : `<p class="nw-hnone">아직 작성한 문서가 없어요.</p>`}</section>
    ${docs.length ? `<section class="nw-hsec"><h3>전체 문서<b>${docs.length}</b></h3><div class="nw-index">${index}</div></section>` : ''}
  </div>`;
}

function paneHead(ctx: ChatContext, title: string, sub: string, right = '', e?: Entry): string {
  const back = wiki.history.some((h) => h.view !== 'home') ? `<button class="ph-tool ph-back" data-action="wiki-back" aria-label="뒤로">${ICONS.back}</button>` : '';
  return `<header class="ph-room-head${back ? '' : ' nw-noback'}">${back}
    ${e ? face(ctx, e, ' sm') : ''}<div class="ph-room-title"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${right ? `<span class="ph-act">${right}</span>` : ''}</header>`;
}

/** 위키 설정 */
function settingsView(ctx: ChatContext): string {
  const s = wikiSettings(ctx.chat.scriptstate);
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  const line = (label: string, control: string, hint = '') =>
    `<div class="ps-row"><div class="ps-label"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
  return `<div class="ph-form nw-setpane">${paneHead(ctx, '위키 설정', '지금 채팅에 적용돼요', `<button class="gx-mini ps-save" data-action="wiki-save-default" title="새 채팅도 지금 설정으로 시작해요">기본값으로 저장</button>`)}
    <div class="ph-form-body ps"><section class="ps-group"><h3>문서 작성</h3><div class="ps-rows">
      ${line('분량', seg('wiki-length', s.length, [['short', '짧게'], ['standard', '보통'], ['detailed', '상세']]))}
      ${line('작성 모드', seg('wiki-mode', s.mode, [['expand', '확장'], ['faithful', '원본 충실']]))}
      ${line('모델', seg('wiki-model', s.model, [['main', '메인'], ['aux', '보조']]))}
      ${line('새로고침 때 이전 문서 참고', seg('wiki-refresh_previous', s.refreshPrevious ? '1' : '0', [['1', '켜기'], ['0', '끄기']]))}
    </div></section>
    <section class="ps-group"><h3>작성 지침</h3><div class="ps-rows"><div class="ps-row">
      <textarea class="gx-search nw-reqbox" data-change="wiki-request" rows="3" placeholder="모든 문서 작성에 덧붙일 말투·형식·관점">${esc(req)}</textarea></div></div></section></div>
  </div>`;
}

/** 새 문서: 제목을 적고 작성 화면으로 */
function newView(ctx: ChatContext): string {
  return `<div class="ph-form">${paneHead(ctx, '새 문서', '')}
    <div class="ph-form-body"><label class="ph-label">제목<small>명부에 있는 이름이면 그 항목의 원본 로어북으로 작성해요</small></label>
      <input class="gx-search" name="wiki-new" data-input="wiki-new" data-enter="wiki-write" value="${esc(wiki.newTitle)}" maxlength="300" placeholder="문서 제목"></div>
    <div class="ph-form-foot"><button class="gx-start" data-action="wiki-write" data-take="wiki-new">작성 화면 열기</button></div></div>`;
}

/** 아직 없는 문서: 원본 자료 안내와 작성 시작 하나 */
function compose(ctx: ChatContext): string {
  const job = jobs.get(chatKey(ctx));
  const mine = job?.title === wiki.title;
  const lore = hasBook(source(ctx), wiki.title);
  const e = entryFor(ctx, wiki.title);
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  const src = lore
    ? '같은 이름의 로어북이 있어요. 그 내용을 원본으로 작성해요.'
    : wiki.inherited.length
      ? `로어북이 없어서 「${esc(wiki.previousTitle ?? '')}」 문서의 원본 자료(${esc(wiki.inherited.join(', '))})를 이어받아 작성해요.`
      : '같은 이름의 로어북이 없어요. 대화와 관련 자료를 바탕으로 작성해요.';
  return `<div class="ph-form">${paneHead(ctx, e?.name ?? wiki.title, e ? CAT_LABEL[e.cat] : '새 문서', '', e)}
    <div class="ph-form-body"><section class="nw-compose">
      ${face(ctx, e, ' lg')}
      <h2 class="nw-title">${esc(wiki.title)}</h2>
      <p class="nw-cmsg">이 문서는 아직 없어요.</p>
      <p class="gx-muted">${src}</p>
      ${req ? `<p class="nw-creq">작성 지침: ${esc(req)}</p>` : ''}
    </section></div>
    <div class="ph-form-foot"><button class="gx-start" data-action="wiki-start" data-value="${esc(wiki.title)}" ${job ? 'disabled' : ''}>${mine ? '작성하는 중…' : '작성 시작'}</button></div></div>`;
}

function docView(ctx: ChatContext): string {
  const doc = findDoc(ctx.chat, wiki.title, ctx.char.globalLore);
  if (!doc) {
    wiki.view = 'compose';
    return compose(ctx);
  }
  const c = canon(ctx);
  const saved = new Set(listDocs(ctx.chat, ctx.char.globalLore).map((d) => d.title));
  const e = entryFor(ctx, doc.title);
  const photo = e?.photo ? imageUrl(ctx.char, e.photo) : null;
  const r = renderArticle(doc.body, { saved: (t) => saved.has(t), canon: c, photo });
  const job = jobs.get(chatKey(ctx));
  // 상세·관련 문서: 사진이 붙은 칩, 아직 없는 문서는 흐리게
  const links = (label: string, list: string[]) =>
    list.length
      ? `<div class="nw-more"><b>${label}</b><div class="nw-chips">${list.map((t) => {
          const le = entryFor(ctx, t);
          return `<button class="nw-chip${saved.has(t) ? '' : ' none'}" data-action="wiki-open" data-value="${esc(t)}">${face(ctx, le, ' xs')}<span>${esc(le?.name ?? t)}</span></button>`;
        }).join('')}</div></div>`
      : '';
  const m = doc.meta;
  const info = m
    ? `<details class="nw-meta"><summary>참조 자료</summary><p>${m.mode === 'faithful' ? '원본 충실' : '확장'} · ${({ short: '짧게', standard: '보통', detailed: '상세' } as Record<string, string>)[m.length] ?? m.length} · ${m.model === 'aux' ? '보조 모델' : '메인 모델'}</p>
       ${m.sources.length ? `<p>${esc(m.sources.join(', '))}</p>` : ''}${m.writingRequest ? `<p>작성 지침: ${esc(m.writingRequest)}</p>` : ''}</details>`
    : '';
  const confirm = wiki.confirmDelete === doc.title;
  // 기본 문서는 지울 수 없고, 채팅에서 새로 쓴 문서를 지우면 기본 문서로 돌아간다
  const hasBase = baseDocs(ctx.char.globalLore).some((d) => d.title === doc.title);
  const del = doc.base
    ? ''
    : confirm
      ? `<button class="gx-mini danger" data-action="wiki-delete" data-value="${esc(doc.title)}">${hasBase ? '되돌리기' : '정말 삭제'}</button>`
      : tool('wiki-delete', ICONS.trash, hasBase ? '기본 문서로 되돌리기' : '문서 삭제', `data-value="${esc(doc.title)}"`);
  const right = `${tool('wiki-rewrite', ICONS.refresh, job?.title === doc.title ? '작성하는 중' : '새로고침', `data-value="${esc(doc.title)}" ${job ? 'disabled' : ''}`)}${del}`;
  const sub = [e ? CAT_LABEL[e.cat] : '', doc.base ? '기본 문서' : m?.created ? when(m.created) : ''].filter(Boolean).join(' · ');
  return `<div class="ph-room nw-pane">${paneHead(ctx, e?.name ?? doc.title, sub, right, e)}
    <article class="nw-doc">
      <header class="nw-dochead"><h2 class="nw-title">${esc(doc.title)}</h2>${e && e.sub && e.cat !== 'lm' ? `<small>${esc(e.sub)}</small>` : ''}</header>
      <div class="nw-body">${r.html}</div>
      ${links('상세 문서', r.related)}${links('관련 문서', r.recent)}${info}
    </article></div>`;
}

function paneHtml(ctx: ChatContext): string {
  if (wiki.view === 'doc') return docView(ctx);
  if (wiki.view === 'compose') return compose(ctx);
  if (wiki.view === 'settings') return settingsView(ctx);
  if (wiki.view === 'new') return newView(ctx);
  return homeView(ctx);
}

export function wikiTab(ctx: ChatContext): string {
  const fail = wiki.failure
    ? `<details class="nw-fail"><summary>최근 실패 원문 (${esc(wiki.failure.title)})</summary><p>${esc(wiki.failure.reason)}</p><textarea class="gx-search" rows="6" readonly>${esc(wiki.failure.raw)}</textarea></details>`
    : '';
  const note = toast('nw', wiki.info, (t) => {
    if (wiki.info === t) wiki.info = '';
  });
  const status = `${busyLine(ctx)}${wiki.notice ? `<div class="gx-err" role="alert">${esc(wiki.notice)}</div>` : ''}`;
  const open = wiki.listOpen;
  return `<main class="gx-body ph-app nw nw-app${open ? ' list-open' : ''}">
    ${rail()}
    <aside class="nw-panel" aria-label="위키 목록"${open ? '' : ' inert'}><div class="nw-pin">
        <div class="nw-search"><input class="gx-search ph-search" type="search" name="wiki-q" data-input="wiki-query" data-enter="wiki-search" placeholder="이름·제목 검색" value="${esc(wiki.query)}" aria-label="위키 검색" autocomplete="off"></div>
        <div class="ph-content nw-list">${wikiList(ctx)}</div>
        ${fail}
      </div></aside>
    <button class="nw-scrim" type="button" data-action="wiki-list" data-value="close" aria-label="목록 접기" tabindex="-1"></button>
    <section class="ph-pane nw-main"><div class="nw-status">${status}</div>${paneHtml(ctx)}</section>
    ${note}
  </main>`;
}

/** 목록 서랍: 세로바를 옆으로 밀면(마우스 끌기 포함) 펼치고, 펼친 목록을 왼쪽으로 밀면 접는다 */
export function bindWikiSide(root: HTMLElement, act: (value: string) => void): void {
  const bar = root.querySelector<HTMLElement>('.nw-rail');
  const panel = root.querySelector<HTMLElement>('.nw-panel');
  if (!bar || !panel) return;
  let x0: number | null = null;
  let dragged = false;
  // 손가락·마우스가 세로바 밖에서 떨어져도 알 수 있게 창 전체에서 받는다
  const up = (e: PointerEvent) => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    x0 = null;
    if (Math.abs(dx) < 30) return;
    dragged = true;
    if (dx > 0 && !wiki.listOpen) act('open');
    else if (dx < 0 && wiki.listOpen) act('close');
  };
  bar.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    dragged = false;
    window.addEventListener('pointerup', up, { once: true });
  });
  // 끈 다음에 따라오는 누르기는 무시
  bar.addEventListener('click', (e) => {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  let t0: { x: number; y: number } | null = null;
  panel.addEventListener('touchstart', (e) => (t0 = { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 }), { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (!t0) return;
    const dx = (e.changedTouches[0]?.clientX ?? t0.x) - t0.x;
    const dy = (e.changedTouches[0]?.clientY ?? t0.y) - t0.y;
    t0 = null;
    if (dx < -36 && Math.abs(dx) > Math.abs(dy) * 1.5 && wiki.listOpen) act('close');
  }, { passive: true });
}

const wide = () => !matchMedia('(max-width: 760px)').matches;

/** 위키 탭의 버튼. 처리했으면 true */
export async function handleWiki(action: string, value: string | undefined, ctx: ChatContext, env: WikiEnv): Promise<boolean> {
  const v = value ?? '';
  if (action !== 'wiki-delete') wiki.confirmDelete = null;
  switch (action) {
    case 'wiki-home':
      go('home');
      wiki.history = [];
      wiki.listOpen = false;
      break;
    case 'wiki-back': {
      // 문서 안 링크로 옮겨 다닌 길을 거슬러 가고, 처음 화면이면 목록으로
      const prev = wiki.history.pop();
      if (prev && prev.view !== 'home') Object.assign(wiki, { view: prev.view, title: prev.title }, { confirmDelete: null, notice: '' });
      else Object.assign(wiki, { view: 'home', title: '', notice: '' }, { history: [] });
      break;
    }
    case 'wiki-list':
      wiki.listOpen = v === 'open' ? true : v === 'close' ? false : !wiki.listOpen;
      env.render();
      if (wiki.listOpen && wide() && !v) document.querySelector<HTMLInputElement>('.nw .ph-search')?.focus();
      return true;
    case 'wiki-search':
      search(ctx, v);
      if (wiki.view === 'compose' || wiki.view === 'doc') wiki.listOpen = false;
      break;
    case 'wiki-pick':
      // 왼쪽 목록에서 고르기. PC는 열린 항목을 다시 누르면 닫힌다
      if ((wiki.view === 'doc' || wiki.view === 'compose') && canon(ctx)(v) === wiki.title && wide()) {
        Object.assign(wiki, { view: 'home', title: '', history: [] });
        break;
      }
      wiki.history = [];
      openTitle(ctx, v, 'search');
      // 고르면 목록을 접어 문서를 넓게
      if (wiki.view !== 'home') wiki.listOpen = false;
      break;
    case 'wiki-open':
      // 문서 안 링크·관련 문서 칩: 없는 문서는 부모 문서의 원본 자료를 물려받는다
      openTitle(ctx, v, wiki.view === 'doc' ? 'link' : 'search');
      break;
    case 'wiki-write':
      if (!v.trim()) break;
      wiki.newTitle = '';
      openTitle(ctx, v, 'direct');
      if (wiki.view === 'compose' || wiki.view === 'doc') wiki.listOpen = false;
      break;
    case 'wiki-new':
      if (wiki.view === 'new') go('home');
      else go('new');
      wiki.listOpen = false;
      break;
    case 'wiki-start':
      if (wiki.view === 'compose' && wiki.title === v) void generate(ctx, env, v, false);
      break;
    case 'wiki-rewrite':
      if (!v) break;
      if (wiki.view !== 'doc') go('doc', v);
      void generate(ctx, env, v, true);
      break;
    case 'wiki-delete':
      if (wiki.confirmDelete !== v) {
        wiki.confirmDelete = v;
        break;
      }
      wiki.confirmDelete = null;
      if (wiki.title === v && wiki.view === 'doc' && !baseDocs(ctx.char.globalLore).some((d) => d.title === v)) Object.assign(wiki, { view: 'home', title: '', history: [] });
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
    case 'wiki-refresh_previous':
      await setVar(ctx, env, `$nw_${action.slice(5)}`, v);
      return true;
    case 'wiki-settings':
      if (wiki.view === 'settings') go('home');
      else go('settings');
      wiki.listOpen = false;
      break;
    case 'wiki-save-default':
      try {
        await saveVarDefaults(['$nw_'], ctx.chat.scriptstate);
        wiki.info = '지금 위키 설정을 새 채팅 기본값으로 저장했어요.';
      } catch (error) {
        wiki.notice = `기본값을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      break;
    default:
      return false;
  }
  env.render();
  return true;
}

/** 입력칸 (다시 그리지 않음) */
export function wikiInput(name: string, value: string): boolean {
  if (name === 'wiki-new') return void (wiki.newTitle = value), true;
  return false;
}
