// 「괴담넷」 탭: 게시판·쪽지함. 생성은 새로고침·글 올리기·댓글·쪽지 보내기를 눌렀을 때만 한 번씩 부른다.
// 원본은 채팅 입력창을 빌려 썼지만 여기서는 창 안의 입력칸에 쓴다. 생성은 창을 닫아도 계속되고 끝나면 원래 채팅에 저장한다.
import {
  acceptComments, acknowledge, addOutgoingDm, addUserComment, addUserPost, applyActivity, applyBoard, attachPostDraft, boardUnread, CFG, commitIncoming,
  dateNow, deleteComment, deletePost, deleteThread, dmThreads, dmUnread, findPost, GN_COOLDOWN, GN_DEFAULTS, GN_NICK, GnetError, gnetSettings,
  GN_STORAGE_AUTO, GN_STORAGE_LIMIT, gnetRetention, incomingPlan, LIMITS, parseDmBody, parseJsonPayload, parsePostDraft, postKey, postUnread, QUANTITY,
  readGnet, sourceFor, STORAGE_MAX, storyTurns, tokens, trimBoard,
  userNick, writeGnet, type GPost, type GSource, type GState, type IncomingOrigin, type IncomingPlan,
} from '../core/gnet';
import { commentPrompt, dmPrompt, postPrompt, refreshPrompt, retryMessages } from '../core/gnetPrompt';
import { composeBody, describe, type UserKind } from '../core/attach';
import { keepOpen } from './panels';
import { attachAction, attachBody, attachEditor, emptyAttachment, type Attachments } from './attach';
import type { RefSource } from '../core/refs';
import type { Chat } from '../core/types';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { runModel } from '../host/llm';
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
  notice: string;
  failure: { label: string; reason: string; raw: string } | null;
}

export const gnet: GnetUi = {
  sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, nick: '', notice: '', failure: null,
};
/** 괴담넷에서 보낼 수 있는 첨부 (원본: 선물 없음) */
export const GN_KINDS: UserKind[] = ['image', 'photo', 'video', 'file', 'link'];

export function resetGnet() {
  Object.assign(gnet, { sub: 'board', open: null, openDm: null, compose: null, draft: '', attach: [], to: '', confirm: null, editNick: false, notice: '', failure: null });
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

const source = (ctx: ChatContext): RefSource => ({ char: ctx.char as RefSource['char'], chat: ctx.chat });

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

function refreshBoard(ctx: ChatContext, env: GnetEnv, automatic = false) {
  return run(ctx, env, automatic ? '본편 응답에 맞춰 게시판을 새로 불러오는 중이에요.' : '게시판을 불러오는 중이에요.', async () => {
    const startLength = ctx.chat.message?.length ?? 0;
    const before = readGnet(ctx.chat);
    const nick = userNick(ctx.chat.scriptstate);
    const s = gnetSettings(ctx.chat.scriptstate);
    const plan = incomingPlan(ctx.chat, before, s, nick, Math.random, undefined, savedOrigin(ctx.chat));
    const prompt = refreshPrompt(source(ctx), before, plan, nick, names(ctx));
    const raw = await runModel(prompt.messages, s.model);
    const value = withRaw(raw, () => parseJsonPayload(raw));
    let note = '';
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      if (automatic && (chat.message?.length ?? 0) !== startLength) {
        note = '본편이 이어져서 이번 자동 새로고침 결과는 저장하지 않았어요.';
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
    const prompt = postPrompt(source(ctx), st, input, plan, names(ctx));
    const raw = await runModel(prompt.messages, s.model);
    const value = withRaw(raw, () => parseJsonPayload(raw)) as Record<string, unknown>;
    const draft = attachPostDraft(withRaw(raw, () => parsePostDraft(value)), input);
    let note = '글을 올렸어요.';
    let newId = 0;
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readGnet(chat);
      const p = addUserPost(cur, nick, draft.title, draft.content, dateNow(chat));
      newId = p.id;
      const got = acceptComments(value.comments, [], { postId: p.id, replyTo: 0, total: 0, supplied: new Set() }, nick);
      for (const c of got.comments) p.comments.push({ nick: c.author, body: c.content, parent: c.parent, mine: false, unread: false });
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick);
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
    index = addUserComment(st, postId, parent, nick, body);
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
    const prompt = commentPrompt({ char: ctx.char as RefSource['char'], chat: saved }, st, postId, index, body, plan, nick, names(ctx));
    const snapshot = postKey(target);
    let raw = '';
    try {
      raw = await runModel(prompt.messages, s.model);
    } catch (error) {
      throw new GnetError(`댓글은 저장했어요. ${error instanceof Error ? error.message : String(error)}`);
    }
    const value = withRaw(raw, () => {
      try {
        return parseJsonPayload(raw) as Record<string, unknown>;
      } catch (error) {
        throw new GnetError(`댓글은 저장했어요. ${(error as Error).message}`, raw);
      }
    });
    let note = '';
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readGnet(chat);
      const p = findPost(cur, postId);
      if (!p || postKey(p) !== snapshot) {
        note = '생성하는 동안 글이 바뀌어서 답글을 적용하지 않았어요. 내 댓글은 저장돼 있어요.';
        return null;
      }
      const got = acceptComments(value.comments, p.comments, { postId, replyTo: index, total: prompt.total, supplied: prompt.supplied }, nick);
      for (const c of got.comments) p.comments.push({ nick: c.author, body: c.content, parent: c.parent, mine: false, unread: false });
      const [, skipped] = applyActivity(cur, value.activity, prompt.activity.snapshots, nick);
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
    const prompt = dmPrompt({ char: ctx.char as RefSource['char'], chat: saved }, st, nick, body, me, names(ctx));
    let reply: string;
    try {
      const raw = await runModel(prompt.messages, s.model);
      try {
        reply = parseDmBody(raw);
      } catch (error) {
        // 원본과 같이 한 번만 고쳐 달라고 다시 묻는다
        const again = await runModel(retryMessages(prompt, raw, (error as Error).message), s.model);
        reply = withRaw(again, () => parseDmBody(again));
      }
    } catch (error) {
      throw new GnetError(`보낸 쪽지는 저장했어요. 답장을 받지 못했어요: ${error instanceof Error ? error.message : String(error)}`, (error as { raw?: string }).raw ?? '');
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

function composeBox(c: Compose, busy: boolean): string {
  const label = c.kind === 'post' ? '새 글' : c.kind === 'newdm' ? '새 쪽지' : c.label;
  const hint = c.kind === 'post' ? '<p class="gx-muted">올릴 글이나 쓰고 싶은 내용을 적으면 제목과 본문을 다듬어 올리고, 댓글도 함께 받아요.</p>' : '';
  const to = c.kind === 'newdm' ? `<input class="gx-search" data-input="gn-to" placeholder="받는 사람 닉네임" value="${esc(gnet.to)}" aria-label="받는 사람">` : '';
  return `<div class="gn-compose"><div class="gn-compose-head"><b>${esc(label)}</b><button class="gx-mini" data-action="gn-cancel">취소</button></div>${hint}${to}
    <textarea class="gx-search gn-text" data-input="gn-draft" rows="${c.kind === 'post' ? 5 : 3}" placeholder="${c.kind === 'post' ? '예: 어젯밤 소라 랜드 앞에서 이상한 소리 들은 사람 있음?' : gnet.attach.length ? '함께 보낼 글 (선택)' : '내용을 입력하세요'}">${esc(gnet.draft)}</textarea>
    ${attachEditor('gn', gnet.attach, GN_KINDS, busy)}
    <button class="gx-start gn-send" data-action="gn-send" ${busy ? 'disabled' : ''}>${c.kind === 'post' ? '올리기' : c.kind === 'comment' ? '등록' : '보내기'}</button></div>`;
}

function commentTree(p: GPost, me: string): string {
  const kids = new Map<number, number[]>();
  p.comments.forEach((c, i) => {
    const parent = c.parent > 0 && c.parent <= p.comments.length && c.parent !== i + 1 ? c.parent : 0;
    kids.set(parent, [...(kids.get(parent) ?? []), i + 1]);
  });
  const out: string[] = [];
  const seen = new Set<number>();
  const walk = (n: number, depth: number) => {
    for (const k of kids.get(n) ?? []) {
      if (seen.has(k)) continue;
      seen.add(k);
      const c = p.comments[k - 1];
      const confirm = gnet.confirm === `c:${p.id}:${k}`;
      const author = c.mine
        ? `<b class="gn-me">${esc(c.nick)}</b>`
        : `<button class="gn-nick" data-action="gn-dm-from" data-value="${p.id}:${k}" title="쪽지 보내기">${esc(c.nick)}</button>`;
      out.push(`<li class="gn-c${c.unread ? ' unread' : ''}" style="--gn-depth:${Math.min(depth, 3)}">
        <div class="gn-c-head">${author}${c.unread ? '<span class="gn-dot" aria-label="새 답글"></span>' : ''}
          <span class="gn-c-act"><button class="gx-mini" data-action="gn-reply" data-value="${p.id}:${k}">답글</button>${c.mine ? `<button class="gx-mini${confirm ? ' danger' : ''}" data-action="gn-del-comment" data-value="${p.id}:${k}">${confirm ? '정말 삭제' : '삭제'}</button>` : ''}</span></div>
        <div class="gn-c-body">${body(c.body)}</div></li>`);
      walk(k, depth + 1);
    }
  };
  walk(0, 0);
  return out.join('');
}

function postView(p: GPost, me: string, busy: boolean): string {
  const c = gnet.compose;
  const composing = c?.kind === 'comment' && c.post === p.id;
  const confirm = gnet.confirm === `p:${p.id}`;
  return `<div class="gn-post">
    <div class="gn-post-meta">${p.mine ? `<b class="gn-me">${esc(p.nick)}</b>` : `<button class="gn-nick" data-action="gn-dm-from" data-value="${p.id}:0" title="쪽지 보내기">${esc(p.nick)}</button>`}
      <span>${esc(p.date)}</span><span>조회 ${p.views.toLocaleString()}</span><span>추천 ${p.votes.toLocaleString()}</span><span class="gn-no">#${p.id}</span></div>
    <div class="gn-post-body">${body(p.body)}</div>
    <div class="gn-post-act">
      <button class="gx-mini" data-action="gn-comment" data-value="${p.id}">댓글 쓰기</button>
      <button class="gx-mini" data-action="wiki-goto" data-value="${esc(p.title)}">위키</button>
      ${p.mine ? `<button class="gx-mini${confirm ? ' danger' : ''}" data-action="gn-del-post" data-value="${p.id}">${confirm ? '정말 삭제' : '글 삭제'}</button>` : ''}
    </div>
    ${composing ? composeBox(c, busy) : ''}
    <h3 class="gn-ccount">전체 댓글 ${p.comments.length}</h3>
    ${p.comments.length ? `<ul class="gn-comments">${commentTree(p, me)}</ul>` : '<p class="gx-none">아직 댓글이 없어요.</p>'}
  </div>`;
}

function boardView(st: GState, me: string, busy: boolean): string {
  const c = gnet.compose;
  const top = c && c.kind === 'post' ? composeBox(c, busy) : '';
  if (!st.posts.length) return `${top}<p class="gx-none">게시글이 없어요. 새로고침을 눌러 불러오세요.</p>`;
  const rows = st.posts
    .map((p) => {
      const open = gnet.open === p.id;
      return `<li class="gn-row${open ? ' open' : ''}${p.mine ? ' mine' : ''}">
        <button class="gn-row-main" data-action="gn-open" data-value="${p.id}" aria-expanded="${open}">
          <span class="gn-title">${esc(p.title)}${p.comments.length ? ` <em>[${p.comments.length}]</em>` : ''}${postUnread(p) ? '<span class="gn-dot" aria-label="새 댓글"></span>' : ''}</span>
          <span class="gn-row-meta"><span>${esc(p.nick)}</span><span>${esc(time(p.date))}</span><span>조회 ${p.views.toLocaleString()}</span><span>추천 ${p.votes.toLocaleString()}</span></span>
        </button>${open ? postView(p, me, busy) : ''}</li>`;
    })
    .join('');
  return `${top}<ul class="gn-list">${rows}</ul>`;
}

function dmView(st: GState, busy: boolean): string {
  const c = gnet.compose;
  const top = c?.kind === 'newdm' || (c?.kind === 'dm' && !st.dms.some((d) => d.nick === c.nick)) ? composeBox(c, busy) : '';
  const threads = dmThreads(st);
  if (!threads.length) return `${top}<p class="gx-none">주고받은 쪽지가 없어요. 게시판에서 닉네임을 누르거나 ✉ 쪽지로 보낼 수 있어요.</p>`;
  const rows = threads
    .map((t) => {
      const open = gnet.openDm === t.nick;
      const confirm = gnet.confirm === `d:${t.nick}`;
      const bubbles = open
        ? `<div class="gn-thread">${st.sources[t.nick] ? `<p class="gx-muted">처음 이어진 글: 「${esc(st.sources[t.nick].title)}」</p>` : ''}
          ${t.rows.map((d) => `<div class="gn-bubble ${d.side}"><div>${body(d.body)}</div><small>${d.side === 'me' ? '보냄' : '받음'}${d.date ? ` · ${esc(d.date)}` : ''}</small></div>`).join('')}
          ${c?.kind === 'dm' && c.nick === t.nick ? composeBox(c, busy) : `<div class="gn-post-act"><button class="gx-mini" data-action="gn-dm-reply" data-value="${esc(t.nick)}">답장하기</button>
          <button class="gx-mini${confirm ? ' danger' : ''}" data-action="gn-del-thread" data-value="${esc(t.nick)}">${confirm ? '정말 삭제' : '삭제'}</button></div>`}</div>`
        : '';
      return `<li class="gn-row${open ? ' open' : ''}"><button class="gn-row-main" data-action="gn-open-dm" data-value="${esc(t.nick)}" aria-expanded="${open}">
        <span class="gn-title">${esc(t.nick)}${t.unread ? `<span class="gx-badge hot">새 쪽지 ${t.unread}</span>` : ''}</span>
        <span class="gn-row-meta"><span>${t.rows.length}통</span>${t.lastDate ? `<span>${esc(t.lastDate)}</span>` : ''}</span></button>${bubbles}</li>`;
    })
    .join('');
  return `${top}<ul class="gn-list">${rows}</ul>`;
}

function settingsView(ctx: ChatContext): string {
  const v = (k: string) => String(ctx.chat.scriptstate?.[CFG(k)] ?? GN_DEFAULTS[k]);
  const text = (k: string, ph: string) => `<input class="gx-search" data-change="gn-text" data-key="${k}" value="${esc(v(k) === '-' ? '' : v(k))}" placeholder="${esc(ph)}">`;
  const keep = gnetRetention(ctx.chat.scriptstate);
  const on = v('mode') !== '0';
  return `<details class="nw-req gn-settings" data-keep="gn-settings"${keepOpen('gn-settings', !on)}><summary>괴담넷 설정</summary><div class="nw-settings">
    <label>괴담넷 사용</label>${seg('power', on ? '1' : '0', [['1', '켜기'], ['0', '끄기']])}
    ${on ? `<label>모델</label>${seg('mode', v('mode') === '1' ? '1' : '2', [['1', '메인'], ['2', '보조']])}
    <label>새로고침</label>${seg('lazy', v('lazy') === '0' ? '0' : '1', [['1', '수동'], ['0', '본편 응답마다']])}
    <label>게시글 수</label>${seg('quantity', v('quantity'), Object.entries(QUANTITY).map(([k, q]) => [k, q.label]))}
    <label>사생활</label>${seg('privacy', v('privacy'), [['0', '이목집중'], ['1', '자율'], ['2', '약보호'], ['3', '강보호'], ['4', '언급금지']])}
    <label>주제</label>${text('subject', '비우면 세계관에 맞는 다양한 주제')}
    <label>분위기·말투</label>${text('mood', '비우면 익명 커뮤니티 말투')}
    <label>보호 대상</label>${text('protagonist', '비우면 주인공')}
    <label>새로고침 시 내 글</label>${seg('keepown', v('keepown'), [['1', '유지'], ['0', '교체']])}
    <label>내 댓글 있는 글</label>${seg('keepreplied', v('keepreplied'), [['1', '유지'], ['0', '교체']])}
    <label>선쪽지 받기</label>${seg('incoming', v('incoming') === '0' ? '0' : '1', [['1', '받기'], ['0', '안 받기']])}
    <label>본편에 반영</label>${seg('context', v('context') === '1' ? '1' : '0', [['0', '포함'], ['1', '빼기']])}
    <label>다양성 강화</label>${seg('sampling', v('sampling') === '1' ? '1' : '0', [['0', '끄기'], ['1', '켜기']])}
    <label>쪽지 자동 정리</label><div class="ph-inline">${seg('storage', keep.auto ? '1' : '0', [['1', '켜기'], ['0', '끄기']])}${keep.auto ? `<input class="gx-search ph-pct" type="number" min="1" max="${STORAGE_MAX}" data-change="gn-keep" value="${keep.limit}" aria-label="상대별 쪽지 보관 상한"><span>통</span>` : ''}</div>` : ''}
  </div><p class="gx-muted">${on
    ? `새로고침을 본편 응답마다로 두면 본편 응답이 끝날 때마다 게시판을 새로 불러와요(모델을 한 번 더 불러요). 본편에 반영을 켜면 최근 글 5개와 쪽지가 본편 요청에 참고 기록으로 붙어요. 쪽지 자동 정리는 상대마다 최근 ${keep.limit}통만 남겨요.`
    : '괴담넷을 끄면 게시판 생성과 본편 반영을 멈춰요. 저장된 글과 쪽지는 그대로 남아요.'}</p></details>`;
}

export function gnetTab(ctx: ChatContext, env?: GnetEnv): string {
  if (env) liveEnv = env;
  if (!gnetSettings(ctx.chat.scriptstate).enabled) {
    return `<main class="gx-body gn"><div class="gx-empty">괴담넷이 꺼져 있어요. 아래 설정에서 켜면 다시 쓸 수 있어요.</div>${settingsView(ctx)}</main>`;
  }
  const st = readGnet(ctx.chat);
  const me = userNick(ctx.chat.scriptstate);
  const job = jobs.get(chatKey(ctx));
  const busy = !!job;
  const unreadDm = st.dms.filter((d) => d.unread).length;
  const nick = gnet.editNick
    ? `<div class="gn-nickform"><input class="gx-search" name="gn-nick" data-enter="gn-nick-save" value="${esc(me === '익명' && !ctx.chat.scriptstate?.[GN_NICK] ? '' : me)}" placeholder="익명" maxlength="36" aria-label="내 닉네임"><button class="gx-mini" data-action="gn-nick-save" data-take="gn-nick">저장</button></div>`
    : `<button class="gn-nickbtn" data-action="gn-nick" title="닉네임 바꾸기">${esc(me)} ✎</button>`;
  const fail = gnet.failure
    ? `<details class="nw-fail"><summary>최근 실패 원문</summary><p>${esc(gnet.failure.reason)}</p><textarea class="gx-search" rows="6" readonly>${esc(gnet.failure.raw)}</textarea></details>`
    : '';
  return `<main class="gx-body gn">
    <div class="gn-top"><div class="gx-segs gx-segs-sm">
      <button class="gx-seg${gnet.sub === 'board' ? ' on' : ''}" data-action="gn-sub" data-value="board">게시판${boardUnread(st) ? '<span class="gn-dot"></span>' : ''}</button>
      <button class="gx-seg${gnet.sub === 'dm' ? ' on' : ''}" data-action="gn-sub" data-value="dm">쪽지함${unreadDm ? ` <b class="gn-count">${unreadDm}</b>` : dmUnread(st) ? '<span class="gn-dot"></span>' : ''}</button>
    </div>${nick}</div>
    ${job ? `<div class="nw-busy" role="status"><span class="nw-spin"></span>${esc(job)} 창을 닫아도 계속돼요.</div>` : ''}
    ${gnet.notice ? `<div class="gx-hint gn-notice" role="status">${esc(gnet.notice)}</div>` : ''}
    <div class="gn-actions">
      <button class="gx-mini" data-action="gn-refresh" ${busy ? 'disabled' : ''}>↻ 새로고침</button>
      <button class="gx-mini" data-action="gn-write">✎ 글쓰기</button>
      <button class="gx-mini" data-action="gn-newdm">✉ 쪽지</button>
    </div>
    ${gnet.sub === 'board' ? boardView(st, me, busy) : dmView(st, busy)}
    ${fail}${settingsView(ctx)}
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

/** 본편 응답이 끝난 뒤 (main.ts). 설정이 본편 응답마다일 때, 같은 응답에는 한 번만 (원본 lazy=0) */
export async function autoRefreshGnet(ctx: ChatContext, messageIndex: number): Promise<void> {
  const s = gnetSettings(ctx.chat.scriptstate);
  if (!s.enabled || !s.auto || jobs.has(chatKey(ctx))) return;
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
  await refreshBoard({ ...ctx, chat: saved }, target, true);
  if (target !== env) gnet.notice = notice;
}

/** 괴담넷 탭 버튼. 처리했으면 true */
export async function handleGnet(action: string, value: string | undefined, ctx: ChatContext, env: GnetEnv): Promise<boolean> {
  liveEnv = env;
  const v = value ?? '';
  const [a, b] = v.split(':').map(Number);
  const st = () => readGnet(ctx.chat);
  if (!action.startsWith('gn-')) return false;
  if (action !== 'gn-del-post' && action !== 'gn-del-comment' && action !== 'gn-del-thread') gnet.confirm = null;
  switch (action) {
    case 'gn-sub':
      gnet.sub = v === 'dm' ? 'dm' : 'board';
      if (gnet.compose?.kind !== 'post' || gnet.sub !== 'board') gnet.compose = null;
      break;
    case 'gn-open': {
      gnet.open = gnet.open === a ? null : a;
      if (gnet.compose?.kind === 'comment') gnet.compose = null;
      const p = gnet.open !== null ? findPost(st(), gnet.open) : undefined;
      if (p && postUnread(p)) {
        const id = p.id;
        await mutate(ctx, env, (s) => acknowledge(s, id), {}, false);
        return true;
      }
      break;
    }
    case 'gn-open-dm': {
      gnet.openDm = gnet.openDm === v ? null : v;
      if (gnet.compose?.kind === 'dm') gnet.compose = null;
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
      gnet.sub = 'board';
      gnet.compose = { kind: 'post' };
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-newdm':
      gnet.sub = 'dm';
      gnet.compose = { kind: 'newdm' };
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-comment':
      gnet.compose = { kind: 'comment', post: a, parent: 0, label: '댓글' };
      gnet.draft = '';
      gnet.attach = [];
      break;
    case 'gn-reply': {
      const c = findPost(st(), a)?.comments[b - 1];
      if (!c) break;
      gnet.compose = { kind: 'comment', post: a, parent: b, label: `${c.nick}에게 답글` };
      gnet.draft = '';
      gnet.attach = [];
      break;
    }
    case 'gn-dm-from': {
      const p = findPost(st(), a);
      const contact = p && (b > 0 ? p.comments[b - 1] : p);
      if (!p || !contact || contact.mine) break;
      gnet.sub = 'dm';
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
      const c = gnet.compose;
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
