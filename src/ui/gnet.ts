// 「괴담넷」 탭: 게시판·쪽지함. 생성은 새로고침·글 올리기·댓글·쪽지 보내기를 눌렀을 때만 한 번씩 부른다.
// 원본은 채팅 입력창을 빌려 썼지만 여기서는 창 안의 입력칸에 쓴다. 생성은 창을 닫아도 계속되고 끝나면 원래 채팅에 저장한다.
import {
  acceptComments, acknowledge, addOutgoingDm, addUserComment, addUserPost, applyActivity, applyBoard, pushComments, hhmm, attachPostDraft, boardUnread, CFG, commitIncoming,
  dateNow, deleteComment, deletePost, deleteThread, dmThreads, dmUnread, findPost, GN_COOLDOWN, GN_DEFAULTS, GN_NICK, GnetError, gnetSettings,
  GN_STORAGE_AUTO, GN_STORAGE_LIMIT, gnetRetention, incomingPlan, LIMITS, parseDmBody, parseJsonPayload, parsePostDraft, postKey, postUnread, QUANTITY,
  readGnet, sourceFor, STORAGE_MAX, storyTurns, tokens, trimBoard,
  userNick, writeGnet, type GPost, type GSource, type GState, type IncomingOrigin, type IncomingPlan, gnetLabel } from '../core/gnet';
import { commentPrompt, dmPrompt, POST_REFRESH_ACTION, postPrompt, refreshPrompt, retryMessages } from '../core/gnetPrompt';
import { composeBody, describe, previewText, type UserKind } from '../core/attach';
import { ICONS } from './icons';
import { toast } from './toast';
import { drawerHtml } from './drawer';
import { attachAction, attachBody, attachEditor, emptyAttachment, type Attachments } from './attach';
import type { RefSource } from '../core/refs';
import type { Chat } from '../core/types';
import { lastReply } from '../core/phone';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { generate, type LlmMessage, type RetryOptions } from '../host/llm';
import type { Joint } from '../host/joint';
import { budgetFor, genSettings } from '../core/advanced';
import { fitPrompt } from '../core/budget';
import { advancedBox } from './advanced';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { saveVarDefaults } from '../host/prefs';
import { defaultsAction, defaultsButtons, defaultsConfirm } from './defaults';
import { updateChat, type ChatContext } from '../host/risu';

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
}

export const gnet: GnetUi = {
  sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, nick: '', notice: '', failure: null, settings: false, attachMenu: false,
};
/** 괴담넷에서 보낼 수 있는 첨부 (원본: 선물 없음) */
export const GN_KINDS: UserKind[] = ['image', 'photo', 'video', 'file', 'link'];

export function resetGnet() {
  Object.assign(gnet, { sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, notice: '', failure: null, settings: false, attachMenu: false });
}

export interface GnetEnv {
  render(): void;
  refresh(): Promise<void>;
  current(): ChatContext | null;
}

/** 채팅마다 한 번에 하나 (원본 LB.exclusive) */
const jobs = new Map<string, string>();
const chatKey = (ctx: { charIndex: number; chatIndex: number }) => `${ctx.charIndex}:${ctx.chatIndex}`;

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const retry = (chat: Chat): RetryOptions => ({ ...genSettings(chat.scriptstate), state: chat.scriptstate });
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
  if (jobs.has(key)) {
    gnet.notice = `${jobs.get(key)} 끝난 뒤 다시 눌러 주세요.`;
    env.render();
    return;
  }
  jobs.set(key, label);
  gnet.notice = '';
  gnet.failure = null;
  env.render();
  try {
    gnet.notice = await work();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    gnet.notice = msg;
    const raw = (error as { raw?: string }).raw;
    if (raw) gnet.failure = { label, reason: msg, raw };
  } finally {
    jobs.delete(key);
    await env.refresh();
  }
}

/** 창에서 지금 펼쳐 보고 있는 글·쪽지 (생성 결과를 저장할 때 바로 읽음 처리) */
const viewing = () => ({ post: gnet.sub === 'board' ? gnet.open : null, nick: gnet.sub === 'dm' ? gnet.openDm : null });

// ── 작업 ──

function refreshBoard(ctx: ChatContext, env: GnetEnv, automatic = false, joint?: Joint) {
  return run(ctx, env, automatic ? '채팅 응답에 맞춰 게시판을 새로 불러오는 중이에요.' : '게시판을 불러오는 중이에요.', async () => {
    const startLength = ctx.chat.message?.length ?? 0;
    const before = readGnet(ctx.chat);
    const nick = userNick(ctx.chat.scriptstate);
    const s = gnetSettings(ctx.chat.scriptstate);
    const plan = incomingPlan(ctx.chat, before, s, nick, Math.random, undefined, savedOrigin(ctx.chat));
    const prompt = fitPrompt(budgetFor(ctx.chat.scriptstate, 'gn'), () => refreshPrompt(source(ctx), before, plan, nick, names(ctx)));
    const first = joint && ((m: LlmMessage[]) => joint.ask('gnet', m));
    const { raw, value } = await generate(prompt.messages, s.model, (r) => withRaw(r, () => parseJsonPayload(r)), { ...retry(ctx.chat), first });
    let note = '';
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      if (automatic && (chat.message?.length ?? 0) !== startLength) {
        note = '채팅이 이어져서 이번 자동 새로고침 결과는 저장하지 않았어요.';
        return null;
      }
      const res = withRaw(raw, () => applyBoard(before, readGnet(chat), value, { nick, settings: s, date: dateNow(chat) }));
      const inc = saveIncoming(chat, res.st, (value as { incoming?: unknown }).incoming, plan);
      note = [res.notice, res.emptyComments ? '이번 게시판에는 댓글이 하나도 없어요.' : '', inc.note].filter(Boolean).join(' ');
      return writeGnet(withVars(chat, inc.vars), res.st, { ack: viewing() });
    });
    if (!automatic) gnet.open = null;
    else if (gnet.open !== null && !findPost(readGnet((await currentChat(ctx)) ?? ctx.chat), gnet.open)) gnet.open = null;
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
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readGnet(chat);
      const p = addUserPost(cur, nick, draft.title, draft.content, dateNow(chat));
      newId = p.id;
      const got = acceptComments(value.comments, [], { postId: p.id, replyTo: 0, total: 0, supplied: new Set() }, nick);
      pushComments(p, got.comments, dateNow(chat));
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick, dateNow(chat));
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
    await updateChat(ctx.charIndex, ctx.chatIndex, (latest) => {
      const cur = readGnet(latest);
      const p = findPost(cur, postId);
      if (!p || postKey(p) !== snapshot) {
        note = '불러오는 동안 글이 바뀌어서 적용하지 않았어요. 다시 눌러 주세요.';
        return null;
      }
      const got = acceptComments(value.comments, p.comments, { postId, replyTo: 0, total: prompt.total, supplied: prompt.supplied }, nick);
      pushComments(p, got.comments, dateNow(latest));
      const n = got.comments.length;
      p.views += n * (5 + Math.floor(Math.random() * 20)) + Math.floor(Math.random() * 10);
      p.votes += Math.floor(Math.random() * (n + 2));
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick, dateNow(latest));
      note = n ? '' : '새 댓글이 없어요.';
      if (got.dropped) note += ` 형식이 맞지 않는 댓글 ${got.dropped}개는 뺐어요.`;
      if (skipped) note += ` 다른 글 활동 ${skipped}건은 형식이 맞지 않아 뺐어요.`;
      return writeGnet(latest, cur, { ack: viewing() });
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
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readGnet(chat);
    index = addUserComment(st, postId, parent, nick, body, dateNow(chat));
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
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readGnet(chat);
      const p = findPost(cur, postId);
      if (!p || postKey(p) !== snapshot) {
        note = '생성하는 동안 글이 바뀌어서 답글을 적용하지 않았어요. 내 댓글은 저장돼 있어요.';
        return null;
      }
      const got = acceptComments(value.comments, p.comments, { postId, replyTo: index, total: prompt.total, supplied: prompt.supplied }, nick);
      pushComments(p, got.comments, dateNow(chat));
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick, dateNow(chat));
      const inc = saveIncoming(chat, cur, value.incoming, plan, p);
      note = got.comments.length ? '' : '등록했어요. 추가 답글은 없어요.';
      if (got.dropped) note += ` 형식이 맞지 않는 답글 ${got.dropped}개는 뺐어요.`;
      if (skipped) note += ` 다른 글 활동 ${skipped}건은 형식이 맞지 않아 뺐어요.`;
      if (inc.note) note += ` ${inc.note}`;
      return writeGnet(withVars(chat, inc.vars), cur, { ack: viewing() });
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
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
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
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
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
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readGnet(chat);
      cur.dms.push({ nick, side: 'npc', body: reply, unread: true, date: dateNow(chat) });
      return writeGnet(chat, cur, { ack: viewing() });
    });
    return '';
  });
}

async function mutate(ctx: ChatContext, env: GnetEnv, f: (st: GState, chat: Chat) => boolean | void, vars: Record<string, string> = {}, reconcile = true) {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
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
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => withVars(chat, vars));
  await env.refresh();
}

const MODE_PREV = '$gn_mode_prev';

// ── 화면 ──

function seg(key: string, cur: string, items: [string, string][]): string {
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

/** 오른쪽 칸(모바일은 목록 대신)에 무엇을 띄울지 (v0.16.22: 괴담톡처럼 두 칸) */
type Pane = 'settings' | 'compose' | 'post' | 'dm' | null;
/** 모바일: 글·쪽지는 화면을 넘기지 않고 목록 안에서 펼친다 (사용자 요청) */
const narrow = () => matchMedia('(max-width: 760px)').matches;

function paneKind(st: GState, mobile = narrow()): Pane {
  if (gnet.settings) return 'settings';
  const c = gnet.compose;
  if (c && (c.kind === 'post' || c.kind === 'newdm' || (c.kind === 'dm' && !st.dms.some((d) => d.nick === c.nick)))) return 'compose';
  if (mobile) return null;
  if (gnet.sub === 'board' && gnet.open !== null && findPost(st, gnet.open)) return 'post';
  if (gnet.sub === 'dm' && gnet.openDm && st.dms.some((d) => d.nick === gnet.openDm)) return 'dm';
  return null;
}

/** 아래 입력줄 (댓글·답글·쪽지 답장): 괴담톡 입력줄과 같은 모양 */
/** 모바일에서 펼친 글·쪽지의 입력줄: 목록 아래에 고정 (괴담톡처럼) */
function inlineComposer(st: GState, busy: boolean): string {
  const c = gnet.compose;
  if (c && c.kind !== 'comment' && c.kind !== 'dm') return '';
  if (gnet.sub === 'board' && gnet.open !== null && findPost(st, gnet.open)) {
    // 답글은 그 댓글 바로 밑에 입력줄이 열린다 (v0.16.23). 그동안 아래 입력줄은 숨긴다
    if (c?.kind === 'comment' && c.post === gnet.open && c.parent > 0) return '';
    return composer(busy, '댓글 입력');
  }
  if (gnet.sub === 'dm' && gnet.openDm && st.dms.some((d) => d.nick === gnet.openDm)) {
    const ph = c?.kind === 'dm' && c.nick === gnet.openDm && c.source ? `「${c.source.title}」 보고 보내는 쪽지` : '쪽지 입력';
    return composer(busy, ph);
  }
  return '';
}

function composer(busy: boolean, placeholder: string, chip = ''): string {
  return `<div class="ph-composer gn-composer">
    ${chip}
    ${attachEditor('gn', gnet.attach, GN_KINDS, busy, '', gnet.attachMenu)}
    <div class="ph-compose">
      <button class="ph-tool ph-plus${gnet.attachMenu ? ' on' : ''}" data-action="gn-att-menu" aria-label="첨부" aria-expanded="${gnet.attachMenu}" title="첨부">${ICONS.plus}</button>
      <textarea class="ph-input" data-input="gn-draft" rows="1" placeholder="${esc(placeholder)}" ${busy ? 'disabled' : ''}>${esc(gnet.draft)}</textarea>
      <button class="ph-send" data-action="gn-send" aria-label="등록" title="등록" ${busy ? 'disabled' : ''}>${ICONS.send}</button>
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

function commentTree(p: GPost, busy: boolean): string {
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
      const author = c.mine
        ? `<b class="gn-me">${esc(c.nick)}</b>`
        : `<button class="gn-nick" data-action="gn-dm-from" data-value="${p.id}:${k}" title="쪽지 보내기">${esc(c.nick)}</button>`;
      const del = c.mine
        ? confirm
          ? `<button class="gx-mini danger" data-action="gn-del-comment" data-value="${p.id}:${k}">정말 삭제</button>`
          : `<button class="ph-tool sm gn-cdel" data-action="gn-del-comment" data-value="${p.id}:${k}" aria-label="댓글 삭제" title="삭제">${ICONS.trash}</button>`
        : '';
      // 게시판 댓글 줄: 닉네임 | 내용 | 답글·삭제 (모바일은 닉네임 줄 아래 내용)
      out.push(`<li class="gn-c${depth ? ' re' : ''}${c.unread ? ' unread' : ''}${target === k ? ' target' : ''}" style="--gn-depth:${Math.min(depth, 3)}">
        <div class="gn-c-who">${depth ? '<span class="gn-re" aria-hidden="true">↳</span>' : ''}${author}${c.unread ? '<span class="gn-dot" aria-label="새 답글"></span>' : ''}</div>
        <div class="gn-c-body">${body(c.body)}</div>
        <div class="gn-c-act">${commentClock(p, c)}<button class="gn-reply" data-action="gn-reply" data-value="${p.id}:${k}">답글</button>${del}</div></li>`);
      if (target === k && gnet.compose?.kind === 'comment') out.push(replyBox(gnet.compose.label, busy, depth + 1));
      walk(k, depth + 1);
    }
  };
  walk(0, 0);
  return out.join('');
}

/** 댓글 시각: 글과 같은 날이면 「14:23」, 다른 날이면 「05.14 09:10」 (시각 없는 옛 댓글은 없음) */
function commentClock(p: GPost, c: GPost['comments'][number]): string {
  if (!c.time) return '';
  const same = c.time.slice(0, 10) === String(p.date).slice(0, 10);
  return `<time class="gn-c-time">${esc(same ? hhmm(c.time) : `${c.time.slice(5, 10)} ${hhmm(c.time)}`)}</time>`;
}

function postView(p: GPost, busy: boolean, inline = false): string {
  const c = gnet.compose;
  const reply = c?.kind === 'comment' && c.post === p.id && c.parent > 0 ? c : null;
  const confirm = gnet.confirm === `p:${p.id}`;
  const right = p.mine
    ? confirm
      ? `<button class="gx-mini danger" data-action="gn-del-post" data-value="${p.id}">정말 삭제</button>`
      : tool('gn-del-post', ICONS.trash, '글 삭제', `data-value="${p.id}"`)
    : '';
  const again = tool('gn-post-refresh', ICONS.refresh, '이 글 새로고침', `data-value="${p.id}" ${busy ? 'disabled' : ''}`);
  // 모바일 펼침: 목록 줄이 이미 제목·닉네임·시각·조회·추천을 보여 주므로 머리줄 없이 본문부터 (v0.16.23).
  // 글쓴이에게 쪽지·내 글 삭제는 댓글 머리줄 오른쪽에
  const who = p.mine ? '' : `<button class="gn-nick" data-action="gn-dm-from" data-value="${p.id}:0" title="쪽지 보내기">${esc(p.nick)}</button>`;
  const head = inline
    ? ''
    : `<header class="gn-post-head"><h2 class="gn-post-title">${esc(p.title)}</h2>
          <div class="gn-post-meta"><span class="gn-post-who">${p.mine ? `<b class="gn-me">${esc(p.nick)}</b>` : who}</span>
            <span>${esc(p.date)}</span><span class="gn-post-stat"><span>조회 ${p.views.toLocaleString()}</span><span>추천 ${p.votes.toLocaleString()}</span><span>댓글 ${p.comments.length}</span></span></div></header>`;
  const tail = inline ? `<span class="gn-chead-act">${again}${p.mine ? right : `<span class="gn-chead-dm">${ICONS.mail}${who}</span>`}</span>` : '';
  return `<div class="${inline ? 'gn-inline' : 'ph-room gn-pane'}">${inline ? '' : paneHead('게시판', `#${p.id}`, again + right)}
    <div class="gn-doc">
      <article class="gn-post">${head}
        <div class="gn-post-body">${body(p.body)}</div>
      </article>
      <section class="gn-csec"><div class="gn-chead"><h3 class="gn-ccount">전체 댓글 <b>${p.comments.length}</b>개</h3>${tail}</div>
        ${p.comments.length ? `<ul class="gn-comments">${commentTree(p, busy)}</ul>` : '<p class="gn-cnone">아직 댓글이 없어요.</p>'}</section>
    </div>
    ${inline || reply ? '' : composer(busy, '댓글 입력')}
  </div>`;
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

/** 게시판 목록: 첫 줄 제목·댓글 수, 둘째 줄 닉네임·시각·조회·추천 */
function boardList(st: GState, busy: boolean, mobile: boolean): string {
  if (!st.posts.length) return '<div class="ph-blank"><p>게시글이 없어요.<br>새로고침을 눌러 불러오세요.</p></div>';
  return `<ul class="ph-list gn-list">${st.posts
    .map((p) => {
      const on = gnet.open === p.id && !gnet.settings;
      return `<li class="gn-row${on ? ' on' : ''}${p.mine ? ' mine' : ''}"><button class="gn-row-main" data-action="gn-open" data-value="${p.id}" aria-pressed="${on}">
        <span class="gn-title"><b>${esc(p.title)}</b>${p.comments.length ? `<em>${p.comments.length}</em>` : ''}${postUnread(p) ? '<span class="gn-dot" aria-label="새 댓글"></span>' : ''}</span>
        <span class="gn-row-meta"><span class="gn-row-nick">${esc(p.nick)}</span><span>${esc(time(p.date))}</span><span>조회 ${p.views.toLocaleString()}</span><span>추천 ${p.votes.toLocaleString()}</span></span>
      </button>${mobile && on && !gnet.compose?.kind.match(/post|newdm/) ? postView(p, busy, true) : ''}</li>`;
    })
    .join('')}</ul>`;
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
  const on = v('mode') !== '0';
  const rows = on
    ? `${group(gnetLabel(ctx.chat.scriptstate), [
        row('게시판 사용', seg('power', '1', [['1', '켜기'], ['0', '끄기']])),
        row('모델', seg('mode', v('mode') === '1' ? '1' : '2', [['1', '메인'], ['2', '보조']])),
        row('새로고침', seg('lazy', ['0', 'open'].includes(v('lazy')) ? v('lazy') : '1', [['1', '수동'], ['open', '창을 열 때'], ['0', '매 턴']]), LAZY_HINT[v('lazy')] ?? LAZY_HINT['1']),
        row('채팅에 반영', seg('context', v('context') === '1' ? '1' : '0', [['0', '포함'], ['1', '빼기']]), '지금 장면과 관련된 글과 쪽지가 채팅 요청에 참고로 붙어요'),
        row('다양성 강화', seg('sampling', v('sampling') === '1' ? '1' : '0', [['0', '끄기'], ['1', '켜기']])),
      ].join(''))}
      ${group('게시판', [
        row('게시글 수', seg('quantity', v('quantity'), Object.entries(QUANTITY).map(([k, q]) => [k, q.label]))),
        row('성격', seg('style', ['gal', 'wpf'].includes(v('style')) ? v('style') : 'net', [['gal', '괴담갤'], ['net', '괴담넷'], ['wpf', '세정게']]), '괴담갤 = 일반인 괴담 커뮤니티 · 괴담넷 = 업계 관계자들이 가명으로 쓰는 곳 · 세정게 = 세계정치 게시판(음모론 속에 진짜가 섞인 곳). 이용자 구성과 기본 말투만 바뀌고 다음 새로고침부터 적용돼요. 메뉴 이름도 같이 바뀌어요.'),
        row('사생활', seg('privacy', v('privacy'), [['0', '이목집중'], ['1', '자율'], ['2', '약보호'], ['3', '강보호'], ['4', '언급금지']])),
        row('주제', text('subject', '비우면 세계관에 맞는 다양한 주제')),
        row('분위기·말투', text('mood', '비우면 익명 커뮤니티 말투')),
        row('보호 대상', text('protagonist', '비우면 주인공')),
        row('새로고침 시 내 글', seg('keepown', v('keepown'), [['1', '유지'], ['0', '교체']])),
        row('내 댓글 있는 글', seg('keepreplied', v('keepreplied'), [['1', '유지'], ['0', '교체']])),
      ].join(''))}
      ${group('쪽지', [
        row('선쪽지 받기', seg('incoming', v('incoming') === '0' ? '0' : '1', [['1', '받기'], ['0', '안 받기']])),
        row('쪽지 자동 정리', `<span class="ph-inline">${seg('storage', keep.auto ? '1' : '0', [['1', '켜기'], ['0', '끄기']])}${keep.auto ? `<input class="gx-search ph-pct" type="number" min="1" max="${STORAGE_MAX}" data-change="gn-keep" value="${keep.limit}" aria-label="상대별 쪽지 보관 상한"><span>통</span>` : ''}</span>`, `상대마다 최근 ${keep.limit}통만 남겨요`),
      ].join(''))}
      ${advancedBox('gn', ctx.chat.scriptstate)}`
    : group(gnetLabel(ctx.chat.scriptstate), row('게시판 사용', seg('power', '0', [['1', '켜기'], ['0', '끄기']]), '꺼 두면 게시판 생성과 채팅 반영을 멈춰요. 저장된 글과 쪽지는 남아요'));
  return `<div class="ph-form">${paneHead(`${gnetLabel(ctx.chat.scriptstate)} 설정`, '', defaultsButtons('gn'), back)}${defaultsConfirm('gn')}<div class="ph-form-body ps">${rows}</div></div>`;
}

function paneHtml(ctx: ChatContext, st: GState, kind: Pane, busy: boolean): string {
  if (kind === 'settings') return settingsView(ctx);
  if (kind === 'compose' && gnet.compose) return composeView(gnet.compose, busy);
  if (kind === 'post') return postView(findPost(st, gnet.open as number) as GPost, busy);
  if (kind === 'dm') return dmPane(st, gnet.openDm as string, busy);
  return `<div class="ph-empty"><span class="ph-empty-ico">${ICONS.gnet}</span><b>${gnetLabel(ctx.chat.scriptstate)}</b><p>왼쪽에서 글이나 쪽지를 고르세요.</p></div>`;
}

export function gnetTab(ctx: ChatContext, env?: GnetEnv): string {
  if (env) liveEnv = env;
  if (!gnetSettings(ctx.chat.scriptstate).enabled) {
    const off = toast('gn', gnet.notice, (t) => {
      if (gnet.notice === t) gnet.notice = '';
    });
    return `<main class="gx-body gn gn-off">${settingsView(ctx, false)}${off}</main>`;
  }
  const st = readGnet(ctx.chat);
  const me = userNick(ctx.chat.scriptstate);
  const job = jobs.get(chatKey(ctx));
  const busy = !!job;
  const unreadDm = st.dms.filter((d) => d.unread).length;
  const mobile = narrow();
  const kind = paneKind(st, mobile);
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
  const tools = [
    tool('gn-refresh', ICONS.refresh, '게시판 새로고침', busy ? 'disabled' : '', '새로고침'),
    tool('gn-write', ICONS.pen, '글쓰기', gnet.compose?.kind === 'post' ? 'aria-pressed="true"' : '', '글쓰기'),
    tool('gn-newdm', ICONS.mail, '새 쪽지', gnet.compose?.kind === 'newdm' ? 'aria-pressed="true"' : '', '쪽지'),
    tool('gn-nick', ICONS.idcard, '닉네임 바꾸기', gnet.editNick ? 'aria-pressed="true"' : '', '닉네임'),
    tool('gn-settings', ICONS.settings, `${gnetLabel(ctx.chat.scriptstate)} 설정`, gnet.settings ? 'aria-pressed="true"' : '', '설정'),
  ].join('');
  const subBtn = (id: 'board' | 'dm', label: string, extra = '') =>
    `<button class="ph-sub${gnet.sub === id ? ' on' : ''}" data-action="gn-sub" data-value="${id}" aria-pressed="${gnet.sub === id}">${label}${extra}</button>`;
  return `<main class="gx-body ph ph-app gn ${kind ? 'is-detail' : 'is-list'}">
    <section class="ph-side" aria-label="괴담넷 목록">
      <div class="ph-side-head">
        <div class="ph-subs">${subBtn('board', '게시판', boardUnread(st) ? '<span class="gn-dot"></span>' : '')}${subBtn('dm', '쪽지함', unreadDm ? ` <b class="gn-count">${unreadDm}</b>` : dmUnread(st) ? '<span class="gn-dot"></span>' : '')}<span class="gn-mynick" title="내 닉네임"><small>내 닉네임</small><b>${esc(me)}</b></span></div>
      </div>
      ${kind ? '' : status}
      <div class="ph-content">${gnet.sub === 'board' ? boardList(st, busy, mobile) : dmList(st, busy, mobile)}</div>
      ${mobile && !kind ? inlineComposer(st, busy) : ''}
      ${fail}
      ${drawerHtml(tools, nick)}
    </section>
    <section class="ph-pane">${kind ? status : ''}${paneHtml(ctx, st, kind, busy)}</section>
    ${note}
  </main>`;
}

const AUTO_LAST = '$gn_auto_last';
const quietEnv: GnetEnv = { render: () => {}, refresh: async () => {}, current: () => null };
let liveEnv: GnetEnv | null = null;

async function currentChat(ctx: ChatContext): Promise<Chat | null> {
  try {
    return (await risuai.getChatFromIndex(ctx.charIndex, ctx.chatIndex)) as Chat | null;
  } catch {
    return null;
  }
}

/** 채팅 응답이 끝난 뒤 (main.ts, 매 턴 = 원본 lazy 0), 또는 「창을 열 때」면 괴담넷 탭을 열 때 (gnetOpenCheck). 같은 응답에는 한 번만 */
export async function autoRefreshGnet(ctx: ChatContext, messageIndex: number, open = false, joint?: Joint): Promise<void> {
  const s = gnetSettings(ctx.chat.scriptstate);
  if (!s.enabled || !(open ? s.autoOpen : s.auto) || jobs.has(chatKey(ctx))) return;
  const data = String(ctx.chat.message?.[messageIndex]?.data ?? '');
  if (!data.trim()) return;
  let hash = 7;
  for (let i = 0; i < data.length; i++) hash = (hash * 131 + data.charCodeAt(i)) % 2147483647;
  const stamp = `${messageIndex}:${hash}`;
  if (String(ctx.chat.scriptstate?.[AUTO_LAST] ?? '') === stamp) return;
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => withVars(chat, { [AUTO_LAST]: stamp }));
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
export function gnetOpenCheck(ctx: ChatContext, env: GnetEnv): void {
  liveEnv = env;
  if (!gnetSettings(ctx.chat.scriptstate).autoOpen) return;
  const at = lastReply(ctx.chat);
  if (at < 0) return;
  void autoRefreshGnet(ctx, at, true).catch((error) => console.log(`[goei] 괴담넷 새로고침 실패: ${error instanceof Error ? error.message : String(error)}`));
}

const LAZY_HINT: Record<string, string> = {
  '1': '새로고침 버튼을 누를 때만 불러요',
  open: '채팅이 진행된 뒤 괴담넷을 열면 한 번 불러요',
  '0': '채팅 응답이 끝날 때마다 모델을 한 번 더 불러요',
};

/** 괴담넷 탭 버튼. 처리했으면 true */
export async function handleGnet(action: string, value: string | undefined, ctx: ChatContext, env: GnetEnv): Promise<boolean> {
  liveEnv = env;
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
    case 'gn-open': {
      // PC는 고른 글을 다시 누르면 닫힌다
      gnet.open = gnet.open === a && !gnet.settings && !(gnet.compose && gnet.compose.kind !== 'comment') ? null : a;
      gnet.settings = false;
      if (gnet.compose && gnet.compose.kind !== 'post') gnet.compose = null;
      if (gnet.compose?.kind === 'post') gnet.compose = null;
      const p = gnet.open !== null ? findPost(st(), gnet.open) : undefined;
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
      const c = findPost(st(), a)?.comments[b - 1];
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
      const p = findPost(st(), a);
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
      if (k === 'power') {
        // 끌 때 고른 모델을 기억했다가 켤 때 돌려놓는다 (원본은 mode 하나에 끄기·메인·보조가 함께 있음)
        const cur = String(ctx.chat.scriptstate?.[CFG('mode')] ?? GN_DEFAULTS.mode);
        if (val === '0' && cur !== '0') await setVars(ctx, env, { [CFG('mode')]: '0', [MODE_PREV]: cur === '1' ? '1' : '2' });
        else if (val === '1' && cur === '0') await setVar(ctx, env, CFG('mode'), String(ctx.chat.scriptstate?.[MODE_PREV] ?? '') === '1' ? '1' : '2');
        return true;
      }
      if (k === 'storage') {
        await setVar(ctx, env, GN_STORAGE_AUTO, val === '0' ? '0' : '1');
        return true;
      }
      if (k in GN_DEFAULTS) await setVar(ctx, env, CFG(k), val);
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
export const gnetSettingsPane = (ctx: ChatContext): string => settingsView(ctx, true);
