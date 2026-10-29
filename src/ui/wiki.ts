// 「위키」 탭: 목록·검색·작성 화면·문서 보기. 생성은 "위키 작성 시작"·"새로고침"을 눌렀을 때만 한 번 부른다.
// 생성은 창을 닫아도 계속되고, 끝나면 원래 채팅의 로어북에 저장한다.
import { onOffSwitch } from './controls';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { buildRegistry, type Registry } from '../core/world/registry';
import { hasBook, type RefSource } from '../core/refs';
import {
  type WikiDoc, acceptArticle, baseDocs, canonicalTitle, deleteDoc, findDoc, listDocs, renderArticle, saveDoc, validTitle, wikiPrompt, wikiSettings, WikiError,
  type WikiMeta, type WikiSettings, wikiContextOn,
} from '../core/wiki';
import { generate as askModel } from '../host/llm';
import { budgetFor, genSettings } from '../core/advanced';
import { fitPrompt } from '../core/budget';
import { advancedBox } from './advanced';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { GHOST_ICON, ICONS } from './icons';
import { defaultsAction, defaultsButtons, defaultsConfirm } from './defaults';
import { toast } from './toast';
import { drawerHtml } from './drawer';
import { imageUrl } from './images';
import { baseLink, basePic as baseArt } from './evpic';
import { orgLoreName, orgLores, readDirectory } from '../core/world/directory';
import { facePic, mainPic, moduleAssetStamp } from '../host/assets';
import { readWorld, worldOn } from '../core/world/output';
import { activeEvents } from '../core/world/engine';
import { lastStatusFields } from '../core/world/tags';
import { placeWhere } from '../core/world/geo';
import { factionList } from '../core/factions';
import { updateChat, type ChatContext } from '../host/risu';

/** 위키는 문서만 (2026-10-29: 이 채팅의 인물·개인 기록·세력·기록 문서 화면은 왼쪽 메뉴 「기록」으로 옮겼다, ui/records.ts) */
type WikiView = 'home' | 'compose' | 'doc' | 'settings' | 'new';
/** 명부 항목 분류: 괴이·특수·거점·인물·조직 */
type Cat = 'an' | 'ms' | 'lm' | 'ag' | 'org';
/** 서랍 탭. 세력은 거점과 조직을 함께, 명부에 없는 새 주제는 기타 (사람 문서면 인물) */
type Tab = 'all' | 'story' | 'an' | 'ms' | 'ag' | 'fac' | 'etc';
const TABS: [Tab, string][] = [['all', '전체'], ['story', '이번 이야기'], ['an', '괴이'], ['ms', '특수'], ['ag', '인물'], ['fac', '세력'], ['etc', '기타']];

interface WikiState {
  view: WikiView;
  title: string;
  query: string;
  /** 메인 화면 검색칸 (입력하는 대로 아래에 결과) */
  homeQuery: string;
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
  /** 서랍 목록 탭: 전체·이번 이야기·분류·기타 */
  tab: Tab;
  newTitle: string;
  /** 작성·다시 쓰기 화면의 「이 문서 지침」 */
  docReq: string;
  /** 다시 쓰기 칸을 연 문서 제목, 그 칸의 「이전 문서 참고」 */
  rewrite: string | null;
  rewritePrev: boolean;
}

export const wiki: WikiState = {
  view: 'home', title: '', query: '', homeQuery: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, failure: null, notice: '', info: '', listOpen: false, tab: 'all', newTitle: '', docReq: '', rewrite: null, rewritePrev: true,
};

export function resetWiki() {
  Object.assign(wiki, { view: 'home', title: '', query: '', homeQuery: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, notice: '', newTitle: '', docReq: '', rewrite: null });
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
const source = (ctx: ChatContext): RefSource => playerSource({ char: ctx.char as RefSource['char'], chat: ctx.chat, persona: personaText() } as RefSource);
function canon(ctx: ChatContext) {
  const r = registry(ctx);
  const src = source(ctx);
  return (t: string) => ownDoc(ctx, t) ?? canonicalTitle(r, src, t).title;
}
/** 그 제목 그대로 된 문서가 있으면 별칭보다 먼저 (거점 「백일몽 본사」는 조직 「백일몽」과 다른 문서, 2026-10-21 사용자) */
function ownDoc(ctx: ChatContext, t: string): string | null {
  const title = t.trim();
  return title && findDoc(ctx.chat, title, ctx.char.globalLore) ? title : null;
}

function go(view: WikiView, title = '', query = wiki.query) {
  if (wiki.view !== view || wiki.title !== title) wiki.history.push({ view: wiki.view, title: wiki.title, query: wiki.query });
  if (wiki.history.length > 30) wiki.history.shift();
  if (wiki.view !== view || wiki.title !== title) Object.assign(wiki, { docReq: '', rewrite: null });
  wiki.view = view;
  wiki.title = title;
  wiki.query = query;
  wiki.confirmDelete = null;
  wiki.notice = '';
}

/** 메인 설정의 「위키」 버튼: 위키 설정을 바로 연다 */
export function openWikiSettings() {
  if (wiki.view !== 'settings') go('settings');
  wiki.listOpen = false;
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
/** 문서·작성 화면으로 갔으면 true. 못 찾으면 목록을 펼치고 false */
function search(ctx: ChatContext, q: string): boolean {
  const query = q.trim();
  wiki.query = query;
  if (!query) return false;
  const own = ownDoc(ctx, query);
  const c = own ? { title: own, known: true } : canonicalTitle(registry(ctx), source(ctx), query);
  if (findDoc(ctx.chat, c.title, ctx.char.globalLore)) return go('doc', c.title, query), true;
  if (c.known) return openTitle(ctx, c.title, 'direct'), true;
  // 여러 개가 걸리면 목록을 펼쳐 고르게. 하나도 없으면 목록에 「없어요 · 작성하기」가 뜬다 (바로 작성 화면으로 가지 않는다)
  wiki.listOpen = true;
  return false;
}

// ── 생성 ──

async function generate(ctx: ChatContext, env: WikiEnv, title: string, regenerate: boolean, docRequest = '', usePrevious?: boolean): Promise<void> {
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
  const previousDoc = regenerate ? ((usePrevious ?? s.refreshPrevious) ? old : null) : wiki.previousTitle ? findDoc(ctx.chat, wiki.previousTitle, ctx.char.globalLore) : null;
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
    const prompt = fitPrompt(budgetFor(ctx.chat.scriptstate, 'nw'), () => wikiPrompt(source(ctx), { title, inherited, previous: previousDoc?.body ?? null, writingRequest, docRequest: docRequest.trim(), direct }, s, catalogNames, registry(ctx)));
    let body: string;
    try {
      body = (await askModel(prompt.messages, s.model, (raw) => acceptArticle(raw, title, canon(ctx)), { ...genSettings(ctx.chat.scriptstate), state: ctx.chat.scriptstate })).value;
    } catch (error) {
      const raw = (error as { raw?: string }).raw;
      if (raw) wiki.failure = { title, reason: error instanceof Error ? error.message : String(error), raw };
      throw error;
    }
    const meta: WikiMeta = {
      title, mode: s.mode, model: s.model, created: Math.floor(Date.now() / 1000), length: s.length, sources: prompt.sources,
      primarySources: prompt.primarySources.length ? prompt.primarySources : inherited, writingRequest, direct,
      ...(docRequest.trim() ? { docRequest: docRequest.trim() } : {}),
    };
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => saveDoc(chat, meta, body));
    // 아직 그 작성 화면을 보고 있으면 문서로 넘어간다
    const cur = env.current();
    if (cur && chatKey(cur) === key && (wiki.view === 'compose' || wiki.view === 'doc') && wiki.title === title) Object.assign(wiki, { view: 'doc', rewrite: null, docReq: '' });
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
  /** 대표 사진 (문서 정보표) */
  photo: string;
  /** 얼굴 사진 (목록·카드·분류 타일) */
  face: string;
  terms: string[];
}

const CAT_LABEL: Record<Cat, string> = { an: '괴이', ms: '특수', lm: '거점', ag: '인물', org: '조직' };
const CAT_ICON: Record<Cat, string> = { an: ICONS.info, ms: ICONS.spook, lm: ICONS.pin, ag: ICONS.idcard, org: ICONS.group };

let entryCache: { lore: unknown; stamp: number; viewer: string; list: Entry[] } | null = null;
function entries(ctx: ChatContext): Entry[] {
  const viewer = String(ctx.chat.scriptstate?.['$st_faction'] ?? '');
  if (entryCache && entryCache.lore === ctx.char.globalLore && entryCache.stamp === moduleAssetStamp() && entryCache.viewer === viewer) return entryCache.list;
  const c = canon(ctx);
  const list: Entry[] = [];
  const dir = readDirectory(ctx.char.globalLore);
  // 괴이 폴더 밖에서 발생 후보로 들어온 요원·세력 로어북(흡혈귀·탐미주의 등)은 인물·조직 항목으로만 보인다
  const other = new Set([...dir.agents.map((a) => a.lore), ...orgLores(ctx.char.globalLore ?? [])]);
  for (const [cat, rows] of [['an', dir.anomalies], ['ms', dir.sites]] as const) {
    for (const p of rows) if (p.inFolder || !other.has(p.lore)) list.push({ cat, name: p.label, title: c(p.lore || p.label), sub: p.english, photo: mainPic(ctx.char, p), face: facePic(ctx.char, p), terms: [p.label, p.english, ...p.aliases] });
  }
  try {
    for (const l of parseCatalog(ctx.char.globalLore).landmarks) {
      const link = baseLink(ctx, l.name);
      list.push({ cat: 'lm', name: l.name, title: c(link.doc), sub: [link.org, placeWhere(l.sido, l.gu)].filter(Boolean).join(' · '), photo: baseArt(ctx, l.name), face: baseArt(ctx, l.name), terms: [l.name, l.english, ...l.aliases] });
    }
  } catch {
    /* 목록 로어북이 없으면 거점만 뺀다 */
  }
  for (const a of dir.agents) list.push({ cat: 'ag', name: a.name, title: c(a.lore || a.name), sub: [a.rank, a.department].filter(Boolean).join(' · ') || a.english, photo: mainPic(ctx.char, a), face: facePic(ctx.char, a, true), terms: [a.name, a.english, ...a.aliases] });
  // 조직: 명부의 조직 전부 (플레이 세력이면 시작 화면 이름). 문서는 세력 폴더 로어북 이름 (발푸르기스 → 발푸르기스 협회)
  const lore = ctx.char.globalLore ?? [];
  const facs = factionList(lore);
  const hasLore = new Set(lore.map((e) => String(e.comment ?? '').trim()));
  for (const o of dir.orgs) {
    const f = o.faction ? facs.find((x) => x.code === o.faction) : facs.find((x) => !x.builtin && x.affiliation === o.name);
    if (f?.hidden) continue;
    const doc = orgLoreName(lore, o.name);
    if (!f && !hasLore.has(doc)) continue; // 요원 소속에만 있는 이름(미분류 등)
    const name = f?.name ?? o.name;
    // 문서 제목: 로어북 이름(이슬람 서울중앙성원)과 기본 문서 제목(이슬람)이 다를 수 있어 문서가 있는 쪽 (2026-10-21)
    const title = [c(doc), c(o.name), c(name)].find((t) => findDoc(ctx.chat, t, lore)) ?? c(doc);
    list.push({ cat: 'org', name, title, sub: o.name !== name ? o.name : '', photo: mainPic(ctx.char, { ...o.spec, shared: o.shared }), face: facePic(ctx.char, { ...o.spec, shared: o.shared }), terms: [name, o.name, doc, o.spec.english ?? ''] });
  }
  // 같은 문서로 이어지는 항목은 하나만
  const seen = new Set<string>();
  const out = list.filter((e) => (seen.has(`${e.cat}|${e.title}`) ? false : (seen.add(`${e.cat}|${e.title}`), true)));
  entryCache = { lore: ctx.char.globalLore, stamp: moduleAssetStamp(), viewer, list: out };
  return out;
}

// 같은 문서로 이어지는 항목이 여럿이면 (예: 거점 「관리국 본부」와 조직 「관리국」) 이름이 제목과 같은 쪽
// 거점은 조직 문서를 같이 가리킬 뿐이라 (서울중앙성원 → 이슬람) 다른 항목이 있으면 그쪽 이름으로 보인다
const entryFor = (ctx: ChatContext, title: string) => {
  const all = entries(ctx).filter((e) => e.title === title);
  return all.find((e) => e.name === title) ?? all.find((e) => e.cat !== 'lm') ?? all[0];
};
/** 목록에 보이는 이름 (가나다 묶음·정렬도 이 이름으로: 문서 「협회」는 「특수재난대응협회」로 ㅌ에) */
const shownName = (ctx: ChatContext, title: string) => entryFor(ctx, title)?.name ?? title;

function matches(ctx: ChatContext, q: string): Entry[] {
  const lower = q.toLowerCase();
  return entries(ctx).filter((e) => e.terms.some((t) => t && t.toLowerCase().includes(lower)));
}

/** 띄어쓰기·기호·대소문자를 빼고 비교 */
const squash = (t: string) => t.toLowerCase().replace(/[\s·.,!?'"「」『』()\[\]\-_~]/g, '');

function editDistance(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, i) => i);
  for (let i = 1; i <= A.length; i++) {
    const cur = [i];
    for (let j = 1; j <= B.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (A[i - 1] === B[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[B.length];
}

/** 비슷한 제목: 띄어쓰기만 다르거나 한두 글자 틀린 것 (가까운 순, 최대 6개) */
function similar(q: string, titles: string[]): string[] {
  const k = squash(q);
  if (!k) return [];
  const limit = Math.max(1, Math.floor([...k].length / 3));
  return [...new Set(titles)]
    .map((t) => {
      const v = squash(t);
      if (!v) return null;
      if (v === k || v.includes(k) || (k.includes(v) && [...v].length >= 2)) return { t, d: 0 };
      const d = editDistance(k, v);
      return d <= limit ? { t, d } : null;
    })
    .filter((x): x is { t: string; d: number } => !!x)
    .sort((a, b) => a.d - b.d || a.t.length - b.t.length)
    .slice(0, 6)
    .map((x) => x.t);
}

/** 사진(카드 에셋) 또는 분류 아이콘 */
function face(ctx: ChatContext, e: Entry | undefined, cls = ''): string {
  const url = e?.face ? imageUrl(ctx.char, e.face) : null;
  return `<span class="ph-avatar nw-ava${cls}${e ? ` k-${e.cat}` : ''}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : e ? CAT_ICON[e.cat] : ICONS.book}</span>`;
}

function seg(action: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, action, (v) => v);
  if (sw) return sw;
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
function row(ctx: ChatContext, e: Entry | undefined, title: string, sub?: string, dot = false): string {
  const on = (wiki.view === 'doc' || wiki.view === 'compose') && wiki.title === title;
  const small = sub ?? (e ? [e.title !== e.name ? e.title : '', e.sub].filter(Boolean).join(' · ') : '');
  return `<li class="ph-row"><button class="ph-main nw-row${on ? ' on' : ''}" data-action="wiki-pick" data-value="${esc(title)}">${face(ctx, e)}
    <span class="ph-who"><span class="ph-who-top"><b>${esc(e?.name ?? title)}</b>${dot ? '<span class="nw-dot" title="이번 이야기에서 작성" aria-label="이번 이야기에서 작성"></span>' : ''}</span>${small ? `<small>${esc(small)}</small>` : ''}</span></button></li>`;
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
    .map((d) => ({ d, n: shownName(ctx, d.title) }))
    .map((x) => ({ ...x, k: KEYS.indexOf(keyOf(x.n)) }))
    .sort((x, y) => x.k - y.k || x.n.localeCompare(y.n, 'ko'))
    .map((x) => x.d);
}

/** 메인 검색칸 결과: 입력하는 대로 바로 바뀐다 (서랍 검색과 같은 목록) */
export function wikiHomeResults(ctx: ChatContext): string {
  return wiki.homeQuery.trim() ? wikiList(ctx, wiki.homeQuery) : '';
}

/** 왼쪽 목록 (검색어를 바꾸면 이것만 다시 그린다) */
export function wikiList(ctx: ChatContext, query = wiki.query): string {
  const docs = sortedDocs(ctx);
  const saved = new Set(docs.map((d) => d.title));
  const q = query.trim();
  // 이번 이야기에서 쓰거나 새로고침한 문서는 이름 옆 점
  const dated = (d: (typeof docs)[number], dot = true) => {
    const e = entryFor(ctx, d.title);
    return row(ctx, e, d.title, e ? undefined : d.meta?.created ? when(d.meta.created) : '', dot && !d.base);
  };
  if (q) {
    const lower = q.toLowerCase();
    const mine = docs.filter((d) => d.title.toLowerCase().includes(lower) || entryFor(ctx, d.title)?.terms.some((t) => t && t.toLowerCase().includes(lower)));
    const hits = matches(ctx, q).filter((e) => !saved.has(e.title));
    const exact = canon(ctx)(q);
    // 검색과 작성은 하나 (v0.16.24, 사용자 설계): 결과가 없으면 「없어요 + 작성」, 있는데 딱 맞는 제목이 없으면 끝에 작성 줄
    const known = saved.has(exact) || hits.some((e) => e.title === exact);
    const docPart = mine.length ? `<h4 class="ph-sec">문서<b>${mine.length}</b></h4><ul class="ph-list">${mine.map((d) => dated(d)).join('')}</ul>` : '';
    const rosterPart = hits.length
      ? `<h4 class="ph-sec">명부<b>${hits.length}</b></h4><ul class="ph-list">${hits.map((e) => row(ctx, e, e.title, [CAT_LABEL[e.cat], e.sub].filter(Boolean).join(' · '))).join('')}</ul>`
      : '';
    // 띄어쓰기가 다르거나 조금 틀린 제목은 「비슷한 문서」로 먼저 제안 (예: 소라랜드 → 소라 랜드)
    const shownTitles = new Set([...mine.map((d) => d.title), ...hits.map((e) => e.title)]);
    const near = known ? [] : similar(q, [...docs.map((d) => d.title), ...entries(ctx).map((e) => e.title)]).filter((t) => !shownTitles.has(t));
    const nearPart = near.length
      ? `<h4 class="ph-sec">비슷한 문서<b>${near.length}</b></h4><ul class="ph-list">${near.map((t) => {
          const d = docs.find((x) => x.title === t);
          if (d) return dated(d);
          const e = entries(ctx).find((x) => x.title === t)!;
          return row(ctx, e, e.title, [CAT_LABEL[e.cat], e.sub].filter(Boolean).join(' · '));
        }).join('')}</ul>`
      : '';
    if (!docPart && !rosterPart && !nearPart) {
      return `<div class="nw-groups"><div class="ph-blank nw-nohit"><p>「${esc(q)}」 문서가 없어요.<br>새로 작성할까요?</p><button class="gx-start" data-action="wiki-write" data-value="${esc(q)}">${ICONS.pen}작성하기</button></div></div>`;
    }
    const fresh = known
      ? ''
      : `<ul class="ph-list"><li class="ph-row"><button class="ph-main nw-row nw-newrow" data-action="wiki-write" data-value="${esc(q)}"><span class="ph-avatar nw-ava">${ICONS.pen}</span><span class="ph-who"><b>「${esc(q)}」</b><small>이 제목으로 새로 작성</small></span></button></li></ul>`;
    const lead = !docPart && !rosterPart ? `<p class="nw-near-lead">「${esc(q)}」 문서는 없어요. 혹시 이 문서를 찾으셨나요?</p>` : '';
    return `<div class="nw-groups">${lead}${docPart}${rosterPart}${nearPart}${fresh}</div>`;
  }
  if (!docs.length) return `<div class="nw-groups">${blank('아직 작성한 문서가 없어요.<br>위에서 이름이나 제목을 검색해 보세요.')}</div>`;
  const count = (t: Tab) => docs.filter((d) => inTab(ctx, d, t)).length;
  const tabs = TABS.filter(([t]) => t === 'all' || count(t));
  const tab = tabs.some(([t]) => t === wiki.tab) ? wiki.tab : 'all';
  const shown = docs.filter((d) => inTab(ctx, d, tab));
  const chips = `<div class="ph-tabs nw-tabs" role="tablist">${tabs
    .map(([t, label]) => `<button class="ph-tab${t === tab ? ' on' : ''}" data-action="wiki-tab" data-value="${t}" aria-selected="${t === tab}">${label}<small>${count(t)}</small></button>`)
    .join('')}</div>`;
  const keyOfDoc = (d: (typeof docs)[number]) => keyOf(shownName(ctx, d.title));
  const keys = KEYS.filter((k) => shown.some((d) => keyOfDoc(d) === k));
  const groups = keys.map((k) => {
    const rows = shown.filter((d) => keyOfDoc(d) === k);
    const head = keys.length > 1 ? `<button type="button" class="nw-kbtn" data-kpick aria-label="${k}, 다른 자음으로 이동">${k}<b>${rows.length}</b></button>` : `${k}<b>${rows.length}</b>`;
    return `<h4 class="ph-sec nw-ksec" data-ksec="${k}">${head}</h4><ul class="ph-list">${rows.map((d) => dated(d, tab !== 'story')).join('')}</ul>`;
  }).join('');
  // 자음 제목을 누르면 자음판 (v0.16.25, 휴대폰 연락처처럼): 문서가 있는 자음만 켜진다
  const index = keys.length > 1
    ? `<div class="nw-kgrid" hidden><div class="nw-kgrid-in" role="group" aria-label="가나다 색인">${KEYS.map((k) => `<button type="button" data-k="${k}" ${keys.includes(k) ? '' : 'disabled'}>${k}</button>`).join('')}</div></div>`
    : '';
  return `${chips}<div class="nw-groups">${groups}</div>${index}`;
}

/** 문서의 분류: 명부 항목이면 그 분류, 아니면 사람 문서는 인물, 나머지는 기타 */
function docCat(ctx: ChatContext, d: WikiDoc): Exclude<Tab, 'all' | 'story'> {
  const e = entryFor(ctx, d.title);
  if (e) return e.cat === 'lm' || e.cat === 'org' ? 'fac' : e.cat;
  return /doc_type="person"/.test(d.body.slice(0, 300)) ? 'ag' : 'etc';
}
const inTab = (ctx: ChatContext, d: WikiDoc, t: Tab) => (t === 'all' ? true : t === 'story' ? !d.base : docCat(ctx, d) === t);

/** 왼쪽 세로바: 위키 메인·새 문서·설정, 남은 자리는 목록 펼치기 (누르거나 옆으로 밀기) */
function rail(): string {
  const open = wiki.listOpen;
  const label = open ? '목록 접기' : '목록 펼치기';
  return `<nav class="nw-rail" aria-label="위키 메뉴">
    ${tool('wiki-home', ICONS.wiki, '위키 메인', wiki.view === 'home' ? 'aria-pressed="true"' : '')}
    ${tool('wiki-settings', ICONS.settings, '위키 설정', wiki.view === 'settings' ? 'aria-pressed="true"' : '')}
    <button class="nw-grab" type="button" data-action="wiki-list" aria-expanded="${open}" aria-label="${label}" title="${label}"><span class="nw-grab-ico${open ? '' : ' flip'}">${ICONS.back}</span></button>
  </nav>`;
}

/** 위키 메인: 검색, 지금 얽힌 문서, 이번 이야기에서 쓴 문서, 분류 */
function homeView(ctx: ChatContext): string {
  const docs = listDocs(ctx.chat, ctx.char.globalLore);
  const saved = new Set(docs.map((d) => d.title));
  const c = canon(ctx);
  const card = (title: string, sub: string) => {
    const e = entryFor(ctx, title);
    const url = e?.face ? imageUrl(ctx.char, e.face) : null;
    const none = !saved.has(title);
    return `<button class="nw-card${none ? ' none' : ''}" data-action="wiki-pick" data-value="${esc(title)}">
      <span class="nw-card-img${e ? ` k-${e.cat}` : ''}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : e ? CAT_ICON[e.cat] : ICONS.book}</span>
      <b>${esc(e?.name ?? title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</button>`;
  };
  // 지금 얽힌 문서: 상황판은 배경일 뿐이라, 유저가 지금 들어가 있는 곳만 본다.
  // 상태창 마지막 칸(지금 다루는 괴이·특수·사건)과 거기 투입된 요원, 작전투입 요원, 상태창 위치
  const live: [string, string][] = [];
  const st = lastStatusFields((ctx.chat.message ?? []).filter((m) => m.role === 'char').slice(-6).map((m) => m.data));
  const target = st?.target.trim() ?? '';
  if (worldOn(ctx.chat)) {
    const w = readWorld(ctx.chat);
    const kind = { an: '괴이', in: '사건', ms: '특수' } as const;
    const here = activeEvents(w).filter((ev) => ev.name && (ev.name.trim() === target || w.an.some((a) => a.exploring && a.name === ev.name)));
    for (const ev of here) live.push([c(ev.name), `${kind[ev.kind]} · 탐사 중`]);
    const deploy = here.map((ev) => ev.people ?? '').join(' ');
    for (const a of readDirectory(ctx.char.globalLore).agents) {
      const s = w.agents[a.id]?.st;
      const sent = deploy && (deploy.includes(a.id) || (a.name && deploy.includes(a.name)));
      if (sent || s === '작전투입') live.push([c(a.lore || a.name), '인물 · 작전투입']);
    }
  } else if (target) live.push([c(target), '탐사 중']);
  if (st?.place && entryFor(ctx, c(st.place))) live.push([c(st.place), '현재 위치']);
  const seen = new Set<string>();
  const liveCards = live.filter(([t]) => (seen.has(t) ? false : (seen.add(t), true))).slice(0, 8).map(([t, sub]) => card(t, sub)).join('');
  const story = docs.filter((d) => !d.base).sort((a, b) => (b.meta?.created ?? 0) - (a.meta?.created ?? 0));
  const storyCards = story.slice(0, 8).map((d) => card(d.title, d.meta?.created ? when(d.meta.created) : '')).join('');
  // 분류: 사진 몇 장 + 개수, 누르면 서랍이 그 탭으로
  const tiles = TABS.filter(([t]) => t !== 'all' && t !== 'story')
    .map(([t, label]) => {
      const list = docs.filter((d) => inTab(ctx, d, t));
      if (!list.length) return '';
      const pics = list.map((d) => entryFor(ctx, d.title)?.face).filter((x): x is string => !!x).slice(0, 4)
        .map((ph) => imageUrl(ctx.char, ph)).filter(Boolean)
        .map((u) => `<img src="${esc(u!)}" alt="" loading="lazy">`).join('');
      return `<button class="nw-tile k-${t}" data-action="wiki-browse" data-value="${t}"><span class="nw-tile-pics">${pics || (t === 'an' ? CAT_ICON.an : t === 'ms' ? CAT_ICON.ms : ICONS.book)}</span><b>${label}</b><small>문서 ${list.length}개</small></button>`;
    }).join('');
  const sec = (title: string, n: number, inner: string) => `<section class="nw-hsec"><h3>${title}${n ? `<b>${n}</b>` : ''}</h3>${inner}</section>`;
  return `<div class="nw-home">
    <section class="nw-hero">
      <div class="nw-hero-top"><span class="nw-hero-ico">${GHOST_ICON}</span><div class="nw-hero-t"><h2>괴이위키</h2><small>문서 ${docs.length}개</small></div></div>
      <div class="nw-hero-q"><input class="gx-search" type="search" name="wiki-home-q" data-input="wiki-home-query" data-enter="wiki-search" placeholder="이름·제목 검색" value="${esc(wiki.homeQuery)}" aria-label="위키 검색" autocomplete="off"></div>
      <div class="nw-hero-res">${wikiHomeResults(ctx)}</div>
    </section>
    ${liveCards ? sec('지금 얽힌 문서', 0, `<div class="nw-cards">${liveCards}</div>`) : ''}
    ${sec('이번 이야기에서 쓴 문서', story.length, story.length ? `<div class="nw-cards">${storyCards}</div>${story.length > 8 ? `<button class="gx-mini nw-more-btn" data-action="wiki-browse" data-value="story">${story.length}개 모두 보기</button>` : ''}` : '<p class="nw-hnone">아직 이번 이야기에서 쓴 문서가 없어요.</p>')}
    ${sec('분류', 0, `<div class="nw-tiles">${tiles}</div>`)}
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
  return `<div class="ph-form nw-setpane">${paneHead(ctx, '위키 설정', '', defaultsButtons('wiki'))}${defaultsConfirm('wiki')}
    <div class="ph-form-body ps"><section class="ps-group"><h3>문서 작성</h3><div class="ps-rows">
      ${line('분량', seg('wiki-length', s.length, [['short', '짧게'], ['standard', '보통'], ['detailed', '상세']]))}
      ${line('작성 모드', seg('wiki-mode', s.mode, [['expand', '확장'], ['faithful', '원본 충실']]))}
      ${line('모델', seg('wiki-model', s.model, [['main', '메인'], ['aux', '보조']]))}
      ${line('다시 쓸 때 이전 문서 참고', seg('wiki-refresh_previous', s.refreshPrevious ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]))}
      ${line('채팅에 반영', seg('wiki-context', wikiContextOn(ctx.chat.scriptstate) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '채팅에 나온 문서가 채팅 요청에 참고로 붙어요')}
    </div></section>
    <section class="ps-group"><h3>공용 지침</h3><div class="ps-rows"><div class="ps-row">
      <textarea class="gx-search nw-reqbox" data-change="wiki-request" rows="3" placeholder="모든 문서에 덧붙일 말투·형식·관점">${esc(req)}</textarea></div></div></section>
    ${advancedBox('nw', ctx.chat.scriptstate)}</div>
  </div>`;
}

/** 새 문서: 제목을 적고 작성 화면으로 */
function newView(ctx: ChatContext): string {
  return `<div class="ph-form">${paneHead(ctx, '새 문서', '')}
    <div class="ph-form-body"><label class="ph-label">제목<small>명부에 있는 이름이면 그 항목의 원본 로어북으로 작성해요</small></label>
      <input class="gx-search" name="wiki-new" data-input="wiki-new" data-enter="wiki-write" value="${esc(wiki.newTitle)}" maxlength="300" placeholder="문서 제목"></div>
    <div class="ph-form-foot"><button class="gx-start" data-action="wiki-write" data-take="wiki-new">작성 화면 열기</button></div></div>`;
}

/** 작성·다시 쓰기의 지침 칸: 공용 지침은 보여 주기만, 이 문서 지침은 여기서 적는다 (칸 위 제목 글자는 뺐다, 사용자 2026-10-23) */
function docReqBox(shared: string): string {
  return `<label class="nw-reqlabel"><textarea class="gx-search nw-reqbox" data-input="wiki-docreq" rows="3" maxlength="2000" aria-label="이 문서 지침" placeholder="이 문서에만 덧붙일 지침 (내용·관점·분량)">${esc(wiki.docReq)}</textarea></label>
      ${shared ? `<p class="nw-creq">공용 지침: ${esc(shared)}</p>` : ''}`;
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
      ${docReqBox(req)}
    </section></div>
    <div class="ph-form-foot"><button class="gx-start" data-action="wiki-start" data-value="${esc(wiki.title)}" ${job ? 'disabled' : ''}>${mine ? '작성하는 중…' : '작성 시작'}</button></div></div>`;
}

/** 괴이 문서의 정답 문단을 접을지: 이 채팅에서 그 괴이를 클리어했으면 처음부터 펼친다 */
function spoilerFold(ctx: ChatContext, title: string, e: Entry | undefined): boolean {
  if (e?.cat !== 'an') return false;
  const cleared = new Set(readWorld(ctx.chat).cleared ?? []);
  return ![title, e.name, e.title].some((n) => cleared.has(n));
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
  const r = renderArticle(doc.body, { saved: (t) => saved.has(t), canon: c, photo, fold: spoilerFold(ctx, doc.title, e) });
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
       ${m.sources.length ? `<p>${esc(m.sources.join(', '))}</p>` : ''}${m.writingRequest ? `<p>공용 지침: ${esc(m.writingRequest)}</p>` : ''}${m.docRequest ? `<p>이 문서 지침: ${esc(m.docRequest)}</p>` : ''}</details>`
    : '';
  const confirm = wiki.confirmDelete === doc.title;
  // 기본 문서는 지울 수 없고, 채팅에서 새로 쓴 문서를 지우면 기본 문서로 돌아간다
  const hasBase = baseDocs(ctx.char.globalLore).some((d) => d.title === doc.title);
  const del = doc.base
    ? ''
    : confirm
      ? `<button class="gx-mini danger" data-action="wiki-delete" data-value="${esc(doc.title)}">${hasBase ? '되돌리기' : '정말 삭제'}</button>`
      : tool('wiki-delete', ICONS.trash, hasBase ? '기본 문서로 되돌리기' : '문서 삭제', `data-value="${esc(doc.title)}"`);
  const open = wiki.rewrite === doc.title;
  const right = `${tool('wiki-rewrite', ICONS.pen, job?.title === doc.title ? '작성하는 중' : '다시 쓰기', `data-value="${esc(doc.title)}" ${open ? 'aria-pressed="true"' : ''} ${job ? 'disabled' : ''}`)}${del}`;
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  const rewrite = open
    ? `<section class="nw-rewrite">${docReqBox(req)}
        <div class="nw-rwrow"><span>이전 문서 참고</span><div class="gx-segs gx-segs-sm">${([['1', 'ON'], ['0', 'OFF']] as const).map(([v, l]) => `<button class="gx-seg${(wiki.rewritePrev ? '1' : '0') === v ? ' on' : ''}" data-action="wiki-rw-prev" data-value="${v}" aria-pressed="${(wiki.rewritePrev ? '1' : '0') === v}">${l}</button>`).join('')}</div></div>
        <div class="gx-row-btns"><button class="gx-mini ps-save" data-action="wiki-rw-go" data-value="${esc(doc.title)}" ${job ? 'disabled' : ''}>${job?.title === doc.title ? '작성하는 중…' : '다시 쓰기'}</button><button class="gx-mini" data-action="wiki-rw-cancel">취소</button></div></section>`
    : '';
  const sub = [e ? CAT_LABEL[e.cat] : '', doc.base ? '기본 문서' : m?.created ? when(m.created) : ''].filter(Boolean).join(' · ');
  return `<div class="ph-room nw-pane">${paneHead(ctx, e?.name ?? doc.title, sub, right, e)}
    <article class="nw-doc">
      ${rewrite}<header class="nw-dochead"><h2 class="nw-title">${esc(doc.title)}</h2>${e && e.sub && e.cat !== 'lm' ? `<small>${esc(e.sub)}</small>` : ''}</header>
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
    <button class="nw-edge" type="button" data-action="wiki-list" data-value="open" aria-label="목록 펼치기">${ICONS.list}<span>목록</span></button>
    <section class="ph-pane nw-main"><div class="nw-status">${status}</div>${paneHtml(ctx)}</section>
    ${drawerHtml([
      tool('wiki-home', ICONS.wiki, '위키 메인', wiki.view === 'home' ? 'aria-pressed="true"' : '', '메인'),
      tool('wiki-find', ICONS.search, '위키 검색', '', '검색'),
      tool('wiki-list', ICONS.list, open ? '목록 접기' : '목록 펼치기', `aria-pressed="${open}"`, '목록'),
      tool('wiki-settings', ICONS.settings, '위키 설정', wiki.view === 'settings' ? 'aria-pressed="true"' : '', '설정'),
    ].join(''))}
    ${note}
  </main>`;
}

/** 목록 서랍: 세로바를 옆으로 밀면(마우스 끌기 포함) 펼치고, 펼친 목록을 왼쪽으로 밀면 접는다 */
/**
 * 각주: PC(마우스)는 번호에 올리면 내용 창, 누르면 아래 각주 목록으로 내려간다.
 * 터치 화면은 누르면 내용 창만 (다시 누르거나 바깥을 누르면 닫힘). 문서를 다시 그릴 때마다 새로 붙인다
 */
export function bindFootnotes(root: HTMLElement): void {
  const doc = root.querySelector<HTMLElement>('.nw-doc');
  if (!doc?.querySelector('.nw-fn')) return;
  const hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const pop = document.createElement('div');
  pop.className = 'nw-fnpop';
  pop.hidden = true;
  doc.appendChild(pop);
  let cur: HTMLElement | null = null;
  const hide = () => {
    pop.hidden = true;
    cur = null;
  };
  const show = (sup: HTMLElement) => {
    const li = doc.querySelector<HTMLElement>(`.nw-notes li[data-fn="${sup.dataset.fn}"]`);
    if (!li) return;
    cur = sup;
    pop.innerHTML = `<b>[${sup.dataset.fn}]</b> ${(li.querySelector<HTMLElement>('.nw-fn-t') ?? li).innerHTML}`;
    pop.hidden = false;
    // 문서 칸 안에서 번호 바로 아래 (아래가 모자라면 위), 좌우는 칸 밖으로 안 나가게
    const box = doc.getBoundingClientRect();
    const r = sup.getBoundingClientRect();
    const w = Math.min(360, box.width - 24);
    pop.style.width = `${w}px`;
    const left = Math.max(12, Math.min(r.left - box.left - w / 2 + r.width / 2, box.width - w - 12));
    let top = r.bottom - box.top + doc.scrollTop + 6;
    if (r.bottom + pop.offsetHeight + 12 > box.bottom && r.top - pop.offsetHeight - 12 > box.top) top = r.top - box.top + doc.scrollTop - pop.offsetHeight - 6;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  };
  const supOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('.nw-fn');
  if (hover) {
    doc.addEventListener('mouseover', (e) => {
      const sup = supOf(e);
      if (sup && sup !== cur) show(sup);
    });
    doc.addEventListener('mouseout', (e) => {
      if (supOf(e) && !(e.relatedTarget as HTMLElement | null)?.closest?.('.nw-fn')) hide();
    });
  }
  doc.addEventListener('click', (e) => {
    const sup = supOf(e);
    if (!sup) {
      if (!hover && !(e.target as HTMLElement).closest('.nw-fnpop')) hide();
      return;
    }
    e.preventDefault();
    if (!hover) {
      if (cur === sup) hide();
      else show(sup);
      return;
    }
    hide();
    const li = doc.querySelector<HTMLElement>(`.nw-notes li[data-fn="${sup.dataset.fn}"]`);
    if (!li) return;
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li.classList.remove('hit');
    void li.offsetWidth;
    li.classList.add('hit');
  });
  doc.addEventListener('scroll', () => !hover && hide(), { passive: true });
}

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
    // 세로바가 오른쪽이면(설정) 왼쪽으로 끌어 연다
    const d = root.closest<HTMLElement>('[data-wiki-side]')?.dataset.wikiSide === 'right' ? -dx : dx;
    if (d > 0 && !wiki.listOpen) act('open');
    else if (d < 0 && wiki.listOpen) act('close');
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
  // 자음판: 묶음 제목을 누르면 열리고, 자음을 고르면 그 묶음으로, 바깥을 누르면 닫힌다 (목록은 검색할 때마다 다시 그려지므로 서랍에서 받는다)
  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const grid = panel.querySelector<HTMLElement>('.nw-kgrid');
    if (!grid) return;
    if (t.closest('[data-kpick]')) {
      grid.hidden = false;
      return;
    }
    const k = t.closest<HTMLElement>('.nw-kgrid [data-k]')?.dataset.k;
    if (k) {
      const box = panel.querySelector<HTMLElement>('.nw-groups');
      const sec = box?.querySelector<HTMLElement>(`[data-ksec="${k}"]`);
      if (box && sec) box.scrollTop = sec.offsetTop;
      grid.hidden = true;
      return;
    }
    if (t.closest('.nw-kgrid') && !t.closest('.nw-kgrid-in button')) grid.hidden = true;
  });
  let t0: { x: number; y: number } | null = null;
  panel.addEventListener('touchstart', (e) => (t0 = (e.target as HTMLElement).closest('.nw-kgrid') ? null : { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 }), { passive: true });
  panel.addEventListener('touchend', (e) => {
    if (!t0) return;
    const dx = (e.changedTouches[0]?.clientX ?? t0.x) - t0.x;
    const dy = (e.changedTouches[0]?.clientY ?? t0.y) - t0.y;
    t0 = null;
    // PC는 설정한 쪽(기본 왼쪽)에서, 모바일은 오른쪽에서 열리므로 접는 방향도 그쪽으로
    const fromLeft = wide() && root.closest<HTMLElement>('[data-wiki-side]')?.dataset.wikiSide !== 'right';
    const out = fromLeft ? dx < -36 : dx > 36;
    if (out && Math.abs(dx) > Math.abs(dy) * 1.5 && wiki.listOpen) act('close');
  }, { passive: true });
  // 모바일 책갈피를 왼쪽으로 끌어도 열린다
  const edge = root.querySelector<HTMLElement>('.nw-edge');
  let e0: number | null = null;
  edge?.addEventListener('touchstart', (e) => (e0 = e.touches[0]?.clientX ?? null), { passive: true });
  edge?.addEventListener('touchend', (e) => {
    if (e0 === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? e0) - e0;
    e0 = null;
    if (dx < -24 && !wiki.listOpen) act('open');
  }, { passive: true });
}

const wide = () => !matchMedia('(max-width: 760px)').matches;

/** 위키 탭의 버튼. 처리했으면 true */
export async function handleWiki(action: string, value: string | undefined, ctx: ChatContext, env: WikiEnv): Promise<boolean> {
  const v = value ?? '';
  if (action !== 'wiki-delete') wiki.confirmDelete = null;
  if (action.startsWith('wiki-def-')) {
    try {
      const msg = await defaultsAction('wiki', action, v, ctx, env.refresh);
      if (msg) wiki.info = msg;
    } catch (error) {
      wiki.notice = `기본값을 처리하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
    }
    env.render();
    return true;
  }
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
    case 'wiki-find':
      // 모바일 하단 서랍의 검색: 목록을 펼치고 검색칸에 바로 커서 (위까지 손을 올리지 않게)
      wiki.listOpen = true;
      env.render();
      document.querySelector<HTMLInputElement>('.nw .ph-search')?.focus();
      return true;
    case 'wiki-tab':
      wiki.tab = (TABS.some(([t]) => t === v) ? v : 'all') as Tab;
      break;
    case 'wiki-browse':
      // 메인의 분류 칸: 서랍을 그 탭으로 연다
      Object.assign(wiki, { tab: (TABS.some(([t]) => t === v) ? v : 'all') as Tab, listOpen: true, query: '' });
      break;
    case 'wiki-search': {
      wiki.homeQuery = '';
      // 검색으로 문서·작성 화면에 갔을 때만 목록을 접는다. 못 찾으면 search 가 목록을 펼쳐 「없어요 · 작성하기」를 보이는데,
      // 예전엔 문서를 보던 중이면 곧바로 다시 접혀 검색이 아무 반응 없는 것처럼 보였다 (QC 2026-10-28)
      if (search(ctx, v) && (wiki.view === 'compose' || wiki.view === 'doc')) wiki.listOpen = false;
      break;
    }
    case 'wiki-pick':
      // 왼쪽 목록에서 고르기. PC는 열린 항목을 다시 누르면 닫힌다
      if ((wiki.view === 'doc' || wiki.view === 'compose') && canon(ctx)(v) === wiki.title && wide()) {
        Object.assign(wiki, { view: 'home', title: '', history: [] });
        break;
      }
      wiki.history = [];
      wiki.homeQuery = '';
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
      if (wiki.view === 'compose' && wiki.title === v) void generate(ctx, env, v, false, wiki.docReq);
      break;
    case 'wiki-rewrite': {
      // 다시 쓰기 칸을 연다: 지난번 이 문서 지침을 채워 둔다
      if (!v) break;
      if (wiki.view !== 'doc' || wiki.title !== v) go('doc', v);
      if (wiki.rewrite === v) {
        wiki.rewrite = null;
        break;
      }
      const old = findDoc(ctx.chat, v, ctx.char.globalLore);
      Object.assign(wiki, { rewrite: v, docReq: old?.meta?.docRequest ?? '', rewritePrev: wikiSettings(ctx.chat.scriptstate).refreshPrevious });
      break;
    }
    case 'wiki-rw-prev':
      wiki.rewritePrev = v === '1';
      break;
    case 'wiki-rw-cancel':
      Object.assign(wiki, { rewrite: null, docReq: '' });
      break;
    case 'wiki-rw-go':
      if (!v || wiki.rewrite !== v) break;
      void generate(ctx, env, v, true, wiki.docReq, wiki.rewritePrev);
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
      const el = document.getElementById(v);
      // 접힌 정답 문단 속 소제목이면 펼치고 간다
      const fold = el?.closest('details');
      if (fold) fold.open = true;
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
    case 'wiki-request':
      await setVar(ctx, env, '$nw_writing_request', v.trim());
      return true;
    case 'wiki-length':
    case 'wiki-mode':
    case 'wiki-model':
    case 'wiki-refresh_previous':
    case 'wiki-context':
      await setVar(ctx, env, `$nw_${action.slice(5)}`, v);
      return true;
    case 'wiki-settings':
      if (wiki.view === 'settings') go('home');
      else go('settings');
      wiki.listOpen = false;
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
  if (name === 'wiki-docreq') return void (wiki.docReq = value), true;
  return false;
}

/** 메인 설정 「기능별 설정」에서 연다 */
export const wikiSettingsPane = (ctx: ChatContext): string => settingsView(ctx);
