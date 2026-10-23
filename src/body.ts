import { clearUnsent, unsentShown } from './host/unsent';
import { refreshStatusContext, renderStatus, setWikiOpener } from './host/statusview';
import { openingShown, refreshOpeningHint, setOpeningHint, setRepickOpener, wantsOpeningHint } from './host/openinghint';
import { hasStatusTag } from './core/world';
import { isUnsent, renderStartCards, renderUnsentMark, START_MARK, stripStartCard, stripUnsentMark, UNSENT_MARK } from './core/dispatch';
import { readPersona, USER_MARK } from './host/user';
import { hasSceneCard, renderSceneCards } from './core/dispatch';
import { CONTEXT as GN_CONTEXT, GN_RAW, gnetSettings, mainContext, readGnet, userNick } from './core/gnet';
import { mainContextRules } from './core/gnetPrompt';
import { processRequest, unwrapCalls, unwrapScenes, type PromptMessage } from './core/request';
import { HISTORY as PH_HISTORY, hasCall, mainContext as phoneMainContext, phoneSettings, PH_STATE, PH_BULLETINS, readBulletins, readPhone, renderCalls } from './core/phone';
import { mainContextRules as phoneRules } from './core/phonePrompt';
import { advNum, applyAdvanced } from './core/advanced';
import { fitTotal, type ContextPart } from './core/budget';
import { makeFocus, sceneText } from './core/focus';
import { buildRegistry, type Registry } from './core/world/registry';
import { wikiContextOn, wikiContextRules, wikiMainContext } from './core/wiki';
import { chatPhase } from './core/start';
import { autoRefresh } from './ui/phone';
import { autoRefreshGnet } from './ui/gnet';
import { Joint } from './host/joint';
import { prefetchFactions } from './ui/images';
import { SEED_OPEN } from './core/seed';
import { readManifest } from './core/start';
import type { Chat, LoreEntry } from './core/types';
import { cleanOutput, hasWorldTags, parseCatalog, processOutput } from './core/world';
import { basicSettings, missingBasicVars, worldSettings } from './core/settings';
import { staleFactionVars } from './core/factions';
import { supplementAssets } from './host/asset';
import { updateCharacterLore, updateChat } from './host/risu';
import { WatchState, type WatchSnapshot } from './core/watch';
import { createFab, type Fab } from './host/overlay';
import { BRAND } from './ui/brand';
import { cardPalette as themedCardPalette, currentTheme, onThemeChange, repaintTheme, setCurrentTheme, themeName } from './ui/theme';
import { hasImgTag, IMG_RECENT, imgTagsKnown, renderImgTags, setImgHidden, stripOldImgTags } from './core/imgtag';
import { loadModuleAssets, modulePicker } from './host/assets';
import { getPrefs } from './core/settings';
import { openApp, openWiki } from './ui/app';
import { GHOST_ICON } from './ui/icons';
import { landingHtml as renderLanding } from './ui/landing';
import { loadPrefs } from './host/prefs';
import { setWaiting } from './host/waiting';
import { syncDecorators, computeLore, loreOptions, patchSlots, sameVars, trimRoster, type LoreMode } from './core/lore';
import { advValue } from './core/advanced';
import { userInfo } from './host/user';
import { applyPlayer, hidePlayerTag, playerAgent, playerBlock } from './core/player';
import { withInterludes } from './core/interlude';
import { visitRecord } from './core/visit';
import { visitContextRules } from './core/visitPrompt';

const PLUGIN_ID = 'goei-plugin';
const WATCH_MS = 1000;

/** 지금 보고 있는 캐릭터가 괴이봇 Lite인지 (감시 루프가 갱신). 다른 봇에서는 아무것도 하지 않기 위해 쓴다 */
let liteNow = false;

async function onBeforeRequest<M extends PromptMessage>(messages: M[], type: string): Promise<M[]> {
  if (type !== 'model' || !Array.isArray(messages)) return messages;
  setWaiting(true);
  setOpeningHint(null); // 첫 전송: 시작 메시지 안내는 이제 필요 없다
  // 지시문·전화 표식은 이 봇에만 있으니 판정과 상관없이 벗긴다 (없으면 그대로)
  messages = unwrapCalls(unwrapScenes(messages).messages).messages;
  const marked = (t: unknown) => typeof t === 'string' && (t.includes(UNSENT_MARK) || t.includes(START_MARK));
  if (messages.some((m) => marked(m?.content))) {
    messages = messages.map((m) => (marked(m?.content) ? { ...m, content: stripStartCard(stripUnsentMark(m.content)) } : m));
  }
  // 오래된 메시지의 이미지 태그는 요청에서 뺀다 (원본 「🖼️에셋리퀘제거」)
  if (liteNow || messages.some((m) => typeof m?.content === 'string' && imgTagsKnown(m.content, modulePicker()))) messages = stripOldImgTags(messages, getPrefs().imgSend ?? IMG_RECENT.def);
  if (liteNow) {
    messages = stripHistoryTags(messages);
    messages = await fixLore(messages).catch(() => messages);
    messages = await withPlayer(messages).catch(() => messages);
    messages = await withVisit(messages).catch(() => messages);
    messages = trimRoster(messages);
    const ctx = await moduleContext(sceneText(messages)).catch(() => [] as string[]);
    if (ctx.length) {
      // 마지막 사용자 메시지 바로 앞에 (원본은 맨 끝). 모델이 이번 행동보다 참고 기록을 「지금 할 일」로 읽지 않게
      const at = messages.map((m) => m?.role).lastIndexOf('user');
      const add = ctx.map((c) => ({ role: 'system', content: c }) as M);
      messages = at < 0 ? [...messages, ...add] : [...messages.slice(0, at), ...add, ...messages.slice(at)];
    }
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

// ── 본편 로어북 고르기 (core/lore.ts) ──

type LoreChar = { name?: string; globalLore?: LoreEntry[]; loreSettings?: unknown };

function loreFor(char: LoreChar, chat: Chat, input?: string) {
  const mode = advValue(chat.scriptstate, 'gen', 'lore_mode') as LoreMode;
  const player = playerAgent(char.globalLore, chat.scriptstate);
  return computeLore(char.globalLore, chat, { ...loreOptions(char, chat, mode, userInfo().name), input, ...(player ? { exclude: [player.lore] } : {}) });
}

/** 고른 로어북을 자리 항목이 읽는 채팅 변수에 적는다 (요청 전이라 Risu가 세고 넘치면 오래된 채팅을 지운다) */
async function storeLore(charIndex: number, chatIndex: number, input?: string): Promise<void> {
  let char = (await risuai.getCharacterFromIndex(charIndex)) as LoreChar | null;
  if (!char || !readManifest(char.globalLore)) return;
  // 이 채팅의 보내는 방식에 맞게 네 폴더 항목 첫 줄(@@dont_activate)을 맞춘다. 사용자가 새로 넣은 항목도 같이
  const cur0 = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  const mode = advValue(cur0?.scriptstate, 'gen', 'lore_mode') as LoreMode;
  if (syncDecorators(char.globalLore, mode)) {
    await updateCharacterLore(charIndex, (lore) => syncDecorators(lore, mode));
    char = ((await risuai.getCharacterFromIndex(charIndex)) as LoreChar | null) ?? char;
  }
  const c = char;
  await updateChat(charIndex, chatIndex, (cur) => {
    const got = loreFor(c, cur, input);
    if (!got || sameVars(cur.scriptstate, got.vars)) return null;
    return { ...cur, scriptstate: { ...(cur.scriptstate ?? {}), ...got.vars } };
  });
}

/** 보낼 때: 채팅창에 적은 글까지 보고 고른다. 글은 바꾸지 않는다 */
async function onInput(text: string): Promise<string> {
  if (!liteNow || typeof text !== 'string') return text;
  try {
    await storeLore(await risuai.getCurrentCharacterIndex(), await risuai.getCurrentChatIndex(), text);
  } catch (error) {
    console.log(`[goei] 로어북 고르기 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
  return text;
}

/** 요청 직전: 다시 굴리기·자동 전송처럼 입력을 거치지 않았으면 지금 채팅으로 다시 골라 요청 속 글을 바꾼다 */
async function fixLore<M extends PromptMessage>(messages: M[]): Promise<M[]> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const char = (await risuai.getCharacterFromIndex(charIndex)) as LoreChar | null;
  const chat = (await risuai.getChatFromIndex(charIndex, await risuai.getCurrentChatIndex())) as Chat | null;
  if (!char || !chat) return messages;
  const got = loreFor(char, chat);
  if (!got || sameVars(chat.scriptstate, got.vars)) return messages;
  return patchSlots(messages, chat.scriptstate, got.vars).messages;
}

/** 캐릭터로 플레이: 페르소나 자리에 그 요원 로어북과 틀 지침, 페르소나 이름은 요원 이름으로 */
async function withPlayer<M extends PromptMessage>(messages: M[]): Promise<M[]> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const char = (await risuai.getCharacterFromIndex(charIndex)) as LoreChar | null;
  const chat = (await risuai.getChatFromIndex(charIndex, await risuai.getCurrentChatIndex())) as Chat | null;
  const agent = char && chat ? playerAgent(char.globalLore, chat.scriptstate) : undefined;
  if (!char || !chat || !agent) return messages;
  const env = { vars: chat.scriptstate ?? {}, char: char.name, user: agent.name };
  const out = applyPlayer(messages, playerBlock(char.globalLore, agent, env), await readPersona(), userInfo().name, agent.name);
  return basicSettings(char.globalLore, chat.scriptstate).assetPlayer ? out : hidePlayerTag(out, [agent.english]);
}

/** 본부 막간: 대화가 일어난 메시지 바로 뒤에 끼운다 (core/interlude.ts). 채팅은 바꾸지 않는다 */
async function withVisit<M extends PromptMessage>(messages: M[]): Promise<M[]> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const chat = (await risuai.getChatFromIndex(charIndex, await risuai.getCurrentChatIndex())) as Chat | null;
  if (!chat || !visitRecord(chat).turns.length) return messages;
  const char = (await risuai.getCharacterFromIndex(charIndex)) as LoreChar | null;
  const me = char ? playerAgent(char.globalLore, chat.scriptstate) : undefined;
  return withInterludes(messages, chat, char ? visitContextRules({ char }) : null, me?.name || userInfo().name || '주인공');
}

let rulesCache: { charIndex: number; gnet: string | null; phone: string | null; wiki: string | null; registry: Registry } | null = null;

/** 괴담넷 글·쪽지, 괴담톡 대화·공지, 위키 문서를 본편 요청의 마지막 사용자 메시지 앞에 참고 기록으로 (원본 editRequest + RC.gnetContext·phoneContext·wikiContext). 기록이 없거나 꺼 두면 빈 목록 */
async function moduleContext(scene: string): Promise<string[]> {
  const charIndex = await risuai.getCurrentCharacterIndex();
  const chatIndex = await risuai.getCurrentChatIndex();
  const chat = (await risuai.getChatFromIndex(charIndex, chatIndex)) as Chat | null;
  const ss = chat?.scriptstate;
  const wantGnet = !!ss?.[GN_RAW] && gnetSettings(ss).enabled && gnetSettings(ss).context;
  const wantPhone = (!!ss?.[PH_STATE] || !!ss?.[PH_BULLETINS]) && phoneSettings(ss).context;
  const wantWiki = wikiContextOn(ss);
  if (!chat || (!wantGnet && !wantPhone && !wantWiki)) return [];
  applyAdvanced(ss);
  if (rulesCache?.charIndex !== charIndex) {
    const char = (await risuai.getCharacterFromIndex(charIndex)) as { globalLore?: LoreEntry[] } | null;
    const src = { char: { globalLore: char?.globalLore }, chat };
    rulesCache = { charIndex, gnet: mainContextRules(src), phone: phoneRules(src), wiki: wikiContextRules(char?.globalLore), registry: buildRegistry(char?.globalLore) };
  }
  const focus = makeFocus(scene, rulesCache.registry);
  const rules = rulesCache;
  // 기능마다 반영 상한 안에서 고르고, 합이 「본편 반영 총 상한」을 넘으면 상한을 나눠 다시 고른다 (core/budget.ts fitTotal)
  const parts: ContextPart[] = [];
  if (wantGnet && rules.gnet) {
    const st = readGnet(chat);
    const own = GN_CONTEXT.tokens;
    if (st.posts.length || st.dms.length) parts.push({ cap: own, build: (cap) => withCap(GN_CONTEXT, 'tokens', cap, () => mainContext(st, userNick(ss), rules.gnet!, focus)) });
  }
  if (wantPhone && rules.phone) {
    try {
      const st = readPhone(chat);
      const notices = readBulletins(chat);
      parts.push({ cap: PH_HISTORY.contextTokens, build: (cap) => withCap(PH_HISTORY, 'contextTokens', cap, () => phoneMainContext(st, notices, phoneSettings(ss), rules.phone!, focus)) });
    } catch (error) {
      console.log(`[goei] 괴담톡 기록을 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (wantWiki && rules.wiki) parts.push({ cap: advNum(ss, 'nw', 'ctx_tokens'), build: (cap) => wikiMainContext(chat, rules.wiki!, focus, cap) });
  return fitTotal(parts, advNum(ss, 'gen', 'ctx_total')).filter(Boolean);
}

/** 공용 상한 상수를 잠깐 바꿔 고르고 되돌린다 */
function withCap<T extends Record<K, number>, K extends string>(box: T, key: K, cap: number, run: () => string): string {
  const keep = box[key];
  box[key] = cap as T[K];
  try {
    return run();
  } finally {
    box[key] = keep;
  }
}

/** 혹시 저장 본문에 상황판 태그가 남아 있으면 요청에서만 지운다 (원본 editRequest와 같음) */
function stripHistoryTags<M extends PromptMessage>(messages: M[]): M[] {
  if (!messages.some((m) => m?.role === 'assistant' && typeof m.content === 'string' && hasWorldTags(m.content))) return messages;
  return messages.map((m) => (m?.role === 'assistant' && typeof m.content === 'string' && hasWorldTags(m.content) ? { ...m, content: cleanOutput(m.content) } : m));
}

/** 모델 응답이 채팅에 들어간 뒤: 상황판 태그 반영 + 저장 본문 정리 + 다음 턴 브리핑 */
async function onOutput(arg: { char: unknown; chat: unknown; characterIndex: number; chatIndex: number; messageIndex: number }): Promise<void> {
  setWaiting(false);
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
    // 다음 요청에 넣을 로어북을 미리 골라 둔다 (다시 굴리기·자동 전송은 입력 처리를 거치지 않는다)
    await storeLore(arg.characterIndex, arg.chatIndex).catch(() => {});
    // 막혔던 요청을 사용자가 전송 버튼으로 보냈으면 카드의 「전송을 눌러 주세요」·취소를 없앤다
    if (now.message.some((m) => typeof m.data === 'string' && isUnsent(m.data))) now = (await updateChat(arg.characterIndex, arg.chatIndex, clearUnsent)) ?? now;
    // 보조모델 이미지 태그 보충 (설정이 보조모델일 때). 끝난 뒤 괴담톡 확인 (보조 모델을 겹쳐 부르지 않게)
    // 상태창 「지난 장면」 목록을 새 응답까지 넣어 다시
    await refreshStatusContext(arg.characterIndex, arg.chatIndex).catch(() => {});
    await supplementAssets({ charIndex: arg.characterIndex, chatIndex: arg.chatIndex, lore: char.globalLore, chat: now, messageIndex: arg.messageIndex });
    // 괴담톡 자동 새 메시지 확인 → 괴담넷 자동 새로고침 (설정이 켜져 있을 때, 같은 응답에는 한 번. 따로 부를 때는 겹치지 않게 차례로)
    const phoneAuto = phoneSettings(now.scriptstate).auto;
    const gnetAuto = gnetSettings(now.scriptstate).auto;
    if (phoneAuto || gnetAuto) {
      const fresh = async () => {
        const c = ((await risuai.getChatFromIndex(arg.characterIndex, arg.chatIndex)) as Chat | null) ?? now!;
        c.message ??= [];
        return { charIndex: arg.characterIndex, chatIndex: arg.chatIndex, char: char as never, chat: c };
      };
      void (async () => {
        applyAdvanced(now!.scriptstate);
        await readPersona();
        const phoneFail = (error: unknown) => console.log(`[goei] 괴담톡 자동 확인 실패: ${error instanceof Error ? error.message : String(error)}`);
        const gnetFail = (error: unknown) => console.log(`[goei] 괴담넷 자동 새로고침 실패: ${error instanceof Error ? error.message : String(error)}`);
        // 둘 다 매 턴이고 같은 모델이면 모델 한 번으로 (원본 통합 자동 확인, 2026-10-21 사용자 요청으로 복원)
        const model = phoneSettings(now!.scriptstate).model;
        if (phoneAuto && gnetAuto && gnetSettings(now!.scriptstate).model === model) {
          const joint = new Joint(model);
          await Promise.all([
            autoRefresh(await fresh(), arg.messageIndex, undefined, joint).catch(phoneFail).finally(() => joint.done('phone')),
            autoRefreshGnet(await fresh(), arg.messageIndex, false, joint).catch(gnetFail).finally(() => joint.done('gnet')),
          ]);
          return;
        }
        if (phoneAuto) await autoRefresh(await fresh(), arg.messageIndex).catch(phoneFail);
        if (gnetAuto) await autoRefreshGnet(await fresh(), arg.messageIndex).catch(gnetFail);
      })();
    }
  } catch (error) {
    console.log(`[goei] 응답 처리 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 자동 전송이 막혀 아직 안 보낸 메시지의 안내와 취소 (host/unsent.ts) */
function unsentRow(): string {
  const p = cardPalette();
  unsentShown();
  return `<span style="flex:1;color:${p.text}">전송 대기 · 채팅창의 전송 버튼으로 보내세요.</span>`
    + `<button type="button" data-goei-cancel="1" style="flex:none;padding:3px 12px;border:1px solid ${p.accentLine};border-radius:999px;background:transparent;color:${p.text};font:inherit;font-size:.92em;cursor:pointer">취소</button>`;
}

/** 채팅 화면의 이동·커스텀 임무 기록 카드 (본문 대신 목표와 투입만) */
function sceneCardHtml(s: { target: string; party: string; unsent?: boolean }): string {
  const p = cardPalette();
  const unsent = s.unsent
    ? `<span style="flex-basis:100%;display:flex;align-items:center;gap:10px;margin-top:4px;padding-top:6px;border-top:1px solid ${p.accentLine}">${unsentRow()}</span>`
    : '';
  return `<div data-goei-card="scene" style="${cardStyle()}flex-wrap:wrap">`
    + `<span style="color:${p.signal};font-weight:600">목표</span><span>${escHtml(s.target)}</span>`
    + `<span style="opacity:.5">|</span><span style="color:${p.signal};font-weight:600">투입</span><span>${escHtml(s.party)}</span>${unsent}</div>`;
}

/** 시작 화면 직접 입력의 첫 상황 카드 (적은 글 전체를 보인다) */
function startCardHtml(body: string, unsent: boolean): string {
  const p = cardPalette();
  const row = unsent
    ? `<span style="display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:6px;border-top:1px solid ${p.accentLine}">${unsentRow()}</span>`
    : '';
  return `<div data-goei-card="start" style="${cardStyle()}display:block">`
    + `<span style="display:block;color:${p.signal};font-weight:600;margin-bottom:4px">첫 상황</span>`
    + `<span style="display:block;color:${p.text};white-space:pre-wrap">${escHtml(body.trim())}</span>${row}</div>`;
}

/** 기록 카드 없이 놓인 메시지(시작 화면 직접 입력) 아래의 전송 대기 줄 */
function unsentMarkHtml(): string {
  return `<div data-goei-card="unsent" style="${cardStyle()}display:flex;margin-top:8px">${unsentRow()}</div>`;
}

/** 시작 메시지로 시작한 첫 장면 아래: 첫 행동을 적어 보내라는 안내와 재선택 (host/openinghint.ts) */
function openingHintHtml(): string {
  const p = cardPalette();
  openingShown();
  return `<div data-goei-card="opening" style="${cardStyle()}display:flex;flex-wrap:wrap;margin-top:14px">`
    + `<span style="flex:1 1 14em;color:${p.text}"><b style="color:${p.signal}">첫 행동</b> · 채팅창에 할 말이나 행동을 적고 전송하세요.</span>`
    + `<button type="button" data-goei-repick="1" style="flex:none;padding:3px 12px;border:1px solid ${p.accentLine};border-radius:999px;background:transparent;color:${p.text};font:inherit;font-size:.92em;cursor:pointer">재선택</button></div>`;
}

/** 채팅 화면의 전화 기록 카드 (원본 ph-call-card: 상대만 보이고 요청 본문은 숨김) */
function callCardHtml(target: string): string {
  const p = cardPalette();
  return `<div data-goei-card="call" style="${cardStyle()}">`
    + `<span aria-hidden="true">📞</span><span><b style="color:${p.signal}">${escHtml(target)}</b>에게 전화를 걸었다.</span></div>`;
}

/** Lite 카드의 첫 안내(first_mes). 카드에는 고정색으로 들어 있어 플러그인이 테마 색으로 다시 그린다. 옛 카드 문구도 알아본다 */
function isLanding(text: string): boolean {
  return text.includes('data-goei="landing"') || (text.includes('ANOMALY SIMULATION') && text.includes('버튼을 눌러 시작하세요'));
}

function landingHtml(): string {
  return renderLanding(cardPalette());
}

/** 채팅 속 기록 카드도 창 배색을 따른다 (테마를 바꾸면 다시 그리지 않아도 바로 바뀌게 CSS 변수로) */
function cardPalette() {
  return themedCardPalette(currentTheme());
}
function cardStyle(): string {
  const p = cardPalette();
  return `display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid ${p.accentLine};border-radius:10px;background:${p.accentBg};color:${p.sub};font-size:.92em;line-height:1.5;`;
}

/** Lite에서만: 응답이 막 들어와 아직 정리되기 전에도 태그가 보이지 않게, 이동 지시문은 카드로 */
function onDisplay(text: string): string {
  if (typeof text !== 'string') return text;
  // 플러그인 고유 표식(시작 카드·지시문·전화 카드)은 Lite 판정 전에도 바꾼다.
  // 다른 채팅에 갔다 오면 Risu가 판정(liteNow)보다 먼저 메시지를 다시 그려서 원문이 드러난 채 남았다.
  // 이 표식은 이 봇 메시지에만 있으니 다른 봇에서는 아무것도 바뀌지 않는다.
  // 이 봇 메시지인지: Lite 판정 전에도 알아볼 수 있는 표식들 (상태창 [▣|…], 시작·지시문·전화 카드)
  const ours = liteNow || isLanding(text) || text.includes(UNSENT_MARK) || text.includes(START_MARK) || hasStatusTag(text) || hasSceneCard(text) || hasCall(text);
  let out = text;
  if (isLanding(text)) out = landingHtml();
  else {
    if (liteNow && hasWorldTags(out)) out = cleanOutput(out);
    if (hasSceneCard(out)) out = renderSceneCards(out, sceneCardHtml);
    if (hasCall(out)) out = renderCalls(out, callCardHtml);
    if (out.includes(START_MARK)) out = renderStartCards(out, startCardHtml);
    // 상태창은 카드 정규식 대신 플러그인이 그린다 (칸이 어긋나도 깨지지 않게, 설정의 배색으로)
    if (hasStatusTag(out)) out = renderStatus(out);
    // 캐릭터 이미지 태그는 플러그인이 그림 칸으로. Lite 판정 전(다른 채팅에서 돌아온 직후)에는 태그가 모두 에셋 모듈에 있는 이름일 때만
    if (hasImgTag(out)) {
      const pick = modulePicker();
      const self = userInfo().name;
      if (liteNow || imgTagsKnown(out, pick, self)) out = renderImgTags(out, pick, getPrefs().imgShow ?? IMG_RECENT.def, self);
    }
    if (out.includes(UNSENT_MARK)) out = renderUnsentMark(out, unsentMarkHtml());
    if (wantsOpeningHint(text)) out += openingHintHtml();
  }
  // 유저 사진 주소를 Risu가 채워 주는 숨은 칸 (host/user.ts). 이 봇 메시지에만
  if (ours && !out.includes('data-goei-user')) out += USER_MARK;
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
  // 이 채팅의 에셋 출력이 꺼져 있으면 채팅 속 그림 칸을 숨긴다 (변수가 없으면 새 채팅 기본값)
  const on = chat.scriptstate?.['$st_asset_on'];
  const changed = setImgHidden(on === undefined || on === null || on === '' ? getPrefs().basic.assetOn === false : on === '0' || on === 0 || on === false);
  const before = currentTheme();
  setCurrentTheme(themeName(chat.scriptstate?.['$st_fixed_theme'], chat.message?.length ? 'light' : themeName(getPrefs().theme)));
  if (changed && currentTheme() === before) repaintTheme();
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
        if (next.fabVisible) {
          await readTheme(snap).catch(() => {});
          await refreshStatusContext(snap.charIndex, snap.chatIndex).catch(() => {});
          await refreshOpeningHint(snap.charIndex, snap.chatIndex).catch(() => {});
        }
        // 접속 효과는 버튼 자리에서 버튼이 나타나며 (v0.16.22)
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

export interface BodyHandlers {
  beforeRequest: typeof onBeforeRequest;
  input: typeof onInput;
  output: typeof onOutput;
  display: typeof onDisplay;
  unload: () => Promise<void>;
}

/** 본체 시작: 설정을 읽고 플로팅 버튼·채팅 감시를 켠다. Risu에 거는 처리기는 시작기(main.ts)가 대신 걸고 여기로 넘긴다 */
export async function start(): Promise<BodyHandlers> {
  await loadPrefs();
  // 채팅 속 이미지 태그가 쓸 모듈 에셋 이름 (창을 열 때도 다시 읽는다)
  void loadModuleAssets();
  setWikiOpener((title) => void openWiki(title));
  setRepickOpener(() => void openApp({ quietIfNotLite: true }));
  let stopWatcher: (() => void) | null = null;
  let fab: Fab | null = null;
  try {
    fab = await createFab(() => (fab?.endIntro(), void openApp({ quietIfNotLite: true })));
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
  return {
    beforeRequest: onBeforeRequest,
    input: onInput,
    output: onOutput,
    display: onDisplay,
    unload: async () => {
      stopWatcher?.();
      await fab?.remove().catch(() => {});
    },
  };
}
