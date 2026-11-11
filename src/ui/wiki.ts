// 「위키」 탭: 목록·검색·작성 화면·문서 보기. 생성은 "위키 작성 시작"·"새로고침"을 눌렀을 때만 한 번 부른다.
// 생성은 창을 닫아도 계속되고, 끝나면 원래 채팅의 로어북에 저장한다.
import { turnKeyAt } from '../core/shop';
import { onOffSwitch } from './controls';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { buildRegistry, type Registry } from '../core/world/registry';
import { hasBook, type RefSource } from '../core/refs';
import {
  type WikiDoc, acceptArticle, baseDocs, canonicalTitle, deleteDoc, findDoc, listDocs, renderArticle, saveDoc, validTitle, wikiPrompt, wikiSettings, WikiError,
  type WikiMeta, type WikiSettings, wikiContextOn, docSummary, portraitMood, wikiTitlePrompt, acceptTitle,
} from '../core/wiki';
import { lastReply } from '../core/phone';
import { playerAgent } from '../core/player';
import { generate as askModel, type LlmMessage } from '../host/llm';
import { craftSettings, featureModel } from '../core/craft';
import { budgetFor, genSettings } from '../core/advanced';
import { fitPrompt } from '../core/budget';
import { advancedBox } from './advanced';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { ICONS } from './icons';
import { defaultsAction, defaultsButtons, defaultsConfirm } from './defaults';
import { toast } from './toast';
import { imageUrl } from './images';
import { baseLink, basePic as baseArt } from './evpic';
import { orgLoreName, orgLores, readDirectory } from '../core/world/directory';
import { assetNames, facePic, hasAsset, mainPic, moduleAssetStamp } from '../host/assets';
import { readWorld } from '../core/world/output';
import { placeWhere } from '../core/world/geo';
import { factionList } from '../core/factions';
import { updateChat, type ChatContext } from '../host/risu';
import { isPhone } from './media';

/** 위키는 문서만 (2026-10-29: 이 채팅의 인물·개인 기록·세력·기록 문서 화면은 왼쪽 메뉴 「기록」으로 옮겼다, ui/records.ts) */
type WikiView = 'home' | 'compose' | 'doc' | 'settings' | 'new' | 'find';
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
  /** 서랍 검색칸 */
  filter: string;
  newTitle: string;
  /** 작성·다시 쓰기 화면의 「이 문서 지침」 */
  docReq: string;
  /** 다시 쓰기 칸을 연 문서 제목, 그 칸의 「이전 문서 참고」 */
  rewrite: string | null;
  rewritePrev: boolean;
}

export const wiki: WikiState = {
  view: 'home', title: '', query: '', homeQuery: '', history: [], inherited: [], previousTitle: null, direct: false, confirmDelete: null, failure: null, notice: '', info: '', listOpen: false, tab: 'all', filter: '', newTitle: '', docReq: '', rewrite: null, rewritePrev: true,
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
  // 여러 개가 걸리면 검색 화면에서 고르게. 하나도 없으면 「없어요 · 작성하기」 (바로 작성 화면으로 가지 않는다)
  go('find', '', query);
  return true;
}


/** 문서 요청 조립 (generate 와 호출 흐름 미리 계산이 같이 쓴다) */
function articlePrompt(ctx: ChatContext, title: string, o: { inherited: string[]; previousDoc: ReturnType<typeof findDoc>; writingRequest: string; docRequest: string; direct: boolean }) {
  const s: WikiSettings = wikiSettings(ctx.chat.scriptstate);
  const { inherited, previousDoc, writingRequest, docRequest, direct } = o;
    const catalogNames = (() => {
      try {
        return factionNames(parseCatalog(ctx.char.globalLore), String(ctx.chat.scriptstate?.['$st_faction'] ?? ''));
      } catch {
        return {};
      }
    })();
    // 그림 (라이트보드 나무위키 W3): 본문까지면 괴이·특수·거점·조직 그림 후보, 인물 문서면 정보칸 표정 후보
    const subject = entryFor(ctx, title);
    const images = s.images === 'body'
      ? [...(subject && subject.cat !== 'ag' && subject.photo ? [subject] : []), ...entries(ctx).filter((e) => e.cat !== 'ag' && e.photo && e !== subject)]
          .filter((e, i, arr) => arr.findIndex((x) => x.photo === e.photo) === i)
          .map((e) => ({ name: e.photo.replace(/#.*$/, ''), label: e.name }))
      : [];
    const moods = s.images !== 'off' && subject?.cat === 'ag' ? portraitMoods(ctx, subject.photo) : [];
    return fitPrompt(budgetFor(ctx.chat.scriptstate, 'nw'), () => wikiPrompt(source(ctx), { title, inherited, previous: previousDoc?.body ?? null, writingRequest, docRequest: docRequest.trim(), direct, images, moods }, s, catalogNames, registry(ctx)));
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
    const prompt = articlePrompt(ctx, title, { inherited, previousDoc, writingRequest, docRequest, direct });
    let body: string;
    try {
      body = (await askModel(prompt.messages, s.model, (raw) => acceptArticle(raw, title, canon(ctx)), { ...genSettings(ctx.chat.scriptstate), reiterate: craftSettings(ctx.chat.scriptstate, 'nw').reiterate, staticModel: featureModel(ctx.chat.scriptstate, 'nw'), state: ctx.chat.scriptstate, label: '위키 글' })).value;
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

/** 그 인물의 표정 그림 이름들 (「영문명_default」 → 「영문명_표정」이 있는 것) */
function portraitMoods(ctx: ChatContext, photo: string): string[] {
  const base = photo.replace(/#.*$/, '').replace(/_default$/, '');
  if (!base || base === photo) return [];
  return assetNames(ctx.char).filter((n) => n.startsWith(`${base}_`)).map((n) => n.slice(base.length + 1)).filter((m) => m && m !== 'default' && /^[a-z ]+$/i.test(m)).sort();
}

// ── 자동 작성 (라이트보드 나무위키 W2, 2026-11-06) ──
const quietEnv: WikiEnv = { render: () => {}, refresh: async () => {}, current: () => null };
let liveEnv: WikiEnv | null = null;
const NW_AUTO_LAST = '$nw_auto_last';

/** 채팅 응답마다(「매 턴」) 또는 위키를 열 때(「창을 열 때」) 문서 하나를 저절로 쓴다. 같은 응답에는 한 번 */
export async function autoWriteWiki(ctx: ChatContext, messageIndex: number, open = false): Promise<void> {
  const s = wikiSettings(ctx.chat.scriptstate);
  if (!(open ? s.auto === 'open' : s.auto === 'turn') || jobs.has(chatKey(ctx))) return;
  const data = String(ctx.chat.message?.[messageIndex]?.data ?? '');
  if (!data.trim()) return;
  const stamp = turnKeyAt(ctx.chat, messageIndex);
  if (String(ctx.chat.scriptstate?.[NW_AUTO_LAST] ?? '') === stamp) return;
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [NW_AUTO_LAST]: stamp } }));
  if (!saved) return;
  const cur = { ...ctx, chat: saved };
  const env = liveEnv ?? quietEnv;
  const showing = env.current();
  const target = showing && chatKey(showing) === chatKey(cur) ? env : quietEnv;
  const notice = wiki.notice;
  try {
    const title = s.autoTitle === 'input' ? (s.autoQuery ? canon(cur)(s.autoQuery) : '') : await pickTitle(cur);
    if (!title) {
      if (target !== quietEnv) wiki.notice = '자동 작성 제목이 비어 있어요. 위키 설정에서 적어 주세요.';
      return;
    }
    const old = findDoc(cur.chat, title, cur.char.globalLore);
    await generate(cur, target, title, !!old && !old.base);
  } finally {
    if (target === quietEnv) wiki.notice = notice;
  }
}

/** 명부 항목 중에서 모델이 제목 하나를 고른다 (주인공이 맡은 인물은 뺀다) */
async function pickTitle(ctx: ChatContext): Promise<string> {
  const me = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  const written = new Set(listDocs(ctx.chat, ctx.char.globalLore).filter((d) => !d.base).map((d) => d.title));
  const candidates = [...new Set(entries(ctx).filter((e) => !(me && e.cat === 'ag' && e.name === me.name)).map((e) => e.title))];
  if (!candidates.length) return '';
  const names = (() => {
    try {
      return factionNames(parseCatalog(ctx.char.globalLore), String(ctx.chat.scriptstate?.['$st_faction'] ?? ''));
    } catch {
      return {};
    }
  })();
  const s = wikiSettings(ctx.chat.scriptstate);
  const { value } = await askModel(wikiTitlePrompt(source(ctx), candidates, [...written], names), s.model, (raw) => acceptTitle(raw, candidates), { ...genSettings(ctx.chat.scriptstate), staticModel: featureModel(ctx.chat.scriptstate, 'nw'), state: ctx.chat.scriptstate, label: '위키 제목' });
  return value;
}

/** 위키 탭을 열 때: 「창을 열 때」 설정이고 마지막 채팅 응답에 맞춰 아직 쓰지 않았으면 한 번 */
export function wikiOpenCheck(ctx: ChatContext, env: WikiEnv): void {
  liveEnv = env;
  if (wikiSettings(ctx.chat.scriptstate).auto !== 'open') return;
  const at = lastReply(ctx.chat);
  if (at < 0) return;
  void autoWriteWiki(ctx, at, true).catch((error) => console.log(`[goei] 위키 자동 작성 실패: ${error instanceof Error ? error.message : String(error)}`));
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

// ── 괴이위키 화면 (2026-11-08 사용자 확정 시안: 작업_1108/브라우저_시안3/mock3.html 의 .wk 마크업 그대로) ──

const ni = (d: string) => `<svg class="ni" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
const SHUFFLE = '<path d="M3 7h4c4 0 6 10 10 10h4M3 17h4c1.6 0 2.8-1.6 3.8-3.5M13.2 9.5C14.2 8 15.4 7 17 7h4M18 4l3 3-3 3M18 14l3 3-3 3"/>';
const SRCH = '<svg class="i s" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';
const LOGO = '<svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="5" fill="#27685b"/><path fill="#fff" d="M6 5h5.2c.9 0 .8.6.8 1.3V19c-.4-.6-1-1-1.8-1H6zM18 5h-5.2c-.9 0-.8.6-.8 1.3V19c.4-.6 1-1 1.8-1H18z"/><circle cx="8.6" cy="10" r="1.1" fill="#27685b"/><circle cx="15.4" cy="10" r="1.1" fill="#27685b"/></svg>';
const LIST_ICO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const IROW_ICO = {
  doc: '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M6 2h9l5 5v15H6z" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 11h8M9 15h8M9 19h5" stroke="#fff" stroke-width="2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12z" fill="#fff"/><circle cx="12" cy="10" r="2.6" fill="#00a495"/></svg>',
  person: '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><circle cx="12" cy="8" r="4.5" fill="#fff"/><path d="M3 22c0-5 4-8 9-8s9 3 9 8z" fill="#fff"/></svg>',
  pen: '<svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M4 20l1-5L16 4l4 4L9 19z" fill="#fff"/><path d="M3 21h18" stroke="#fff" stroke-width="2"/></svg>',
};

/** 몇 분 전·몇 시간 전·어제 (대문 「최근 변경」) */
function ago(sec: number): string {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (d < 60) return '방금';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  if (d < 172800) return '어제';
  return `${Math.floor(d / 86400)}일 전`;
}
/** 「오늘」 또는 날짜 (문서 머리의 최근 수정 시각) */
function dayOf(sec: number): string {
  const t = new Date(sec * 1000);
  const n = new Date();
  if (t.toDateString() === n.toDateString()) return '오늘';
  return `${t.getFullYear()}.${String(t.getMonth() + 1).padStart(2, '0')}.${String(t.getDate()).padStart(2, '0')}`;
}

/** 문서의 분류 이름 (탭 이름과 같음) */
const catName = (ctx: ChatContext, d: WikiDoc) => TABS.find(([t]) => t === docCat(ctx, d))?.[1] ?? '기타';

/** 서랍·대문 검색 결과 한 줄: 이름, 이번 이야기에서 쓴 문서면 점, 없는 문서면 빨간 글자 */
function linkRow(ctx: ChatContext, title: string, o: { dot?: boolean; none?: boolean; name?: string } = {}): string {
  const on = (wiki.view === 'doc' || wiki.view === 'compose') && wiki.title === title;
  return `<button type="button" class="it${on ? ' on' : ''}${o.none ? ' none' : ''}" data-action="wiki-pick" data-value="${esc(title)}"><span>${esc(o.name ?? shownName(ctx, title))}</span>${o.dot ? '<i title="이번 이야기에서 작성" aria-label="이번 이야기에서 작성"></i>' : ''}</button>`;
}

/** 검색어로 걸러 낸 목록 (서랍 검색칸·대문 검색칸): 문서, 명부, 비슷한 문서, 새로 만들기 */
function searchRows(ctx: ChatContext, q: string): string {
  const docs = sortedDocs(ctx);
  const saved = new Set(docs.map((d) => d.title));
  const lower = q.toLowerCase();
  const mine = docs.filter((d) => d.title.toLowerCase().includes(lower) || entryFor(ctx, d.title)?.terms.some((t) => t && t.toLowerCase().includes(lower)));
  // 같은 문서로 이어지는 명부 항목(거점 「관리국」·조직 「관리국」)은 하나만
  const hits = matches(ctx, q).filter((e, i, all) => !saved.has(e.title) && all.findIndex((x) => x.title === e.title) === i);
  const exact = canon(ctx)(q);
  const known = saved.has(exact) || hits.some((e) => e.title === exact);
  const shown = new Set([...mine.map((d) => d.title), ...hits.map((e) => e.title)]);
  // 띄어쓰기가 다르거나 조금 틀린 제목 (예: 소라랜드 → 소라 랜드)
  const near = known ? [] : similar(q, [...docs.map((d) => d.title), ...entries(ctx).map((e) => e.title)]).filter((t) => !shown.has(t));
  const grp = (label: string, rows: string[]) => (rows.length ? `<h4>${label}<b>${rows.length}</b></h4>${rows.join('')}` : '');
  const fresh = known ? '' : `<button type="button" class="it new" data-action="wiki-write" data-value="${esc(q)}"><span>「${esc(q)}」 새 문서 만들기</span></button>`;
  const body = grp('문서', mine.map((d) => linkRow(ctx, d.title, { dot: !d.base })))
    + grp('명부', hits.map((e) => linkRow(ctx, e.title, { none: true, name: e.name })))
    + grp('비슷한 문서', near.map((t) => linkRow(ctx, t, { none: !saved.has(t) })));
  return body ? body + fresh : `<p class="wnone">「${esc(q)}」 문서가 없어요.</p>${fresh}`;
}

/** 대문 검색칸 아래 결과: 입력하는 대로 바뀐다 */
export function wikiHomeResults(ctx: ChatContext): string {
  const q = wiki.homeQuery.trim();
  return q ? `<div class="wls">${searchRows(ctx, q)}</div>` : '';
}

/** 서랍 목록: 검색칸에 글이 있으면 걸러서, 없으면 분류 탭 + 가나다 묶음 */
export function wikiList(ctx: ChatContext): string {
  const q = wiki.filter.trim();
  if (q) return `<div class="wls">${searchRows(ctx, q)}</div>`;
  const docs = sortedDocs(ctx);
  if (!docs.length) return `<div class="wls"><p class="wnone">아직 작성한 문서가 없어요.</p></div>`;
  const count = (t: Tab) => docs.filter((d) => inTab(ctx, d, t)).length;
  const tabs = TABS.filter(([t]) => t === 'all' || count(t));
  const tab = tabs.some(([t]) => t === wiki.tab) ? wiki.tab : 'all';
  const shown = docs.filter((d) => inTab(ctx, d, tab));
  const chips = `<div class="wtabs" role="tablist">${tabs
    .map(([t, label]) => `<button type="button" class="${t === tab ? 'on' : ''}" data-action="wiki-tab" data-value="${t}" role="tab" aria-selected="${t === tab}">${label}<small>${count(t)}</small></button>`)
    .join('')}</div>`;
  const keyOfDoc = (d: WikiDoc) => keyOf(shownName(ctx, d.title));
  const keys = KEYS.filter((k) => shown.some((d) => keyOfDoc(d) === k));
  const groups = keys.map((k) => {
    const rows = shown.filter((d) => keyOfDoc(d) === k);
    // 자음 제목을 누르면 자음판 (v0.16.25, 휴대폰 연락처처럼)
    const head = keys.length > 1 ? `<button type="button" data-kpick aria-label="${k}, 다른 자음으로 이동">${k}<b>${rows.length}</b></button>` : `${k}<b>${rows.length}</b>`;
    return `<h4 data-ksec="${k}">${head}</h4>${rows.map((d) => linkRow(ctx, d.title, { dot: tab !== 'story' && !d.base })).join('')}`;
  }).join('');
  const index = keys.length > 1
    ? `<div class="nw-kgrid" hidden><div class="nw-kgrid-in" role="group" aria-label="가나다 색인">${KEYS.map((k) => `<button type="button" data-k="${k}" ${keys.includes(k) ? '' : 'disabled'}>${k}</button>`).join('')}</div></div>`
    : '';
  return `${chips}<div class="wls">${groups}</div>${index}`;
}

/** 문서의 분류: 명부 항목이면 그 분류, 아니면 사람 문서는 인물, 나머지는 기타 */
function docCat(ctx: ChatContext, d: WikiDoc): Exclude<Tab, 'all' | 'story'> {
  const e = entryFor(ctx, d.title);
  if (e) return e.cat === 'lm' || e.cat === 'org' ? 'fac' : e.cat;
  return /doc_type="person"/.test(d.body.slice(0, 300)) ? 'ag' : 'etc';
}
const inTab = (ctx: ChatContext, d: WikiDoc, t: Tab) => (t === 'all' ? true : t === 'story' ? !d.base : docCat(ctx, d) === t);

/** 머리줄 (시안 WKTOP·WKMAIN): 로고, 최근 변경·임의 문서, 목록 단추, (대문은 임의 문서 단추) 검색칸 */
function topBar(main: boolean): string {
  const open = wiki.listOpen;
  const wlb = `<button type="button" class="wlb wk-menu${open ? ' on' : ''}" data-action="wiki-list" aria-expanded="${open}" aria-label="${open ? '목록 접기' : '목록 펼치기'}" title="목록">${LIST_ICO}</button>`;
  const nav = main
    ? `<nav><button type="button" data-action="wiki-recent">${ni(CLOCK)}최근 변경</button></nav>`
    : `<nav><button type="button" data-action="wiki-recent">${ni(CLOCK)}최근 변경</button><button type="button" data-action="wiki-random">${ni(SHUFFLE)}임의 문서</button></nav>`;
  const rnd = main ? `<button type="button" class="rnd" data-action="wiki-random" title="임의 문서" aria-label="임의 문서"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00a495" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SHUFFLE}</svg></button>` : '';
  const sr = `<label class="sr"><input class="wk-in" type="search" name="wiki-q" data-input="wiki-query" data-enter="wiki-search" placeholder="${main ? '여기에서 검색' : '문서 제목 검색'}" value="${esc(wiki.query)}" aria-label="위키 검색" autocomplete="off"><button type="button" class="sg" data-action="wiki-search" data-take="wiki-q" aria-label="검색">${SRCH}</button></label>`;
  return `<div class="top wk-top"><button type="button" class="lg wk-logo" data-action="wiki-home" aria-label="괴이위키 대문">${LOGO}괴이위키</button>${nav}${wlb}${rnd}${sr}</div>`;
}

/** 오늘의 문서: 날마다 바뀌는 저장 문서 하나 (첫 문단이 있는 것) */
function todayDoc(ctx: ChatContext, docs: WikiDoc[]): { doc: WikiDoc; text: string } | null {
  const list = docs.map((d) => ({ doc: d, text: docSummary(d.body, 120) })).filter((x) => x.text);
  if (!list.length) return null;
  const day = Math.floor((Date.now() + 9 * 3600e3) / 86400e3);
  return list[day % list.length];
}

/** 위키 대문 (시안 WKMAIN) */
function homeView(ctx: ChatContext): string {
  const docs = sortedDocs(ctx);
  const pick = (t: string) => `<button type="button" class="wl" data-action="wiki-pick" data-value="${esc(t)}">${esc(shownName(ctx, t))}</button>`;
  const links = (list: WikiDoc[], tab: Tab) => [...list.slice(0, 9).map((d) => pick(d.title)), `<button type="button" class="wl" data-action="wiki-browse" data-value="${tab}">[전체]</button>`].join(' · ');
  const places = docs.filter((d) => ['an', 'ms'].includes(docCat(ctx, d)));
  const people = docs.filter((d) => docCat(ctx, d) === 'ag');
  const today = todayDoc(ctx, docs);
  const rows = [
    today ? [IROW_ICO.doc, `오늘의 문서 · ${esc(shownName(ctx, today.doc.title))}`, `${esc(today.text)} <button type="button" class="wl" data-action="wiki-pick" data-value="${esc(today.doc.title)}">[더 보기]</button>`] : null,
    places.length ? [IROW_ICO.pin, `괴담·장소 <small>${places.length}</small>`, links(places, 'an')] : null,
    people.length ? [IROW_ICO.person, `인물 <small>${people.length}</small>`, links(people, 'ag')] : null,
    [IROW_ICO.pen, '새 문서 요청', '찾는 문서가 없으면 <button type="button" class="wl" data-action="wiki-new">문서 작성 요청</button>을 남겨 주세요.'],
  ].filter((r): r is string[] => !!r);
  const story = docs.filter((d) => !d.base).sort((a, b) => (b.meta?.created ?? 0) - (a.meta?.created ?? 0));
  const recent = story.slice(0, 10).map((d) => `<div class="rc">${pick(d.title)}${d.meta?.created ? `<small>${ago(d.meta.created)}</small>` : ''}</div>`).join('');
  return `<div class="wrap"><div class="doc mainp"><div class="h1r"><h1 class="wk-h1">괴이위키:대문</h1></div><div class="dm dm0">최근 수정 시각: 오늘</div><div class="cat">분류: <button type="button" class="wl" data-action="wiki-home">괴이위키</button></div><hr class="hl">
    <div class="intro"><h3>여러분이 기록해 나가는 <span>괴담의 나무</span></h3><p><button type="button" class="wl" data-action="wiki-home">괴이위키</button>에 오신 것을 환영합니다!</p><p class="sm2">괴이위키는 누구나 기여할 수 있는 위키입니다.<br>검증되지 않았거나 편향된 내용이 있을 수 있습니다.</p>
      <div class="bsr"><input type="search" name="wiki-home-q" data-input="wiki-home-query" data-enter="wiki-search" placeholder="여기에서 검색" value="${esc(wiki.homeQuery)}" aria-label="위키 검색" autocomplete="off"><button type="button" data-action="wiki-search" data-take="wiki-home-q">검색</button></div>
      <div class="hres">${wikiHomeResults(ctx)}</div></div><hr class="hl">
    <table class="irow">${rows.map(([ic, tt, body]) => `<tr><td class="ic">${ic}</td><td><div class="tt">${tt}</div><div>${body}</div></td></tr>`).join('')}</table>
  </div><div class="side wk-side"><div class="bx"><h5>${ni(CLOCK)}최근 변경</h5>${recent || '<p class="rc0">아직 바뀐 문서가 없어요.</p>'}${story.length > 10 ? `<button type="button" class="more" data-action="wiki-browse" data-value="story">${story.length}개 모두 보기</button>` : ''}</div></div></div>`;
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
    <div class="ph-form-body ps">
    <section class="ps-group"><h3>자동 작성</h3><div class="ps-rows">
      ${line('자동 호출', seg('wiki-auto', s.auto, [['0', '수동'], ['open', '창을 열 때'], ['turn', '매 턴']]), '채팅이 진행되면 문서 하나를 저절로 써요. 문서가 길어 호출 하나가 커요')}
      ${line('제목', seg('wiki-auto_title', s.autoTitle, [['model', '모델이 고름'], ['input', '직접 입력']]), '모델이 고름 = 명부 항목 중 이번 이야기에 맞는 것')}
      ${s.autoTitle === 'input' ? line('직접 입력', `<input class="gx-search ps-text" data-change="wiki-auto_query" value="${esc(s.autoQuery)}" placeholder="문서 제목">`) : ''}
    </div></section>
    <section class="ps-group"><h3>문서 작성</h3><div class="ps-rows">
      ${line('분량', seg('wiki-length', s.length, [['short', '짧게'], ['standard', '보통'], ['detailed', '상세']]))}
      ${line('작성 모드', seg('wiki-mode', s.mode, [['expand', '확장'], ['faithful', '원본 충실']]))}
      ${line('모델', seg('wiki-model', s.model, [['main', '메인 모델'], ['aux', '보조 모델']]))}
      ${line('다시 쓸 때 이전 문서 참고', seg('wiki-refresh_previous', s.refreshPrevious ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]))}
      ${line('컨텍스트에 포함', seg('wiki-context', wikiContextOn(ctx.chat.scriptstate) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '채팅에 나온 문서가 채팅 요청에 참고로 붙어요')}
      ${line('주석', seg('wiki-footnotes', s.footnotes, [['pop', '뜨는 창'], ['inline', '펼치기']]), '펼치기는 주석을 본문 안에 괄호로 둬요. 폰에서 읽기 편해요')}
      ${line('그림', seg('wiki-images', s.images, [['off', '끔'], ['infobox', '정보칸만'], ['body', '본문까지']]), '본문까지면 괴이·특수·거점·조직 그림을 본문에 넣고, 인물 문서는 정보칸 표정을 모델이 골라요. 인물 그림은 본문에 넣지 않아요')}
    </div></section>
    <section class="ps-group"><h3>공용 지침</h3><div class="ps-rows"><div class="ps-row">
      <textarea class="gx-search nw-reqbox" data-change="wiki-request" rows="3" placeholder="모든 문서에 덧붙일 말투·형식·관점">${esc(req)}</textarea></div></div></section>
    ${advancedBox('nw', ctx.chat.scriptstate)}</div>
  </div>`;
}

/** 새 문서 (시안 WKNEW) */
function newView(): string {
  return `<div class="wrap one"><div class="doc"><h1 class="wk-h1">새 문서 만들기</h1><div class="dm">괴이위키</div>
    <div class="nodoc"><label for="wk-new">문서 제목</label><input id="wk-new" class="in1" name="wiki-new" data-input="wiki-new" data-enter="wiki-write" value="${esc(wiki.newTitle)}" maxlength="300" placeholder="문서 제목"><p class="src">명부에 있는 이름이면 그 항목의 원본 로어북으로 작성해요.</p><div class="rr"><span class="sp"></span><button type="button" class="bt go" data-action="wiki-write" data-take="wiki-new">다음</button></div></div></div></div>`;
}

/** 작성·다시 쓰기의 지침 칸: 공용 지침은 보여 주기만, 이 문서 지침은 여기서 적는다 */
function docReqBox(shared: string): string {
  return `<textarea class="ta" data-input="wiki-docreq" rows="3" maxlength="2000" aria-label="이 문서 지침" placeholder="이 문서에만 덧붙일 지침 (내용·관점·분량)">${esc(wiki.docReq)}</textarea>
      ${shared ? `<p class="crq">공용 지침: ${esc(shared)}</p>` : ''}`;
}

/** 아직 없는 문서 (시안 WKNONE): 원본 자료 안내, 지침 칸, 문서 작성 */
function compose(ctx: ChatContext): string {
  const job = jobs.get(chatKey(ctx));
  const mine = job?.title === wiki.title;
  const lore = hasBook(source(ctx), wiki.title);
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  const src = lore
    ? '같은 이름의 로어북이 있어요. 그 내용을 원본으로 작성해요.'
    : wiki.inherited.length
      ? `로어북이 없어서 「${esc(wiki.previousTitle ?? '')}」 문서의 원본 자료(${esc(wiki.inherited.join(', '))})를 이어받아 작성해요.`
      : '같은 이름의 로어북이 없어요. 대화와 관련 자료를 바탕으로 작성해요.';
  return `<div class="wrap one"><div class="doc"><h1 class="wk-h1">${esc(wiki.title)}</h1><div class="dm">새 문서</div>
    <div class="nodoc wk-compose"><p><b>해당 문서를 찾을 수 없습니다.</b></p><p class="src">${src}</p>
      ${docReqBox(req)}
      <div class="rr"><span class="sp"></span><button type="button" class="bt go" data-action="wiki-start" data-value="${esc(wiki.title)}" ${job ? 'disabled' : ''}>${mine ? '<i class="spin"></i>작성하는 중…' : '문서 작성'}</button></div>${mine ? '<p class="bz nw-busy" role="status">창을 닫아도 계속 작성돼요.</p>' : ''}</div></div></div>`;
}

/** 괴이 문서의 정답 문단을 접을지: 이 채팅에서 그 괴이를 클리어했으면 처음부터 펼친다 */
function spoilerFold(ctx: ChatContext, title: string, e: Entry | undefined): boolean {
  if (e?.cat !== 'an') return false;
  const cleared = new Set(readWorld(ctx.chat).cleared ?? []);
  return ![title, e.name, e.title].some((n) => cleared.has(n));
}

/** 문서 보기 (시안 wk·wk_rw) */
function docView(ctx: ChatContext): string {
  const doc = findDoc(ctx.chat, wiki.title, ctx.char.globalLore);
  if (!doc) {
    wiki.view = 'compose';
    return compose(ctx);
  }
  const c = canon(ctx);
  const saved = new Set(listDocs(ctx.chat, ctx.char.globalLore).map((d) => d.title));
  const e = entryFor(ctx, doc.title);
  const s = wikiSettings(ctx.chat.scriptstate);
  // 정보칸 그림: 인물 문서는 모델이 고른 표정(그 그림이 있을 때만), 설정이 끔이면 없음
  let pic = s.images === 'off' ? '' : e?.photo ?? '';
  const mood = pic && e?.cat === 'ag' ? portraitMood(doc.body) : '';
  if (mood && /_default$/.test(pic.replace(/#.*$/, '')) && hasAsset(ctx.char, pic.replace(/#.*$/, '').replace(/_default$/, `_${mood}`))) pic = pic.replace(/_default(#|$)/, `_${mood}$1`);
  const photo = pic ? imageUrl(ctx.char, pic) : null;
  const r = renderArticle(doc.body, {
    saved: (t) => saved.has(t), canon: c, photo, fold: spoilerFold(ctx, doc.title, e), inlineNotes: s.footnotes === 'inline',
    image: s.images === 'body' ? (name) => (hasAsset(ctx.char, name) ? imageUrl(ctx.char, name) : null) : undefined,
  });
  const job = jobs.get(chatKey(ctx));
  // 상세·관련 문서: 아직 없는 문서는 빨간 글자
  const rel = (label: string, list: string[]) =>
    list.length
      ? `<div class="rel"><b>${label}</b>${list.map((t) => `<button type="button" class="wl${saved.has(t) ? '' : ' none'}" data-action="wiki-open" data-value="${esc(t)}">${esc(entryFor(ctx, t)?.name ?? t)}</button>`).join(' · ')}</div>`
      : '';
  const m = doc.meta;
  const info = m
    ? `<details class="ref"><summary>참조 자료</summary><p>${m.mode === 'faithful' ? '원본 충실' : '확장'} · ${({ short: '짧게', standard: '보통', detailed: '상세' } as Record<string, string>)[m.length] ?? m.length} · ${m.model === 'aux' ? '보조 모델' : '메인 모델'}</p>
       ${m.sources.length ? `<p>${esc(m.sources.join(', '))}</p>` : ''}${m.writingRequest ? `<p>공용 지침: ${esc(m.writingRequest)}</p>` : ''}${m.docRequest ? `<p>이 문서 지침: ${esc(m.docRequest)}</p>` : ''}</details>`
    : '';
  const confirm = wiki.confirmDelete === doc.title;
  // 기본 문서는 지울 수 없고, 채팅에서 새로 쓴 문서를 지우면 기본 문서로 돌아간다
  const hasBase = baseDocs(ctx.char.globalLore).some((d) => d.title === doc.title);
  const del = doc.base
    ? ''
    : `<button type="button" class="${confirm ? 'danger' : ''}" data-action="wiki-delete" data-value="${esc(doc.title)}">${confirm ? (hasBase ? '정말 되돌리기' : '정말 삭제') : hasBase ? '↺ 되돌리기' : '🗑 삭제'}</button>`;
  const open = wiki.rewrite === doc.title;
  const busy = job?.title === doc.title;
  const tools = `<div class="dbtn"><button type="button" class="${open ? 'on' : ''}" data-action="wiki-rewrite" data-value="${esc(doc.title)}" aria-pressed="${open}" ${job ? 'disabled' : ''}>${busy ? '✎ 작성하는 중' : '✎ 다시 쓰기'}</button>${del}</div>`;
  const req = String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? '');
  const rewrite = open
    ? `<div class="rwbox wk-rewrite"><b>다시 쓰기</b>${docReqBox(req)}
        <div class="rr"><span>이전 문서 참고</span><span class="sg2">${([['1', 'ON'], ['0', 'OFF']] as const).map(([v, l]) => `<button type="button" class="${(wiki.rewritePrev ? '1' : '0') === v ? 'on' : ''}" data-action="wiki-rw-prev" data-value="${v}" aria-pressed="${(wiki.rewritePrev ? '1' : '0') === v}">${l}</button>`).join('')}</span><span class="sp"></span><button type="button" class="bt go" data-action="wiki-rw-go" data-value="${esc(doc.title)}" ${job ? 'disabled' : ''}>${busy ? '<i class="spin"></i>작성하는 중…' : '다시 쓰기'}</button><button type="button" class="bt" data-action="wiki-rw-cancel">취소</button></div>${busy ? '<p class="bz nw-busy" role="status">창을 닫아도 계속 작성돼요.</p>' : ''}</div>`
    : '';
  const dm = [doc.base ? '' : m?.created ? `최근 수정 시각: ${dayOf(m.created)}` : '', `분류: ${catName(ctx, doc)}`, e && e.sub && e.cat !== 'lm' ? e.sub : ''].filter(Boolean).join(' · ');
  return `<div class="wrap one"><div class="doc wk-docp"><div class="h1r wk-head"><h1 class="wk-h1">${esc(doc.title)}</h1>${tools}</div><div class="dm">${esc(dm)}</div>
    ${rewrite}<article class="nw-doc"><div class="nw-body">${r.html}</div></article>
    ${rel('상세 문서', r.related)}${rel('관련 문서', r.recent)}${info}</div></div>`;
}

/** 검색 결과 (시안 WKSEARCH): 딱 맞는 문서가 없을 때. 걸린 문서·명부·비슷한 문서, 맨 위에 새 문서 만들기 */
function findView(ctx: ChatContext): string {
  const q = wiki.query.trim();
  const docs = sortedDocs(ctx);
  const saved = new Set(docs.map((d) => d.title));
  const lower = q.toLowerCase();
  const mine = docs.filter((d) => d.title.toLowerCase().includes(lower) || entryFor(ctx, d.title)?.terms.some((t) => t && t.toLowerCase().includes(lower)));
  // 같은 문서로 이어지는 명부 항목(거점 「관리국」·조직 「관리국」)은 하나만
  const hits = matches(ctx, q).filter((e, i, all) => !saved.has(e.title) && all.findIndex((x) => x.title === e.title) === i);
  const shown = new Set([...mine.map((d) => d.title), ...hits.map((e) => e.title)]);
  const near = similar(q, [...docs.map((d) => d.title), ...entries(ctx).map((e) => e.title)]).filter((t) => !shown.has(t));
  const item = (title: string, cat: string, text: string, none: boolean) =>
    `<li><button type="button" class="wl t${none ? ' none' : ''}" data-action="wiki-pick" data-value="${esc(title)}">${esc(shownName(ctx, title))}</button><small>${esc(cat)}</small>${text ? `<p>${esc(text)}</p>` : ''}</li>`;
  const ofDoc = (d: WikiDoc) => item(d.title, catName(ctx, d), docSummary(d.body, 90), false);
  const ofEntry = (e: Entry) => item(e.title, CAT_LABEL[entryFor(ctx, e.title)?.cat ?? e.cat], [e.sub, '아직 없는 문서'].filter(Boolean).join(' · '), true);
  const list = [
    ...mine.map(ofDoc),
    ...hits.map(ofEntry),
    ...near.map((t) => {
      const d = docs.find((x) => x.title === t);
      if (d) return ofDoc(d);
      const e = entries(ctx).find((x) => x.title === t);
      return e ? ofEntry(e) : '';
    }),
  ].filter(Boolean);
  const exact = saved.has(canon(ctx)(q));
  const go1 = exact ? '' : `<div class="go1 wk-nohit">→ <button type="button" class="wl" data-action="wiki-write" data-value="${esc(q)}"><b>${esc(q)}</b></button> 문서가 없어요. <button type="button" class="wl new" data-action="wiki-write" data-value="${esc(q)}">이 제목으로 새 문서 만들기</button></div>`;
  return `<div class="wrap one"><div class="doc wk-find"><h1 class="wk-h1">"${esc(q)}" 검색 결과</h1><div class="dm">문서 ${list.length}개</div>
    ${go1}${list.length ? `<ul class="sres">${list.join('')}</ul>` : ''}</div></div>`;
}

function paneHtml(ctx: ChatContext): string {
  if (wiki.view === 'doc') return docView(ctx);
  if (wiki.view === 'compose') return compose(ctx);
  if (wiki.view === 'settings') return `<div class="wrap one"><div class="doc">${settingsView(ctx)}</div></div>`;
  if (wiki.view === 'new') return newView();
  if (wiki.view === 'find') return findView(ctx);
  return homeView(ctx);
}

export function wikiTab(ctx: ChatContext, env?: WikiEnv): string {
  if (env) liveEnv = env;
  const fail = wiki.failure
    ? `<details class="nw-fail"><summary>최근 실패 원문 (${esc(wiki.failure.title)})</summary><p>${esc(wiki.failure.reason)}</p><textarea class="gx-search" rows="6" readonly>${esc(wiki.failure.raw)}</textarea></details>`
    : '';
  const note = toast('nw', wiki.info, (t) => {
    if (wiki.info === t) wiki.info = '';
  });
  const job = jobs.get(chatKey(ctx));
  // 작성 화면·다시 쓰기 칸에서는 단추가 작성 중을 보여 주므로, 다른 화면에서만 한 줄로
  const showBusy = job && !(wiki.title === job.title && (wiki.view === 'compose' || (wiki.view === 'doc' && wiki.rewrite === job.title)));
  const status = `${showBusy ? busyLine(ctx) : ''}${wiki.notice ? `<div class="gx-err" role="alert">${esc(wiki.notice)}</div>` : ''}`;
  const open = wiki.listOpen;
  const main = wiki.view === 'home';
  // 목록 서랍 (시안 wk_list): 머리줄 아래 설정한 쪽(기본 오른쪽)에서. 폰은 오른쪽 아래 「목록」 책갈피
  const drawer = `<aside class="wdr${open ? ' open' : ''}" aria-label="위키 목록"${open ? '' : ' inert'}>
      <label class="wsr">${SRCH}<input type="search" name="wiki-filter" data-input="wiki-filter" placeholder="이름·제목 검색" value="${esc(wiki.filter)}" aria-label="이름·제목 검색" autocomplete="off"></label>
      <div class="wlist">${wikiList(ctx)}</div>${fail}</aside>`;
  const grab = `<button type="button" class="wgrab" data-action="wiki-list" data-value="open" aria-label="목록 펼치기">‹<span>목록</span></button>`;
  const scrim = open ? '<button type="button" class="wscrim" data-action="wiki-list" data-value="close" aria-label="목록 접기" tabindex="-1"></button>' : '';
  return `<main class="gx-body wk hasdr${main ? ' nm' : ''}${open ? ' dr-open' : ''}">
    ${topBar(main)}
    <div class="wsc">${status ? `<div class="wst nw-status">${status}</div>` : ''}${paneHtml(ctx)}</div>
    ${grab}${drawer}${scrim}
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
  doc.closest('.wsc')?.addEventListener('scroll', () => !hover && hide(), { passive: true });
}

export function bindWikiSide(root: HTMLElement, act: (value: string) => void): void {
  const bar = root.querySelector<HTMLElement>('.nw-rail');
  const panel = root.querySelector<HTMLElement>('.wk .wdr');
  if (!panel) return;
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
  bar?.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
    dragged = false;
    window.addEventListener('pointerup', up, { once: true });
  });
  // 끈 다음에 따라오는 누르기는 무시
  bar?.addEventListener('click', (e) => {
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
      const box = panel.querySelector<HTMLElement>('.wls');
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
    // 설정한 쪽(기본 오른쪽)에서 열리므로 접는 방향도 그쪽으로 (PC·폰 같음, 2026-10-29)
    const fromLeft = root.closest<HTMLElement>('[data-wiki-side]')?.dataset.wikiSide === 'left';
    const out = fromLeft ? dx < -36 : dx > 36;
    if (out && Math.abs(dx) > Math.abs(dy) * 1.5 && wiki.listOpen) act('close');
  }, { passive: true });
  // 모바일 책갈피를 안쪽으로 끌어도 열린다 (오른쪽 책갈피는 왼쪽으로, 왼쪽 책갈피는 오른쪽으로)
  const edge = root.querySelector<HTMLElement>('.wk .wgrab');
  let e0: number | null = null;
  edge?.addEventListener('touchstart', (e) => (e0 = e.touches[0]?.clientX ?? null), { passive: true });
  edge?.addEventListener('touchend', (e) => {
    if (e0 === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? e0) - e0;
    e0 = null;
    const leftSide = root.closest<HTMLElement>('[data-wiki-side]')?.dataset.wikiSide === 'left';
    if ((leftSide ? dx > 24 : dx < -24) && !wiki.listOpen) act('open');
  }, { passive: true });
}

const wide = () => !isPhone();

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
      go('home', '', '');
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
      return true;
    case 'wiki-recent':
      // 최근 변경은 대문 오른쪽 칸에 있다
      go('home', '', '');
      wiki.history = [];
      wiki.listOpen = false;
      break;
    case 'wiki-random': {
      const docs = listDocs(ctx.chat, ctx.char.globalLore);
      if (!docs.length) break;
      const d = docs[Math.floor(Math.random() * docs.length)];
      wiki.history = [];
      go('doc', d.title, '');
      wiki.listOpen = false;
      break;
    }
    case 'wiki-find':
      // 검색칸에 바로 커서
      wiki.listOpen = false;
      env.render();
      document.querySelector<HTMLInputElement>('.wk-in')?.focus();
      return true;
    case 'wiki-tab':
      wiki.tab = (TABS.some(([t]) => t === v) ? v : 'all') as Tab;
      break;
    case 'wiki-browse':
      // 메인의 분류 칸: 서랍을 그 탭으로 연다
      Object.assign(wiki, { tab: (TABS.some(([t]) => t === v) ? v : 'all') as Tab, listOpen: true, query: '', filter: '' });
      break;
    case 'wiki-search': {
      wiki.homeQuery = '';
      // 검색으로 문서·작성 화면에 갔을 때만 목록을 접는다. 못 찾으면 search 가 목록을 펼쳐 「없어요 · 작성하기」를 보이는데,
      // 예전엔 문서를 보던 중이면 곧바로 다시 접혀 검색이 아무 반응 없는 것처럼 보였다 (QC 2026-10-28)
      if (search(ctx, v)) wiki.listOpen = false;
      // 문서·작성 화면으로 갔으면 검색칸을 비운다 (검색 화면에서는 그대로)
      if (wiki.view !== 'find') wiki.query = '';
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
    case 'wiki-footnotes':
    case 'wiki-images':
    case 'wiki-auto':
    case 'wiki-auto_title':
      await setVar(ctx, env, `$nw_${action.slice(5)}`, v);
      return true;
    case 'wiki-auto_query':
      await setVar(ctx, env, '$nw_auto_query', v.trim().slice(0, 80));
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
  if (name === 'wiki-filter') return void (wiki.filter = value), true;
  return false;
}

/** 메인 설정 「기능별 설정」에서 연다 */
export const wikiSettingsPane = (ctx: ChatContext): string => settingsView(ctx);

/** 호출 흐름 미리 계산: 매 턴 자동 작성이 보낼 요청 (제목 고르기 + 본문). 제목은 설정대로, 모델이 고르는 설정이면 후보 첫 항목으로 친다 */
export function previewWikiAuto(ctx: ChatContext): { title: LlmMessage[] | null; article: LlmMessage[] | null } {
  const s = wikiSettings(ctx.chat.scriptstate);
  const me = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  const written = new Set(listDocs(ctx.chat, ctx.char.globalLore).filter((d) => !d.base).map((d) => d.title));
  const candidates = [...new Set(entries(ctx).filter((e) => !(me && e.cat === 'ag' && e.name === me.name)).map((e) => e.title))];
  const names = (() => {
    try {
      return factionNames(parseCatalog(ctx.char.globalLore), String(ctx.chat.scriptstate?.['$st_faction'] ?? ''));
    } catch {
      return {};
    }
  })();
  const titleMsgs = s.autoTitle === 'model' && candidates.length ? wikiTitlePrompt(source(ctx), candidates, [...written], names) : null;
  const title = s.autoTitle === 'input' ? (s.autoQuery ? canon(ctx)(s.autoQuery) : '') : candidates.find((c) => !written.has(c)) ?? candidates[0] ?? '';
  if (!title) return { title: titleMsgs, article: null };
  const old = findDoc(ctx.chat, title, ctx.char.globalLore);
  const regenerate = !!old && !old.base;
  const p = articlePrompt(ctx, title, { inherited: regenerate ? (old?.meta && !old.meta.direct ? old.meta.primarySources : []) : [], previousDoc: regenerate && s.refreshPrevious ? old : null, writingRequest: String(ctx.chat.scriptstate?.['$nw_writing_request'] ?? ''), docRequest: '', direct: regenerate ? !!old?.meta?.direct : false });
  return { title: titleMsgs, article: p.messages };
}
