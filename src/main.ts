import { hasSceneCard, renderSceneCards } from './core/dispatch';
import { GN_RAW, gnetSettings, mainContext, readGnet, userNick } from './core/gnet';
import { mainContextRules } from './core/gnetPrompt';
import { processRequest, unwrapCalls, unwrapScenes, type PromptMessage } from './core/request';
import { hasCall, mainContext as phoneMainContext, phoneSettings, PH_STATE, PH_BULLETINS, readBulletins, readPhone, renderCalls } from './core/phone';
import { mainContextRules as phoneRules } from './core/phonePrompt';
import { chatPhase } from './core/start';
import { autoRefresh } from './ui/phone';
import { autoRefreshGnet } from './ui/gnet';
import { prefetchFactions } from './ui/images';
import { SEED_OPEN } from './core/seed';
import { readManifest } from './core/start';
import type { Chat, LoreEntry } from './core/types';
import { cleanOutput, hasWorldTags, parseCatalog, processOutput } from './core/world';
import { missingBasicVars, worldSettings } from './core/settings';
import { staleFactionVars } from './core/factions';
import { supplementAssets } from './host/asset';
import { updateChat } from './host/risu';
import { WatchState, type WatchSnapshot } from './core/watch';
import { createFab, playIntro, type Fab } from './host/overlay';
import { BRAND } from './ui/brand';
import { currentTheme, onThemeChange, PALETTES, setCurrentTheme, themeName } from './ui/theme';
import { getPrefs } from './core/settings';
import { openApp } from './ui/app';
import { GHOST_ICON } from './ui/icons';
import { loadPrefs } from './host/prefs';

const PLUGIN_ID = 'goei-plugin';
const WATCH_MS = 1000;

/** 지금 보고 있는 캐릭터가 괴이봇 Lite인지 (감시 루프가 갱신). 다른 봇에서는 아무것도 하지 않기 위해 쓴다 */
let liteNow = false;

async function onBeforeRequest<M extends PromptMessage>(messages: M[], type: string): Promise<M[]> {
  if (type !== 'model' || !Array.isArray(messages)) return messages;
  if (liteNow) {
    messages = unwrapCalls(unwrapScenes(stripHistoryTags(messages)).messages).messages;
    const ctx = await moduleContext().catch(() => [] as string[]);
    for (const c of ctx) messages = [...messages, { role: 'system', content: c } as M];
  }
  // 시드 표식이 없는 요청은 아무것도 읽지 않고 바로 돌려보낸다 (매 전송마다 드는 비용을 0에 가깝게).
  if (!messages.some((m) => typeof m?.content === 'string' && m.content.includes(SEED_OPEN))) return messages;
  try {
    const charIndex = await risuai.getCurrentCharacterIndex();
    const chatIndex = await risuai.getCurrentChatIndex();
    const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
    if (!chat) return messages;
    // 요청 도중에는 채팅을 저장하지 않는다. 응답이 붙기 전에 채팅 객체를 바꾸면 응답이 사라질 수 있다.
    // 남은 seed_lore 변수는 여기서 걸러지므로 두 번째 전송부터는 모델에 가지 않는다.
    return processRequest(messages, chat).messages;
  } catch (error) {
    console.log(`[goei] beforeRequest 실패: ${error instanceof Error ? error.message : String(error)}`);
    return messages;
  }
}

let rulesCache: { charIndex: number; gnet: string | null; phone: string | null } | null = null;

/** 괴담넷 글·쪽지, 괴담톡 대화·공지를 본편 요청 끝에 참고 기록으로 (원본 editRequest + RC.gnetContext·phoneContext). 기록이 없거나 꺼 두면 빈 목록 */
async function moduleContext(): Promise<string[]> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const chatIndex = await risuai.getCurrentChatIndex();
  const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  const ss = chat?.scriptstate;
  const wantGnet = !!ss?.[GN_RAW] && gnetSettings(ss).enabled && gnetSettings(ss).context;
  const wantPhone = (!!ss?.[PH_STATE] || !!ss?.[PH_BULLETINS]) && phoneSettings(ss).context;
  if (!chat || (!wantGnet && !wantPhone)) return [];
  if (rulesCache?.charIndex !== charIndex) {
    const char = (await risuai.getCharacterFromIndex(charIndex)) as { globalLore?: LoreEntry[] } | null;
    const src = { char: { globalLore: char?.globalLore }, chat };
    rulesCache = { charIndex, gnet: mainContextRules(src), phone: phoneRules(src) };
  }
  const out: string[] = [];
  if (wantGnet && rulesCache.gnet) {
    const st = readGnet(chat);
    if (st.posts.length || st.dms.length) out.push(mainContext(st, userNick(ss), rulesCache.gnet));
  }
  if (wantPhone && rulesCache.phone) {
    try {
      out.push(phoneMainContext(readPhone(chat), readBulletins(chat), phoneSettings(ss), rulesCache.phone));
    } catch (error) {
      console.log(`[goei] 괴담톡 기록을 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return out.filter(Boolean);
}

/** 혹시 저장 본문에 상황판 태그가 남아 있으면 요청에서만 지운다 (원본 editRequest와 같음) */
function stripHistoryTags<M extends PromptMessage>(messages: M[]): M[] {
  if (!messages.some((m) => m?.role === 'assistant' && typeof m.content === 'string' && hasWorldTags(m.content))) return messages;
  return messages.map((m) => (m?.role === 'assistant' && typeof m.content === 'string' && hasWorldTags(m.content) ? { ...m, content: cleanOutput(m.content) } : m));
}

/** 모델 응답이 채팅에 들어간 뒤: 상황판 태그 반영 + 저장 본문 정리 + 다음 턴 브리핑 */
async function onOutput(arg: { char: unknown; chat: unknown; characterIndex: number; chatIndex: number; messageIndex: number }): Promise<void> {
  try {
    const char = arg.char as { globalLore?: LoreEntry[] } | null;
    const chat = arg.chat as Chat | null;
    if (!char || !chat || !readManifest(char.globalLore)) return; // 다른 봇: 아무것도 안 함
    const raw = chat.message?.[arg.messageIndex]?.data;
    if (typeof raw !== 'string') return;
    let latest: Chat | null = null;
    if (chat.scriptstate?.['$st_anomaly_on'] === '1') {
      const catalog = parseCatalog(char.globalLore);
      latest = await updateChat(arg.characterIndex, arg.chatIndex, (cur) =>
        processOutput(cur, arg.messageIndex, raw, catalog, worldSettings(char.globalLore, cur.scriptstate), Math.random),
      );
    }
    let now = latest ?? ((await risuai.getChatFromIndex(arg.characterIndex, arg.chatIndex)) as Chat | null);
    if (!now || chatPhase(now) !== 'started') return;
    now.message ??= [];
    // 이전 버전에서 시작한 채팅: 에셋 모듈 로어북이 읽는 설정 변수를 채운다. 명부의 새 세력이 바뀌었으면 태그·세력 로어북 변수도 맞춘다
    const missing = (ss: Chat['scriptstate']) => {
      const vars = { ...missingBasicVars(char.globalLore, ss), ...staleFactionVars(char.globalLore, ss) };
      return Object.keys(vars).length ? vars : null;
    };
    if (missing(now.scriptstate)) {
      now = (await updateChat(arg.characterIndex, arg.chatIndex, (cur) => {
        const vars = missing(cur.scriptstate);
        return vars ? { ...cur, scriptstate: { ...(cur.scriptstate ?? {}), ...vars } } : null;
      })) ?? now;
    }
    // 보조모델 이미지 태그 보충 (설정이 보조모델일 때). 끝난 뒤 괴담톡 확인 (보조 모델을 겹쳐 부르지 않게)
    await supplementAssets({ charIndex: arg.characterIndex, chatIndex: arg.chatIndex, lore: char.globalLore, chat: now, messageIndex: arg.messageIndex });
    // 괴담톡 자동 새 메시지 확인 → 괴담넷 자동 새로고침 (설정이 켜져 있을 때, 같은 응답에는 한 번. 모델을 겹쳐 부르지 않게 차례로)
    const phoneAuto = phoneSettings(now.scriptstate).auto;
    const gnetAuto = gnetSettings(now.scriptstate).auto;
    if (phoneAuto || gnetAuto) {
      const fresh = async () => {
        const c = ((await risuai.getChatFromIndex(arg.characterIndex, arg.chatIndex)) as Chat | null) ?? now!;
        c.message ??= [];
        return { charIndex: arg.characterIndex, chatIndex: arg.chatIndex, char: char as never, chat: c };
      };
      void (async () => {
        if (phoneAuto) {
          await autoRefresh(await fresh(), arg.messageIndex).catch((error) =>
            console.log(`[goei] 괴담톡 자동 확인 실패: ${error instanceof Error ? error.message : String(error)}`),
          );
        }
        if (gnetAuto) {
          await autoRefreshGnet(await fresh(), arg.messageIndex).catch((error) =>
            console.log(`[goei] 괴담넷 자동 새로고침 실패: ${error instanceof Error ? error.message : String(error)}`),
          );
        }
      })();
    }
  } catch (error) {
    console.log(`[goei] 응답 처리 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 채팅 화면의 이동·커스텀 임무 기록 카드 (본문 대신 목표와 투입만) */
function sceneCardHtml(s: { target: string; party: string }): string {
  const p = cardPalette();
  return `<div style="${cardStyle()}flex-wrap:wrap">`
    + `<span style="color:${p.signal};font-weight:600">목표</span><span>${escHtml(s.target)}</span>`
    + `<span style="opacity:.5">|</span><span style="color:${p.signal};font-weight:600">투입</span><span>${escHtml(s.party)}</span></div>`;
}

/** 채팅 화면의 전화 기록 카드 (원본 ph-call-card: 상대만 보이고 요청 본문은 숨김) */
function callCardHtml(target: string): string {
  const p = cardPalette();
  return `<div style="${cardStyle()}">`
    + `<span aria-hidden="true">📞</span><span><b style="color:${p.signal}">${escHtml(target)}</b>에게 전화를 걸었다.</span></div>`;
}

/** Lite 카드의 첫 안내(first_mes). 카드에는 고정색으로 들어 있어 플러그인이 테마 색으로 다시 그린다. 옛 카드 문구도 알아본다 */
function isLanding(text: string): boolean {
  return text.includes('data-goei="landing"') || (text.includes('ANOMALY SIMULATION') && text.includes('버튼을 눌러 시작하세요'));
}

function landingHtml(): string {
  const p = cardPalette();
  return `<div style="max-width:34em;margin:18px auto;padding:22px 22px 18px;border-radius:20px;background:${p.void};border:1px solid ${p.line};color:${p.text};line-height:1.65;font-size:15px;text-align:center;box-shadow:0 20px 40px -24px rgba(0,0,0,.45)">`
    + `<span style="display:inline-grid;place-items:center;width:52px;height:52px;border-radius:16px;background:${p.accentBg};color:${p.signal};margin-bottom:10px">${GHOST_ICON.replace('width="24" height="24"', 'width="30" height="30"')}</span>`
    + `<div style="font-family:monospace;font-size:11px;letter-spacing:.28em;color:${p.signal};opacity:.85">ANOMALY SIMULATION</div>`
    + titleHtml(p.text, p.signal)
    + `<div style="color:${p.sub}">유령 버튼을 눌러 시작하세요</div></div>`;
}

/** 제목 「괴이: 이면세계」: 크게, 이면(뒷면)이라는 뜻을 살려 아래로 흐리게 비친 반사를 단다 */
function titleHtml(text: string, signal: string): string {
  const line = `<span style="color:${text}">괴이</span><span style="color:${signal};font-weight:300;margin:0 .18em 0 .06em">:</span><span style="color:${signal}">이면세계</span>`;
  const font = 'font-size:2.1em;font-weight:800;letter-spacing:.08em;line-height:1.15;white-space:nowrap';
  return `<div style="margin:10px 0 0;${font}">${line}</div>`
    + `<div aria-hidden="true" style="${font};line-height:1;margin:-.06em 0 .02em;transform:scaleY(-1);opacity:.3;`
    + `-webkit-mask-image:linear-gradient(to top,#000,transparent 60%);mask-image:linear-gradient(to top,#000,transparent 60%)">${line}</div>`;
}

/** 채팅 속 기록 카드도 창 배색을 따른다 */
function cardPalette() {
  return PALETTES[currentTheme()];
}
function cardStyle(): string {
  const p = cardPalette();
  return `display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${p.accentLine};border-radius:10px;background:${p.accentBg};color:${p.sub};font-size:.92em;line-height:1.5;`;
}

/** Lite에서만: 응답이 막 들어와 아직 정리되기 전에도 태그가 보이지 않게, 이동 지시문은 카드로 */
function onDisplay(text: string): string {
  if (!liteNow || typeof text !== 'string') return text;
  if (isLanding(text)) return landingHtml();
  let out = text;
  if (hasWorldTags(out)) out = cleanOutput(out);
  if (hasSceneCard(out)) out = renderSceneCards(out, sceneCardHtml);
  if (hasCall(out)) out = renderCalls(out, callCardHtml);
  return out;
}

async function readSnapshot(fab: Fab): Promise<WatchSnapshot> {
  const none = { charIndex: -1, chatIndex: -1, chatScreen: false };
  try {
    const charIndex = await risuai.getCurrentCharacterIndex();
    if (!Number.isInteger(charIndex) || charIndex < 0) return none;
    const chatIndex = await risuai.getCurrentChatIndex();
    const chatScreen = await fab.chatScreenVisible();
    return { charIndex, chatIndex: Number.isInteger(chatIndex) ? chatIndex : -1, chatScreen };
  } catch {
    return none;
  }
}

async function isLiteCharacter(charIndex: number): Promise<boolean> {
  if (charIndex < 0) return false;
  try {
    const char = (await risuai.getCharacterFromIndex(charIndex)) as { globalLore?: LoreEntry[] } | null;
    const lite = !!readManifest(char?.globalLore);
    if (lite && char) prefetchFactions(char as never); // 시작 화면을 열 때 사진이 하나씩 늦게 뜨지 않게
    return lite;
  } catch {
    return false;
  }
}

/** 채팅을 바꾸면 그 채팅의 배색으로 (시작 전이면 새 채팅 기본값, 옛 채팅은 창과 같이 라이트) */
async function readTheme(snap: WatchSnapshot): Promise<void> {
  if (snap.chatIndex < 0) return;
  const chat = (await risuai.getChatFromIndex(snap.charIndex, snap.chatIndex)) as { message?: unknown[]; scriptstate?: Record<string, unknown> } | null;
  if (!chat) return;
  setCurrentTheme(themeName(chat.scriptstate?.['$st_fixed_theme'], chat.message?.length ? 'light' : themeName(getPrefs().theme)));
}

// 괴이봇 Lite 채팅 화면에서만 보이는 플로팅 버튼 + 그 화면에 들어올 때마다 접속 효과
function startWatcher(fab: Fab): () => void {
  const state = new WatchState();
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      const snap = await readSnapshot(fab);
      const lite = state.needsCharacterCheck(snap) ? await isLiteCharacter(snap.charIndex) : undefined;
      if (stopped) return;
      const next = state.update(snap, lite);
      liteNow = state.lite;
      if (next.changed) {
        if (next.fabVisible) await readTheme(snap).catch(() => {});
        if (next.intro) {
          await fab.setVisible(false);
          await playIntro().catch(() => {});
          if (stopped) return;
        }
        await fab.setVisible(next.fabVisible, next.intro);
      }
    } catch (error) {
      console.log(`[goei] 채팅 감시 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (!stopped) timer = setTimeout(() => void tick(), WATCH_MS);
    }
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

await loadPrefs();
await risuai.addRisuReplacer('beforeRequest', onBeforeRequest);
await risuai.addRisuChatListener('output', onOutput);
await risuai.addRisuScriptHandler('display', onDisplay);

let stopWatcher: (() => void) | null = null;
let fab: Fab | null = null;
try {
  fab = await createFab(() => void openApp({ quietIfNotLite: true }));
  const f = fab;
  void f.setTheme(currentTheme());
  onThemeChange((t) => void f.setTheme(t).catch(() => {}));
  stopWatcher = startWatcher(fab);
} catch (error) {
  // 본 화면 접근 권한을 거부하면 플로팅 버튼 대신 채팅 메뉴 항목을 쓴다 (다른 봇에서는 눌러도 아무것도 안 뜸).
  console.log(`[goei] 플로팅 버튼을 만들지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  await risuai.registerButton(
    { name: BRAND.name, icon: GHOST_ICON, iconType: 'html', location: 'chat', id: `${PLUGIN_ID}-chat` },
    () => void openApp({ quietIfNotLite: true }),
  );
}

await risuai.onUnload(async () => {
  stopWatcher?.();
  await fab?.remove().catch(() => {});
  await risuai.removeRisuReplacer('beforeRequest', onBeforeRequest);
  await risuai.removeRisuChatListener('output', onOutput);
  await risuai.removeRisuScriptHandler('display', onDisplay);
});
