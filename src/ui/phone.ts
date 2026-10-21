// 「괴담톡」 탭: 연락처·대화방·공지·전화. 원본 괴담톡(폰)과 같은 저장 형식과 규칙.
// 생성은 보내기·방 새로고침·단톡 만들기·초대·새 메시지 확인을 눌렀을 때, 그리고 (설정이 켜져 있으면) 채팅 응답이 끝날 때마다 한 번.
// 생성은 창을 닫아도 계속되고 끝나면 원래 채팅에 저장한다.
import { composeBody, describe, previewText, type UserKind } from '../core/attach';
import { keepOpen } from './panels';
import { attachAction, attachBody, attachEditor, attachInput, emptyAttachment, type Attachments } from './attach';
import {
  applyEvents, bulletinUnread, callRecord, commitAnnouncements, commitInvitations, contactDetails, cooldownMark, directory, LIMITS, listedRooms,
  membership, parseRefresh, parseReply, personOf, phoneSettings, phoneTime, phoneValue, PH, PH_AUTO_LAST, PH_CONTACTS, PhoneError, push, readBulletins,
  readCustom, readPhone, readRoom, refreshAllowed, roomLabel, unreadCount, unsolicited, keepValid, lastReply, validCallTarget, writeBulletins, writePhone,
  chancePassed, type Contact, type Directory, type PRoom, type PState, contactId, splitRecords, noticeSettings, phoneStorage, STORAGE_MAX, NOTICE_PAGE_SIZES, hiddenPause, noticeLabel,
} from '../core/phone';
import { refreshPrompt, refreshRetry, replyPrompt } from '../core/phonePrompt';
import { agentFace, imageUrl, stChip } from './images';
import { readWorld, worldOn } from '../core/world/output';
import { ICONS } from './icons';
import { josa } from '../core/josa';
import { defaultsAction, defaultsButtons, defaultsConfirm } from './defaults';
import { toast } from './toast';
import { drawerHtml } from './drawer';
import type { RefSource } from '../core/refs';
import { tokens } from '../core/gnet';
import type { Chat } from '../core/types';
import { factionNames, parseCatalog } from '../core/world/catalog';
import { generate as askModel } from '../host/llm';
import type { Joint } from '../host/joint';
import { advNum, budgetFor, genSettings } from '../core/advanced';
import { advancedBox } from './advanced';
import { fitPrompt } from '../core/budget';
import { personaText } from '../host/user';
import { playerSource } from '../core/player';
import { saveVarDefaults } from '../host/prefs';
import { updateChat, type ChatContext } from '../host/risu';

type Sub = 'contacts' | 'chats' | 'notices';

interface PhoneUi {
  sub: Sub;
  tab: string;
  query: string;
  view: 'list' | 'room' | 'group' | 'call' | 'add' | 'settings' | 'notice';
  /** 작성칸 + 버튼으로 연 첨부 메뉴 */
  attachMenu: boolean;
  pickQuery: string;
  room: string | null;
  invite: string | null;
  picked: string[];
  topic: string;
  gname: string;
  draft: string;
  page: number;
  call: string;
  callText: string;
  addName: string;
  addNote: string;
  openNotice: number | null;
  noticePage: number;
  attach: Attachments;
  confirm: string | null;
  notice: string;
  failure: { label: string; reason: string; raw: string } | null;
  /** 대화·공지 목록: 전체 / 안 읽음만 */
  chatFilter: 'all' | 'unread';
  noticeFilter: 'all' | 'unread';
  /** 공지 목록: 이 세력 공지만 (빈칸 = 모두). 세력이 둘 이상 섞였을 때만 고를 수 있다 */
  noticeFaction: string;
  /** 단톡 만들기·초대 목록의 소속 탭 */
  pickTab: string;
}

export const phone: PhoneUi = {
  sub: 'contacts', tab: '', query: '', view: 'list', room: null, invite: null, picked: [], topic: '', gname: '', draft: '', page: 1, call: '', callText: '',
  addName: '', addNote: '', openNotice: null, noticePage: 1, attach: [], confirm: null, notice: '', failure: null, attachMenu: false, pickQuery: '',
  chatFilter: 'all', noticeFilter: 'all', noticeFaction: '', pickTab: '',
};

export function resetPhone() {
  Object.assign(phone, {
    sub: 'contacts', tab: '', query: '', view: 'list', room: null, invite: null, picked: [], topic: '', gname: '', draft: '', page: 1, call: '', callText: '',
    addName: '', addNote: '', openNotice: null, noticePage: 1, attach: [], confirm: null, notice: '', failure: null, attachMenu: false, pickQuery: '',
    chatFilter: 'all', noticeFilter: 'all', noticeFaction: '', pickTab: '',
  });
}

export interface PhoneEnv {
  render(): void;
  refresh(): Promise<void>;
  /** 괴담톡 탭이 지금 화면에 떠 있는지 (받은 말풍선을 바로 읽음 처리할지) */
  visible(): boolean;
  /** 전화 기록을 남긴 뒤 창을 닫는다 */
  close(): Promise<void>;
}

const quietEnv: PhoneEnv = { render: () => {}, refresh: async () => {}, visible: () => false, close: async () => {} };
let liveEnv: PhoneEnv | null = null;
const envOr = (env?: PhoneEnv) => env ?? liveEnv ?? quietEnv;

const PAGE = 40;
const jobs = new Map<string, string>();
const chatKey = (ctx: { charIndex: number; chatIndex: number }) => `${ctx.charIndex}:${ctx.chatIndex}`;
export const phoneBusy = (ctx: { charIndex: number; chatIndex: number }) => jobs.has(chatKey(ctx));

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const source = (ctx: ChatContext, chat = ctx.chat): RefSource => playerSource({ char: ctx.char as RefSource['char'], chat, persona: personaText() } as RefSource);

function names(ctx: ChatContext): Record<string, string> {
  try {
    return factionNames(parseCatalog(ctx.char.globalLore), String(ctx.chat.scriptstate?.['$st_faction'] ?? ''));
  } catch {
    return {};
  }
}

function dir(ctx: ChatContext, chat = ctx.chat): Directory {
  return directory(ctx.char.globalLore, chat);
}

const token = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

async function run(ctx: ChatContext, env: PhoneEnv, label: string, work: () => Promise<string>): Promise<boolean> {
  const key = chatKey(ctx);
  if (jobs.has(key)) {
    phone.notice = `${jobs.get(key)} 끝난 뒤 다시 눌러 주세요.`;
    env.render();
    return false;
  }
  jobs.set(key, label);
  phone.notice = '';
  phone.failure = null;
  env.render();
  try {
    phone.notice = await work();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    phone.notice = msg;
    const raw = (error as { raw?: string }).raw;
    if (raw) phone.failure = { label, reason: msg, raw };
  } finally {
    jobs.delete(key);
    await env.refresh();
  }
  return true;
}

function viewingRoom(env: PhoneEnv): string | null {
  return env.visible() && phone.view === 'room' ? phone.room : null;
}

// ── 생성 ──

/** 대기 중인 요청(보내기·단톡 시작·초대·방 새로고침)에 대한 답장 한 번 (원본 generate) */
function generate(ctx: ChatContext, env: PhoneEnv, rid: string, label: string) {
  return run(ctx, env, label, async () => {
    const req = token();
    const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const st = readPhone(chat);
      const r = st.rooms[rid];
      if (!r?.pending) return null;
      r.pending.status = 'working';
      (r.pending as { request?: string }).request = req;
      return writePhone(chat, st);
    });
    if (!saved) throw new PhoneError('대기 중인 대화 요청이 없어요.');
    const st = readPhone(saved);
    const r = st.rooms[rid];
    const d = dir(ctx, saved);
    let raw = '';
    let result: ReturnType<typeof parseReply>;
    try {
      const prompt = fitPrompt(budgetFor(saved.scriptstate, 'ph'), () => replyPrompt(source(ctx, saved), st, r, d, names(ctx)));
      ({ raw, value: result } = await askModel(prompt.messages, phoneSettings(saved.scriptstate).model, (x) => parseReply(x, r, prompt.contactMode), { ...genSettings(saved.scriptstate), state: saved.scriptstate }));
    } catch (error) {
      await markFailed(ctx, rid, req);
      const msg = error instanceof Error ? error.message : String(error);
      throw new PhoneError(`대화 갱신에 실패했어요. 기존 기록은 그대로예요. ${msg}`, (error as { raw?: string }).raw ?? raw);
    }
    let note = '';
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      const cur = readPhone(chat);
      const room = cur.rooms[rid];
      if (!room?.pending || (room.pending as { request?: string }).request !== req) {
        note = '대화 상태가 바뀌어서 답장을 저장하지 않았어요.';
        return null;
      }
      const events = keepValid(result.events, room);
      const unsolicitedRefresh = room.pending.action.type === 'refresh' && unsolicited(room);
      const added = applyEvents(cur, room, events, phoneTime(chat));
      room.pending = undefined;
      if (viewingRoom(env) === rid) readRoom(room);
      if (!added) note = room.kind === 'group' ? '아무도 말하지 않았어요.' : '답장이 없어요.';
      return writePhone(chat, cur, unsolicitedRefresh && added ? cooldownMark(chat, 'incoming') : {});
    });
    return note;
  });
}

async function markFailed(ctx: ChatContext, rid: string, req: string) {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readPhone(chat);
    const r = st.rooms[rid];
    if (!r?.pending || (r.pending as { request?: string }).request !== req) return null;
    r.pending.status = 'error';
    return writePhone(chat, st);
  }).catch(() => null);
}

async function send(ctx: ChatContext, env: PhoneEnv, rid: string, text: string) {
  if (phoneBusy(ctx)) {
    phone.notice = `${jobs.get(chatKey(ctx))} 끝난 뒤 다시 눌러 주세요.`;
    return env.render();
  }
  if (tokens(describe(text)) > LIMITS.input_tokens) {
    phone.notice = `메시지와 첨부 내용은 합쳐서 ${LIMITS.input_tokens}토큰 이내로 적어 주세요.`;
    return env.render();
  }
  let giftBlocked = false;
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readPhone(chat);
    const r = st.rooms[rid];
    if (!r || r.pending) return null;
    if (r.kind !== 'dm' && /\[\[ATTACH:gift\]\]/i.test(text)) return void (giftBlocked = true), null;
    if (!st.order.includes(rid)) st.order.push(rid);
    // 첨부는 하나씩 따로, 함께 쓴 글은 그 뒤 한 말풍선 (원본 AT.records)
    const time = phoneTime(chat);
    const pieces = splitRecords(text);
    let m = push(st, r, 'me', pieces[0] ?? text, time);
    for (const piece of pieces.slice(1)) m = push(st, r, 'me', piece, time);
    r.draft = '';
    r.silent = false;
    readRoom(r);
    r.pending = { message: m.id, status: 'error', action: { type: 'send' } };
    return writePhone(chat, st);
  });
  if (!saved) {
    phone.notice = giftBlocked ? '단톡방에서는 선물을 보낼 수 없어요.' : '이전 답장을 다시 시도하거나 건너뛴 뒤 보내 주세요.';
    return env.refresh();
  }
  phone.draft = '';
  phone.attach = [];
  phone.attachMenu = false;
  phone.page = 1;
  const r = readPhone(saved).rooms[rid];
  await generate({ ...ctx, chat: saved }, env, rid, `${roomLabel(r)}의 답장을 기다리는 중이에요.`);
}

/** 방 하나만 새 메시지 확인 (원본 ph_room_refresh) */
async function roomRefresh(ctx: ChatContext, env: PhoneEnv, rid: string) {
  const st = readPhone(ctx.chat);
  const r = st.rooms[rid];
  if (!r || !r.members.length) return;
  if (r.pending) return void generate(ctx, env, rid, `${josa(roomLabel(r), '을', '를')} 확인하는 중이에요.`);
  const set = phoneSettings(ctx.chat.scriptstate);
  let [ok, why] = refreshAllowed(ctx.chat, r, set);
  if (ok && unsolicited(r)) [ok, why] = refreshAllowed(ctx.chat, r, set, chancePassed(set.incomingChance, Math.random));
  if (!ok) {
    phone.notice = `${why} 내가 보낸 메시지의 답장에는 이 제한이 없어요.`;
    return env.render();
  }
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const cur = readPhone(chat);
    const room = cur.rooms[rid];
    if (!room || room.pending) return null;
    room.pending = { status: 'error', action: { type: 'refresh' } };
    return writePhone(chat, cur);
  });
  if (saved) await generate({ ...ctx, chat: saved }, env, rid, `${josa(roomLabel(r), '을', '를')} 확인하는 중이에요.`);
}

/** 단톡 만들기 또는 초대 (원본 ph_group_create) */
async function createGroup(ctx: ChatContext, env: PhoneEnv) {
  const d = dir(ctx);
  const members = phone.picked.filter((cid) => d.map.get(cid)?.visible);
  const inviteRoom = phone.invite;
  if (!members.length) {
    phone.notice = '초대할 사람을 골라 주세요.';
    return env.render();
  }
  if (!inviteRoom && members.length === 1) {
    phone.picked = [];
    return openDm(ctx, env, members[0]);
  }
  const topic = phone.topic.trim();
  const gname = inviteRoom ? '' : phone.gname.trim();
  if ([...gname].length > LIMITS.room_name) {
    phone.notice = `단톡방 이름은 ${LIMITS.room_name}자 이내로 적어 주세요.`;
    return env.render();
  }
  if (tokens(topic) > LIMITS.topic_tokens) {
    phone.notice = `단톡 주제는 ${LIMITS.topic_tokens}토큰 이내로 적어 주세요.`;
    return env.render();
  }
  let rid = '';
  let error = '';
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readPhone(chat);
    const time = phoneTime(chat);
    if (inviteRoom) {
      let r = st.rooms[inviteRoom];
      if (!r || r.pending) return void (error = '대화방 상태가 바뀌었어요.'), null;
      const fresh = members.filter((cid) => !r!.members.includes(cid));
      if (!fresh.length || r.members.length + fresh.length > LIMITS.members) return void (error = `초대할 사람을 고르세요. 상대는 최대 ${LIMITS.members}명이에요.`), null;
      if (r.kind === 'dm') {
        const old = r.id;
        do st.seq += 1;
        while (st.rooms[`g_${st.seq}`]);
        r = { ...r, id: `g_${st.seq}`, kind: 'group', name: undefined };
        delete st.rooms[old];
        st.rooms[r.id] = r;
        const at = st.order.indexOf(old);
        if (at >= 0) st.order[at] = r.id;
        else st.order.push(r.id);
      }
      for (const cid of fresh) {
        r.people[cid] = personOf(d.map.get(cid)!);
        r.members.push(cid);
      }
      for (const cid of fresh) membership(st, r, 'invite', cid, time);
      r.pending = { status: 'error', action: { type: 'invite_more', invited: fresh } };
      rid = r.id;
    } else {
      if (members.length > LIMITS.members) return void (error = `상대는 최대 ${LIMITS.members}명이에요.`), null;
      st.seq += 1;
      rid = `g_${st.seq}`;
      const people = Object.fromEntries(members.map((c) => [c, personOf(d.map.get(c)!)]));
      const r: PRoom = { id: rid, kind: 'group', name: gname || undefined, topic, members: [...members], people, messages: [], draft: '', unread: 0 };
      st.rooms[rid] = r;
      st.order.push(rid);
      for (const cid of members) membership(st, r, 'invite', cid, time);
      r.pending = { status: 'error', action: { type: 'invite_initial', invited: members } };
    }
    return writePhone(chat, st);
  });
  if (!saved) {
    phone.notice = error || '저장하지 못했어요.';
    return env.render();
  }
  Object.assign(phone, { invite: null, picked: [], topic: '', gname: '', room: rid, view: 'room', sub: 'chats', page: 1 });
  await generate({ ...ctx, chat: saved }, env, rid, inviteRoom ? '초대한 사람들의 반응을 기다리는 중이에요.' : '단톡방을 여는 중이에요.');
}

/** 전체 새 메시지 확인 (원본 refreshInbox). automatic: 채팅 응답 뒤 자동 확인 */
export function refreshInbox(ctx: ChatContext, env?: PhoneEnv, automatic = false, joint?: Joint) {
  const e = envOr(env);
  return run(ctx, e, automatic ? '새 메시지를 자동으로 확인하는 중이에요.' : '새 메시지를 확인하는 중이에요.', async () => {
    const startLength = ctx.chat.message?.length ?? 0;
    const st = readPhone(ctx.chat);
    const d = dir(ctx);
    // 확률 검사(Math.random)는 처음 한 번만: 토큰 상한에 맞춰 다시 만들 때는 같은 결과를 쓴다
    const rolls: number[] = [];
    let k = 0;
    const roll = () => (k < rolls.length ? rolls[k++] : (rolls.push(Math.random()), k++, rolls[rolls.length - 1]));
    const plan = fitPrompt(budgetFor(ctx.chat.scriptstate, 'ph'), () => {
      k = 0;
      const p = refreshPrompt(source(ctx), st, d, names(ctx), roll);
      return { ...p, messages: p.prompt?.messages ?? [] };
    });
    if (!plan.prompt) return automatic ? '' : plan.reason;
    const prompt = plan.prompt;
    const model = phoneSettings(ctx.chat.scriptstate).model;
    // 원본 설정(실패 시 재시도)과 같이 같은 자료로 다시 (횟수·모델은 고급 설정 → 생성 공통)
    const { value: result } = await askModel(prompt.messages, model, (raw) => parseRefresh(raw, plan.selected, plan.receive, plan.announce, plan.invite, st, d, prompt.contactMode), {
      ...genSettings(ctx.chat.scriptstate),
      state: ctx.chat.scriptstate,
      fix: (_raw, reason) => refreshRetry(prompt, reason),
      first: joint && ((m) => joint.ask('phone', m)),
    });
    let note = '';
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      if (automatic && (chat.message?.length ?? 0) !== startLength) {
        note = '채팅이 이어져서 이번 자동 확인 결과는 저장하지 않았어요.';
        return null;
      }
      const cur = readPhone(chat);
      const set = phoneSettings(chat.scriptstate);
      const time = phoneTime(chat);
      let received = 0;
      let unsolicitedGot = false;
      for (const u of result.updates) {
        const r = cur.rooms[u.room] ?? plan.selected.get(u.room)!;
        if (r.pending) throw new PhoneError('확인하는 동안 대화 상태가 바뀌었어요. 다시 확인해 주세요.');
        if (u.events.length && !refreshAllowed(chat, r, set)[0]) throw new PhoneError('선톡 받기 설정이 바뀌었어요.');
        u.events = keepValid(u.events, r);
      }
      const visible = viewingRoom(e);
      for (const u of result.updates) {
        if (!u.events.length) continue;
        let r = cur.rooms[u.room];
        const talk = u.events.some((x) => x.type === 'message');
        if (!r && !talk) continue;
        if (!r) {
          r = plan.selected.get(u.room)!;
          cur.rooms[r.id] = r;
          cur.order.push(r.id);
        }
        if (talk && unsolicited(r)) unsolicitedGot = true;
        received += applyEvents(cur, r, u.events, time);
        if (visible === r.id) readRoom(r);
      }
      received += commitInvitations(cur, result.invitations, time);
      const b = readBulletins(chat);
      const notices = commitAnnouncements(b, cur, result.announcements, plan.announce, time);
      const marks = {
        ...(unsolicitedGot ? cooldownMark(chat, 'incoming') : {}),
        ...(result.invitations.length ? cooldownMark(chat, 'invitation') : {}),
        ...(notices ? cooldownMark(chat, 'announcement') : {}),
      };
      note = received || result.invitations.length || notices
        ? `메시지 ${received}개 · 단톡 초대 ${result.invitations.length}개 · 공지 ${notices}개를 받았어요.`
        : automatic ? '' : '새 메시지가 없어요.';
      return writePhone(chat, cur, { ...writeBulletins(b, chat.scriptstate), ...marks });
    });
    return note;
  });
}

/** 채팅 응답이 끝난 뒤 (main.ts onOutput), 또는 「창을 열 때」면 괴담톡 탭을 열 때 (openCheck). 같은 응답에는 한 번만 */
export async function autoRefresh(ctx: ChatContext, messageIndex: number, env?: PhoneEnv, joint?: Joint): Promise<void> {
  const set = phoneSettings(ctx.chat.scriptstate);
  if (!(env ? set.autoOpen : set.auto) || phoneBusy(ctx)) return;
  const data = String(ctx.chat.message?.[messageIndex]?.data ?? '');
  if (!data.trim()) return;
  let hash = 7;
  for (let i = 0; i < data.length; i++) hash = (hash * 131 + data.charCodeAt(i)) % 2147483647;
  const stamp = `${messageIndex}:${hash}`;
  if (String(ctx.chat.scriptstate?.[PH_AUTO_LAST] ?? '') === stamp) return;
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [PH_AUTO_LAST]: stamp } }));
  if (!saved) return;
  try {
    directory(ctx.char.globalLore, saved);
  } catch {
    return; // 괴담톡 로어북이 없는 카드
  }
  await refreshInbox({ ...ctx, chat: saved }, env, true, joint);
}

/** 괴담톡 탭을 열 때: 「창을 열 때」 설정이고 마지막 채팅 응답을 아직 확인하지 않았으면 한 번 확인 */
export function openCheck(ctx: ChatContext, env: PhoneEnv): void {
  if (!phoneSettings(ctx.chat.scriptstate).autoOpen) return;
  const at = lastReply(ctx.chat);
  if (at < 0) return;
  void autoRefresh(ctx, at, env).catch((error) => console.log(`[goei] 괴담톡 확인 실패: ${error instanceof Error ? error.message : String(error)}`));
}

async function openDm(ctx: ChatContext, env: PhoneEnv, cid: string) {
  const d = dir(ctx);
  const c = d.map.get(cid);
  if (!c) return;
  const rid = `dm_${c.id}`;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readPhone(chat);
    dropEmpty(st, rid);
    const r = st.rooms[rid];
    if (r) {
      readRoom(r);
      return writePhone(chat, st);
    }
    st.rooms[rid] = { id: rid, kind: 'dm', members: [c.id], people: { [c.id]: personOf(c) }, messages: [], draft: '', unread: 0, readThrough: 0 };
    return writePhone(chat, st);
  });
  Object.assign(phone, { room: rid, view: 'room', page: 1, draft: '', attach: [], attachMenu: false, confirm: null });
  await env.refresh();
}

/** 상황판 요원 카드의 톡·위키: 요원 번호(P001…)로 연락처를 찾는다 */
export function agentContact(ctx: ChatContext, agentId: string): { id: string; wiki: string } | null {
  const c = dir(ctx).map.get(contactId(agentId));
  return c ? { id: c.id, wiki: c.lore || c.name } : null;
}

/** 상황판에서 바로 그 요원과의 1:1 방을 연다 */
export async function openAgentDm(ctx: ChatContext, env: PhoneEnv, agentId: string): Promise<boolean> {
  const c = agentContact(ctx, agentId);
  if (!c) return false;
  phone.query = '';
  await openDm(ctx, env, c.id);
  return true;
}

/** 말 한마디 없이 나간 빈 1:1 방은 지운다 (원본 clearEmptyRoom) */
function dropEmpty(st: PState, keep: string) {
  const prev = phone.room;
  if (!prev || prev === keep) return;
  const r = st.rooms[prev];
  if (r && !r.messages.length && !r.pending && !r.draft.trim()) {
    delete st.rooms[prev];
    st.order = st.order.filter((x) => x !== prev);
  }
}

async function openRoom(ctx: ChatContext, env: PhoneEnv, rid: string) {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readPhone(chat);
    const r = st.rooms[rid];
    if (!r) return null;
    dropEmpty(st, rid);
    readRoom(r);
    return writePhone(chat, st);
  });
  Object.assign(phone, { room: rid, view: 'room', page: 1, draft: '', attach: [], attachMenu: false, confirm: null });
  await env.refresh();
}

async function mutate(ctx: ChatContext, env: PhoneEnv, f: (st: PState, chat: Chat) => boolean | void, extra: (chat: Chat) => Record<string, string> = () => ({})) {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const st = readPhone(chat);
    if (f(st, chat) === false) return null;
    return writePhone(chat, st, extra(chat));
  });
  await env.refresh();
}

async function setVars(ctx: ChatContext, env: PhoneEnv, vars: Record<string, string>) {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } }));
  await env.refresh();
}

function newMessage(data: string) {
  const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { role: 'user', data, time: Date.now(), chatId: id };
}

/** 전화: 채팅 끝에 전화 기록(유저 메시지)을 남기고 창을 닫는다. 전송을 누르면 본편이 통화로 이어진다 */
async function placeCall(ctx: ChatContext, env: PhoneEnv, target: string, purpose: string) {
  if (!validCallTarget(target)) {
    phone.notice = '상대 이름을 확인해 주세요. (60자 이내, 줄바꿈·괄호 없이)';
    return env.render();
  }
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const message = (chat.message ?? []).slice();
    const last = message[message.length - 1];
    const record = callRecord(target.trim(), purpose);
    // 아직 보내지 않은 전화 기록이 마지막에 있으면 바꿔 끼운다
    if (last?.role === 'user' && String(last.data).includes('%%PHONE_CALL:')) message[message.length - 1] = { ...last, data: record };
    else message.push(newMessage(record));
    return { ...chat, message };
  });
  Object.assign(phone, { view: 'list', call: '', callText: '', notice: '' });
  await env.close();
}

// ── 화면 ──

const bubbleBody = (text: string) => attachBody(text);
/** 괴담톡 첨부 종류 (선물은 1:1만, 원본 AT.check) */
export const phKinds = (r: PRoom): UserKind[] => (r.kind === 'dm' ? ['image', 'photo', 'video', 'file', 'link', 'gift'] : ['image', 'photo', 'video', 'file', 'link']);

const initial = (name: string) => esc([...name][0] ?? '톡');
/** 연락처 사진(카드 에셋, 영문 이름) 또는 첫 글자 */
function face(ctx: ChatContext, who: { name: string; english?: string; custom?: boolean } | undefined, label: string, cls = ''): string {
  const url = who && !who.custom ? imageUrl(ctx.char, agentFace(ctx.char, who.english)) : null;
  return `<span class="ph-avatar${cls}">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : initial(label)}</span>`;
}
const shortTime = (t: string) => /(\d\d:\d\d)/.exec(t)?.[1] ?? '';

function matches(c: Contact, q: string, fnames: Record<string, string>): boolean {
  return `${c.name} ${c.english ?? ''} ${fnames[c.group ?? ''] ?? c.group ?? ''} ${c.rank ?? ''} ${c.department ?? ''} ${c.terms.join(' ')}`.toLowerCase().includes(q);
}

/** short: 모바일에서 아이콘 아래 붙는 짧은 이름 (버튼을 크게 만들어 누르기 쉽게) */
const tool = (action: string, icon: string, label: string, extra = '', short = '') =>
  `<button class="ph-tool" data-action="${action}" aria-label="${label}" title="${label}" ${extra}>${icon}${short ? `<span class="ph-tool-l">${short}</span>` : ''}</button>`;

/** 안 읽은 수: 빨간 동그라미에 흰 숫자 (카톡처럼) */
const badge = (n: number) => (n > 0 ? `<span class="ph-badge">${n > 99 ? '99+' : n}</span>` : '');

/** 목록 위 묶음 칩. count: 이름 오른쪽 작은 개수, alert: 빨간 배지 */
function chips(action: string, cur: string, items: { id: string; label: string; count?: number; alert?: number }[]): string {
  return `<div class="ph-tabs" role="tablist">${items
    .map((t) => `<button class="ph-tab${t.id === cur ? ' on' : ''}" data-action="${action}" data-value="${esc(t.id)}" aria-selected="${t.id === cur}">${esc(t.label)}${t.count !== undefined ? `<small>${t.count}</small>` : ''}${badge(t.alert ?? 0)}</button>`)
    .join('')}</div>`;
}

/** 빈 목록 안내: 목록 칸 한가운데 */
const blank = (text: string) => `<div class="ph-blank"><p>${text}</p></div>`;

/** 상황판의 요원 상태 (작전·비번 등). 상황판이 꺼져 있거나 기록이 없으면 빈 칸 */
function agentStates(ctx: ChatContext): Record<string, string> {
  try {
    if (!worldOn(ctx.chat)) return {};
    return Object.fromEntries(Object.entries(readWorld(ctx.chat).agents).map(([k, v]) => [k, v.st]));
  } catch {
    return {};
  }
}

function contactsView(ctx: ChatContext, d: Directory, st: PState): string {
  if (!d.tabs.length) return blank('이 소속에 공개된 연락처 탭이 없어요. 설정에서 「모든 연락처 공개」를 켤 수 있어요.');
  const tab = d.tabs.some((t) => t.id === phone.tab) ? phone.tab : d.tabs[0].id;
  const head = chips('ph-ctab', tab, d.tabs.map((t) => ({ id: t.id, label: t.name, count: d.contacts.filter((c) => c.tabs.includes(t.id)).length })));
  const rows = d.contacts.filter((c) => c.tabs.includes(tab));
  return head + (rows.length ? contactList(ctx, rows, st) : blank('이 탭에는 아직 연락처가 없어요.'));
}

/** 연락처 줄: 큰 사진, 이름 옆에 상황판 상태 딱지, 아래 직급·소속 */
/** 연락처 이름 옆 말풍선: 이 사람과 나눈 대화가 있으면 (글자 없이 아이콘만, 안 읽은 게 있으면 강조) */
const talking = (room: PRoom | undefined) =>
  room?.messages.some((m) => m.kind === 'message')
    ? `<span class="ph-talk${room.unread ? ' new' : ''}" role="img" aria-label="${room.unread ? '안 읽은 대화' : '대화 중'}">${ICONS.phone}</span>`
    : '';

function contactList(ctx: ChatContext, rows: Contact[], st: PState): string {
  const fnames = names(ctx);
  const states = agentStates(ctx);
  return `<ul class="ph-list ph-contacts">${rows
        .map((c) => {
          const room = st.rooms[`dm_${c.id}`];
          const confirm = phone.confirm === `contact:${c.id}`;
          const on = phone.view === 'room' && phone.room === `dm_${c.id}`;
          return `<li class="ph-row"><button class="ph-main${on ? ' on' : ''}" data-action="ph-dm" data-value="${c.id}">${face(ctx, c, c.name)}
            <span class="ph-who"><span class="ph-who-name"><b>${esc(c.name)}</b>${c.agentId && states[c.agentId] ? stChip(states[c.agentId]) : ''}${talking(room)}</span><small>${esc(contactDetails(c) || (c.custom ? c.note || '직접 추가한 연락처' : fnames[c.group ?? ''] ?? ''))}</small></span>
            ${badge(room?.unread ?? 0)}</button>
            <span class="ph-act"><button class="ph-tool sm" data-action="ph-call" data-value="${esc(c.name)}" title="전화" aria-label="${esc(c.name)}에게 전화">${ICONS.call}</button>
            ${c.custom ? '' : `<button class="ph-tool sm" data-action="wiki-goto" data-value="${esc(c.lore || c.name)}" title="위키" aria-label="${esc(c.name)} 위키">${ICONS.book}</button>`}
            ${c.saved && c.custom ? `<button class="gx-mini${confirm ? ' danger' : ''}" data-action="ph-contact-del" data-value="${c.id}">${confirm ? '정말 삭제' : '삭제'}</button>` : ''}</span></li>`;
        })
        .join('')}</ul>`;
}

function chatRooms(st: PState, q: string) {
  const keys = [...new Set([...listedRooms(st), ...st.order.filter((k) => st.rooms[k]?.pending)])];
  return keys
    .map((k) => st.rooms[k])
    .filter((r) => r && (!q || roomLabel(r).toLowerCase().includes(q) || r.messages.some((m) => m.text.toLowerCase().includes(q))));
}

function chatsView(ctx: ChatContext, st: PState, d: Directory): string {
  const all = chatRooms(st, '');
  if (!all.length) return blank('아직 대화가 없어요.<br>연락처에서 이름을 누르거나 새 메시지 확인을 눌러 보세요.');
  const unread = all.filter((r) => r.unread);
  const head = chips('ph-chat-filter', phone.chatFilter, [
    { id: 'all', label: '전체', count: all.length },
    { id: 'unread', label: '안읽음', alert: unread.reduce((n, r) => n + r.unread, 0) },
  ]);
  const rows = phone.chatFilter === 'unread' ? unread : all;
  return head + (rows.length ? chatList(ctx, rows, d) : blank('안 읽은 대화가 없어요.'));
}

function chatList(ctx: ChatContext, rows: ReturnType<typeof chatRooms>, d: Directory): string {
  return `<ul class="ph-list ph-chats">${rows
    .map((r) => {
      const last = [...r.messages].reverse().find((m) => m.kind === 'message') ?? r.messages[r.messages.length - 1];
      const who = r.kind === 'dm' ? d.map.get(r.members[0]) ?? r.people[r.members[0]] : null;
      const preview = r.pending ? '답장을 기다리는 중…' : last ? (last.kind === 'message' ? `${last.sender === 'me' ? '나: ' : ''}${previewText(last.text)}` : last.text) : '';
      const on = phone.view === 'room' && phone.room === r.id;
      return `<li class="ph-row"><button class="ph-main${on ? ' on' : ''}" data-action="ph-room" data-value="${esc(r.id)}">${r.kind === 'group' ? `<span class="ph-avatar group">${ICONS.group}<i>${r.members.length + 1}</i></span>` : face(ctx, who ?? undefined, roomLabel(r))}
        <span class="ph-who"><span class="ph-who-top"><b>${esc(roomLabel(r))}</b>${last ? `<small class="ph-time">${esc(shortTime(last.time))}</small>` : ''}</span>
        <span class="ph-who-bot"><small class="${r.pending ? 'ph-wait' : ''}">${esc([...preview].slice(0, 60).join(''))}</small>${badge(r.unread)}</span></span></button>${roomDel(r.id, !!r.pending, roomLabel(r))}</li>`;
    })
    .join('')}</ul>`;
}

/** 대화 목록 오른쪽 끝 휴지통 (한 번 더 누르면 삭제) */
function roomDel(id: string, pending: boolean, label: string): string {
  return phone.confirm === `room:${id}`
    ? `<button class="gx-mini danger ph-rdel" data-action="ph-room-del" data-value="${esc(id)}">정말 삭제</button>`
    : `<button class="ph-tool sm ph-rdel" data-action="ph-room-del" data-value="${esc(id)}" title="삭제" aria-label="${esc(label)} 삭제" ${pending ? 'disabled' : ''}>${ICONS.trash}</button>`;
}

const dayOf = (t: string) => /^(\d{4})\.(\d\d)\.(\d\d)/.exec(t);

function roomView(ctx: ChatContext, st: PState, d: Directory, busy: boolean): string {
  const r = phone.room ? st.rooms[phone.room] : undefined;
  if (!r) return '<div class="ph-empty"><p class="gx-none">대화방을 찾지 못했어요.</p></div>';
  const confirm = phone.confirm === `room:${r.id}`;
  const visible = r.messages.filter((m) => m.kind !== 'pause' || !hiddenPause(m.text));
  const shown = visible.slice(-PAGE * phone.page);
  const more = visible.length > shown.length;
  const name = (cid: string) => (d.map.get(cid) ?? r.people[cid])?.name ?? cid;
  const isMsg = (m: (typeof shown)[number] | undefined) => !!m && m.kind === 'message' && m.sender !== 'system';
  let lastDay = '';
  const bubbles = shown
    .map((m, i) => {
      // 날짜가 바뀌면 가운데 줄 (메신저처럼)
      const dm = dayOf(m.time);
      const day = dm ? `${dm[1]}년 ${Number(dm[2])}월 ${Number(dm[3])}일` : '';
      const sep = day && day !== lastDay ? `<div class="ph-day"><span>${day}</span></div>` : '';
      if (day) lastDay = day;
      if (!isMsg(m)) return `${sep}<div class="ph-sys${m.kind === 'pause' ? ' pause' : ''}">${esc(m.text)}</div>`;
      const prev = shown[i - 1];
      const next = shown[i + 1];
      const me = m.sender === 'me';
      const first = !!sep || !isMsg(prev) || prev!.sender !== m.sender;
      // 시각은 같은 사람이 같은 분에 이어 보낸 말풍선 중 마지막에만
      const last = !isMsg(next) || next!.sender !== m.sender || shortTime(next!.time) !== shortTime(m.time) || !!(dayOf(next!.time)?.[0] !== dm?.[0]);
      const unread = me && r.kind === 'dm' && r.pending?.message === m.id && !r.messages.some((x) => x.id > m.id && x.sender !== 'me' && x.kind === 'message');
      const who = d.map.get(m.sender) ?? r.people[m.sender];
      const pic = !me ? (first ? face(ctx, who, name(m.sender), ' ph-face') : '<span class="ph-face-gap"></span>') : '';
      const head = !me && first ? `<b class="ph-name">${esc(name(m.sender))}</b>` : '';
      const meta = last || unread ? `<span class="ph-meta-t">${unread ? '<i>1</i>' : ''}${last ? esc(shortTime(m.time)) : ''}</span>` : '';
      return `${sep}<div class="ph-msg ${me ? 'me' : 'npc'}${first ? ' first' : ''}">${pic}<div class="ph-msg-col">${head}<div class="ph-line"><div class="ph-bubble">${bubbleBody(m.text)}</div>${meta}</div></div></div>`;
    })
    .join('');
  const pending = r.pending
    ? r.pending.status === 'working' || busy
      ? '<div class="ph-msg npc first ph-typing-row"><span class="ph-face-gap"></span><div class="ph-bubble ph-typing" aria-label="입력 중"><i></i><i></i><i></i></div></div>'
      : `<div class="ph-retry"><span>답장을 받지 못했어요.</span><button class="gx-mini" data-action="ph-retry" data-value="${esc(r.id)}">다시 시도</button><button class="gx-mini" data-action="ph-skip" data-value="${esc(r.id)}">건너뛰기</button></div>`
    : '';
  const who = r.kind === 'dm' ? d.map.get(r.members[0]) ?? r.people[r.members[0]] : undefined;
  const sub = r.kind === 'dm' ? contactDetails(who) : `${r.members.length + 1}명${r.topic ? ` · ${r.topic}` : ''}`;
  const off = !r.members.length;
  const locked = !!r.pending || off;
  return `<div class="ph-room">
    <header class="ph-room-head"><button class="ph-tool ph-back" data-action="ph-back" aria-label="목록으로">${ICONS.back}</button>
      ${r.kind === 'group' ? `<span class="ph-avatar group sm">${ICONS.group}</span>` : face(ctx, who, roomLabel(r), ' sm')}
      <div class="ph-room-title"><b>${esc(roomLabel(r))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
      <span class="ph-act">
        ${tool('ph-room-refresh', ICONS.refresh, '이 방 새로고침', `data-value="${esc(r.id)}" ${busy || off ? 'disabled' : ''}`)}
        ${r.kind === 'dm' ? tool('ph-call', ICONS.call, '전화', `data-value="${esc(roomLabel(r))}"`) : ''}
        ${tool('ph-invite', ICONS.addUser, '초대', `data-value="${esc(r.id)}" ${busy || r.pending ? 'disabled' : ''}`)}
        ${confirm ? `<button class="gx-mini danger" data-action="ph-room-del" data-value="${esc(r.id)}">정말 삭제</button>` : tool('ph-room-del', ICONS.trash, '방 삭제', `data-value="${esc(r.id)}" ${r.pending ? 'disabled' : ''}`)}
      </span></header>
    ${r.kind === 'group' ? `<p class="ph-members">참여자: 나, ${esc(r.members.map(name).join(', '))}</p>` : ''}
    <div class="ph-log">${more ? `<button class="gx-mini ph-more" data-action="ph-more">이전 대화 더 보기</button>` : ''}${r.trimmedRecords && !more ? `<div class="ph-sys">오래된 기록 ${r.trimmedRecords}개는 보관 상한으로 정리됐어요.</div>` : ''}${bubbles || '<div class="ph-sys">아직 대화가 없어요. 첫 메시지를 보내 보세요.</div>'}${pending}</div>
    <div class="ph-composer">
      ${off ? '' : attachEditor('ph', phone.attach, phKinds(r), !!r.pending, r.kind === 'dm' ? '' : '선물은 1:1 대화에서만 보낼 수 있어요.', phone.attachMenu)}
      <div class="ph-compose">
        <button class="ph-tool ph-plus${phone.attachMenu ? ' on' : ''}" data-action="ph-att-menu" aria-label="첨부" aria-expanded="${phone.attachMenu}" title="사진·파일·선물 첨부 (사진은 붙여넣기도 돼요)" ${locked ? 'disabled' : ''}>${ICONS.plus}</button>
        <textarea class="ph-input" data-input="ph-draft" rows="1" placeholder="${off ? '참여자가 없어요' : phone.attach.length ? '함께 보낼 메시지 (선택)' : '메시지 입력'}" ${locked ? 'disabled' : ''}>${esc(phone.draft)}</textarea>
        <button class="ph-send" data-action="ph-send" data-value="${esc(r.id)}" aria-label="보내기" title="보내기" ${busy || locked ? 'disabled' : ''}>${ICONS.send}</button>
        <button class="ph-tool ph-back2" data-action="ph-back" aria-label="목록으로" title="목록으로">${ICONS.back}</button>
      </div>
    </div>
  </div>`;
}

/** 단톡 만들기·초대 목록 (검색어를 바꾸면 이 목록만 다시 그린다) */
export function phonePickList(ctx: ChatContext): string {
  let st: PState;
  let d: Directory;
  try {
    st = readPhone(ctx.chat);
    d = dir(ctx);
  } catch (error) {
    return `<p class="gx-none">${esc(error instanceof Error ? error.message : String(error))}</p>`;
  }
  const room = phone.invite ? st.rooms[phone.invite] : undefined;
  const existing = new Set(room?.members ?? []);
  const q = phone.pickQuery.trim().toLowerCase();
  const fnames = names(ctx);
  // 검색어가 있으면 소속과 상관없이, 없으면 고른 소속 탭만
  const tab = pickTabOf(d);
  const rows = d.contacts.filter((c) => !existing.has(c.id) && (q ? matches(c, q, fnames) : !tab || c.tabs.includes(tab)));
  const picked = new Set(phone.picked);
  if (!rows.length) return '<p class="gx-none">고를 수 있는 연락처가 없어요.</p>';
  return rows
    .map((c) => `<li class="ph-row"><button class="ph-main${picked.has(c.id) ? ' on' : ''}" data-action="ph-pick" data-value="${c.id}" aria-pressed="${picked.has(c.id)}">
        <span class="ph-check">${picked.has(c.id) ? '✓' : ''}</span>${face(ctx, c, c.name)}<span class="ph-who"><b>${esc(c.name)}</b><small>${esc(contactDetails(c))}</small></span></button></li>`)
    .join('');
}

function pickTabOf(d: Directory): string {
  const cur = phone.pickTab;
  return d.tabs.some((t) => t.id === cur) ? cur : d.tabs[0]?.id ?? '';
}

function paneHead(title: string, sub: string, right = ''): string {
  return `<header class="ph-room-head"><button class="ph-tool ph-back" data-action="ph-back" aria-label="뒤로">${ICONS.back}</button><div class="ph-room-title"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${right}</header>`;
}

function groupView(ctx: ChatContext, st: PState, d: Directory): string {
  const room = phone.invite ? st.rooms[phone.invite] : undefined;
  const picked = phone.picked.length;
  const existing = new Set(room?.members ?? []);
  const tabs = d.tabs.length > 1
    ? chips('ph-pick-tab', pickTabOf(d), d.tabs.map((t) => ({ id: t.id, label: t.name, count: d.contacts.filter((c) => c.tabs.includes(t.id) && !existing.has(c.id)).length })))
    : '';
  return `<div class="ph-form">
    ${paneHead(room ? `「${esc(roomLabel(room))}」에 초대` : '단톡방 만들기', `${picked}명 선택 · 상대 최대 ${LIMITS.members}명`,
      `<input class="gx-search ph-head-q" data-input="ph-pick-q" value="${esc(phone.pickQuery)}" placeholder="이름·소속 검색" aria-label="초대할 사람 검색">`)}
    <div class="ph-form-body ph-gbody">
      ${room ? '' : `<input class="gx-search ph-gname" data-input="ph-gname" value="${esc(phone.gname)}" maxlength="${LIMITS.room_name}" placeholder="단톡방 이름 (선택, 비우면 참여자 이름)" aria-label="단톡방 이름">`}
      ${room ? '' : `<textarea class="gx-search ph-topic${phone.topic.trim() ? ' filled' : ''}" data-input="ph-topic" rows="1" placeholder="주제·상황 (선택, 비우면 지금 상황에 맞춰 시작)" aria-label="주제·상황">${esc(phone.topic)}</textarea>`}
      ${tabs}
      <ul class="ph-list ph-pick">${phonePickList(ctx)}</ul>
    </div>
    <div class="ph-form-foot"><button class="gx-start" data-action="ph-group-create" ${picked ? '' : 'disabled'}>${room ? '초대하기' : picked === 1 ? '1:1 대화' : '단톡방 만들기'}</button></div>
  </div>`;
}

function noticesView(ctx: ChatContext): string {
  let b;
  try {
    b = readBulletins(ctx.chat);
  } catch (error) {
    return `<p class="gx-none">${esc((error as Error).message)}</p>`;
  }
  const received = [...b.items].reverse();
  if (!received.length) return blank('아직 받은 공지가 없어요.<br>새 메시지 확인 때 소속 공지가 올 수 있어요.');
  // 세력을 바꿔도 지난 공지는 남는다. 세력이 섞였을 때만 세력별로 묶어 보는 칩을 둔다 (사용자 결정 2026-10-19)
  const label = noticeFactionLabel(names(ctx));
  const factions = [...new Set(received.map((r) => r.channel))];
  if (factions.length < 2 || !factions.includes(phone.noticeFaction)) phone.noticeFaction = '';
  const every = phone.noticeFaction ? received.filter((r) => r.channel === phone.noticeFaction) : received;
  const unreadN = every.filter((r) => r.read === false).length;
  const all = phone.noticeFilter === 'unread' ? every.filter((r) => r.read === false) : every;
  const size = noticeSettings(ctx.chat.scriptstate).page;
  const pages = Math.max(1, Math.ceil(all.length / size));
  const page = Math.min(Math.max(1, phone.noticePage), pages);
  const items = all.slice((page - 1) * size, page * size);
  // 대화와 같은 묶음 (전체·안읽음). 오른쪽 끝에 모두 읽음
  const head = `<div class="ph-notice-bar">${chips('ph-notice-filter', phone.noticeFilter, [
    { id: 'all', label: '전체', count: every.length },
    { id: 'unread', label: '안읽음', alert: unreadN },
  ])}${unreadN ? '<button class="gx-mini" data-action="ph-notice-all">모두 읽음</button>' : ''}</div>`
    + (factions.length > 1
      ? `<div class="ph-notice-facs">${factions.map((f) => `<button class="gx-chip${phone.noticeFaction === f ? ' on' : ''}" data-action="ph-notice-faction" data-value="${esc(f)}" aria-pressed="${phone.noticeFaction === f}">${esc(label(f, received.find((r) => r.channel === f)?.channelName))}<small>${received.filter((r) => r.channel === f).length}</small></button>`).join('')}</div>`
      : '');
  if (!all.length) return head + blank('안 읽은 공지가 없어요.');
  const nav = pages > 1
    ? `<div class="ph-pager"><button class="gx-mini" data-action="ph-notice-page" data-value="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ 이전</button><span>${page} / ${pages}</span><button class="gx-mini" data-action="ph-notice-page" data-value="${page + 1}" ${page >= pages ? 'disabled' : ''}>다음 ›</button></div>`
    : '';
  return `${head}${noticeList(items, label)}${nav}`;
}

/** 공지를 받은 세력 이름: 지금 명부 이름 → 받을 때 적어 둔 이름 → 코드 */
function noticeFactionLabel(names: Record<string, string>) {
  return (code: string, saved?: string) => (code ? noticeLabel(code, names) : '') || saved || code || '소속 없음';
}

/** 공지 목록 (v0.16.22, 사용자 설계): 첫 줄 분류 딱지·발신·시각과 오른쪽 끝 휴지통, 둘째 줄 제목. 본문은 오른쪽(모바일은 다음 화면)에 */
function noticeList(items: ReturnType<typeof readBulletins>['items'], label: (code: string, saved?: string) => string): string {
  return `<ul class="ph-list ph-notices">${items
    .map((r) => {
      const on = phone.view === 'notice' && phone.openNotice === r.id;
      const confirm = phone.confirm === `notice:${r.id}`;
      const del = confirm
        ? `<button class="gx-mini danger ph-ndel" data-action="ph-notice-del" data-value="${r.id}">정말 삭제</button>`
        : `<button class="ph-tool sm ph-ndel" data-action="ph-notice-del" data-value="${r.id}" title="삭제" aria-label="${esc(r.title)} 삭제">${ICONS.trash}</button>`;
      // 모바일은 목록 안에서 미리보기 → 펼치기, PC는 목록엔 제목만 두고 본문은 오른쪽 칸 (CSS로 나눈다)
      const open = phone.openNotice === r.id;
      return `<li class="ph-notice${on ? ' on' : ''}${open ? ' open' : ''}${r.read === false ? ' new' : ''}"><button class="ph-ncard" data-action="ph-notice" data-value="${r.id}" aria-pressed="${on}" aria-expanded="${open}">
        <span class="ph-ncard-top"><span class="gx-badge">${esc(r.category)}</span><span class="ph-nfac">${esc(label(r.channel, r.channelName))}</span><small>${esc(r.issuer)}${r.time ? ` · ${esc(r.time)}` : ''}</small></span>
        <span class="ph-ncard-title"><b>${esc(r.title)}</b>${r.read === false ? '<span class="gn-dot" aria-label="안 읽음"></span>' : ''}</span>
</button>${del}
        ${open ? `<div class="ph-notice-body">${esc(r.text).replace(/\n/g, '<br>')}</div>` : ''}</li>`;
    })
    .join('')}</ul>`;
}

/** 공지 본문 (PC 오른쪽 칸, 모바일은 목록 대신) */
function noticeDetail(ctx: ChatContext): string {
  let r;
  try {
    r = readBulletins(ctx.chat).items.find((x) => x.id === phone.openNotice);
  } catch {
    r = undefined;
  }
  if (!r) return '<div class="ph-empty"><p class="gx-none">공지를 찾지 못했어요.</p></div>';
  const confirm = phone.confirm === `notice:${r.id}`;
  const del = confirm
    ? `<button class="gx-mini danger" data-action="ph-notice-del" data-value="${r.id}">정말 삭제</button>`
    : tool('ph-notice-del', ICONS.trash, '공지 삭제', `data-value="${r.id}"`);
  // 공지문 모양: 제목줄(분류·제목·발신·시각) → 본문. 발신처는 한 번만
  return `<div class="ph-form ph-ndoc">${paneHead('공지', '', `<span class="ph-act">${del}</span>`)}
    <article class="ph-ndoc-body">
      <header class="ph-ndoc-head"><span class="gx-badge">${esc(r.category)}</span><h3>${esc(r.title)}</h3>
        <div class="ph-ndoc-meta"><b>${esc(r.issuer)}</b>${r.time ? `<span>${esc(r.time)}</span>` : ''}</div></header>
      <div class="ph-ndoc-text">${esc(r.text).replace(/\n/g, '<br>')}</div>
    </article></div>`;
}

/** 통합 검색 (v0.16.22): 검색어가 있으면 탭과 상관없이 연락처·대화·공지를 한꺼번에 */
function searchView(ctx: ChatContext, st: PState, d: Directory): string {
  const q = phone.query.trim().toLowerCase();
  const fnames = names(ctx);
  const people = d.contacts.filter((c) => matches(c, q, fnames));
  const rooms = chatRooms(st, q);
  let notes: ReturnType<typeof readBulletins>['items'] = [];
  try {
    notes = [...readBulletins(ctx.chat).items].reverse().filter((r) => `${r.title} ${r.text} ${r.issuer}`.toLowerCase().includes(q));
  } catch {
    /* 공지를 못 읽으면 공지만 뺀다 */
  }
  if (!people.length && !rooms.length && !notes.length) return blank('검색 결과가 없어요.');
  const sec = (title: string, n: number, html: string) => (n ? `<h4 class="ph-sec">${title}<b>${n}</b></h4>${html}` : '');
  return sec('연락처', people.length, contactList(ctx, people, st)) + sec('대화', rooms.length, chatList(ctx, rooms, d)) + sec('공지', notes.length, noticeList(notes, noticeFactionLabel(names(ctx))));
}

function callView(): string {
  return `<div class="ph-form">${paneHead('전화 걸기', '기록을 남기고 창을 닫아요. 채팅에서 전송을 누르면 통화 장면이 이어져요.')}
    <div class="ph-form-body">
      <label class="ph-label">상대</label><input class="gx-search" data-input="ph-call-to" value="${esc(phone.call)}" placeholder="상대 이름" maxlength="60">
      <label class="ph-label">할 말·용건 (선택)<small>채팅 입력창에 덧붙여 보내도 돼요</small></label><textarea class="gx-search" data-input="ph-call-text" rows="3" placeholder="예: 방금 본 걸 보고하려고">${esc(phone.callText)}</textarea>
    </div>
    <div class="ph-form-foot"><button class="gx-start" data-action="ph-call-place">${ICONS.call} 전화 걸기</button></div></div>`;
}

function addView(): string {
  return `<div class="ph-form">${paneHead('연락처 추가', '「기타」 탭에 들어가요. 명부에 있는 이름이면 그 인물로 추가돼요.')}
    <div class="ph-form-body">
      <label class="ph-label">이름</label><input class="gx-search" data-input="ph-add-name" value="${esc(phone.addName)}" maxlength="60" placeholder="이름">
      <label class="ph-label">인물 메모 (선택)<small>어떤 사람인지, 어떻게 아는 사이인지</small></label><textarea class="gx-search" data-input="ph-add-note" rows="3">${esc(phone.addNote)}</textarea>
    </div>
    <div class="ph-form-foot"><button class="gx-start" data-action="ph-add-save">추가</button></div></div>`;
}

const AUTO_HINT: Record<string, string> = {
  '0': '새로고침 버튼을 누를 때만 확인해요',
  open: '채팅이 진행된 뒤 괴담톡을 열면 한 번 확인해요',
  '1': '채팅 응답이 끝날 때마다 모델을 한 번 더 불러요',
};

function seg(key: string, cur: string, items: [string, string][]): string {
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="ph-cfg" data-value="${key}=${v}" aria-pressed="${cur === v}">${label}</button>`)
    .join('')}</div>`;
}

/** 설정 한 줄: 왼쪽 이름·설명, 오른쪽 조작 */
const row = (label: string, control: string, hint = '') =>
  `<div class="ps-row"><div class="ps-label"><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
const group = (title: string, rows: string) => `<section class="ps-group"><h3>${title}</h3><div class="ps-rows">${rows}</div></section>`;

function settingsView(ctx: ChatContext): string {
  const v = (k: string) => phoneValue(ctx.chat.scriptstate, k);
  const onoff = (k: string) => seg(k, v(k) === '1' ? '1' : '0', [['1', '켜기'], ['0', '끄기']]);
  const pct = (k: string) => `<span class="ph-inline"><input class="gx-search ph-pct" type="number" min="0" max="100" data-change="ph-num" data-key="${k}" value="${esc(v(k))}" aria-label="확률"><span>%</span></span>`;
  const num = (k: string, cur: number, lo: number, hi: number, unit: string) => `<span class="ph-inline"><input class="gx-search ph-pct" type="number" min="${lo}" max="${hi}" data-change="ph-num" data-key="${k}" value="${cur}" aria-label="${k}"><span>${unit}</span></span>`;
  const notices = noticeSettings(ctx.chat.scriptstate);
  const rest = (k: string) => {
    const n = advNum(ctx.chat.scriptstate, 'ph', k);
    return n ? `받은 뒤 ${n}턴 쉬어요` : '';
  };
  const keep = (k: 'dm' | 'group' | 'notice', label: string) => {
    const st = phoneStorage(ctx.chat.scriptstate, k);
    return row(label, `<span class="ph-inline">${seg(`storage_auto_${k}`, st.auto ? '1' : '0', [['1', '켜기'], ['0', '끄기']])}${st.auto ? num(`storage_limit_${k}`, st.limit, 1, STORAGE_MAX, '개') : ''}</span>`, '최근 기록만 남기고, 지운 대화는 흐름 요약으로 남겨요');
  };
  return `<div class="ph-form">${paneHead('괴담톡 설정', '', `<span class="ph-act">${defaultsButtons('ph')}</span>`)}${defaultsConfirm('ph')}
    <div class="ph-form-body ps">
      ${group('답장', [
        row('모델', seg('model', v('model') === 'main' ? 'main' : 'aux', [['main', '메인'], ['aux', '보조']])),
        row('채팅에 반영', onoff('context'), '지금 장면과 관련된 대화가 채팅 요청에 참고로 붙어요'),
        row('요원 상태 참고', onoff('status')),
      ].join(''))}
      ${group('새 메시지', [
        row('새 메시지 확인', seg('auto', ['1', 'open'].includes(v('auto')) ? v('auto') : '0', [['0', '수동'], ['open', '창을 열 때'], ['1', '매 턴']]), AUTO_HINT[v('auto')] ?? AUTO_HINT['0']),
        row('선톡 받기', `<span class="ph-inline">${onoff('incoming')}${pct('incoming_chance')}</span>`, rest('cd_incoming')),
        row('단톡방 초대 받기', `<span class="ph-inline">${onoff('group_invites')}${pct('group_invite_chance')}</span>`, rest('cd_invite')),
        row('소속 공지 받기', onoff('announcements')),
        row('공지 대기 턴', num('announcement_gap', notices.gap, 1, 100, '턴')),
        row('공지 참고 수', num('announcement_history', notices.history, 1, 50, '개')),
      ].join(''))}
      ${group('연락처', [row('모든 연락처 공개', onoff('all_contacts'), '내 소속과 관계없이 모든 탭을 보여요'), row('괴이 연락처 공개', onoff('anomaly_contacts'))].join(''))}
      ${group('보관', [
        keep('dm', '1:1 대화 정리'), keep('group', '단톡방 정리'), keep('notice', '공지 정리'),
        row('페이지당 공지', `<div class="gx-segs gx-segs-sm">${NOTICE_PAGE_SIZES.map((n) => `<button class="gx-seg${notices.page === n ? ' on' : ''}" data-action="ph-cfg" data-value="announcement_page_size=${n}" aria-pressed="${notices.page === n}">${n}</button>`).join('')}</div>`),
      ].join(''))}
      ${advancedBox('ph', ctx.chat.scriptstate)}
    </div></div>`;
}


/** 왼쪽 목록 (연락처·대화·공지) */
function listHtml(ctx: ChatContext, st: PState, d: Directory): string {
  if (phone.query.trim()) return searchView(ctx, st, d);
  return phone.sub === 'contacts' ? contactsView(ctx, d, st) : phone.sub === 'chats' ? chatsView(ctx, st, d) : noticesView(ctx);
}

/** 오른쪽 (모바일은 목록 대신) 화면 */
function paneHtml(ctx: ChatContext, st: PState, d: Directory, busy: boolean): string {
  if (phone.view === 'room') return roomView(ctx, st, d, busy);
  if (phone.view === 'group') return groupView(ctx, st, d);
  if (phone.view === 'call') return callView();
  if (phone.view === 'add') return addView();
  if (phone.view === 'settings') return settingsView(ctx);
  if (phone.view === 'notice') return noticeDetail(ctx);
  return `<div class="ph-empty"><span class="ph-empty-ico">${ICONS.phone}</span><b>괴담톡</b><p>왼쪽에서 대화나 연락처를 고르세요.</p></div>`;
}

/** 검색어를 바꿀 때 목록만 다시 그린다 (입력칸 포커스 유지) */
export function phoneContent(ctx: ChatContext, query: string): string {
  phone.query = query;
  try {
    return listHtml(ctx, readPhone(ctx.chat), dir(ctx));
  } catch (error) {
    return `<p class="gx-none">${esc(error instanceof Error ? error.message : String(error))}</p>`;
  }
}

export function phoneTab(ctx: ChatContext, env: PhoneEnv): string {
  liveEnv = env;
  let st: PState;
  let d: Directory;
  try {
    st = readPhone(ctx.chat);
    d = dir(ctx);
  } catch (error) {
    return `<main class="gx-body"><div class="gx-empty">${esc(error instanceof Error ? error.message : String(error))}</div></main>`;
  }
  const job = jobs.get(chatKey(ctx));
  const busy = !!job;
  let b;
  try {
    b = readBulletins(ctx.chat);
  } catch {
    b = null;
  }
  const unread = unreadCount(st);
  const subBtn = (id: Sub, label: string, extra = '') =>
    `<button class="ph-sub${phone.sub === id ? ' on' : ''}" data-action="ph-sub" data-value="${id}" aria-pressed="${phone.sub === id}">${label}${extra}</button>`;
  const fail = phone.failure
    ? `<details class="nw-fail"><summary>최근 실패 원문</summary><p>${esc(phone.failure.reason)}</p><textarea class="gx-search" rows="6" readonly>${esc(phone.failure.raw)}</textarea></details>`
    : '';
  const status = job ? `<div class="nw-busy" role="status"><span class="nw-spin"></span>${esc(job)} 창을 닫아도 계속돼요.</div>` : '';
  const note = toast('ph', phone.notice, (t) => {
    if (phone.notice === t) phone.notice = '';
  });
  const detail = phone.view !== 'list';
  const tools = [
    tool('ph-refresh', ICONS.refresh, '새 메시지 확인', busy ? 'disabled' : '', '새로고침'),
    tool('ph-group', ICONS.group, '단톡 만들기', busy ? 'disabled' : '', '단톡'),
    tool('ph-add', ICONS.addUser, '연락처 추가', '', '추가'),
    tool('ph-call', ICONS.call, '전화 걸기', 'data-value=""', '전화'),
    tool('ph-settings', ICONS.settings, '괴담톡 설정', phone.view === 'settings' ? 'aria-pressed="true"' : '', '설정'),
  ].join('');
  return `<main class="gx-body ph ph-app ${detail ? 'is-detail' : 'is-list'}">
    <section class="ph-side" aria-label="괴담톡 목록">
      <div class="ph-side-head">
        <div class="ph-subs">${subBtn('contacts', '연락처')}${subBtn('chats', '대화', badge(unread))}${subBtn('notices', '공지', badge(b ? b.items.filter((r) => r.read === false).length : 0))}</div>
        <input class="gx-search ph-search" name="ph-q" data-input="ph-query" value="${esc(phone.query)}" placeholder="이름·대화·공지 검색" aria-label="연락처·대화·공지 검색">
      </div>
      ${detail ? '' : status}
      <div class="ph-content">${listHtml(ctx, st, d)}</div>
      ${fail}
      ${drawerHtml(tools)}
    </section>
    <section class="ph-pane">${detail ? status : ''}${paneHtml(ctx, st, d, busy)}</section>
    ${note}
  </main>`;
}

/** 괴담톡 탭 버튼. 처리했으면 true */
export async function handlePhone(action: string, value: string | undefined, ctx: ChatContext, env: PhoneEnv): Promise<boolean> {
  if (!action.startsWith('ph-')) return false;
  liveEnv = env;
  const v = value ?? '';
  if (!['ph-room-del', 'ph-contact-del', 'ph-notice-del'].includes(action)) phone.confirm = null;
  if (action.startsWith('ph-def-')) {
    try {
      const msg = await defaultsAction('ph', action, v, ctx, env.refresh);
      if (msg) phone.notice = msg;
    } catch (error) {
      phone.notice = `기본값을 처리하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
    }
    env.render();
    return true;
  }
  switch (action) {
    case 'ph-sub':
      // 대화방이 열려 있으면 (PC 두 칸 화면) 그대로 두고 목록만 바꾼다
      Object.assign(phone, { sub: v as Sub, query: '', ...(phone.view === 'room' ? {} : { view: 'list', invite: null, picked: [] }) });
      break;
    case 'ph-settings':
      Object.assign(phone, { view: phone.view === 'settings' ? 'list' : 'settings', invite: null, picked: [] });
      break;
    case 'ph-att-menu':
      phone.attachMenu = !phone.attachMenu;
      break;
    case 'ph-ctab':
      phone.tab = v;
      phone.query = '';
      break;
    case 'ph-chat-filter':
      phone.chatFilter = v === 'unread' ? 'unread' : 'all';
      break;
    case 'ph-notice-filter':
      phone.noticeFilter = v === 'unread' ? 'unread' : 'all';
      phone.noticePage = 1;
      break;
    case 'ph-notice-faction':
      phone.noticeFaction = phone.noticeFaction === v ? '' : v;
      phone.noticePage = 1;
      break;
    case 'ph-pick-tab':
      phone.pickTab = v;
      phone.pickQuery = '';
      break;
    case 'ph-dm':
      // PC: 열린 대화의 연락처를 다시 누르면 닫힌다 (대화 목록과 같음)
      if (phone.view === 'room' && phone.room === `dm_${v}` && !matchMedia('(max-width: 760px)').matches) return handlePhone('ph-back', undefined, ctx, env);
      await openDm(ctx, env, v);
      return true;
    case 'ph-room':
      // PC: 열린 방을 다시 누르면 닫힌다 (‹ 뒤로와 같음)
      if (phone.view === 'room' && phone.room === v && !matchMedia('(max-width: 760px)').matches) return handlePhone('ph-back', undefined, ctx, env);
      await openRoom(ctx, env, v);
      return true;
    case 'ph-back':
      if (phone.view === 'group' && phone.invite) {
        Object.assign(phone, { view: 'room', room: phone.invite, invite: null, picked: [] });
        break;
      }
      if (phone.view === 'room' && phone.room) {
        const rid = phone.room;
        Object.assign(phone, { view: 'list', room: null, draft: '', attach: [] });
        await mutate(ctx, env, (st) => {
          const r = st.rooms[rid];
          if (!r || r.messages.length || r.pending) return false;
          delete st.rooms[rid];
          st.order = st.order.filter((x) => x !== rid);
        });
        return true;
      }
      Object.assign(phone, { view: 'list', invite: null, picked: [] });
      break;
    case 'ph-more':
      phone.page += 1;
      break;
    case 'ph-att-add':
    case 'ph-att-del': {
      const r = readPhone(ctx.chat).rooms[phone.room ?? ''];
      if (r) attachAction(phone.attach, action === 'ph-att-add' ? 'add' : 'del', v, phKinds(r));
      break;
    }
    case 'ph-send': {
      if (!phone.draft.trim() && !phone.attach.length) {
        phone.notice = '메시지를 입력해 주세요.';
        break;
      }
      if (emptyAttachment(phone.attach)) {
        phone.notice = '첨부 내용을 입력하거나 ✕로 빼 주세요.';
        break;
      }
      void send(ctx, env, v, composeBody(phone.attach, phone.draft));
      return true;
    }
    case 'ph-retry': {
      const r = readPhone(ctx.chat).rooms[v];
      if (r?.pending) void generate(ctx, env, v, `${roomLabel(r)}의 답장을 다시 기다리는 중이에요.`);
      return true;
    }
    case 'ph-skip':
      if (phoneBusy(ctx)) break;
      await mutate(ctx, env, (st) => {
        const r = st.rooms[v];
        if (!r?.pending) return false;
        r.pending = undefined;
      });
      return true;
    case 'ph-room-refresh':
      void roomRefresh(ctx, env, v);
      return true;
    case 'ph-refresh':
      void refreshInbox(ctx, env);
      return true;
    case 'ph-group':
      Object.assign(phone, { view: 'group', invite: null, picked: [], topic: '', gname: '', pickQuery: '', pickTab: '' });
      break;
    case 'ph-invite':
      Object.assign(phone, { view: 'group', invite: v, room: v, picked: [], pickQuery: '', pickTab: '' });
      break;
    case 'ph-pick': {
      const set = new Set(phone.picked);
      if (set.has(v)) set.delete(v);
      else {
        const existing = phone.invite ? readPhone(ctx.chat).rooms[phone.invite]?.members.length ?? 0 : 0;
        if (set.size + existing >= LIMITS.members) {
          phone.notice = `상대는 최대 ${LIMITS.members}명까지예요.`;
          break;
        }
        set.add(v);
      }
      phone.picked = [...set];
      break;
    }
    case 'ph-group-create':
      await createGroup(ctx, env);
      return true;
    case 'ph-room-del':
      if (phone.confirm !== `room:${v}`) {
        phone.confirm = `room:${v}`;
        break;
      }
      phone.confirm = null;
      await mutate(ctx, env, (st) => {
        const r = st.rooms[v];
        if (!r || r.pending) return false;
        delete st.rooms[v];
        st.order = st.order.filter((x) => x !== v);
      });
      if (phone.room === v) Object.assign(phone, { view: phone.view === 'room' ? 'list' : phone.view, room: null });
      return true;
    case 'ph-notice': {
      const id = Number(v);
      // PC: 오른쪽 칸에 본문 하나. 모바일: 목록 안에서 펼치고 다시 누르면 접는다
      if (matchMedia('(max-width: 760px)').matches) Object.assign(phone, { openNotice: phone.openNotice === id ? null : id, view: phone.view === 'notice' ? 'list' : phone.view });
      else if (phone.view === 'notice' && phone.openNotice === id) Object.assign(phone, { openNotice: null, view: 'list' });
      else Object.assign(phone, { openNotice: id, view: 'notice' });
      {
        const b = readBulletins(ctx.chat);
        const row = b.items.find((x) => x.id === id);
        if (row && row.read === false) {
          row.read = true;
          await setVars(ctx, env, writeBulletins(b, ctx.chat.scriptstate));
          return true;
        }
      }
      break;
    }
    case 'ph-notice-page':
      phone.noticePage = Math.max(1, Number(v) || 1);
      phone.openNotice = null;
      break;
    case 'ph-notice-all': {
      const b = readBulletins(ctx.chat);
      if (!b.items.some((x) => x.read === false)) break;
      for (const row of b.items) row.read = true;
      await setVars(ctx, env, writeBulletins(b, ctx.chat.scriptstate));
      return true;
    }
    case 'ph-notice-del': {
      if (phone.confirm !== `notice:${v}`) {
        phone.confirm = `notice:${v}`;
        break;
      }
      phone.confirm = null;
      const b = readBulletins(ctx.chat);
      b.items = b.items.filter((x) => x.id !== Number(v));
      if (phone.openNotice === Number(v)) Object.assign(phone, { openNotice: null, view: phone.view === 'notice' ? 'list' : phone.view });
      await setVars(ctx, env, writeBulletins(b, ctx.chat.scriptstate));
      return true;
    }
    case 'ph-call':
      Object.assign(phone, { view: 'call', call: v, callText: '' });
      break;
    case 'ph-call-place':
      await placeCall(ctx, env, phone.call, phone.callText);
      return true;
    case 'ph-add':
      Object.assign(phone, { view: 'add', addName: '', addNote: '' });
      break;
    case 'ph-add-save':
      await addContact(ctx, env);
      return true;
    case 'ph-contact-del':
      if (phone.confirm !== `contact:${v}`) {
        phone.confirm = `contact:${v}`;
        break;
      }
      phone.confirm = null;
      await deleteContact(ctx, env, v);
      return true;
    case 'ph-cfg': {
      const [k, val] = v.split('=');
      const vars: Record<string, string> = { [PH(k)]: val };
      if (k === 'all_contacts' || k === 'anomaly_contacts') phone.tab = '';
      if (k === 'announcement_page_size') phone.noticePage = 1;
      await setVars(ctx, env, vars);
      return true;
    }
    case 'ph-num': {
      const [k, val] = v.split('=');
      const range: Record<string, [number, number]> = {
        incoming_chance: [0, 100], group_invite_chance: [0, 100], announcement_gap: [1, 100], announcement_history: [1, 50],
        storage_limit_dm: [1, STORAGE_MAX], storage_limit_group: [1, STORAGE_MAX], storage_limit_notice: [1, STORAGE_MAX],
      };
      const r = range[k];
      const n = Math.floor(Number(val));
      if (r && Number.isFinite(n)) await setVars(ctx, env, { [PH(k)]: String(Math.max(r[0], Math.min(r[1], n))) });
      else env.render();
      return true;
    }
    default:
      return false;
  }
  env.render();
  return true;
}

async function addContact(ctx: ChatContext, env: PhoneEnv) {
  const name = phone.addName.trim();
  if (!validCallTarget(name)) {
    phone.notice = '이름은 60자 이내로, 줄바꿈·괄호 없이 적어 주세요.';
    return env.render();
  }
  if (tokens(phone.addNote) > LIMITS.memo_tokens) {
    phone.notice = `인물 메모는 ${LIMITS.memo_tokens}토큰 이내로 적어 주세요.`;
    return env.render();
  }
  const d = dir(ctx);
  const key = name.toLowerCase();
  const found = [...new Set(d.map.values())].filter((c) => c.name === name || (c.english ?? '').toLowerCase() === key || c.terms.some((t) => t.toLowerCase() === key));
  if (found.length > 1) {
    phone.notice = '같은 이름의 연락처가 여럿이에요. 정확한 이름을 적어 주세요.';
    return env.render();
  }
  const match = found[0];
  if (match?.visible) {
    Object.assign(phone, { view: 'list', sub: 'contacts', tab: match.tabs[0] ?? '', query: '', notice: '이미 등록된 연락처예요.' });
    return env.render();
  }
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const data = readCustom(chat);
    if (match) data.items.push({ id: match.id, name: match.name, agentId: match.agentId });
    else {
      data.seq += 1;
      data.items.push({ id: contactId(`custom:${data.seq}`), name, note: phone.addNote.trim() });
    }
    return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [PH_CONTACTS]: JSON.stringify(data) } };
  });
  Object.assign(phone, { view: 'list', sub: 'contacts', tab: 'T05', query: '', notice: '연락처를 기타에 추가했어요.' });
  await env.refresh();
}

async function deleteContact(ctx: ChatContext, env: PhoneEnv, cid: string) {
  if (phoneBusy(ctx)) return;
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const data = readCustom(chat);
    data.items = data.items.filter((x) => x.id !== cid);
    const st = readPhone(chat);
    for (const [rid, r] of Object.entries(st.rooms)) if (r.kind === 'dm' && (rid === `dm_${cid}` || r.members.includes(cid))) delete st.rooms[rid];
    st.order = st.order.filter((x) => st.rooms[x]);
    return writePhone({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [PH_CONTACTS]: JSON.stringify(data) } }, st);
  });
  phone.notice = '연락처와 1:1 대화 기록을 지웠어요.';
  await env.refresh();
}

/** 입력칸 (포커스 유지를 위해 다시 그리지 않음) */
export function phoneInput(name: string, value: string, key?: string): boolean {
  switch (name) {
    case 'ph-draft':
      phone.draft = value;
      return true;
    case 'ph-att':
      return attachInput(phone.attach, key, value);
    case 'ph-topic':
      phone.topic = value;
      return true;
    case 'ph-gname':
      phone.gname = value;
      return true;
    case 'ph-call-to':
      phone.call = value;
      return true;
    case 'ph-call-text':
      phone.callText = value;
      return true;
    case 'ph-add-name':
      phone.addName = value;
      return true;
    case 'ph-add-note':
      phone.addNote = value;
      return true;
    case 'ph-pick-q':
      phone.pickQuery = value;
      return true;
    default:
      return false;
  }
}

/** 탭 버튼 배지 */
export function phoneUnread(ctx: ChatContext): boolean {
  try {
    return unreadCount(readPhone(ctx.chat)) > 0 || bulletinUnread(readBulletins(ctx.chat));
  } catch {
    return false;
  }
}
