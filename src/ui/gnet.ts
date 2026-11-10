// 「괴담넷」 탭: 게시판·쪽지함. 생성은 새로고침·글 올리기·댓글·쪽지 보내기를 눌렀을 때만 한 번씩 부른다.
// 원본은 채팅 입력창을 빌려 썼지만 여기서는 창 안의 입력칸에 쓴다. 생성은 창을 닫아도 계속되고 끝나면 원래 채팅에 저장한다.
import { onOffSwitch } from './controls';
import {
  acceptComments, acknowledge, addOutgoingDm, addUserComment, addUserPost, applyActivity, applyBoard, pushComments, hhmm, attachPostDraft, CFG, commitIncoming,
  dateNow, deleteComment, deletePost, deleteThread, dmThreads, dmUnread, findPost, GN_COOLDOWN, GN_DEFAULTS, GN_NICK, GnetError, gnetSettings,
  GN_STORAGE_AUTO, GN_STORAGE_LIMIT, gnetRetention, incomingPlan, LIMITS, parseDmBody, parseJsonPayload, parsePostDraft, postKey, postUnread, COUNT_RANGE, type CountKey,
  readGnet, findAnyPost, archived, sourceFor, STORAGE_MAX, storyTurns, tokens, trimBoard,
  userNick, writeGnet, mergeKeyFigures, type GPost, type GSource, type GState, type IncomingOrigin, type IncomingPlan, gnetLabel } from '../core/gnet';
import { commentPrompt, dmPrompt, POST_REFRESH_ACTION, postPrompt, refreshPrompt, retryMessages } from '../core/gnetPrompt';
import { composeBody, describe, previewText, type UserKind } from '../core/attach';
import { ICONS } from './icons';
import { toast } from './toast';
import { imageUrl } from './images';
import { resolveSitePic } from '../core/sitepics';
import { boardFiles, boardThumb, setSitePicSource, attachAction, attachBody, attachEditor, emptyAttachment, type Attachments } from './attach';
import { itemIconUrl } from '../host/itemicons';
import { iconQuiet } from '../core/iconmatch';
import type { RefSource } from '../core/refs';
import type { Chat } from '../core/types';
import { lastReply } from '../core/phone';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { generate, type LlmMessage, type RetryOptions } from '../host/llm';
import { craftSettings, featureModel } from '../core/craft';
import type { Joint } from '../host/joint';
import { budgetFor, genSettings } from '../core/advanced';
import { fitPrompt } from '../core/budget';
import { advancedBox } from './advanced';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { defaultsAction, defaultsButtons, defaultsConfirm } from './defaults';
import { updateChat, type ChatContext } from '../host/risu';
import { BOARD_NAME, BOARD_SITE_VAR, boardView, boardWrite, isBoardSite, type BoardSite } from '../core/boards';
import { JOINT_VAR, jointOn } from '../core/netjoint';
import { siteLogo } from './browser';
import { isPhone } from './media';
import { winStyle, type PopSpec, type WinBox } from './popwin';

type Compose =
  | { kind: 'post' }
  | { kind: 'comment'; post: number; parent: number; label: string }
  | { kind: 'dm'; nick: string; source?: GSource; label: string }
  | { kind: 'newdm' };

interface GnetUi {
  sub: 'board' | 'dm';
  open: number | null;
  openDm: string | null;
  compose: Compose | null;
  draft: string;
  attach: Attachments;
  to: string;
  confirm: string | null;
  editNick: boolean;
  nick: string;
  settings: boolean;
  attachMenu: boolean;
  notice: string;
  failure: { label: string; reason: string; raw: string } | null;
  /** 사이트 화면 (2026-11-08): 분류('' 전체 · 말머리 · '@mine' 내가 쓴 글 · '@scrap' 스크랩), 정렬, 찾기, 쪽 */
  cat: string;
  sort: 'new' | 'hot' | 'cmt';
  q: string;
  page: number;
  /** PC 쪽지함 팝업창 자리·크기 (11-09 사용자: 우주 쇼핑몰 질문 창처럼) */
  dmWin: WinBox | null;
}

export const gnet: GnetUi = {
  sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, nick: '', notice: '', failure: null, settings: false, attachMenu: false,
  cat: '', sort: 'new', q: '', page: 1, dmWin: null,
};
/** 괴담넷에서 보낼 수 있는 첨부 (원본: 선물 없음) */
export const GN_KINDS: UserKind[] = ['image', 'photo', 'video', 'file', 'link'];

export function resetGnet() {
  uiSaved.clear();
  Object.assign(gnet, { sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, notice: '', failure: null, settings: false, attachMenu: false, cat: '', sort: 'new', q: '', page: 1 });
}

export interface GnetEnv {
  render(): void;
  refresh(): Promise<void>;
  current(): ChatContext | null;
}

/** 채팅마다 한 번에 하나 (원본 LB.exclusive) */
const jobs = new Map<string, string>();
const chatKey = (ctx: { charIndex: number; chatIndex: number }) => `${ctx.charIndex}:${ctx.chatIndex}:${siteOf(ctx)}`;

/* ── 사이트 (2026-11-08): 괴담넷·괴담갤·세정게·연어 마켓은 같은 게시판 코드를 쓰고 변수만 따로 (core/boards.ts) ── */
type SiteCtx = ChatContext & { site?: BoardSite };
const siteOf = (ctx: object): BoardSite => (ctx as SiteCtx).site ?? 'gn';
/** 그 사이트로 비춘 ctx (이미 비췄으면 그대로) */
function siteCtx(ctx: ChatContext, site: BoardSite): SiteCtx {
  if ((ctx as SiteCtx).site === site) return ctx;
  return { ...ctx, chat: boardView(ctx.chat, site), site };
}
/** 비춘 채팅으로 고치고, 원래 채팅에 되돌려 저장. 돌려주는 것도 비춘 채팅 */
async function upd(ctx: ChatContext, f: (chat: Chat) => Chat | null | undefined): Promise<Chat | null> {
  const site = siteOf(ctx);
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const r = f(boardView(chat, site));
    return r ? boardWrite(chat, r, site) : null;
  });
  return saved ? boardView(saved, site) : null;
}
/** 사이트마다 따로 둔 화면 상태 (글 펼침·쓰던 글 등) */
let uiSite: BoardSite = 'gn';
const uiSaved = new Map<BoardSite, GnetUi>();
const freshUi = (): GnetUi => ({ sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, nick: '', notice: '', failure: null, settings: false, attachMenu: false, cat: '', sort: 'new', q: '', page: 1, dmWin: null });
export function useBoardSite(site: BoardSite): void {
  if (site === uiSite) return;
  uiSaved.set(uiSite, { ...gnet });
  Object.assign(gnet, uiSaved.get(site) ?? freshUi());
  uiSite = site;
}
export const boardSiteNow = (): BoardSite => uiSite;
/** 그 사이트의 화면 상태: 지금 보고 있는 사이트면 gnet, 아니면 저장해 둔 것 (11-09 점검: 다른 사이트 자동 새로고침이 보고 있던 괴담넷 글을 닫고 읽음 처리하던 것) */
function uiFor(site: BoardSite): GnetUi {
  if (site === uiSite) return gnet;
  let u = uiSaved.get(site);
  if (!u) uiSaved.set(site, (u = freshUi()));
  return u;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const retry = (chat: Chat): RetryOptions => {
  const site = chat.scriptstate?.[BOARD_SITE_VAR];
  return { ...genSettings(chat.scriptstate), reiterate: craftSettings(chat.scriptstate, 'gn').reiterate, staticModel: featureModel(chat.scriptstate, 'gn'), state: chat.scriptstate, label: BOARD_NAME[isBoardSite(site) ? site : 'gn'] };
};
const source = (ctx: ChatContext, chat = ctx.chat): RefSource => playerSource({ char: ctx.char as RefSource['char'], chat, persona: personaText() } as RefSource);

function names(ctx: ChatContext): Record<string, string> {
  try {
    return factionNames(parseCatalog(ctx.char.globalLore), String(ctx.chat.scriptstate?.['$st_faction'] ?? ''));
  } catch {
    return {};
  }
}

const ORIGIN_KEY = '$gn_incoming_origin';
function savedOrigin(chat: Chat): IncomingOrigin | null {
  try {
    const v = JSON.parse(String(chat.scriptstate?.[ORIGIN_KEY] ?? ''));
    return v && Number.isInteger(v.post) ? v : null;
  } catch {
    return null;
  }
}

function withVars(chat: Chat, vars: Record<string, string>): Chat {
  return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } };
}

/** 선쪽지 반영 (실패해도 본 결과는 둔다). 알림 문장을 돌려준다 */
function saveIncoming(chat: Chat, st: GState, rows: unknown, plan: IncomingPlan, post?: GPost): { vars: Record<string, string>; note: string } {
  try {
    if (commitIncoming(st, rows, plan, dateNow(chat), post)) return { vars: { [GN_COOLDOWN]: String(storyTurns(chat)) }, note: '새 쪽지가 왔어요.' };
    return { vars: {}, note: '' };
  } catch (error) {
    return { vars: {}, note: `본 결과는 저장했어요. 선쪽지만 적용하지 않았어요: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function run(ctx: ChatContext, env: GnetEnv, label: string, work: () => Promise<string>): Promise<void> {
  const key = chatKey(ctx);
  const u = uiFor(siteOf(ctx));
  if (jobs.has(key)) {
    u.notice = `${jobs.get(key)} 끝난 뒤 다시 눌러 주세요.`;
    env.render();
    return;
  }
  jobs.set(key, label);
  u.notice = '';
  u.failure = null;
  env.render();
  // 방금 저장한 것(보낸 쪽지·내 댓글)이 기다리는 동안에도 바로 보이게 채팅을 다시 읽어 그린다 (2026-11-10 사용자: 보낸 쪽지가 답장 올 때까지 안 보였다)
  await env.refresh().catch(() => undefined);
  try {
    u.notice = await work();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    u.notice = msg;
    const raw = (error as { raw?: string }).raw;
    if (raw) u.failure = { label, reason: msg, raw };
  } finally {
    jobs.delete(key);
    await env.refresh();
  }
}

/** 창에서 지금 펼쳐 보고 있는 글·쪽지 (생성 결과를 저장할 때 바로 읽음 처리) */
const viewing = (site: BoardSite) => { const u = uiFor(site); return { post: u.sub === 'board' ? u.open : null, nick: u.sub === 'dm' ? u.openDm : null }; };

// ── 작업 ──

function refreshBoard(ctx: ChatContext, env: GnetEnv, automatic = false, joint?: Joint) {
  return run(ctx, env, automatic ? '채팅 응답에 맞춰 게시판을 새로 불러오는 중이에요.' : '게시판을 불러오는 중이에요.', async () => {
    const startLength = ctx.chat.message?.length ?? 0;
    const before = readGnet(ctx.chat);
    const nick = userNick(ctx.chat.scriptstate);
    const s = gnetSettings(ctx.chat.scriptstate);
    const plan = incomingPlan(ctx.chat, before, s, nick, Math.random, undefined, savedOrigin(ctx.chat));
    const prompt = fitPrompt(budgetFor(ctx.chat.scriptstate, 'gn'), () => refreshPrompt(source(ctx), before, plan, nick, names(ctx)));
    const site = siteOf(ctx);
    const first = joint && ((m: LlmMessage[]) => joint.ask(site, m));
    const { raw, value } = await generate(prompt.messages, s.model, (r) => withRaw(r, () => parseJsonPayload(r)), { ...retry(ctx.chat), first });
    let note = '';
    await upd(ctx, (chat) => {
      if (automatic && (chat.message?.length ?? 0) !== startLength) {
        note = '채팅이 이어져서 이번 자동 새로고침 결과는 저장하지 않았어요.';
        return null;
      }
      const res = withRaw(raw, () => applyBoard(before, readGnet(chat), value, { nick, settings: s, date: dateNow(chat) }));
      const inc = saveIncoming(chat, res.st, (value as { incoming?: unknown }).incoming, plan);
      note = [res.notice, res.emptyComments ? '이번 게시판에는 댓글이 하나도 없어요.' : '', inc.note].filter(Boolean).join(' ');
      const figs = s.keyFigures ? mergeKeyFigures(chat.scriptstate, (value as { keyFigures?: unknown }).keyFigures) : null;
      return writeGnet(withVars(chat, { ...inc.vars, ...(figs ?? {}) }), res.st, { ack: viewing(site) });
    });
    const u = uiFor(site);
    if (!automatic) u.open = null;
    else if (u.open !== null && !findAnyPost(readGnet((await currentChat(ctx)) ?? ctx.chat), u.open)) u.open = null;
    return note;
  });
}

function withRaw<T>(raw: string, f: () => T): T {
  try {
    return f();
  } catch (error) {
    if (error instanceof GnetError && !error.raw) throw new GnetError(error.message, raw);
    throw error;
  }
}

function writePost(ctx: ChatContext, env: GnetEnv, input: string) {
  return run(ctx, env, '글을 올리는 중이에요.', async () => {
    const st = readGnet(ctx.chat);
    const nick = userNick(ctx.chat.scriptstate);
    const s = gnetSettings(ctx.chat.scriptstate);
    const draftPost: GPost = { id: 0, date: '', nick, title: '', body: input, views: 0, votes: 0, mine: true, comments: [] };
    const plan = incomingPlan(ctx.chat, st, s, nick, Math.random, { post: draftPost });
    const prompt = fitPrompt(budgetFor(ctx.chat.scriptstate, 'gn'), () => postPrompt(source(ctx), st, input, plan, names(ctx)));
    const { value, draft: parsed } = (await generate(prompt.messages, s.model, (r) => {
      const v = withRaw(r, () => parseJsonPayload(r)) as Record<string, unknown>;
      return { value: v, draft: withRaw(r, () => parsePostDraft(v)) };
    }, retry(ctx.chat))).value;
    const draft = attachPostDraft(parsed, input);
    let note = '글을 올렸어요.';
    let newId = 0;
    await upd(ctx, (chat) => {
      const cur = readGnet(chat);
      const p = addUserPost(cur, nick, draft.title, draft.content, dateNow(chat));
      if (draft.tag) p.tag = draft.tag;
      newId = p.id;
      const got = acceptComments(value.comments, [], { postId: p.id, replyTo: 0, total: 0, supplied: new Set() }, nick);
      pushComments(p, got.comments, dateNow(chat));
      bumpStats(p, got.comments.length);
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick, dateNow(chat), gnetSettings(chat.scriptstate).counts.act[1]);
      trimBoard(cur, s);
      const inc = saveIncoming(chat, cur, value.incoming, plan, p);
      if (!got.comments.length) note = '글을 올렸어요. 아직 댓글은 없어요.';
      if (skipped) note += ` 다른 글 활동 ${skipped}건은 형식이 맞지 않아 뺐어요.`;
      if (inc.note) note += ` ${inc.note}`;
      return writeGnet(withVars(chat, { ...inc.vars, [ORIGIN_KEY]: JSON.stringify({ post: p.id }) }), cur, { ack: { post: p.id } });
    });
    gnet.compose = null;
    gnet.draft = '';
    gnet.attach = [];
    gnet.sub = 'board';
    gnet.open = newId;
    return note;
  });
}

/**
 * 새 댓글이 달린 글은 조회·추천도 같이 는다 (댓글 하나에 조회 5~24, 추천은 0~댓글 수+1).
 * 글 하나 새로고침에만 있던 셈인데 내가 쓴 글·내가 단 댓글의 반응에는 빠져 있어, 댓글이 달려도 조회 0·추천 0 이었다 (2026-11-10 사용자)
 */
function bumpStats(p: GPost, n: number): void {
  p.views += n * (5 + Math.floor(Math.random() * 20)) + Math.floor(Math.random() * 10);
  p.votes += Math.floor(Math.random() * (n + 2));
}

/** 글 하나만 새로고침 (v0.16.26, 사용자 요청): 그 글에 새 댓글이 달리고 조회·추천이 는다. 다른 글·쪽지는 그대로 */
function refreshPost(ctx: ChatContext, env: GnetEnv, postId: number) {
  return run(ctx, env, '이 글을 새로 불러오는 중이에요.', async () => {
    const chat = ctx.chat;
    const st = readGnet(chat);
    const target = findPost(st, postId);
    if (!target) throw new GnetError('대상 글이 없어졌어요.');
    const s = gnetSettings(chat.scriptstate);
    const nick = userNick(chat.scriptstate);
    const plan = incomingPlan(chat, st, { ...s, incoming: false }, nick, Math.random);
    const prompt = fitPrompt(budgetFor(chat.scriptstate, 'gn'), () => commentPrompt(source(ctx, chat), st, postId, 0, '', plan, nick, names(ctx), POST_REFRESH_ACTION));
    const snapshot = postKey(target);
    const { value } = await generate(prompt.messages, s.model, (r) => withRaw(r, () => parseJsonPayload(r) as Record<string, unknown>), retry(chat));
    let note = '';
    await upd(ctx, (latest) => {
      const cur = readGnet(latest);
      const p = findPost(cur, postId);
      if (!p || postKey(p) !== snapshot) {
        note = '불러오는 동안 글이 바뀌어서 적용하지 않았어요. 다시 눌러 주세요.';
        return null;
      }
      const got = acceptComments(value.comments, p.comments, { postId, replyTo: 0, total: prompt.total, supplied: prompt.supplied }, nick);
      pushComments(p, got.comments, dateNow(latest));
      const n = got.comments.length;
      bumpStats(p, n);
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick, dateNow(latest), gnetSettings(latest.scriptstate).counts.act[1]);
      note = n ? '' : '새 댓글이 없어요.';
      if (got.dropped) note += ` 형식이 맞지 않는 댓글 ${got.dropped}개는 뺐어요.`;
      if (skipped) note += ` 다른 글 활동 ${skipped}건은 형식이 맞지 않아 뺐어요.`;
      return writeGnet(latest, cur, { ack: viewing(siteOf(ctx)) });
    });
    return note.trim();
  });
}

async function writeComment(ctx: ChatContext, env: GnetEnv, postId: number, parent: number, body: string) {
  const key = chatKey(ctx);
  if (jobs.has(key)) {
    gnet.notice = `${jobs.get(key)} 끝난 뒤 다시 눌러 주세요.`;
    return env.render();
  }
  const nick = userNick(ctx.chat.scriptstate);
  let index = 0;
  // 내 댓글은 먼저 저장한다 (원본과 같음). 반응 생성이 실패해도 남는다
  const saved = await upd(ctx, (chat) => {
    const st = readGnet(chat);
    index = addUserComment(st, postId, parent, nick, body, dateNow(chat), storyTurns(chat));
    return writeGnet(withVars(chat, { [ORIGIN_KEY]: JSON.stringify({ post: postId, comment: index }) }), st);
  });
  gnet.compose = null;
  gnet.draft = '';
  gnet.attach = [];
  if (!saved) return env.refresh();
  return run({ ...ctx, chat: saved }, env, '댓글 반응을 기다리는 중이에요.', async () => {
    const st = readGnet(saved);
    const s = gnetSettings(saved.scriptstate);
    const target = findPost(st, postId)!;
    const plan = incomingPlan(saved, st, s, nick, Math.random, { post: target, commentIndex: index });
    // 원본과 같이 반응은 방금 단 내 댓글 아래로 (replyTo = 내 댓글 번호)
    let value: Record<string, unknown>;
    let prompt: ReturnType<typeof commentPrompt>;
    try {
      prompt = fitPrompt(budgetFor(saved.scriptstate, 'gn'), () => commentPrompt(source(ctx, saved), st, postId, index, body, plan, nick, names(ctx)));
      value = (await generate(prompt.messages, s.model, (r) => withRaw(r, () => parseJsonPayload(r) as Record<string, unknown>), retry(saved))).value;
    } catch (error) {
      throw new GnetError(`댓글은 저장했어요. ${error instanceof Error ? error.message : String(error)}`, (error as { raw?: string }).raw ?? '');
    }
    const snapshot = postKey(target);
    let note = '';
    await upd(ctx, (chat) => {
      const cur = readGnet(chat);
      const p = findPost(cur, postId);
      if (!p || postKey(p) !== snapshot) {
        note = '생성하는 동안 글이 바뀌어서 답글을 적용하지 않았어요. 내 댓글은 저장돼 있어요.';
        return null;
      }
      const got = acceptComments(value.comments, p.comments, { postId, replyTo: index, total: prompt.total, supplied: prompt.supplied }, nick);
      pushComments(p, got.comments, dateNow(chat));
      bumpStats(p, got.comments.length);
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick, dateNow(chat), gnetSettings(chat.scriptstate).counts.act[1]);
      const inc = saveIncoming(chat, cur, value.incoming, plan, p);
      note = got.comments.length ? '' : '등록했어요. 추가 답글은 없어요.';
      if (got.dropped) note += ` 형식이 맞지 않는 답글 ${got.dropped}개는 뺐어요.`;
      if (skipped) note += ` 다른 글 활동 ${skipped}건은 형식이 맞지 않아 뺐어요.`;
      if (inc.note) note += ` ${inc.note}`;
      return writeGnet(withVars(chat, inc.vars), cur, { ack: viewing(siteOf(ctx)) });
    });
    return note.trim();
  });
}

async function sendDm(ctx: ChatContext, env: GnetEnv, nick: string, body: string, src?: GSource) {
  const key = chatKey(ctx);
  if (jobs.has(key)) {
    gnet.notice = `${jobs.get(key)} 끝난 뒤 다시 눌러 주세요.`;
    return env.render();
  }
  const me = userNick(ctx.chat.scriptstate);
  if (nick === me) {
    gnet.notice = '나에게는 쪽지를 보낼 수 없어요.';
    return env.render();
  }
  const saved = await upd(ctx, (chat) => {
    const st = readGnet(chat);
    addOutgoingDm(st, nick, body, dateNow(chat), src);
    return writeGnet(chat, st);
  });
  // 답장을 못 받으면 보낸 쪽지를 지우고 쓴 내용을 입력칸에 돌려놓는다 (사용자 요청 v0.16.26)
  const before = { draft: gnet.draft, compose: gnet.compose, attach: gnet.attach, to: gnet.to };
  gnet.compose = null;
  gnet.draft = '';
  gnet.attach = [];
  gnet.to = '';
  gnet.sub = 'dm';
  gnet.openDm = nick;
  if (!saved) return env.refresh();
  return run({ ...ctx, chat: saved }, env, `${nick}의 답장을 기다리는 중이에요.`, async () => {
    const st = readGnet(saved);
    const s = gnetSettings(saved.scriptstate);
    let reply: string;
    try {
      const prompt = fitPrompt(budgetFor(saved.scriptstate, 'gn'), () => dmPrompt(source(ctx, saved), st, nick, body, me, names(ctx)));
      // 원본과 같이 고쳐 달라고 다시 묻는다 (횟수·모델은 고급 설정 → 생성 공통)
      reply = (await generate(prompt.messages, s.model, (r) => withRaw(r, () => parseDmBody(r)), { ...retry(saved), fix: (raw, reason) => retryMessages(prompt, raw, reason) })).value;
    } catch (error) {
      await upd(ctx, (chat) => {
        const cur = readGnet(chat);
        let i = cur.dms.length - 1;
        while (i >= 0 && !(cur.dms[i].nick === nick && cur.dms[i].side === 'me')) i--;
        if (i < 0) return null;
        cur.dms.splice(i, 1);
        return writeGnet(chat, cur);
      }).catch(() => null);
      if (!gnet.draft && !gnet.attach.length) Object.assign(gnet, before);
      throw new GnetError(`쪽지를 보내지 못했어요. 쓴 내용은 입력칸에 돌려놨어요. ${error instanceof Error ? error.message : String(error)}`, (error as { raw?: string }).raw ?? '');
    }
    await upd(ctx, (chat) => {
      const cur = readGnet(chat);
      cur.dms.push({ nick, side: 'npc', body: reply, unread: true, date: dateNow(chat) });
      return writeGnet(chat, cur, { ack: viewing(siteOf(ctx)) });
    });
    return '';
  });
}

async function mutate(ctx: ChatContext, env: GnetEnv, f: (st: GState, chat: Chat) => boolean | void, vars: Record<string, string> = {}, reconcile = true) {
  await upd(ctx, (chat) => {
    const st = readGnet(chat);
    if (f(st, chat) === false) return null;
    return writeGnet(withVars(chat, vars), st, { reconcile });
  });
  await env.refresh();
}

async function setVar(ctx: ChatContext, env: GnetEnv, key: string, value: string) {
  await setVars(ctx, env, { [key]: value });
}

async function setVars(ctx: ChatContext, env: GnetEnv, vars: Record<string, string>) {
  await upd(ctx, (chat) => withVars(chat, vars));
  await env.refresh();
}


// ── 화면 ──

/** 개수 최소·최대 (직접 입력, 괴담톡 「단톡 수다 줄 수」와 같은 칸) */
function countRow(ctx: ChatContext, k: CountKey, unit: string, label: string): string {
  const [a, b] = gnetSettings(ctx.chat.scriptstate).counts[k];
  const [lo, hi] = COUNT_RANGE[k];
  const box = (side: 'min' | 'max', n: number, name: string) =>
    `<input class="gx-search ph-pct" type="number" min="${lo}" max="${hi}" data-change="gn-count" data-key="${k}_${side}" value="${n}" aria-label="${label} ${name}"><span>${unit}</span>`;
  return `<span class="ph-inline"><span>최소</span>${box('min', a, '최소')}<span>최대</span>${box('max', b, '최대')}</span>`;
}

function seg(key: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, 'gn-cfg', (v) => `${key}=${v}`);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="gn-cfg" data-value="${key}=${v}" aria-pressed="${cur === v}">${label}</button>`)
    .join('')}</div>`;
}

const body = (text: string) => attachBody(text, true);

function time(date: string): string {
  return /(\d\d:\d\d)/.exec(date)?.[1] ?? '';
}

const tool = (action: string, icon: string, label: string, extra = '', short = '') =>
  `<button class="ph-tool" data-action="${action}" aria-label="${label}" title="${label}" ${extra}>${icon}${short ? `<span class="ph-tool-l">${short}</span>` : ''}</button>`;

function paneHead(title: string, sub: string, right = '', back = true): string {
  return `<header class="ph-room-head">${back ? `<button class="ph-tool ph-back" data-action="gn-back" aria-label="뒤로">${ICONS.back}</button>` : ''}<div class="ph-room-title"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right ? `<span class="ph-act">${right}</span>` : ''}</header>`;
}

/** 폰 모양으로 그릴지 */
const narrow = () => isPhone();



function composer(busy: boolean, placeholder: string, chip = '', label = ''): string {
  return `<div class="ph-composer gn-composer">
    ${chip}
    ${attachEditor('gn', gnet.attach, GN_KINDS, busy, '', gnet.attachMenu)}
    <div class="ph-compose">
      <button class="ph-tool ph-plus${gnet.attachMenu ? ' on' : ''}" data-action="gn-att-menu" aria-label="첨부" aria-expanded="${gnet.attachMenu}" title="첨부">${ICONS.plus}</button>
      <textarea class="ph-input" data-input="gn-draft" rows="1" placeholder="${esc(placeholder)}" ${busy ? 'disabled' : ''}>${esc(gnet.draft)}</textarea>
      <button class="ph-send${label ? ' txt' : ''}" data-action="gn-send" aria-label="등록" title="등록" ${busy ? 'disabled' : ''}>${label || ICONS.send}</button>
      <button class="ph-tool ph-back2" data-action="gn-back" aria-label="목록으로" title="목록으로">${ICONS.back}</button>
    </div>
  </div>`;
}

/** 새 글·새 쪽지 (오른쪽 칸 전체) */
function composeView(c: Compose, busy: boolean): string {
  const post = c.kind === 'post';
  const to = c.kind === 'newdm'
    ? `<input class="gx-search" data-input="gn-to" placeholder="받는 사람 닉네임" value="${esc(gnet.to)}" aria-label="받는 사람">`
    : c.kind === 'dm' ? `<p class="gn-to">받는 사람 <b>${esc(c.nick)}</b></p>` : '';
  const ph = post ? '올릴 글이나 쓰고 싶은 내용 (제목과 본문은 다듬어서 올려요)' : gnet.attach.length ? '함께 보낼 글 (선택)' : '쪽지 내용';
  return `<div class="ph-form gn-cpane">${paneHead(post ? '새 글' : '새 쪽지', c.kind === 'dm' ? esc(c.label) : '')}
    <div class="ph-form-body">${to}
      <textarea class="gx-search gn-text" data-input="gn-draft" rows="${post ? 8 : 5}" placeholder="${esc(ph)}" aria-label="내용">${esc(gnet.draft)}</textarea>
      ${attachEditor('gn', gnet.attach, GN_KINDS, busy)}
    </div>
    <div class="ph-form-foot"><button class="gx-start" data-action="gn-send" ${busy ? 'disabled' : ''}>${post ? '올리기' : '보내기'}</button></div></div>`;
}

/** 답글 입력줄: 답글을 누른 댓글 바로 밑 */
function replyBox(label: string, busy: boolean, depth: number): string {
  const chip = `<div class="gn-replyto"><span>${esc(label)}</span><button class="ph-tool sm" data-action="gn-cancel" aria-label="답글 취소" title="취소">${ICONS.close}</button></div>`;
  return `<li class="gn-c-compose" style="--gn-depth:${Math.min(depth, 3)}">${composer(busy, '답글 입력', chip)}</li>`;
}

/** 댓글 시각: 글과 같은 날이면 「14:23」, 다른 날이면 「05.14 09:10」 (시각 없는 옛 댓글은 없음) */
function commentClock(p: GPost, c: GPost['comments'][number]): string {
  if (!c.time) return '';
  const same = c.time.slice(0, 10) === String(p.date).slice(0, 10);
  return `<time class="gn-c-time">${esc(same ? hhmm(c.time) : `${c.time.slice(5, 10)} ${hhmm(c.time)}`)}</time>`;
}


function dmPane(st: GState, nick: string, busy: boolean, inline = false): string {
  const t = dmThreads(st).find((x) => x.nick === nick);
  if (!t) return '';
  const confirm = gnet.confirm === `d:${nick}`;
  const right = confirm
    ? `<button class="gx-mini danger" data-action="gn-del-thread" data-value="${esc(nick)}">정말 삭제</button>`
    : tool('gn-del-thread', ICONS.trash, '쪽지 삭제', `data-value="${esc(nick)}"`);
  const src = st.sources[nick];
  const c = gnet.compose;
  const ph = c?.kind === 'dm' && c.nick === nick && c.source ? `「${c.source.title}」 보고 보내는 쪽지` : '쪽지 입력';
  return `<div class="${inline ? 'gn-inline gn-dm-inline' : 'ph-room gn-pane'}">${inline ? '' : paneHead(esc(nick), `${t.rows.length}통`, right)}
    <div class="ph-log">${src ? `<div class="ph-sys">처음 이어진 글 「${esc(src.title)}」</div>` : ''}
      ${t.rows.map((d, i) => {
        const first = i === 0 || t.rows[i - 1].side !== d.side;
        return `<div class="ph-msg ${d.side === 'me' ? 'me' : 'npc'}${first ? ' first' : ''}"><div class="ph-msg-col"><div class="ph-bubble">${body(d.body)}</div>${d.date ? `<small class="gn-dm-t">${esc(d.date)}</small>` : ''}</div></div>`;
      }).join('')}
    </div>
    ${inline ? '' : composer(busy, ph)}
  </div>`;
}


function dmList(st: GState, busy: boolean, mobile: boolean): string {
  const threads = dmThreads(st);
  if (!threads.length) return '<div class="ph-blank"><p>주고받은 쪽지가 없어요.<br>게시판에서 닉네임을 누르거나 쪽지를 눌러 보내 보세요.</p></div>';
  return `<ul class="ph-list gn-list">${threads
    .map((t) => {
      const on = gnet.openDm === t.nick && !gnet.settings;
      const last = t.rows[t.rows.length - 1];
      const confirm = gnet.confirm === `d:${t.nick}`;
      const del = confirm
        ? `<button class="gx-mini danger ph-rdel" data-action="gn-del-thread" data-value="${esc(t.nick)}">정말 삭제</button>`
        : `<button class="ph-tool sm ph-rdel" data-action="gn-del-thread" data-value="${esc(t.nick)}" aria-label="${esc(t.nick)} 쪽지 삭제" title="삭제">${ICONS.trash}</button>`;
      return `<li class="ph-row"><button class="ph-main gn-dmrow${on ? ' on' : ''}" data-action="gn-open-dm" data-value="${esc(t.nick)}" aria-pressed="${on}">
        <span class="ph-avatar gn-ava">${ICONS.mail}</span>
        <span class="ph-who"><span class="ph-who-top"><b>${esc(t.nick)}</b>${t.lastDate ? `<small class="ph-time">${esc(time(t.lastDate) || t.lastDate)}</small>` : ''}</span>
        <span class="ph-who-bot"><small>${last.side === 'me' ? '나: ' : ''}${esc([...previewText(last.body)].slice(0, 60).join(''))}</small>${t.unread ? `<span class="ph-badge">${t.unread}</span>` : ''}</span></span></button>${del}${mobile && on && gnet.compose?.kind !== 'newdm' ? dmPane(st, t.nick, busy, true) : ''}</li>`;
    })
    .join('')}</ul>`;
}

/** 설정 한 줄: 괴담톡 설정과 같은 모양 */
const row = (label: string, control: string, hint = '') =>
  `<div class="ps-row"><div class="ps-label"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
const group = (title: string, rows: string) => `<section class="ps-group"><h3>${title}</h3><div class="ps-rows">${rows}</div></section>`;

function settingsView(ctx: ChatContext, back = true): string {
  const v = (k: string) => String(ctx.chat.scriptstate?.[CFG(k)] ?? GN_DEFAULTS[k]);
  const text = (k: string, ph: string) => `<input class="gx-search ps-text" data-change="gn-text" data-key="${k}" value="${esc(v(k) === '-' ? '' : v(k))}" placeholder="${esc(ph)}">`;
  const keep = gnetRetention(ctx.chat.scriptstate);
  // 「게시판 사용」 켬·끔은 없다 (2026-11-05 사용자: 괴담톡·위키와 같게. 새로고침 수동이면 모델을 부르지 않는다)
  const rows = `${group(gnetLabel(ctx.chat.scriptstate), [
        row('자동 호출', seg('lazy', ['0', 'open'].includes(v('lazy')) ? v('lazy') : '1', [['1', '수동'], ['open', '창을 열 때'], ['0', '매 턴']]), LAZY_HINT[v('lazy')] ?? LAZY_HINT['1']),
        row('한 번에 요청', seg('joint', jointOn(ctx.chat.scriptstate) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]), '괴담톡·괴담넷·괴담갤·세정게·연어 마켓 중 「매 턴」이고 모델이 같은 것들을 한 요청으로 묶어요 (다섯 페이지 공통 값, 쇼핑몰은 따로). 끄면 하나씩 따로 불러요.'),
        row('모델', seg('mode', v('mode') === '1' ? '1' : '2', [['1', '메인 모델'], ['2', '보조 모델']]), '게시판 글·댓글·쪽지를 만들 때 부를 모델이에요. 보조 모델 = Risu의 보조 모델(싸고 빠름), 메인 모델 = 본편과 같은 모델'),
        row('컨텍스트에 포함', seg('context', v('context') === '1' ? '1' : '0', [['0', 'ON'], ['1', 'OFF']]), '지금 장면과 관련된 글과 쪽지가 채팅 요청에 참고로 붙어요'),
        row('다양성 강화', seg('sampling', v('sampling') === '1' ? '1' : '0', [['0', 'OFF'], ['1', 'ON']]), '켜면 모델이 한 번에 서로 다른 게시판 두 벌을 쓰고, 플러그인이 뻔한 첫 벌 대신 두 번째 벌을 써요. 응답이 길어져 토큰을 더 써요'),
      ].join(''))}
      ${group('게시판', [
        row('게시글 수', countRow(ctx, 'post', '개', '게시글 수'), `새로고침 한 번에 새로 만드는 글 수예요(${COUNT_RANGE.post[0]}~${COUNT_RANGE.post[1]}). 많을수록 토큰을 더 써요`),
        row('새 글 댓글 수', countRow(ctx, 'cmt', '개', '새 글 댓글 수'), `새로 만드는 글마다 달릴 댓글 수예요(${COUNT_RANGE.cmt[0]}~${COUNT_RANGE.cmt[1]}). 그 안에서 글마다 모델이 정해요`),
        row('활동 댓글 수', countRow(ctx, 'act', '개', '활동 댓글 수'), `새로고침이나 답장 때 지난 글에 새로 붙는 댓글 수예요(${COUNT_RANGE.act[0]}~${COUNT_RANGE.act[1]}). 바뀐 글마다 이 안에서 붙어요`),
        row('사생활', seg('privacy', v('privacy'), [['0', '이목집중'], ['1', '자율'], ['2', '약보호'], ['3', '강보호'], ['4', '언급금지']]), '게시판 사람들이 「보호 대상」(기본은 주인공)을 얼마나 입에 올리는지예요. 이목집중 = 목격담·소문이 자주 올라옴, 자율 = 이미 유명한 경우에만 멀리서 본 정도, 약보호 = 평범한 사람 취급(큰 사건의 여파만), 강보호 = 그보다 더 제한, 언급금지 = 본인 이야기는 전혀 없고 행동의 결과만'),
        row('주제', text('subject', '비우면 세계관에 맞는 다양한 주제')),
        row('분위기·말투', text('mood', '비우면 익명 커뮤니티 말투')),
        row('보호 대상', text('protagonist', '비우면 주인공'), '위 「사생활」이 지켜 줄 사람 이름이에요. 비우면 주인공'),
        row('주요 인물 닉네임', seg('keyfigures', v('keyfigures') === '0' ? '0' : '1', [['1', '보존'], ['0', '안 함']]), '주요 인물이 게시판에서 쓰는 닉네임을 기억해 다음 새로고침에도 같은 닉네임을 써요'),
        row('새로고침 시 내 글', seg('keepown', v('keepown'), [['1', '유지'], ['0', '교체']]), '새로고침하면 옛 글이 새 글로 바뀌는데, 내가 쓴 글은 남길지예요'),
        row('내 댓글 있는 글', seg('keepreplied', v('keepreplied'), [['1', '유지'], ['0', '교체']]), '내가 댓글을 단 남의 글도 새로고침 때 남길지예요'),
      ].join(''))}
      ${group('쪽지', [
        row('선쪽지 받기', seg('incoming', v('incoming') === '0' ? '0' : '1', [['1', '받기'], ['0', '안 받기']]), '게시판 사람이 먼저 나에게 쪽지를 보낼 수 있게 할지예요'),
        row('쪽지 자동 정리', `<span class="ph-inline">${seg('storage', keep.auto ? '1' : '0', [['1', 'ON'], ['0', 'OFF']])}${keep.auto ? `<input class="gx-search ph-pct" type="number" min="1" max="${STORAGE_MAX}" data-change="gn-keep" value="${keep.limit}" aria-label="상대별 쪽지 보관 상한"><span>통</span>` : ''}</span>`, `상대마다 최근 ${keep.limit}통만 남겨요`),
      ].join(''))}
      ${advancedBox('gn', ctx.chat.scriptstate)}`;
  return `<div class="ph-form">${paneHead(`${gnetLabel(ctx.chat.scriptstate)} 설정`, '', defaultsButtons('gn'), back)}${defaultsConfirm('gn')}<div class="ph-form-body ps">${rows}</div></div>`;
}


/* ── 사이트 화면 (2026-11-08 사용자 시안 「브라우저_시안3」): 괴담넷·괴담갤·세정게·연어 마켓은 게시판 기능은 같고 모양만 사이트마다 ──
   글은 새 화면으로 연다(같은 탭, 목록으로). 분류는 모델이 글마다 붙인 말머리에서 만든다 */
const PAGE = 20;
const LOGO_SM = (id: BoardSite, cls = 'bs-logo') => siteLogo(id === 'gal' ? 'gal' : id === 'wpf' ? 'wpf' : id === 'sm' ? 'sm' : 'gn', cls);
/** 목록에 보일 글 (분류·찾기·정렬) */
function shownPosts(st: GState): GPost[] {
  const q = gnet.q.trim().toLowerCase();
  // 보관함의 글(새로고침으로 게시판에서 빠진 내 글·스크랩)은 「내가 쓴 글」「스크랩」에만 이어 붙는다 (2026-11-10 사용자)
  const pool = gnet.cat === '@mine' ? [...st.posts, ...(st.archive ?? []).filter((p) => p.mine)] : gnet.cat === '@scrap' ? [...st.posts, ...(st.archive ?? []).filter((p) => p.scrap)] : st.posts;
  let list = pool.filter((p) =>
    (gnet.cat === '' || (gnet.cat === '@mine' ? p.mine || p.comments.some((c) => c.mine) : gnet.cat === '@scrap' ? !!p.scrap : p.tag === gnet.cat))
    && (!q || `${p.title}\n${p.body}`.toLowerCase().includes(q)));
  if (gnet.sort === 'hot') list = [...list].sort((a, b) => b.votes - a.votes || b.views - a.views);
  if (gnet.sort === 'cmt') list = [...list].sort((a, b) => b.comments.length - a.comments.length);
  return list;
}
/** 게시판에 나온 말머리들 (처음 나온 차례) */
const tagsOf = (st: GState): string[] => [...new Set(st.posts.map((p) => p.tag ?? '').filter(Boolean))];
/** 목록 시각: 오늘이면 「14:20」, 아니면 「05.13」 */
function when(p: GPost, now: string): string {
  const d = String(p.date);
  return d.slice(0, 10) === now.slice(0, 10) ? time(d) : d.slice(5, 10);
}
/** 「3분 전」 (시안 괴담넷·연어 마켓) */
const minuteOf = (d: string): number | null => {
  const m = /^(\d{4})\.(\d\d)\.(\d\d)\s+(\d\d):(\d\d)/.exec(String(d));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000 : null;
};
function ago(p: GPost, now: string): string {
  const a = minuteOf(p.date);
  const b = minuteOf(now);
  if (a === null || b === null || b < a) return when(p, now);
  const d = b - a;
  if (d < 1) return '방금';
  if (d < 60) return `${d}분 전`;
  if (d < 1440) return `${Math.floor(d / 60)}시간 전`;
  if (d < 2880) return '어제';
  return `${Math.floor(d / 1440)}일 전`;
}
const dot = (p: GPost) => (postUnread(p) ? '<span class="gn-dot" aria-label="새 댓글"></span>' : '');
const openBtn = (p: GPost, inner: string, cls = '') => `<button class="gn-row-main gn-row${cls ? ` ${cls}` : ''}" data-action="gn-open" data-value="${p.id}">${inner}</button>`;
const pageOf = <T,>(list: T[]): T[] => list.slice((Math.max(1, gnet.page) - 1) * PAGE, Math.max(1, gnet.page) * PAGE);
const pages = (total: number) => Math.max(1, Math.ceil(total / PAGE));
/** 쪽 번호 (사이트마다 모양만 다름) */
function pager(total: number, cls: string, prev = '', next = ''): string {
  if (!total) return ''; // 글이 없으면 쪽 번호 「1」도 없다 (11-09 사용자)
  const n = pages(total);
  const cur = Math.min(gnet.page, n);
  const nums = Array.from({ length: n }, (_, i) => i + 1).map((k) => (k === cur ? `<b>${k}</b>` : `<button data-action="gn-page" data-value="${k}">${k}</button>`)).join(' ');
  const go = (label: string, k: number, on: boolean) => (label ? (on ? `<button data-action="gn-page" data-value="${k}">${label}</button>` : `<span>${label}</span>`) : '');
  return `<nav class="${cls}">${go(prev, cur - 1, cur > 1)} ${nums} ${go(next, cur + 1, cur < n)}</nav>`;
}
const searchInput = (ph: string) => `<input name="gn-q" data-enter="gn-search" value="${esc(gnet.q)}" placeholder="${esc(ph)}" aria-label="${esc(ph)}">`;
const writeBtn = (cls: string, label = '글쓰기') => `<button class="${cls}" data-action="gn-write">${label}</button>`;
// 빈 게시판에서도 글은 쓸 수 있다
const emptyList = (busy: boolean, text: string) => `<div class="bs-empty"><p>${text}</p><div class="bs-ebt"><button class="bs-w" data-action="gn-refresh" ${busy ? 'disabled' : ''}>${busy ? '불러오는 중…' : '새로고침'}</button>${writeBtn('bs-w')}</div></div>`;
const none = (list: GPost[]) => (!list.length ? '<p class="bs-none">해당하는 글이 없어요.</p>' : '');
// PC 쪽지함은 게시판 위에 뜨는 창이라 메뉴 선택을 가져가지 않는다 (2026-11-10 사용자: 쪽지함이 선택을 차지했다가 닫으면 앞 선택으로 돌아가 헷갈렸다).
// 그래서 PC 에서는 쪽지함 단추에 선택 표시가 없고(편지 아이콘으로 「여는 단추」임을 보인다), 쪽지함이 떠 있어도 보던 분류의 선택은 그대로다. 폰은 쪽지함이 한 화면이라 앞과 같다
const dmTakes = () => gnet.sub === 'dm' && narrow();
const onCat = (v: string) => !dmTakes() && gnet.cat === v;
const catBtn = (v: string, label: string, cls = '', extra = '', on = onCat(v)) => `<button class="${[cls, on ? 'on' : ''].filter(Boolean).join(' ')}" data-action="gn-cat" data-value="${esc(v)}" aria-pressed="${on}">${esc(label)}${extra}</button>`;
const dmBtn = (st: GState, unreadDm: number, label = '쪽지함', cls = '') => `<button class="${[cls, dmTakes() ? 'on' : '', narrow() ? '' : 'gn-dmpop'].filter(Boolean).join(' ')}" data-action="gn-sub" data-value="dm" ${narrow() ? `aria-pressed="${dmTakes()}"` : `aria-haspopup="dialog" aria-expanded="${gnet.sub === 'dm'}"`}>${narrow() ? '' : ICONS.mail}${label}${unreadDm ? ` <b class="bs-new">${unreadDm}</b>` : dmUnread(st) ? '<span class="gn-dot"></span>' : ''}</button>`;
/** 익명(ㅇㅇ) 글쓴이 옆 IP 앞자리: 글 번호로 늘 같게 (시안 괴담갤) */
const ipOf = (id: number) => `${(id * 37) % 200 + 20}.${(id * 101) % 250}`;
const nickIp = (nick: string, id: number) => `${esc(nick)}${nick === 'ㅇㅇ' ? ` <span class="ip">(${ipOf(id)})</span>` : ''}`;
/** 목록 작은 그림 */
function thumb(p: GPost): string {
  const t = boardThumb(p.body);
  if (!t) return '<span></span>';
  return `<span class="th">${t.url ? `<img src="${esc(t.url)}" alt="">` : CAMERA}</span>`;
}
/** 연어 마켓: 본문에서 값 (「350,000원」·「나눔」·「가격 제안」) */
function priceOf(p: GPost): string {
  const s = `${p.title}\n${previewText(p.body)}`;
  const m = /(\d[\d,]*\s*(?:만\s*)?원)/.exec(s);
  if (m) return m[1].replace(/\s+/g, '');
  if (p.tag === '나눔' || /나눔/.test(s)) return '나눔';
  if (p.tag === '삽니다') return '가격 제안';
  return '';
}
/** 연어 마켓 매물 그림: 본문 [사진:…]이 있으면 그것, 없으면 제목의 물건 이름으로 소지품 그림 팩(host/itemicons.ts)에서 (11-09 사용자: 매칭이 전혀 안 됐다).
 *  제목 앞 「[직거래/계양]」 같은 꼬리표를 떼고, 「및·,·/·+」로 이어진 것은 첫 물건만 본다 */
function smItemName(p: GPost): string {
  const t = p.title.replace(/^\s*(?:\[[^\]]*\]\s*)+/, '').replace(/\s*(?:팝니다|삽니다|나눔|급처|급매|판매|구합니다|구매)\s*$/u, '');
  return t.split(/\s*(?:\s및\s|,|\/|\+|·|~)\s*/)[0].trim();
}
function smPicUrl(p: GPost): string | null {
  const t = boardThumb(p.body);
  if (t?.url) return t.url;
  const name = smItemName(p);
  return name ? iconQuiet(() => itemIconUrl(name)) : null;
}
const CAMERA = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 7h3l2-3h6l2 3h3v13H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="13" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const SM_BG = ['cloth', 'news', 'floor', 'wood', 'desk', 'dark'];

/** 사이트 머리 */
function siteHead(site: BoardSite, st: GState, unreadDm: number): string {
  const home = (inner: string, cls = 'lg') => `<button class="${cls}" data-action="gn-home" aria-label="첫 화면">${inner}</button>`;
  switch (site) {
    case 'gal':
      return `<div class="hd">${home(`${LOGO_SM(site)}<span>괴담 갤러리<small>무섭고 이상한 이야기</small></span>`)}<label class="sch">${searchInput('갤러리 & 통합검색')}<b>${ICONS.search}</b></label></div>`;
    case 'wpf':
      return `<div class="ban">${home(`<b>世界政治 게시판</b><small>WORLD POLITICS FORUM</small>${LOGO_SM(site, 'bs-logo wlogo')}`, 'bh0')}</div>${narrow() ? `
        <div class="bar">${wpfMenu(st, unreadDm)}</div>` : ''}`;
    case 'sm':
      return `<div class="hd">${home(`${LOGO_SM(site)}연어 마켓`)}<nav>${catBtn('', '중고거래')}${catBtn('삽니다', '삽니다')}${catBtn('정보', '오컬트 정보')}</nav><label class="sr">${searchInput('물건 이름으로 찾기')}</label>${writeBtn('wr')}<button class="ch" data-action="gn-sub" data-value="dm">내 채팅${unreadDm ? `<em>${unreadDm}</em>` : ''}</button></div>
        <div class="note">⚠ 직거래는 사람 많은 곳에서 하세요. 연어 마켓은 거래하다 생긴 일을 책임지지 않습니다.</div>`;
    default: {
      const nav = `<nav><button class="${!dmTakes() && gnet.sort !== 'hot' ? 'on' : ''}" data-action="gn-home">커뮤니티</button>${dmBtn(st, unreadDm, '쪽지')}<button class="${!dmTakes() && gnet.sort === 'hot' ? 'on' : ''}" data-action="gn-sort" data-value="hot">랭킹</button></nav>`;
      return `<div class="hd">${home(`${LOGO_SM(site)}괴담넷<small>.net</small>`)}${nav}<label class="sr">${ICONS.search}${searchInput('괴담넷 검색')}</label></div>`;
    }
  }
}

/** 괴담넷 왼쪽 메뉴 */
/** 괴담넷 왼쪽 메뉴 (11-09 사용자: 한 번에 6~8편이라 말머리 분류 조회는 무의미 → 글 제목 목록. 글을 연 채로 다른 글을 바로 고른다, 옛 괴담넷처럼. 말머리는 글마다 그대로) */
function gnSide(st: GState, unreadDm: number): string {
  const posts = [...st.posts].sort((a, b) => b.id - a.id).slice(0, 60);
  const items = posts.map((p) => {
    const on = !dmTakes() && gnet.open === p.id && !gnet.compose;
    return `<button class="sp${on ? ' on' : ''}" data-action="${on ? 'gn-home' : 'gn-open-side'}" data-value="${p.id}" aria-pressed="${on}" title="${esc(p.title)}">${p.tag ? `<i>[${esc(p.tag)}]</i>` : ''}<span>${esc(p.title)}</span>${p.comments.length ? `<em>[${p.comments.length}]</em>` : ''}${dot(p)}</button>`;
  }).join('');
  // 선택 표시는 하나만: 글을 열었으면 그 글 줄, 아니면 보는 분류 (2026-11-10 사용자: 내가 쓴 글·스크랩을 고른 채 글을 열면 둘 다 선택돼 있었다)
  const reading = gnet.open !== null && !gnet.compose;
  const cat = (v: string, label: string) => catBtn(v, label, '', '', onCat(v) && !reading);
  return `<nav class="side" aria-label="게시판 메뉴"><h6>글 목록</h6>${cat('', '전체 글')}<div class="splist">${items || '<p class="sp-none">아직 글이 없어요.</p>'}</div><h6>내 메뉴</h6>${dmBtn(st, unreadDm)}${cat('@mine', '내가 쓴 글')}${cat('@scrap', '스크랩')}</nav>`;
}

/** 세정게 메뉴 단추 (PC 왼쪽 MENU · 폰 윗줄 띠 공용) */
function wpfMenu(st: GState, unreadDm: number): string {
  // 선택 표시는 하나만: 글을 열었으면 인기글 그 줄, 아니면 보는 분류
  const reading = gnet.open !== null && !gnet.compose;
  const cat = (v: string) => onCat(v) && !reading;
  return `<button class="${cat('') ? 'on' : ''}" data-action="gn-home" aria-pressed="${cat('')}">HOME</button>${dmBtn(st, unreadDm)}${catBtn('@mine', '내가 쓴 글', '', '', cat('@mine'))}${catBtn('@scrap', '스크랩', '', '', cat('@scrap'))}`;
}

/** 세정게 왼쪽 인기글: 조회 많은 순, 글을 열어도 그대로 남는다 */
function wpfTop(st: GState): string {
  const top = [...st.posts].filter((p) => p.tag !== '공지').sort((a, b) => b.views - a.views || b.votes - a.votes || b.id - a.id).slice(0, 10);
  if (!top.length) return '';
  const items = top.map((p) => {
    const on = !dmTakes() && gnet.open === p.id && !gnet.compose;
    return `<li><button class="${on ? 'on' : ''}" data-action="gn-open-side" data-value="${p.id}" title="${esc(p.title)}">${esc(p.title)}</button></li>`;
  }).join('');
  return `<div class="t top">인기글</div><ol class="top">${items}</ol>`;
}

/** 괴담갤 오른쪽 칸 (11-09 사용자: 디씨 사이드바 「힛갤」 — 지금 생성된 글을 조회수 순으로, 본문을 열어도 그대로 남는 글 목록) */
function galSide(st: GState): string {
  const top = [...st.posts].filter((p) => p.tag !== '공지').sort((a, b) => b.views - a.views || b.votes - a.votes || b.id - a.id).slice(0, 15);
  const items = top.map((p) => {
    const on = !dmTakes() && gnet.open === p.id && !gnet.compose;
    return `<li><button class="${on ? 'on' : ''}" data-action="gn-open-side" data-value="${p.id}" title="${esc(p.title)}"><span>${esc(p.title)}</span>${p.comments.length ? `<em>[${p.comments.length}]</em>` : ''}<small>${p.views}</small></button></li>`;
  }).join('');
  return `<div class="hit"><h4>힛갤</h4>${items ? `<ol>${items}</ol>` : '<p class="none">아직 글이 없어요.</p>'}</div>`;
}

/** 목록 (사이트마다) */
function siteList(site: BoardSite, st: GState, now: string, busy: boolean, unreadDm: number): string {
  const all = shownPosts(st);
  const list = pageOf(all);
  const empty = !st.posts.length ? emptyList(busy, '게시글이 없어요.') : '';
  switch (site) {
    case 'gal': {
      // 윗줄 탭은 전체글 하나 (2026-11-10 사용자: 공지는 없애고, 개념글은 오른쪽 힛갤이 그 역할을 한다)
      const tabOn = !dmTakes() && gnet.cat === '';
      const tabs = `<div class="lt"><button class="${tabOn ? 'on' : ''}" data-action="gn-tab" data-value="all" aria-pressed="${tabOn}">전체글</button>${dmBtn(st, unreadDm)}${empty ? '' : writeBtn('wr')}</div>`;
      // 말머리 분류 단추는 두지 않는다 (2026-11-10 사용자: 글이 몇 개 안 되는데 지저분하다). 말머리는 글마다 표에 그대로 보인다
      const heads = `<div class="hds">${catBtn('', '전체')}${catBtn('@mine', '내가 쓴 글')}${catBtn('@scrap', '스크랩')}</div>`;
      const ic = (p: GPost) => `<span class="ii ${boardThumb(p.body) ? 'im' : 'tx'}"></span>`;
      const ntc = (p: GPost) => p.tag === '공지';
      const rows = list.map((p) => ntc(p)
        ? `<tr class="ntc"><td><span class="sb">공지</span></td><td><span class="sb">공지</span></td><td class="t">${openBtn(p, `${esc(p.title)}${dot(p)}`)}</td><td class="n">${esc(p.nick)}<span class="fix"></span></td><td>${esc(when(p, now))}</td><td>-</td><td>-</td></tr>`
        : `<tr${p.mine ? ' class="mine"' : ''}><td>${p.id}</td><td>${esc(p.tag ?? '일반')}</td><td class="t">${openBtn(p, `${ic(p)}${esc(p.title)}<em>[${p.comments.length}]</em>${dot(p)}`)}</td><td class="n">${nickIp(p.nick, p.id)}</td><td>${esc(when(p, now))}</td><td>${p.views}</td><td>${p.votes}</td></tr>`).join('');
      const table = `<table><colgroup><col style="width:72px"><col style="width:54px"><col><col style="width:120px"><col style="width:56px"><col style="width:52px"><col style="width:42px"></colgroup>
        <tr><th>번호</th><th>말머리</th><th>제목</th><th>글쓴이</th><th>작성일</th><th>조회</th><th>추천</th></tr>${rows}</table>`;
      const mlist = `<div class="mlist">${list.map((p) => `<div class="it${ntc(p) ? ' ntc' : ''}">${openBtn(p, `<div class="t">${ntc(p) ? '' : `[${esc(p.tag ?? '일반')}] `}${esc(p.title)}${ntc(p) ? '' : `<em>[${p.comments.length}]</em>`}${dot(p)}</div><div class="m">${ntc(p) ? `${esc(p.nick)} · ${esc(when(p, now))}` : `${esc(p.nick)}${p.nick === 'ㅇㅇ' ? `(${ipOf(p.id)})` : ''} · ${esc(when(p, now))} · 조회 ${p.views} · 추천 ${p.votes}`}</div>`)}</div>`).join('')}</div>`;
      // 글이 하나도 없으면 탭 줄과 안내(새로고침·글쓰기)만 (2026-11-10 사용자: 빈 게시판에 글쓰기 단추 셋·분류·찾기칸이 다 떠 지저분했다)
      if (empty) return `<div class="body">${tabs}${empty}</div>`;
      return `<div class="body">${tabs}${heads}${table}${mlist}${none(list)}
        <div class="bt2">${catBtn('', '전체글')}${writeBtn('wr')}</div>${pager(all.length, 'pager', '', '다음')}
        <label class="bsch"><span>제목+내용</span>${searchInput('검색어')}<button class="go" data-action="gn-search-go">검색</button></label></div>`;
    }
    case 'wpf': {
      const ntc = (p: GPost) => p.tag === '공지';
      const rows = list.map((p) => `<tr${ntc(p) ? ' class="ntc"' : ''}><td>${ntc(p) ? '공지' : p.id % 100000}</td><td class="t">${openBtn(p, `${p.tag && !ntc(p) ? `[${esc(p.tag)}] ` : ''}${esc(p.title)}${p.comments.length ? ` <span class="cm">[${p.comments.length}]</span>` : ''}${postUnread(p) ? '<span class="nw">N</span>' : ''}`)}</td><td>${esc(p.nick)}</td><td>${esc(when(p, now).replace('.', '/'))}</td><td>${p.views}</td></tr>`).join('');
      const table = `<table><tr><th style="width:44px">번호</th><th>제 목</th><th style="width:96px">글쓴이</th><th style="width:56px">날짜</th><th style="width:40px">조회</th></tr>${rows}</table>`;
      const wml = `<div class="wml">${list.map((p) => `<div class="it${ntc(p) ? ' ntc' : ''}">${openBtn(p, `<div class="t">${esc(p.title)}${p.comments.length ? ` <span class="cm">[${p.comments.length}]</span>` : ''}${postUnread(p) ? '<span class="nw">N</span>' : ''}</div><div class="m">${esc(p.nick)} · ${esc(when(p, now).replace('.', '/'))} · 조회 ${p.views}</div>`)}</div>`).join('')}</div>`;
      return `<div class="ct"><div class="warn">※ 경.고 : 이 게.시.판은 감.시.받.고 있.습.니.다. 사.진 올.리.지 마.세.요.</div>
        <div class="tot"><span>Total : ${st.posts.length} &nbsp; Page : ${Math.min(gnet.page, pages(all.length))}/${pages(all.length)}</span><span class="srt">${([['new', '최신'], ['hot', '인기'], ['cmt', '댓글']] as const).map(([k, l]) => `<button class="${gnet.sort === k ? 'on' : ''}" data-action="gn-sort" data-value="${k}">${l}</button>`).join(' · ')}</span></div>
        ${empty || `${table}${wml}${none(list)}`}${pager(all.length, 'pgn', '[이전 10개]', '[다음 10개]')}
        <div class="nav2"><span>${catBtn('', '목록', 'bb')}</span><label class="sch">${searchInput('제목·내용')} <button class="bb" data-action="gn-search-go">검색</button></label>${writeBtn('bb')}</div>
      </div>`;
    }
    case 'sm': {
      const cards = list.map((p) => {
        const want = p.tag === '삽니다';
        const u = smPicUrl(p);
        const img = u ? `<img src="${esc(u)}" alt="">` : ICONS.bag;
        const ph = want
          ? `<div class="ph want"><b>삽니다</b><p>${esc([...previewText(p.body)].slice(0, 70).join(''))}</p></div>`
          : `<div class="ph ${SM_BG[p.id % SM_BG.length]}">${img}${p.tag ? `<span class="tag${p.tag === '나눔' ? ' g' : ''}">${esc(p.tag)}</span>` : ''}</div>`;
        const price = priceOf(p);
        return openBtn(p, `${ph}<div><div class="nm">${esc(p.title)}${dot(p)}</div>${price ? `<div class="pr">${esc(price)}</div>` : ''}<div class="mt">${esc(ago(p, now))} · 관심 ${p.votes} · 채팅 ${p.comments.length}</div></div>`, 'c');
      }).join('');
      const cats = `<div class="cats">${['', ...tagsOf(st)].map((t) => catBtn(t, t || '전체')).join('')}${catBtn('@mine', '내 글')}${catBtn('@scrap', '관심 목록')}${dmBtn(st, unreadDm, '내 채팅')}</div>`;
      const sort = `<span class="sort">${([['hot', '인기순'], ['new', '최신순']] as const).map(([k, l]) => `<button class="${gnet.sort === k ? 'on' : ''}" data-action="gn-sort" data-value="${k}">${l}</button>`).join(' · ')}</span>`;
      return `<div class="sec"><div class="bar2"><span class="loc">근처 매물</span>${cats}${sort}</div>${empty || `<div class="grid">${cards}</div>${none(list)}`}${pager(all.length, 'pg')}</div>`;
    }
    default: {
      const rows = list.map((p) => openBtn(p, `<div>${p.tag ? `<span class="c${p.tag === '목격' ? ' hot' : ''}">${esc(p.tag)}</span>` : ''}<span class="tt">${esc(p.title)}${p.comments.length ? `<em>${p.comments.length}</em>` : ''}${dot(p)}</span><small>${esc(p.nick)} · ${esc(ago(p, now))} · 조회 ${p.views.toLocaleString()}</small></div>${thumb(p)}`, `row${p.mine ? ' mine' : ''}`)).join('');
      const title = gnet.cat === '@mine' ? '내가 쓴 글' : gnet.cat === '@scrap' ? '스크랩' : gnet.cat || (gnet.sort === 'hot' ? '랭킹' : '전체');
      const sort = `<div class="sort">${([['new', '최신'], ['hot', '랭킹'], ['cmt', '댓글 많은']] as const).map(([k, l]) => `<button class="${gnet.sort === k ? 'on' : ''}" data-action="gn-sort" data-value="${k}" aria-pressed="${gnet.sort === k}">${l}</button>`).join('')}</div>`;
      const chips = `<div class="mchips">${catBtn('', '전체')}${tagsOf(st).map((t) => catBtn(t, t)).join('')}${dmBtn(st, unreadDm)}${catBtn('@mine', '내가 쓴 글')}${catBtn('@scrap', '스크랩')}</div>`;
      return `<div class="gmain"><div class="bh"><h2>${esc(title)}</h2>${writeBtn('w')}</div>${chips}${sort}${empty || `${rows}${none(list)}`}${pages(all.length) > 1 ? pager(all.length, 'pg', '', '›') : ''}</div>`;
    }
  }
}

/** 댓글 한 줄 (사이트마다 모양: gn 닉·시각 줄 + 본문, gal 세 칸, wpf 한 줄) */
function commentTree(site: BoardSite, p: GPost, busy: boolean): string {
  const kids = new Map<number, number[]>();
  p.comments.forEach((c, i) => {
    const parent = c.parent > 0 && c.parent <= p.comments.length && c.parent !== i + 1 ? c.parent : 0;
    kids.set(parent, [...(kids.get(parent) ?? []), i + 1]);
  });
  const out: string[] = [];
  const seen = new Set<number>();
  const target = gnet.compose?.kind === 'comment' && gnet.compose.post === p.id ? gnet.compose.parent : 0;
  const walk = (n: number, depth: number) => {
    for (const k of kids.get(n) ?? []) {
      if (seen.has(k)) continue;
      seen.add(k);
      const c = p.comments[k - 1];
      const confirm = gnet.confirm === `c:${p.id}:${k}`;
      const shown = site === 'wpf' && c.nick === 'ㅇㅇ' ? '익명' : c.nick;
      const author = c.mine
        ? `<b class="gn-me">${esc(shown)}</b>`
        : `<button class="gn-nick" data-action="gn-dm-from" data-value="${p.id}:${k}" title="쪽지 보내기"><b>${esc(shown)}</b></button>`;
      const ip = site === 'gal' && c.nick === 'ㅇㅇ' ? ` <span class="ip">(${ipOf(p.id + k)})</span>` : '';
      const del = c.mine
        ? confirm
          ? `<button class="gx-mini danger" data-action="gn-del-comment" data-value="${p.id}:${k}">정말 삭제</button>`
          : `<button class="gn-cdel" data-action="gn-del-comment" data-value="${p.id}:${k}" aria-label="댓글 삭제" title="삭제">삭제</button>`
        : '';
      const re = depth ? '<span class="gn-re" aria-hidden="true">↳</span>' : '';
      const unread = c.unread ? '<span class="gn-dot" aria-label="새 답글"></span>' : '';
      const clock = commentClock(p, c);
      const acts = `<span class="cma"><button class="gn-reply" data-action="gn-reply" data-value="${p.id}:${k}">답글</button>${del}</span>`;
      const cls = `cm gn-c${depth ? ' re' : ''}${c.unread ? ' unread' : ''}${target === k ? ' target' : ''}`;
      const style = ` style="--gn-depth:${Math.min(depth, 3)}"`;
      if (site === 'gal') out.push(`<li class="${cls}"${style}><div class="ch">${re}${author}${ip}${unread}</div><div class="cb gn-c-body">${body(c.body)}</div><small>${clock}${acts}</small></li>`);
      else if (site === 'wpf') out.push(`<li class="${cls}"${style}>${re}${author} : <span class="gn-c-body">${body(c.body)}</span> <small>(${clock})</small>${unread}${acts}</li>`);
      else out.push(`<li class="${cls}"${style}><div class="ch">${re}${author} <small>${clock}</small>${unread}${acts}</div><div class="gn-c-body">${body(c.body)}</div></li>`);
      if (target === k && gnet.compose?.kind === 'comment') out.push(replyBox(gnet.compose.label, busy, depth + 1));
      walk(k, depth + 1);
    }
  };
  walk(0, 0);
  return out.join('');
}

/** 글 화면 (같은 탭, 목록으로) */
function sitePost(site: BoardSite, p: GPost, busy: boolean, now: string): string {
  const c = gnet.compose;
  const reply = c?.kind === 'comment' && c.post === p.id && c.parent > 0 ? c : null;
  const confirm = gnet.confirm === `p:${p.id}`;
  const who = p.mine ? `<b class="gn-me">${esc(p.nick)}</b>` : `<button class="gn-nick" data-action="gn-dm-from" data-value="${p.id}:0" title="쪽지 보내기"><b>${esc(p.nick)}</b></button>`;
  const del = (cls: string) => (p.mine ? `<button class="${cls}${confirm ? ' danger' : ''}" data-action="gn-del-post" data-value="${p.id}">${confirm ? '정말 삭제' : '삭제'}</button>` : '');
  const more = (cls: string) => `<button class="${cls}" data-action="gn-post-refresh" data-value="${p.id}" ${busy ? 'disabled' : ''}>새 댓글 보기</button>`;
  const back = (cls: string, label = '‹ 목록으로') => `<button class="${cls}" data-action="gn-back">${label}</button>`;
  const scrap = (cls: string, on = '★ 스크랩됨', off = '☆ 스크랩') => `<button class="${cls}${p.scrap ? ' on' : ''}" data-action="gn-scrap" data-value="${p.id}" aria-pressed="${!!p.scrap}">${p.scrap ? on : off}</button>`;
  const vote = (cls: string, inner: string) => `<button class="${cls}${p.voted ? ' on' : ''}" data-action="gn-vote" data-value="${p.id}" aria-pressed="${!!p.voted}">${inner}</button>`;
  const list = p.comments.length ? `<ul class="cms0 gn-comments">${commentTree(site, p, busy)}</ul>` : '';
  const cin = reply ? '' : composer(busy, '댓글을 입력하세요', '', '등록');
  switch (site) {
    case 'gal': {
      const files = boardFiles(p.body);
      const att = files.length ? `<div class="att"><b>원본 첨부파일 ${files.length}</b>${files.map((f) => (f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">🔗 ${esc(f.text)}</a>` : `<a>${f.kind === 'file' ? '📎' : '🔗'} ${esc(f.text)}</a>`)).join('')}</div>` : '';
      return `<article class="body dpost gn-post"><div class="vt"><h3>${p.tag ? `<span>[${esc(p.tag)}]</span> ` : ''}<span class="gn-post-title">${esc(p.title)}</span></h3><div class="vm"><span>${who}${p.nick === 'ㅇㅇ' ? ` <span class="ip">(${ipOf(p.id)})</span>` : ''} · ${esc(p.date)}</span><span>조회 ${p.views} · 추천 ${p.votes} · 댓글 ${p.comments.length}</span></div></div>
        ${att}<div class="pb gn-post-body">${attachBody(p.body, true, true)}</div>
        <div class="rec">${vote('b up', `<b>${p.votes}</b><span>개념 추천</span>`)}<button class="b dn${p.down ? ' on' : ''}" data-action="gn-down" data-value="${p.id}" aria-pressed="${!!p.down}"><b>${p.down ? 1 : 0}</b><span>비추</span></button></div>
        <div class="cmh">전체 댓글 <b>${p.comments.length}</b>개</div>${list}${cin}
        <div class="bt2">${catBtn('', '전체글')}${back('')}${scrap('', '스크랩됨', '스크랩')}${more('')}${del('')}${writeBtn('wr')}</div></article>`;
    }
    case 'wpf': {
      const files = boardFiles(p.body);
      return `<article class="ct wpost gn-post"><table class="vw"><tr><th>제 목</th><td class="tt gn-post-title" colspan="3">${esc(p.title)}</td></tr><tr><th>글쓴이</th><td>${who}</td><th>날 짜</th><td>${esc(p.date.slice(5).replace('.', '/'))}</td></tr><tr><th>조 회</th><td>${p.views}</td><th>첨 부</th><td>${files.map((f) => (f.url ? `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.text)}</a>` : `<a>${esc(f.text)}</a>`)).join('<br>')}</td></tr>
        <tr><td class="bd gn-post-body" colspan="4">${attachBody(p.body, true, true)}</td></tr></table>
        <div class="cms">${list}${cin}</div>
        <div class="nav2">${back('bb', '목록')}<span>${scrap('bb', '스크랩됨', '스크랩')} ${more('bb')} ${del('bb')}</span>${writeBtn('bb')}</div></article>`;
    }
    case 'sm': {
      const u = smPicUrl(p);
      const price = priceOf(p);
      return `<article class="detail gn-post"><div class="ph ${SM_BG[p.id % SM_BG.length]}">${u ? `<img src="${esc(u)}" alt="">` : ICONS.bag}</div><div>
        <div class="seller"><i></i><div>${who}</div></div>
        <h2 class="gn-post-title">${esc(p.title)}</h2><div class="mt2">${p.tag ? `${esc(p.tag)} · ` : ''}${esc(ago(p, now))}</div>${price ? `<div class="price">${esc(price)}</div>` : ''}
        <div class="body gn-post-body">${body(p.body)}</div><div class="stat">관심 ${p.votes} · 채팅 ${p.comments.length} · 조회 ${p.views}</div>
        <div class="act">${scrap('', '♥', '♡')}${p.mine ? '' : `<button class="chat" data-action="gn-dm-from" data-value="${p.id}:0">채팅하기</button>`}${back('back')}${more('')}${del('')}</div>
        ${p.comments.length ? `<div class="cmh">문의 <b>${p.comments.length}</b></div>` : ''}${list}${cin}</div></article>`;
    }
    default:
      return `<article class="gmain gpost gn-post"><div class="ph1">${p.tag ? `<span class="c">${esc(p.tag)}</span>` : ''}<h2 class="gn-post-title">${esc(p.title)}</h2><div class="mt">${who} · ${esc(p.date.slice(5))} · 조회 ${p.views.toLocaleString()} · 추천 ${p.votes}</div></div>
        <div class="pb gn-post-body">${body(p.body)}</div>
        <div class="acts">${vote('up', `▲ 추천 ${p.votes}`)}${scrap('')}</div>
        <div class="cmh">댓글 <b>${p.comments.length}</b></div>${list}${cin}
        <div class="bt">${back('')}${more('')}${del('')}<span class="sp"></span>${writeBtn('w')}</div></article>`;
  }
}

/** 쪽지함 (사이트 안) */
function siteDm(st: GState, busy: boolean): string {
  const c = gnet.compose;
  if (c && (c.kind === 'newdm' || (c.kind === 'dm' && !st.dms.some((d) => d.nick === c.nick)))) return composeView(c, busy);
  if (gnet.openDm && st.dms.some((d) => d.nick === gnet.openDm)) return dmPane(st, gnet.openDm, busy);
  return `<div class="bs-dmh"><h2>쪽지함</h2><button class="bs-w" data-action="gn-newdm">쪽지 쓰기</button></div>${dmList(st, busy, false)}`;
}

function siteMain(site: BoardSite, ctx: ChatContext, st: GState, busy: boolean, unreadDm: number, popDm: boolean): string {
  const now = dateNow(ctx.chat);
  if (gnet.compose?.kind === 'post') return composeView(gnet.compose, busy);
  if (gnet.sub === 'dm' && !popDm) return siteDm(st, busy);
  const p = gnet.open !== null ? findAnyPost(st, gnet.open) : undefined;
  if (p) return (archived(st, p.id) ? '<p class="bs-arch">보관된 글이에요. 게시판 목록과 본편 참고에는 들어가지 않아요. 댓글을 달면 그 턴에만 다시 들어가요.</p>' : '') + sitePost(site, p, busy, now);
  return siteList(site, st, now, busy, unreadDm);
}

/** 사이트 한 장 (시안 「브라우저_시안3」 그대로: 괴담넷 .gn·괴담갤 .dc·세정게 .wp·연어 마켓 .sm) */
function siteHtml(site: BoardSite, ctx: ChatContext, st: GState, busy: boolean, mobile: boolean, extras: string, note: string): string {
  const unreadDm = st.dms.filter((d) => d.unread).length;
  // PC 쪽지함은 게시판 위에 뜨는 팝업창 (11-09 사용자: 우주 쇼핑몰 질문 창처럼 끌기·크기 조절·바깥 누르면 닫힘). 폰은 전체 화면 그대로
  const popDm = gnet.sub === 'dm' && !mobile;
  const main = siteMain(site, ctx, st, busy, unreadDm, popDm);
  const plain = (gnet.sub === 'dm' && !popDm) || gnet.compose?.kind === 'post';
  const box = (inner: string) => (plain ? `<div class="bs-plain">${extras}${inner}</div>` : `${extras ? `<div class="bs-x">${extras}</div>` : ''}${inner}`);
  let inner: string;
  if (site === 'gn') inner = `<div class="wrap">${gnSide(st, unreadDm)}<div class="gcol">${plain ? `<div class="gmain">${extras}${main}</div>` : `${extras}${main}`}</div></div>`;
  // 본문 쪽은 늘 한 칸으로 싼다: 「불러오는 중」 줄(extras)이 따로 칸을 차지하면 두 칸 격자가 밀려 본문이 오른쪽 좁은 칸으로 갔다 (2026-11-10 사용자)
  // 글이 하나도 없으면 힛갤 칸도 두지 않는다
  else if (site === 'gal' && !mobile) inner = `<div class="gal-cols${st.posts.length ? '' : ' solo'}"><div class="gal-main">${box(main)}</div>${st.posts.length ? `<aside class="gal-side">${galSide(st)}</aside>` : ''}</div>`;
  else if (site === 'wpf') {
    // 왼쪽 MENU 는 글을 열어도·쓸 때도 그대로 (11-09 사용자: 통째로 본문으로 바뀌면 안 된다).
    // PC 는 윗줄 띠 대신 여기에 메뉴를 모으고 아래를 인기글로 채운다 (2026-11-10 사용자: 말머리만 있던 왼쪽 메뉴가 쓸데없다). 폰은 왼쪽 칸이 없어 윗줄 띠 그대로
    const lm = `<div class="lm"><div class="t">MENU</div>${wpfMenu(st, unreadDm)}${writeBtn('')}${wpfTop(st)}</div>`;
    inner = `<div class="pg">${box(`<div class="cols">${lm}<div class="colr">${main}</div></div><div class="ft">관리 : 부매니저 &nbsp;·&nbsp; 이 게시판은 감시받고 있습니다</div>`)}</div>`;
  }
  else inner = box(main);
  // 쪽지함 창: 스크롤 칸 맨 위의 sticky 0 높이 틀 안에 absolute 로 → 글을 내려도 같은 자리에 떠 있고 사이트 색(.bs 변수)을 그대로 쓴다
  const dmWin = popDm
    ? `<div class="gn-dmhost"><aside class="gn-dmwin" role="dialog" aria-label="쪽지함"${winStyle(gnet.dmWin)}><div class="gn-dmwin-hd"><b>${ICONS.mail} 쪽지함</b><button class="ph-tool sm" data-action="gn-dm-close" aria-label="닫기" title="닫기">${ICONS.close}</button></div><div class="gn-dmwin-bd">${siteDm(st, busy)}</div><i class="gn-rs" aria-hidden="true"></i></aside></div>`
    : '';
  return `<main class="gx-body gn bs bs-${site}${mobile ? ' bs-m' : ''}" data-site="${site}">${dmWin}${siteHead(site, st, unreadDm)}${inner}${note}</main>`;
}

/** 쪽지함 팝업창 (ui/popwin.ts 공통) */
export const gnetDmWinSpec: PopSpec = {
  host: '.bs',
  skip: 'bs-m',
  win: '.gn-dmwin',
  grip: '.gn-dmwin-hd',
  size: '.gn-rs',
  keep: '[data-action="gn-sub"][data-value="dm"], [data-action="gn-newdm"], [data-action="gn-dm-from"], .gx-gest',
  min: [320, 280],
  isOpen: () => gnet.sub === 'dm' && !narrow(),
  close: () => closeDm(),
  save: (b) => {
    gnet.dmWin = b;
  },
};
export const gnetDmOpen = (): boolean => gnet.sub === 'dm' && !narrow();
function closeDm(): void {
  gnet.sub = 'board';
  if (gnet.compose && gnet.compose.kind !== 'post' && gnet.compose.kind !== 'comment') gnet.compose = null;
  gnet.confirm = null;
}

export function gnetTab(base: ChatContext, env?: GnetEnv, site: BoardSite = 'gn'): string {
  if (env) liveEnv = env;
  sitePicFor(base);
  useBoardSite(site);
  const ctx = siteCtx(base, site);
  const st = readGnet(ctx.chat);
  const me = userNick(ctx.chat.scriptstate);
  const job = jobs.get(chatKey(ctx));
  const busy = !!job;
  const mobile = narrow();
  const nick = gnet.editNick
    ? `<div class="gn-nickform"><input class="gx-search" name="gn-nick" data-enter="gn-nick-save" value="${esc(me === '익명' && !ctx.chat.scriptstate?.[GN_NICK] ? '' : me)}" placeholder="내 닉네임 (비우면 익명)" maxlength="36" aria-label="내 닉네임"><button class="gx-mini" data-action="gn-nick-save" data-take="gn-nick">저장</button></div>`
    : '';
  const fail = gnet.failure
    ? `<details class="nw-fail"><summary>최근 실패 원문</summary><p>${esc(gnet.failure.reason)}</p><textarea class="gx-search" rows="6" readonly>${esc(gnet.failure.raw)}</textarea></details>`
    : '';
  const status = job ? `<div class="nw-busy" role="status"><span class="nw-spin"></span>${esc(job)} 창을 닫아도 계속돼요.</div>` : '';
  const note = toast('gn', gnet.notice, (t) => {
    if (gnet.notice === t) gnet.notice = '';
  });
  // 떠 있는 알림(note)은 본문 위 줄(extras)에 넣지 않는다: 알림만 있어도 빈 줄이 한 칸 생겼다
  return siteHtml(site, ctx, st, busy, mobile, `${status}${nick}${fail}`, note);
}

const AUTO_LAST = '$gn_auto_last';
const quietEnv: GnetEnv = { render: () => {}, refresh: async () => {}, current: () => null };
let liveEnv: GnetEnv | null = null;

async function currentChat(ctx: ChatContext): Promise<Chat | null> {
  try {
    const chat = (await risuai.getChatFromIndex(ctx.charIndex, ctx.chatIndex)) as Chat | null;
    return chat ? boardView(chat, siteOf(ctx)) : null;
  } catch {
    return null;
  }
}

/** 채팅 응답이 끝난 뒤 (main.ts, 매 턴 = 원본 lazy 0), 또는 「창을 열 때」면 괴담넷 탭을 열 때 (gnetOpenCheck). 같은 응답에는 한 번만 */
export async function autoRefreshGnet(base: ChatContext, messageIndex: number, open = false, joint?: Joint, site: BoardSite = 'gn'): Promise<void> {
  const ctx = siteCtx(base, site);
  const s = gnetSettings(ctx.chat.scriptstate);
  if (!s.enabled || !(open ? s.autoOpen : s.auto) || jobs.has(chatKey(ctx))) return;
  const data = String(ctx.chat.message?.[messageIndex]?.data ?? '');
  if (!data.trim()) return;
  let hash = 7;
  for (let i = 0; i < data.length; i++) hash = (hash * 131 + data.charCodeAt(i)) % 2147483647;
  const stamp = `${messageIndex}:${hash}`;
  if (String(ctx.chat.scriptstate?.[AUTO_LAST] ?? '') === stamp) return;
  const saved = await upd(ctx, (chat) => withVars(chat, { [AUTO_LAST]: stamp }));
  if (!saved) return;
  const env = liveEnv ?? quietEnv;
  const showing = env.current();
  // 창이 다른 채팅을 보고 있으면 그 화면의 알림은 건드리지 않는다
  const target = showing && chatKey(showing) === chatKey(ctx) ? env : { ...quietEnv };
  const notice = gnet.notice;
  await refreshBoard({ ...ctx, chat: saved }, target, true, joint);
  if (target !== env) gnet.notice = notice;
}

/** 괴담넷 탭을 열 때: 「창을 열 때」 설정이고 마지막 채팅 응답에 맞춰 아직 새로고침하지 않았으면 한 번 */
export function gnetOpenCheck(base: ChatContext, env: GnetEnv, site: BoardSite = 'gn'): void {
  liveEnv = env;
  const ctx = siteCtx(base, site);
  if (!gnetSettings(ctx.chat.scriptstate).autoOpen) return;
  const at = lastReply(ctx.chat);
  if (at < 0) return;
  void autoRefreshGnet(ctx, at, true, undefined, site).catch((error) => console.log(`[goei] 괴담넷 새로고침 실패: ${error instanceof Error ? error.message : String(error)}`));
}

const LAZY_HINT: Record<string, string> = {
  '1': '새로고침 버튼을 누를 때만 불러요',
  open: '채팅이 진행된 뒤 괴담넷을 열면 한 번 불러요',
  '0': '채팅 응답이 끝날 때마다 모델을 한 번 더 불러요',
};

/** 괴담넷 탭 버튼. 처리했으면 true */
export async function handleGnet(action: string, value: string | undefined, base: ChatContext, env: GnetEnv, site: BoardSite = uiSite): Promise<boolean> {
  if (!action.startsWith('gn-')) return false;
  liveEnv = env;
  useBoardSite(site);
  const ctx = siteCtx(base, site);
  const v = value ?? '';
  const [a, b] = v.split(':').map(Number);
  const st = () => readGnet(ctx.chat);
  if (!action.startsWith('gn-')) return false;
  if (action !== 'gn-del-post' && action !== 'gn-del-comment' && action !== 'gn-del-thread') gnet.confirm = null;
  if (action.startsWith('gn-def-')) {
    try {
      const msg = await defaultsAction('gn', action, v, ctx, env.refresh);
      if (msg) gnet.notice = msg;
    } catch (error) {
      gnet.notice = `기본값을 처리하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
    }
    env.render();
    return true;
  }
  switch (action) {
    case 'gn-dm-close':
      closeDm();
      break;
    case 'gn-sub':
      gnet.sub = v === 'dm' ? 'dm' : 'board';
      if (gnet.compose?.kind === 'comment' || gnet.compose?.kind === 'dm') gnet.compose = null;
      break;
    case 'gn-back':
      // 오른쪽 칸 닫기 (모바일은 목록으로)
      if (gnet.settings) gnet.settings = false;
      else if (gnet.compose && (gnet.compose.kind === 'post' || gnet.compose.kind === 'newdm' || (gnet.compose.kind === 'dm' && !st().dms.some((d) => d.nick === (gnet.compose as { nick: string }).nick)))) gnet.compose = null;
      else if (gnet.sub === 'board') gnet.open = null;
      else gnet.openDm = null;
      if (gnet.compose?.kind === 'comment' || gnet.compose?.kind === 'dm') gnet.compose = null;
      gnet.attachMenu = false;
      break;
    case 'gn-settings':
      gnet.settings = !gnet.settings;
      break;
    case 'gn-att-menu':
      gnet.attachMenu = !gnet.attachMenu;
      break;
    case 'gn-open':
    case 'gn-open-side': {
      // PC는 고른 글을 다시 누르면 닫힌다 (옆 목록에서 고른 것은 늘 연다)
      gnet.open = action === 'gn-open' && gnet.open === a && !gnet.settings && !(gnet.compose && gnet.compose.kind !== 'comment') ? null : a;
      gnet.sub = 'board';
      gnet.settings = false;
      if (gnet.compose && gnet.compose.kind !== 'post') gnet.compose = null;
      if (gnet.compose?.kind === 'post') gnet.compose = null;
      const p = gnet.open !== null ? findAnyPost(st(), gnet.open) : undefined;
      if (p && postUnread(p)) {
        const id = p.id;
        await mutate(ctx, env, (s) => acknowledge(s, id), {}, false);
        return true;
      }
      break;
    }
    case 'gn-open-dm': {
      gnet.openDm = gnet.openDm === v && !gnet.settings && !gnet.compose ? null : v;
      gnet.settings = false;
      gnet.compose = null;
      if (gnet.openDm && st().dms.some((d) => d.nick === v && d.unread)) {
        await mutate(ctx, env, (s) => acknowledge(s, undefined, v), {}, false);
        return true;
      }
      break;
    }
    case 'gn-refresh':
      void refreshBoard(ctx, env);
      return true;
    case 'gn-home':
      Object.assign(gnet, { sub: 'board', open: null, openDm: null, compose: null, cat: '', q: '', page: 1, settings: false });
      break;
    case 'gn-cat':
      Object.assign(gnet, { sub: 'board', open: null, openDm: null, cat: v, page: 1, settings: false });
      if (gnet.compose?.kind !== 'post') gnet.compose = null;
      break;
    case 'gn-tab':
      // 괴담갤 윗줄 「전체글」: 분류·정렬을 처음으로
      Object.assign(gnet, { sub: 'board', open: null, openDm: null, page: 1, settings: false, cat: '', sort: 'new' });
      if (gnet.compose?.kind !== 'post') gnet.compose = null;
      break;
    case 'gn-sort':
      gnet.sort = v === 'hot' || v === 'cmt' ? v : 'new';
      Object.assign(gnet, { sub: 'board', open: null, page: 1 });
      if (gnet.compose?.kind !== 'post') gnet.compose = null;
      break;
    case 'gn-search-go': {
      // 아래 찾기칸의 「검색」 단추: 고친 칸의 글자로 찾는다
      const ins = [...document.querySelectorAll<HTMLInputElement>('.bs input[name="gn-q"]')];
      const q = (ins.find((i) => i.value.trim() !== gnet.q) ?? ins[0])?.value ?? '';
      Object.assign(gnet, { sub: 'board', open: null, q: q.trim().slice(0, 60), page: 1 });
      break;
    }
    case 'gn-vote':
    case 'gn-down':
      // 추천·비추는 한 번씩, 다시 누르면 취소 (시안: 글마다 추천 단추)
      await mutate(ctx, env, (s) => {
        const p = findAnyPost(s, a);
        if (!p) return false;
        if (action === 'gn-down') p.down = !p.down;
        else {
          p.voted = !p.voted;
          p.votes = Math.max(0, p.votes + (p.voted ? 1 : -1));
        }
      }, {}, false);
      return true;
    case 'gn-page':
      gnet.page = Math.max(1, Math.floor(Number(v)) || 1);
      break;
    case 'gn-search':
      Object.assign(gnet, { sub: 'board', open: null, q: v.trim().slice(0, 60), page: 1 });
      break;
    case 'gn-scrap':
      await mutate(ctx, env, (s) => {
        const p = findAnyPost(s, a);
        if (!p) return false;
        p.scrap = !p.scrap;
        // 보관함에 스크랩으로만 남아 있던 남의 글은 스크랩을 풀면 보관할 까닭이 없다
        if (!p.scrap && !p.mine && archived(s, p.id)) {
          s.archive = s.archive.filter((x) => x.id !== p.id);
          if (gnet.open === p.id) gnet.open = null;
        }
      }, {}, false);
      return true;
    case 'gn-write':
      gnet.settings = false;
      gnet.sub = 'board';
      gnet.compose = { kind: 'post' };
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-newdm':
      gnet.settings = false;
      gnet.sub = 'dm';
      gnet.compose = { kind: 'newdm' };
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-comment': {
      // 아래 입력줄로 데려간다 (모바일은 펼친 글 맨 끝에 있어 안 보일 수 있음)
      gnet.compose = { kind: 'comment', post: a, parent: 0, label: '댓글' };
      gnet.attach = [];
      env.render();
      const box = document.querySelector<HTMLTextAreaElement>('.gn-composer [data-input="gn-draft"]');
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      box?.focus({ preventScroll: true });
      return true;
    }
    case 'gn-reply': {
      const c = findAnyPost(st(), a)?.comments[b - 1];
      if (!c) break;
      gnet.draft = '';
      gnet.attach = [];
      // 같은 댓글의 답글을 다시 누르면 닫는다
      if (gnet.compose?.kind === 'comment' && gnet.compose.post === a && gnet.compose.parent === b) {
        gnet.compose = null;
        break;
      }
      gnet.compose = { kind: 'comment', post: a, parent: b, label: `${c.nick}에게 답글` };
      env.render();
      // 화면은 그대로 두고, 열린 입력줄이 가려져 있을 때만 살짝 당겨 보인다
      const box = document.querySelector<HTMLTextAreaElement>('.gn-c-compose [data-input="gn-draft"]');
      box?.focus({ preventScroll: true });
      box?.closest('.gn-c-compose')?.scrollIntoView({ block: 'nearest' });
      return true;
    }
    case 'gn-dm-from': {
      const p = findAnyPost(st(), a);
      const contact = p && (b > 0 ? p.comments[b - 1] : p);
      if (!p || !contact || contact.mine) break;
      gnet.sub = 'dm';
      gnet.settings = false;
      gnet.openDm = contact.nick;
      gnet.compose = { kind: 'dm', nick: contact.nick, source: sourceFor(p, b), label: `${contact.nick}에게 쪽지 · 「${p.title}」` };
      gnet.draft = '';
      gnet.attach = [];
      break;
    }
    case 'gn-dm-reply':
      gnet.compose = { kind: 'dm', nick: v, label: `${v}에게 답장` };
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-cancel':
      gnet.compose = null;
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-att-add':
    case 'gn-att-del':
      attachAction(gnet.attach, action === 'gn-att-add' ? 'add' : 'del', v, GN_KINDS);
      break;
    case 'gn-send': {
      // 글을 연 채 아래 입력줄에 쓰면 댓글, 쪽지를 연 채 쓰면 답장
      const c: Compose | null = gnet.compose
        ?? (gnet.sub === 'board' && gnet.open !== null ? { kind: 'comment', post: gnet.open, parent: 0, label: '댓글' }
          : gnet.sub === 'dm' && gnet.openDm ? { kind: 'dm', nick: gnet.openDm, label: `${gnet.openDm}에게 답장` } : null);
      if (!c) break;
      if (!gnet.draft.trim() && !gnet.attach.length) {
        gnet.notice = '내용을 입력해 주세요.';
        break;
      }
      const blank = emptyAttachment(gnet.attach);
      if (blank) {
        gnet.notice = '첨부 내용을 입력하거나 ✕로 빼 주세요.';
        break;
      }
      // 첨부 기록 줄 + 함께 보낸 글 (원본 AT.gnetDeliver)
      const text = composeBody(gnet.attach, gnet.draft);
      const cap = c.kind === 'post' ? LIMITS.post_tokens : c.kind === 'comment' ? LIMITS.comment_tokens : LIMITS.dm_tokens;
      if (tokens(describe(text)) > cap) {
        gnet.notice = `첨부 내용과 글이 작성 상한(${cap}토큰)을 넘었어요. 조금 줄여 주세요.`;
        break;
      }
      if (c.kind === 'post') void writePost(ctx, env, text);
      else if (c.kind === 'comment') void writeComment(ctx, env, c.post, c.parent, text);
      else if (c.kind === 'dm') void sendDm(ctx, env, c.nick, text, c.source);
      else {
        const to = gnet.to.trim().slice(0, 80);
        if (!to) {
          gnet.notice = '받는 사람 닉네임을 적어 주세요.';
          break;
        }
        void sendDm(ctx, env, to, text);
      }
      return true;
    }
    case 'gn-post-refresh':
      if (findPost(st(), a)) void refreshPost(ctx, env, a);
      else if (archived(st(), a)) gnet.notice = '보관된 글이라 새 댓글을 불러오지 않아요. 댓글을 달면 그 턴에 다시 이어져요.';
      break;
    case 'gn-del-post':
      if (gnet.confirm !== `p:${a}`) {
        gnet.confirm = `p:${a}`;
        break;
      }
      gnet.confirm = null;
      gnet.open = null;
      await mutate(ctx, env, (s) => deletePost(s, a));
      return true;
    case 'gn-del-comment':
      if (gnet.confirm !== `c:${a}:${b}`) {
        gnet.confirm = `c:${a}:${b}`;
        break;
      }
      gnet.confirm = null;
      await mutate(ctx, env, (s) => deleteComment(s, a, b));
      return true;
    case 'gn-del-thread':
      if (gnet.confirm !== `d:${v}`) {
        gnet.confirm = `d:${v}`;
        break;
      }
      gnet.confirm = null;
      gnet.openDm = null;
      await mutate(ctx, env, (s) => deleteThread(s, v));
      return true;
    case 'gn-nick':
      gnet.editNick = true;
      break;
    case 'gn-nick-save':
      gnet.editNick = false;
      await setVar(ctx, env, GN_NICK, v.trim().slice(0, 36));
      return true;
    case 'gn-cfg': {
      const [k, val] = v.split('=');
      if (k === 'storage') {
        await setVar(ctx, env, GN_STORAGE_AUTO, val === '0' ? '0' : '1');
        return true;
      }
      if (k === 'joint') {
        await setVar(ctx, env, JOINT_VAR, val === '0' ? '0' : '1');
        return true;
      }
      if (k in GN_DEFAULTS) await setVar(ctx, env, CFG(k), val);
      return true;
    }
    case 'gn-count': {
      // 개수 최소·최대: 범위 안으로, 최소가 최대를 넘으면 같이 맞춘다
      const m = /^(post|cmt|act)_(min|max)=(.*)$/.exec(v);
      if (!m) return true;
      const k = m[1] as CountKey;
      const [a, b] = gnetSettings(ctx.chat.scriptstate).counts[k];
      const [lo, hi] = COUNT_RANGE[k];
      const raw = Math.floor(Number(m[3]));
      if (!Number.isFinite(raw) || m[3].trim() === '') return env.render(), true;
      const n = Math.max(lo, Math.min(hi, raw));
      const vars: Record<string, string> = { [CFG(`${k}_${m[2]}`)]: String(n) };
      if (m[2] === 'min' && n > b) vars[CFG(`${k}_max`)] = String(n);
      if (m[2] === 'max' && n < a) vars[CFG(`${k}_min`)] = String(n);
      await setVars(ctx, env, vars);
      return true;
    }
    case 'gn-keep': {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n >= 1 && n <= STORAGE_MAX) await setVar(ctx, env, GN_STORAGE_LIMIT, String(n));
      else env.render();
      return true;
    }
    case 'gn-text': {
      const [k, ...rest] = v.split('=');
      if (['subject', 'mood', 'protagonist'].includes(k)) await setVar(ctx, env, CFG(k), rest.join('=').trim());
      return true;
    }
    default:
      return false;
  }
  env.render();
  return true;
}

/** 메인 설정 「기능별 설정」에서 연다 */
export function gnetSettingsPane(ctx: ChatContext, site: BoardSite = 'gn'): string {
  useBoardSite(site);
  return settingsView(siteCtx(ctx, site), true);
}

/** 호출 흐름 미리 계산: 지금 설정으로 새로고침이 보낼 요청 (모델은 안 부름). 확률 계획은 Math.random 그대로라 매번 조금 다를 수 있다 */
export function previewGnetRefresh(base: ChatContext, site: BoardSite = 'gn'): LlmMessage[] {
  const ctx = siteCtx(base, site);
  const before = readGnet(ctx.chat);
  const nick = userNick(ctx.chat.scriptstate);
  const s = gnetSettings(ctx.chat.scriptstate);
  const plan = incomingPlan(ctx.chat, before, s, nick, Math.random, undefined, savedOrigin(ctx.chat));
  return fitPrompt(budgetFor(ctx.chat.scriptstate, 'gn'), () => refreshPrompt(source(ctx), before, plan, nick, names(ctx))).messages;
}

/** [사진:이름] 을 이 봇의 그림으로 (그리기 전에) */
function sitePicFor(ctx: ChatContext): void {
  setSitePicSource((raw) => {
    const name = resolveSitePic(ctx.char as never, raw);
    return name ? imageUrl(ctx.char, name) : null;
  });
}

/** 브라우저 탭 제목·주소 (시안: 글을 열면 그 글 제목과 글 주소) */
export function boardChrome(base: ChatContext, site: BoardSite): { title: string; path: string } | null {
  useBoardSite(site);
  if (gnet.sub !== 'board' || gnet.open === null || gnet.compose?.kind === 'post') return null;
  const p = findAnyPost(readGnet(siteCtx(base, site).chat), gnet.open);
  if (!p) return null;
  const path = site === 'gal' ? `/board/view/?id=horror&no=${p.id}` : site === 'wpf' ? `/zboard.php?id=wpf&no=${p.id}` : site === 'sm' ? `/articles/${p.id}` : `/board/free/${p.id}`;
  return { title: site === 'sm' ? '' : p.title, path };
}
