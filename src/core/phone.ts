// 괴담톡: 저장 형식(원본 ph_state·ph_contacts·ph_bulletins와 같음), 연락처·탭, 대화 규칙, 모델 응답 검사와 반영.
// 원칙(원본과 같음): 이미 저장된 말풍선은 모델이 고치거나 지우지 못한다. 모델은 새 말풍선·대기·퇴장(단톡)만 덧붙이고,
// 초대·방 만들기·공지 채널·시각·기록 번호는 앱이 정한다.
import type { Chat, LoreEntry } from './types';
import { readWorld } from './world/output';
import { readDirectory, rosterOf } from './world/directory';
import { BUILTIN, extraFactions, extraTabs, factionType, isFactionCode } from './factions';
import { dateNow, storyTurns, tokens, cut } from './gnet';
import { attachmentRecords, describe, stripForged } from './attach';
export { hasAttachment } from './attach';

export class PhoneError extends Error {
  constructor(message: string, readonly raw = '') {
    super(message);
  }
}

// ── 채팅 변수 (원본과 같은 이름) ──

export const PH = (key: string) => `$ph_${key}`;
export const PH_STATE = PH('state');
export const PH_CONTACTS = PH('contacts');
export const PH_BULLETINS = PH('bulletins');
export const PH_AUTO_LAST = PH('auto_last');
export const PH_UNREAD = '$st_unread_phone';

export const PH_DEFAULTS: Record<string, string> = {
  model: 'aux', auto: '1', status: '1', announcements: '1', all_contacts: '0', anomaly_contacts: '0', incoming: '1', group_invites: '1',
  incoming_chance: '100', group_invite_chance: '100', context: '1', context_messages: '1', context_announcements: '1', related: '0',
};

/** 카드 Settings 로어북의 괴담톡 값과 같은 기본값 */
export const LIMITS = {
  events: 12, reply_tokens: 1500, input_tokens: 4000, pause_tokens: 200, topic_tokens: 2000, memo_tokens: 2000, notices: 1, invitations: 1,
  members: 9, room_name: 60, notice_title: 80, notice_issuer: 60, notice_tokens: 1200,
};
export const HISTORY = { room: 100, announcement: 10, context: 200, contextNotices: 1, contextTokens: 20000, turns: 8 };
export const STORAGE = { dm: 40, group: 100, notice: 20 };
export const STORAGE_MAX = 20000;
export const COOLDOWN = { incoming: 1, invitation: 3, announcement: 3 };
export type StorageKind = keyof typeof STORAGE;
/** 보관 한도 (원본 storage_auto_* / storage_limit_*): 자동 정리 켬/끔과 개수는 따로 */
export function phoneStorage(state: Record<string, unknown> | undefined, k: StorageKind): { auto: boolean; limit: number } {
  const n = Number(state?.[PH(`storage_limit_${k}`)]);
  return {
    auto: String(state?.[PH(`storage_auto_${k}`)] ?? '') !== '0',
    limit: Number.isInteger(n) && n >= 1 && n <= STORAGE_MAX ? n : STORAGE[k],
  };
}
const storageCap = (state: Record<string, unknown> | undefined, k: StorageKind) => {
  const s = phoneStorage(state, k);
  return s.auto ? s.limit : Infinity;
};
/** 공지 설정 (원본 announcement_gap·announcement_history·announcement_page_size) */
export const NOTICE_PAGE_SIZES = [20, 30, 40, 50, 60];
export function noticeSettings(state: Record<string, unknown> | undefined): { gap: number; history: number; page: number } {
  const num = (k: string, lo: number, hi: number, d: number) => {
    const n = Number(state?.[PH(k)]);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : d;
  };
  const page = num('announcement_page_size', 20, 60, 20);
  return { gap: num('announcement_gap', 1, 100, COOLDOWN.announcement), history: num('announcement_history', 1, 50, HISTORY.announcement), page: NOTICE_PAGE_SIZES.includes(page) ? page : 20 };
}
const cooldownTurns = (chat: Chat, k: keyof typeof COOLDOWN) => (k === 'announcement' ? noticeSettings(chat.scriptstate).gap : COOLDOWN[k]);
const COOLDOWN_KEY = (k: keyof typeof COOLDOWN) => `$cooldown_received_${k}`;

export interface PhoneSettings {
  model: 'main' | 'aux';
  auto: boolean;
  status: boolean;
  announcements: boolean;
  allContacts: boolean;
  anomalyContacts: boolean;
  incoming: boolean;
  invites: boolean;
  incomingChance: number;
  inviteChance: number;
  context: boolean;
  contextMessages: boolean;
  contextAnnouncements: boolean;
  related: boolean;
}

export function phoneValue(state: Record<string, unknown> | undefined, key: string): string {
  const v = state?.[PH(key)];
  return v === undefined || v === null || v === '' || v === 'null' ? (PH_DEFAULTS[key] ?? '') : String(v);
}

export function phoneSettings(state: Record<string, unknown> | undefined): PhoneSettings {
  const v = (k: string) => phoneValue(state, k);
  const pct = (k: string) => {
    const n = Number(v(k));
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.floor(n))) : 100;
  };
  return {
    model: v('model') === 'main' ? 'main' : 'aux',
    auto: v('auto') === '1',
    status: v('status') !== '0',
    announcements: v('announcements') !== '0',
    allContacts: v('all_contacts') === '1',
    anomalyContacts: v('anomaly_contacts') === '1',
    incoming: v('incoming') !== '0',
    invites: v('group_invites') !== '0',
    incomingChance: pct('incoming_chance'),
    inviteChance: pct('group_invite_chance'),
    context: v('context') !== '0',
    contextMessages: v('context_messages') !== '0',
    contextAnnouncements: v('context_announcements') !== '0',
    related: v('related') === '1',
  };
}

export function cooldownReady(chat: Chat, k: keyof typeof COOLDOWN): boolean {
  const last = Number(chat.scriptstate?.[COOLDOWN_KEY(k)]);
  const now = storyTurns(chat);
  return !Number.isFinite(last) || String(chat.scriptstate?.[COOLDOWN_KEY(k)] ?? '') === '' || now < last || now - last >= cooldownTurns(chat, k);
}
export function cooldownLeft(chat: Chat, k: keyof typeof COOLDOWN): number {
  const last = Number(chat.scriptstate?.[COOLDOWN_KEY(k)]);
  return Number.isFinite(last) ? Math.max(0, cooldownTurns(chat, k) - (storyTurns(chat) - last)) : 0;
}
export const cooldownMark = (chat: Chat, k: keyof typeof COOLDOWN): Record<string, string> => ({ [COOLDOWN_KEY(k)]: String(storyTurns(chat)) });

export function chancePassed(n: number, rng: () => number): boolean {
  return n >= 100 || (n > 0 && Math.floor(rng() * 100) + 1 <= n);
}

// ── 연락처 ──

export interface PPerson {
  id: string;
  name: string;
  agentId?: string;
  english?: string;
  lore?: string;
  group?: string;
  rank?: string;
  department?: string;
  custom?: boolean;
  note?: string;
}

export interface Contact extends PPerson {
  tabs: string[];
  terms: string[];
  visible: boolean;
  saved: boolean;
}

export interface PhoneTab {
  id: string;
  name: string;
}

interface TabDef {
  id: string;
  name: string;
  names: Record<string, string>;
  visibleFor: Set<string>;
}

const hex = (s: string) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
export const contactId = (agentId: string) => `c_${hex(agentId)}`;

function loreJson(lore: LoreEntry[], name: string): unknown {
  const raw = lore.filter((e) => e.comment === name && typeof e.content === 'string').map((e) => e.content as string).join('\n').trim();
  if (!raw) throw new PhoneError(`${name} 로어북이 없어요.`);
  try {
    return JSON.parse(raw.replace(/^﻿/, '').replace(/^```[\w-]*\s*\n/, '').replace(/\n\s*```\s*$/, ''));
  } catch {
    throw new PhoneError(`${name}: JSON 구문을 확인하세요.`);
  }
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

function tabCatalog(lore: LoreEntry[]): { entries: TabDef[]; orders: Record<string, string[]> } {
  const data = loreJson(lore, 'Phone tabs') as { version?: number; tabs?: unknown[]; order_by_faction?: Record<string, unknown> };
  if (data?.version !== 1 || !Array.isArray(data.tabs)) throw new PhoneError('Phone tabs: version 1 탭 설정이 필요해요.');
  const entries: TabDef[] = [];
  for (const row of data.tabs as Record<string, unknown>[]) {
    const id = s(row?.id);
    if (!/^[TX]\d+$/.test(id) || entries.some((e) => e.id === id)) continue;
    const names: Record<string, string> = {};
    if (row.name_by_faction && typeof row.name_by_faction === 'object') for (const [f, n] of Object.entries(row.name_by_faction as object)) if (s(n)) names[f] = s(n);
    entries.push({ id, name: s(row.name) || id, names, visibleFor: new Set(list(row.visible_for)) });
  }
  // 새 세력: 기본 다섯 세력 모두에게 열린 탭은 새 세력에도 열고, 전용 탭을 덧붙인다
  const extra = extraFactions(lore).map((f) => f.code);
  if (extra.length) {
    for (const e of entries) if (BUILTIN.every((f) => e.visibleFor.has(f))) for (const f of extra) e.visibleFor.add(f);
    for (const t of extraTabs(lore)) if (!entries.some((e) => e.id === t.id)) entries.push({ id: t.id, name: t.name, names: {}, visibleFor: new Set(t.visibleFor) });
  }
  const orders: Record<string, string[]> = {};
  for (const [f, order] of Object.entries(data.order_by_faction ?? {})) orders[f] = list(order);
  return { entries, orders };
}

export interface CustomContacts {
  version: 1;
  seq: number;
  items: { id: string; name: string; note?: string; agentId?: string }[];
}

export function readCustom(chat: Chat): CustomContacts {
  const raw = String(chat.scriptstate?.[PH_CONTACTS] ?? '');
  if (!raw || raw === 'null') return { version: 1, seq: 0, items: [] };
  try {
    const d = JSON.parse(raw) as CustomContacts;
    if (d?.version === 1 && Array.isArray(d.items)) return { version: 1, seq: Number(d.seq) || 0, items: d.items.filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string') };
  } catch {
    /* 아래 오류 */
  }
  throw new PhoneError('추가 연락처를 읽지 못했어요. 기존 기록은 그대로 둬요.');
}

export interface Directory {
  tabs: PhoneTab[];
  contacts: Contact[];
  map: Map<string, Contact>;
  faction: string;
}

/** 원본 directoryTabs + contacts: 내 소속에 공개된 탭과 그 탭의 인물, 직접 추가한 연락처(기타 T05) */
export function directory(lore: LoreEntry[] | undefined, chat: Chat): Directory {
  const books = lore ?? [];
  const faction = String(chat.scriptstate?.['$st_faction'] ?? '');
  const set = phoneSettings(chat.scriptstate);
  const cat = tabCatalog(books);
  const tabs: PhoneTab[] = [];
  const visible = new Set<string>();
  const add = (t: TabDef | undefined) => {
    if (!t || visible.has(t.id)) return;
    const allowed = t.id.startsWith('T') ? set.allContacts || t.visibleFor.has(faction) : set.anomalyContacts && t.visibleFor.has(faction);
    if (!allowed) return;
    visible.add(t.id);
    tabs.push({ id: t.id, name: t.names[faction] ?? t.name });
  };
  for (const code of cat.orders[faction] ?? []) add(cat.entries.find((e) => e.id === code));
  for (const t of cat.entries) add(t);

  const roster = { characters: rosterOf(readDirectory(books)) };
  const map = new Map<string, Contact>();
  const contacts: Contact[] = [];
  for (const row of roster.characters ?? []) {
    const agentId = s(row?.id);
    if (!/^P\d{3,}$/.test(agentId) || !s(row.name)) continue;
    const english = s(row.english);
    const c: Contact = {
      id: contactId(agentId), agentId, name: s(row.name), english, lore: s(row.lore), group: s(row.affiliation), rank: s(row.rank),
      department: s(row.department), tabs: list(row.phone_tabs), terms: [s(row.name), english, s(row.lore), ...list(row.aliases), ...list(row.legacy_english)].filter(Boolean),
      visible: false, saved: false,
    };
    c.visible = c.tabs.some((t) => visible.has(t));
    map.set(c.id, c);
    if (c.visible) contacts.push(c);
    // 예전 영문명 기반 ID도 같은 사람으로 (원본 호환)
    for (const name of [english, ...list(row.legacy_english)]) if (name) map.set(`c_${hex(name.toLowerCase())}`, c);
  }
  for (const entry of readCustom(chat).items) {
    let c = map.get(entry.id);
    if (c) {
      if (!c.tabs.includes('T05')) c.tabs = [...c.tabs, 'T05'];
      if (!c.visible && visible.has('T05')) {
        c.visible = true;
        contacts.push(c);
      }
    } else {
      c = { id: entry.id, name: entry.name, english: '', lore: '', group: '미분류', rank: '', department: '', note: entry.note ?? '', custom: true, tabs: ['T05'], terms: [entry.name, entry.note ?? ''], visible: visible.has('T05'), saved: true };
      map.set(c.id, c);
      if (c.visible) contacts.push(c);
    }
    c.saved = true;
  }
  return { tabs, contacts, map, faction };
}

export function personOf(c: PPerson): PPerson {
  const p: PPerson = { id: c.id, name: c.name };
  for (const k of ['agentId', 'english', 'lore', 'group', 'rank', 'department', 'note'] as const) if (c[k]) p[k] = c[k];
  if (c.custom) p.custom = true;
  return p;
}

export function contactDetails(c: PPerson | undefined): string {
  return [c?.rank, c?.department].filter(Boolean).join(' · ');
}

// ── 대화방 ──

export type MsgKind = 'message' | 'pause' | 'invite' | 'exit';
export interface PMsg {
  id: number;
  sender: string;
  text: string;
  time: string;
  kind: MsgKind;
  audience: string[];
  participant?: string;
  inviter?: string;
}
export type ActionType = 'send' | 'invite_initial' | 'invite_more' | 'refresh';
export interface PRoom {
  id: string;
  kind: 'dm' | 'group';
  name?: string;
  topic?: string;
  members: string[];
  people: Record<string, PPerson>;
  messages: PMsg[];
  draft: string;
  unread: number;
  readThrough?: number;
  followupSent?: boolean;
  silent?: boolean;
  inviter?: string;
  pending?: { message?: number; status: 'error' | 'working'; action: { type: ActionType; invited?: string[] } };
  conversationBaseline?: ConversationState;
  trimmedRecords?: number;
}
export interface PState {
  version: 2;
  seq: number;
  mid: number;
  rooms: Record<string, PRoom>;
  order: string[];
}

export const blankState = (): PState => ({ version: 2, seq: 0, mid: 0, rooms: {}, order: [] });

export function readPhone(chat: Chat): PState {
  const raw = String(chat.scriptstate?.[PH_STATE] ?? '');
  if (!raw || raw === 'null') return blankState();
  let st: PState;
  try {
    st = JSON.parse(raw) as PState;
  } catch {
    throw new PhoneError('메시지 기록을 읽지 못했어요. 기존 기록은 그대로 둬요.');
  }
  if (!st || typeof st.rooms !== 'object' || !Array.isArray(st.order)) throw new PhoneError('메시지 기록을 읽지 못했어요. 기존 기록은 그대로 둬요.');
  st.version = 2;
  st.seq = Number(st.seq) || 0;
  st.mid = Number(st.mid) || 0;
  for (const [id, r] of Object.entries(st.rooms)) {
    r.id = r.id || id;
    r.people ??= {};
    r.members ??= [];
    r.messages ??= [];
    r.draft ??= '';
    r.unread = Number(r.unread) || 0;
    for (const m of r.messages) m.kind ??= 'message';
    // 예전에는 만들 때 참여자 이름을 이름으로 박아 뒀다. 그런 이름은 지워서 자동 이름으로 바꾼다
    if (r.kind === 'group' && r.name && r.name === Object.values(r.people).map((p) => p.name).join(', ')) delete r.name;
  }
  return st;
}

/** 이름을 정하지 않은 단톡방은 지금 남아 있는 사람 이름으로 부른다 */
export function roomLabel(r: PRoom): string {
  if (r.kind === 'group') return r.name || r.members.map((c) => r.people[c]?.name ?? c).join(', ') || '단톡방';
  return r.people[r.members[0]]?.name ?? r.people[Object.keys(r.people)[0]]?.name ?? '대화';
}

export function push(st: PState, r: PRoom, sender: string, text: string, time: string, kind: MsgKind = 'message'): PMsg {
  if (!r.messages.length && !r.conversationBaseline && r.readThrough === undefined) r.readThrough = 0;
  st.mid = (st.mid || 0) + 1;
  const m: PMsg = { id: st.mid, sender, text, time, kind, audience: [...r.members] };
  r.messages.push(m);
  return m;
}

export function membership(st: PState, r: PRoom, kind: 'invite' | 'exit', cid: string, time: string): void {
  const p = r.people[cid];
  if (!p) throw new PhoneError('참여자 정보를 찾지 못했어요.');
  const m = push(st, r, 'system', `${p.name}님이 ${kind === 'invite' ? '초대되었습니다.' : '나갔습니다.'}`, time, kind);
  m.participant = cid;
  if (kind === 'exit') r.members = r.members.filter((x) => x !== cid);
}

/** 문장부호만 있는 대기 표시는 기록하지 않는다 (원본 P.emptyPause) */
export const emptyPause = (t: string) => String(t ?? '').replace(/[\s.…⋯．]/g, '') === '';

/** 대기 줄은 「잠시 후」 같은 짧은 시간 표시만 남긴다. 모델이 지문(「○○가 기겁하며…」)을 쓰면 버린다 */
export const hiddenPause = (t: string) => {
  const s = String(t ?? '').trim();
  return emptyPause(s) || [...s].length > 12 || /[다요][.!…]*$/.test(s);
};

export const listedRooms = (st: PState) =>
  Object.keys(st.rooms)
    .filter((k) => st.rooms[k].messages.length > 0)
    .sort((a, b) => st.rooms[b].messages[st.rooms[b].messages.length - 1].id - st.rooms[a].messages[st.rooms[a].messages.length - 1].id);

export function unsolicited(r: PRoom): boolean {
  if (r.kind !== 'dm') return false;
  for (let i = r.messages.length - 1; i >= 0; i--) if (r.messages[i].kind === 'message') return r.messages[i].sender !== 'me';
  return true;
}

export function readRoom(r: PRoom): void {
  let latest = r.readThrough ?? 0;
  for (const m of r.messages) latest = Math.max(latest, m.id);
  r.readThrough = latest;
  r.unread = 0;
}

export const roomUnread = (st: PState) => Object.values(st.rooms).some((r) => r.unread > 0);
export const unreadCount = (st: PState) => Object.values(st.rooms).reduce((n, r) => n + (r.unread || 0), 0);

// ── 대화 상태 (원본 P.conversationState) ──

export interface SenderRow {
  sender: string;
  messagesSinceOwner: number;
  firstMessageTime: string;
  lastMessageTime?: string;
  lastRecordID?: number;
  lastMessageRead?: 'read' | 'unread' | 'unknown';
}
export interface ConversationState {
  ownerHasSpoken: boolean;
  npcMessagesSinceOwner: number;
  senders: SenderRow[];
  readReceipt: 'tracked' | 'unknown';
  lastSender?: string;
  lastMessageTime?: string;
  lastOwnerRecordID?: number;
  lastOwnerTime?: string;
  ownerReadThroughRecordID?: number;
  ownerHasNotReplied?: boolean;
}

export function conversationState(r: { messages: PMsg[]; conversationBaseline?: ConversationState; readThrough?: number }): ConversationState {
  let out: ConversationState = { ownerHasSpoken: false, npcMessagesSinceOwner: 0, senders: [], readReceipt: 'unknown' };
  let senders = new Map<string, SenderRow>();
  if (r.conversationBaseline && typeof r.conversationBaseline === 'object') {
    out = JSON.parse(JSON.stringify(r.conversationBaseline)) as ConversationState;
    for (const row of out.senders ?? []) senders.set(row.sender, row);
    out.senders = [];
  }
  for (const m of r.messages) {
    if (m.kind !== 'message' || m.sender === 'system') continue;
    out.lastSender = m.sender;
    out.lastMessageTime = m.time || '';
    if (m.sender === 'me') {
      out.ownerHasSpoken = true;
      out.lastOwnerRecordID = m.id;
      out.lastOwnerTime = m.time || '';
      out.npcMessagesSinceOwner = 0;
      senders = new Map();
    } else {
      out.npcMessagesSinceOwner++;
      const row = senders.get(m.sender) ?? { sender: m.sender, messagesSinceOwner: 0, firstMessageTime: m.time || '' };
      row.messagesSinceOwner++;
      row.lastMessageTime = m.time || '';
      row.lastRecordID = m.id;
      senders.set(m.sender, row);
    }
  }
  const rt = r.readThrough;
  for (const key of [...senders.keys()].sort()) {
    const row = senders.get(key)!;
    row.lastMessageRead = rt !== undefined && row.lastRecordID !== undefined ? (row.lastRecordID <= rt ? 'read' : 'unread') : 'unknown';
    out.senders.push(row);
  }
  out.readReceipt = rt !== undefined ? 'tracked' : 'unknown';
  out.ownerReadThroughRecordID = rt;
  out.ownerHasNotReplied = out.npcMessagesSinceOwner > 0;
  return out;
}

/** 보관 상한 (기본 1:1 40, 단톡 100, 설정으로 바꾸거나 끔). 지운 기록은 대화 상태 요약으로 남긴다 */
export function trimRooms(st: PState, caps: { dm: number; group: number } = STORAGE): void {
  for (const r of Object.values(st.rooms)) {
    const cap = r.kind === 'group' ? caps.group : caps.dm;
    if (r.pending || r.messages.length <= cap) continue;
    const n = r.messages.length - cap;
    const removed = r.messages.slice(0, n);
    r.conversationBaseline = conversationState({ messages: removed, conversationBaseline: r.conversationBaseline });
    r.messages = r.messages.slice(n);
    r.trimmedRecords = (r.trimmedRecords ?? 0) + n;
    const incoming = r.messages.filter((m) => m.kind === 'message' && m.sender !== 'me' && m.sender !== 'system').length;
    r.unread = Math.min(r.unread, incoming);
  }
}

/** 받기 허용 (원본 P.refreshAllowed). 이유 문장도 함께 */
export function refreshAllowed(chat: Chat, r: PRoom, set: PhoneSettings, incomingPassed?: boolean): [boolean, string] {
  if (r.kind === 'group' || !unsolicited(r)) return [true, ''];
  if (r.followupSent) return [false, '상대의 후속 메시지에 대한 답장을 기다리고 있어요.'];
  if (!set.incoming) return [false, '선톡 받기가 꺼져 있어요. 설정에서 켜면 다시 확인할 수 있어요.'];
  if (!cooldownReady(chat, 'incoming')) return [false, `선톡을 받은 뒤 대기 중이에요. 본편 응답이 ${cooldownLeft(chat, 'incoming')}턴 더 쌓이면 다시 확인해요.`];
  if (incomingPassed === false) return [false, '이번 확인은 선톡 요청 확률에 따라 건너뛰었어요.'];
  return [true, ''];
}

// ── 첨부 표시 [[ATTACH:kind]]…[[/ATTACH]] ──

/** 첨부는 따로 한 말풍선, 나머지 글은 한 말풍선 (원본 AT.records). 실제 사진 기록(%%ATTACHMENT%%)도 그대로 옮긴다 */
export function splitRecords(text: string): string[] {
  const out: string[] = [];
  let last = 0;
  for (const r of attachmentRecords(text)) {
    const before = text.slice(last, r.start).trim();
    if (before) out.push(before);
    const tag = /^\[\[ATTACH:(\w+)\]\]([\s\S]*?)\[\[\/ATTACH\]\]$/.exec(r.text);
    out.push(tag ? `[[ATTACH:${tag[1].toLowerCase()}]]${tag[2].trim()}[[/ATTACH]]` : r.text);
    last = r.end;
  }
  const rest = text.slice(last).trim();
  if (rest) out.push(rest);
  return out;
}

function checkGift(text: string, dm: boolean) {
  if (!dm && /\[\[ATTACH:gift\]\]/i.test(text)) throw new PhoneError('단톡방에서는 선물을 보낼 수 없어요.');
}

// ── 모델 응답 읽기 ──

/** 생각 블록·코드 울타리·허용된 바깥 태그만 벗기고, 끝의 쉼표 같은 확실한 형식 오류만 고친다 (원본 decodeObject) */
export function decodeJson(raw: string): unknown {
  let text = String(raw ?? '').replace(/^﻿/, '').trim();
  for (let i = 0; i < 12; i++) {
    const before = text;
    if (text.startsWith('{') || text.startsWith('[')) break;
    const think = /^<(think|thoughts|analysis|lb-process)\b[^>]*>[\s\S]*?<\/\1>\s*/i.exec(text);
    if (think) text = text.slice(think[0].length).trim();
    else {
      const fence = /^```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text);
      if (fence) text = fence[1].trim();
      else {
        const tag = /^<(output|json|lb-minitalk-refresh|lb-minitalk-patch)(\s[^>]*)?>([\s\S]*)<\/\1>\s*$/i.exec(text);
        if (tag) text = tag[3].trim();
      }
    }
    if (text === before) break;
  }
  if (!text) throw new PhoneError('모델 응답이 비어 있어요.', raw);
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const brace = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (brace >= 0 && end > brace) text = text.slice(brace, end + 1);
    else throw new PhoneError('JSON 대신 설명문이나 다른 형식이 왔어요.', raw);
  }
  try {
    return JSON.parse(text);
  } catch {
    const fixed = text.replace(/,(\s*[}\]])/g, '$1').replace(/[\u0000-\u001f]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
    try {
      return JSON.parse(fixed.replace(/"((?:[^"\\]|\\.)*)"/g, (m) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')));
    } catch (error) {
      throw new PhoneError(`JSON 문법 오류예요. 응답이 중간에 끊겼을 수 있어요. (${(error as Error).message.slice(0, 120)})`, raw);
    }
  }
}

export type PEvent = { type: 'message'; sender: string; text: string } | { type: 'pause'; text: string } | { type: 'exit'; participant: string };

function fail(msg: string): never {
  throw new PhoneError(msg);
}

/** 미니톡 패치 → 대화 이벤트 (원본 eventsFromPatch + validateEvents) */
export function eventsFromPatch(patch: unknown, r: PRoom, allowTitle: boolean): { events: PEvent[]; title?: string } {
  if (!Array.isArray(patch)) fail('대화 변경 목록이 배열이 아니에요.');
  if (patch.length > LIMITS.events + 1) fail('대화 변경 항목이 너무 많아요.');
  const events: PEvent[] = [];
  let title: string | undefined;
  for (const op of patch as Record<string, unknown>[]) {
    if (!op || typeof op !== 'object') fail('대화 변경 항목은 객체여야 해요.');
    if (op.op === 'replace' && op.path === '/name' && allowTitle) {
      if (title || r.kind !== 'group' || typeof op.value !== 'string' || !op.value.trim() || [...op.value].length > LIMITS.room_name) fail('대화방 이름 형식이 잘못됐어요.');
      title = op.value.trim();
      continue;
    }
    if (op.op !== 'add' || op.path !== '/messages/-') fail('기존 기록은 고치거나 지울 수 없어요. 새 메시지만 추가하세요.');
    const m = op.value as Record<string, unknown>;
    if (!m || typeof m !== 'object' || typeof m.content !== 'string' || typeof m.sender !== 'string' || typeof m.type !== 'string') fail('메시지에는 content·sender·type 문자열이 필요해요.');
    if (m.type === 'text') events.push({ type: 'message', sender: m.sender, text: m.content });
    else if (m.type === 'exit') {
      if (m.sender !== '-') fail('퇴장 형식이 잘못됐어요.');
      events.push({ type: 'exit', participant: m.content });
    } else if (m.type === 'pause') {
      if (m.sender !== '-') fail('대기 형식이 잘못됐어요.');
      if (!hiddenPause(m.content)) events.push({ type: 'pause', text: m.content });
    } else fail('괴담톡에서 지원하지 않는 메시지 유형이에요.');
  }
  validateEvents(events, r);
  return { events, title };
}

export function validateEvents(events: PEvent[], r: PRoom): void {
  if (events.length > LIMITS.events) fail('한 번에 추가할 수 있는 말풍선 수를 넘었어요.');
  const active = new Set(r.members);
  for (const e of events) {
    if (e.type === 'message') {
      if (!active.has(e.sender) || !e.text.trim()) fail('참여하지 않은 인물의 메시지예요.');
      checkGift(e.text, r.kind === 'dm');
      if (tokens(e.text) > LIMITS.reply_tokens) fail(`답장 한 개는 ${LIMITS.reply_tokens}토큰 이내여야 해요.`);
    } else if (e.type === 'pause') {
      if (!e.text.trim()) fail('대기 설명이 없어요.');
      if (tokens(e.text) > LIMITS.pause_tokens) fail(`대기 설명은 ${LIMITS.pause_tokens}토큰 이내여야 해요.`);
    } else {
      if (r.kind !== 'group' || !active.has(e.participant)) fail('퇴장할 수 없는 참여자예요.');
      active.delete(e.participant);
    }
  }
}

/** 대화방 답장 응답 (<lb-minitalk-patch>[…]</lb-minitalk-patch>, 직접 추가한 연락처는 {contacts,result:{patch}}) */
export function parseReply(raw: string, r: PRoom, contactMode: boolean): { events: PEvent[]; title?: string } {
  let patch: unknown;
  const tagged = /<lb-minitalk-patch>\s*([\s\S]*?)\s*<\/lb-minitalk-patch>/i.exec(raw);
  if (tagged) patch = decodeJson(tagged[1]);
  else {
    const value = decodeJson(raw) as Record<string, unknown> | unknown[];
    if (Array.isArray(value)) patch = value;
    else if (value && typeof value === 'object' && contactMode && value.result && typeof value.result === 'object') patch = (value.result as Record<string, unknown>).patch;
    else if (value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).patch)) patch = (value as Record<string, unknown>).patch;
    else throw new PhoneError('미니톡 응답의 <lb-minitalk-patch> 표식이 없어요.', raw);
  }
  try {
    return eventsFromPatch(patch, r, r.pending?.action.type === 'invite_initial');
  } catch (error) {
    throw new PhoneError((error as Error).message, raw);
  }
}

/** 이벤트 반영 (원본 applyEvents). 받은 말풍선 수 */
export function applyEvents(st: PState, r: PRoom, events: PEvent[], time: string): number {
  let count = 0;
  const before = r.messages.length;
  const waiting = r.kind === 'dm' && conversationState(r).ownerHasNotReplied;
  for (const e of events) {
    if (e.type === 'message') {
      for (const rec of splitRecords(stripForged(e.text))) {
        push(st, r, e.sender, rec, time);
        count++;
      }
    } else if (e.type === 'pause') {
      if (!hiddenPause(e.text)) push(st, r, 'system', e.text, time, 'pause');
    } else membership(st, r, 'exit', e.participant, time);
  }
  r.unread = (r.unread || 0) + count;
  r.silent = r.messages.length === before;
  if (r.kind === 'dm' && count > 0) r.followupSent = !!waiting;
  return count;
}

// ── 공지 ──

export interface Bulletin {
  id: number;
  order: number;
  read: boolean;
  channel: string;
  channelName: string;
  issuer: string;
  category: string;
  title: string;
  text: string;
  time: string;
}
export interface Bulletins {
  version: 2;
  seq: number;
  items: Bulletin[];
  checks: Record<string, unknown>;
  seen: Record<string, boolean>;
  lastIssuedTurns?: Record<string, number>;
}

export function readBulletins(chat: Chat): Bulletins {
  const raw = String(chat.scriptstate?.[PH_BULLETINS] ?? '');
  if (!raw || raw === 'null') return { version: 2, seq: 0, items: [], checks: {}, seen: {} };
  try {
    const v = JSON.parse(raw) as Bulletins;
    if (v && Array.isArray(v.items)) {
      for (const row of v.items) if (row.read === undefined) row.read = true;
      return { version: 2, seq: Number(v.seq) || 0, items: v.items, checks: v.checks ?? {}, seen: v.seen ?? {}, lastIssuedTurns: v.lastIssuedTurns };
    }
  } catch {
    /* 아래 */
  }
  throw new PhoneError('공지 기록을 읽지 못했어요. 원본 기록은 그대로 둬요.');
}

export const bulletinUnread = (b: Bulletins) => b.items.some((r) => r.read === false);
const signature = (row: { channel: string; title: string; text: string }) => JSON.stringify([row.channel, row.title.trim(), row.text.trim()]);

export function trimBulletins(b: Bulletins, cap = STORAGE.notice): void {
  const n = Math.max(0, b.items.length - cap);
  b.items = b.items.slice(n);
  b.seen = {};
  for (const row of b.items) b.seen[signature(row)] = true;
}

export function noticeChannel(chat: Chat): string | null {
  const code = String(chat.scriptstate?.['$st_faction'] ?? '');
  return isFactionCode(code) ? code : null;
}
export function noticeLabel(code: string, names: Record<string, string>): string {
  return code === 'D00' ? '시민 공개 안내' : code === 'E00' ? '특수재난대응협회 안내' : names[code] ?? code;
}

export interface AnnouncementCheck {
  allowed: boolean;
  channel: string;
  channelName: string;
  access: string;
  maxNew: number;
  recent: { issuer: string; category: string; title: string; text: string; time: string }[];
  turn: number;
  minimumTurnGap: number;
}

export function announcementPacket(chat: Chat, set: PhoneSettings, names: Record<string, string>, lore?: LoreEntry[]): AnnouncementCheck {
  const b = readBulletins(chat);
  const channel = noticeChannel(chat);
  const allowed = set.announcements && !!channel && cooldownReady(chat, 'announcement');
  const recent = b.items
    .filter((r) => r.channel === channel)
    .slice(-noticeSettings(chat.scriptstate).history)
    .map((r) => ({ issuer: r.issuer, category: r.category, title: r.title, text: r.text, time: r.time }));
  return {
    allowed, channel: channel ?? '', channelName: channel ? noticeLabel(channel, names) : '',
    access: { civilian: 'public', freelancer: 'registered contractor notices', org: 'current affiliation internal notices' }[factionType(channel ?? '', lore)],
    maxNew: allowed ? LIMITS.notices : 0, recent, turn: storyTurns(chat), minimumTurnGap: noticeSettings(chat.scriptstate).gap,
  };
}

const CATEGORIES = new Set(['공지', '업무', '시설', '인사', '안전']);
export interface NoticeRow {
  issuer: string;
  category: string;
  title: string;
  text: string;
}

export function validateAnnouncements(rows: unknown, packet: AnnouncementCheck | null): NoticeRow[] {
  const list = (rows ?? []) as NoticeRow[];
  if (!Array.isArray(list) || list.length > (packet?.maxNew ?? 0)) fail('한 번에 받을 공지 수를 넘었어요.');
  for (const row of list) {
    if (!row || typeof row.issuer !== 'string' || typeof row.category !== 'string' || typeof row.title !== 'string' || typeof row.text !== 'string') fail('공지 형식이 잘못됐어요.');
    if (!CATEGORIES.has(row.category)) fail('공지 분류가 올바르지 않아요.');
    if (!row.issuer.trim() || [...row.issuer].length > LIMITS.notice_issuer || !row.title.trim() || [...row.title].length > LIMITS.notice_title || !row.text.trim()) fail('공지 발신처·제목·본문을 확인하세요.');
    if (tokens(row.text) > LIMITS.notice_tokens) fail(`공지 한 개는 ${LIMITS.notice_tokens}토큰 이내여야 해요.`);
  }
  return list;
}

export function commitAnnouncements(b: Bulletins, st: PState, rows: NoticeRow[], packet: AnnouncementCheck, time: string): number {
  let added = 0;
  for (const row of rows) {
    const rec = { channel: packet.channel, title: row.title.trim(), text: row.text.trim() };
    const sig = signature(rec);
    if (b.seen[sig]) continue;
    b.seen[sig] = true;
    b.seq += 1;
    st.mid += 1;
    b.items.push({ id: b.seq, order: st.mid, read: false, channel: packet.channel, channelName: packet.channelName, issuer: row.issuer.trim(), category: row.category, title: rec.title, text: rec.text, time });
    added++;
  }
  if (added && packet.allowed) b.lastIssuedTurns = { ...(b.lastIssuedTurns ?? {}), [packet.channel]: packet.turn };
  return added;
}

// ── 단톡방 초대 ──

export interface InvitationCheck {
  allowed: boolean;
  maxNew: number;
  candidates: string[];
  existingGroups: { name: string; members: string[] }[];
}

export function invitationPacket(st: PState, candidates: string[], allowed: boolean): InvitationCheck {
  const ok = allowed && candidates.length >= 2;
  return {
    allowed: ok, maxNew: ok ? LIMITS.invitations : 0, candidates,
    existingGroups: Object.values(st.rooms).filter((r) => r.kind === 'group').map((r) => ({ name: roomLabel(r), members: r.members })),
  };
}

export function validateInvitations(rows: unknown, packet: InvitationCheck | null, st: PState, dir: Directory): PRoom[] {
  const list = (rows ?? []) as Record<string, unknown>[];
  if (!Array.isArray(list) || list.length > (packet?.maxNew ?? 0)) fail('한 번에 받을 단톡방 초대 수를 넘었어요.');
  const allowed = new Set(packet?.candidates ?? []);
  const sig = (m: string[]) => [...m].sort().join(',');
  const out: PRoom[] = [];
  const fresh = new Set<string>();
  for (const row of list) {
    if (!row || typeof row.inviter !== 'string' || !Array.isArray(row.members) || typeof row.name !== 'string' || !Array.isArray(row.patch)) fail('단톡방 초대 형식이 잘못됐어요.');
    const name = row.name.trim();
    if (!name || [...name].length > LIMITS.room_name) fail('초대할 단톡방 이름이 길이 제한을 넘었어요.');
    const members = row.members as string[];
    if (members.length < 2 || members.length > LIMITS.members) fail('단톡방에는 NPC 2명 이상이 필요하고 최대 인원을 넘을 수 없어요.');
    const people: Record<string, PPerson> = {};
    for (const cid of members) {
      const c = dir.map.get(cid);
      if (typeof cid !== 'string' || !allowed.has(cid) || !c || people[cid]) fail('단톡방 초대에 허용되지 않거나 중복된 참여자가 있어요.');
      people[cid] = personOf(c);
    }
    if (!people[row.inviter]) fail('초대한 인물은 단톡방 참여자여야 해요.');
    const key = `${name}\0${sig(members)}`;
    if (fresh.has(key)) fail('같은 단톡방 초대가 중복됐어요.');
    fresh.add(key);
    for (const r of Object.values(st.rooms)) if (r.kind === 'group' && roomLabel(r).trim() === name && sig(r.members) === sig(members)) fail('같은 이름과 참여자의 단톡방이 이미 있어요.');
    const room: PRoom = { id: '', kind: 'group', name, members: [...members], people, messages: [], draft: '', unread: 0, inviter: row.inviter };
    (room as PRoom & { events?: PEvent[] }).events = eventsFromPatch(row.patch, room, false).events;
    out.push(room);
  }
  return out;
}

export function commitInvitations(st: PState, rooms: PRoom[], time: string): number {
  let received = 0;
  for (const r of rooms) {
    do st.seq += 1;
    while (st.rooms[`g_${st.seq}`]);
    r.id = `g_${st.seq}`;
    st.rooms[r.id] = r;
    st.order.push(r.id);
    const m = push(st, r, 'system', `${r.people[r.inviter!].name}님이 나를 단톡방에 초대했습니다.`, time, 'invite');
    m.participant = 'me';
    m.inviter = r.inviter;
    const events = (r as PRoom & { events?: PEvent[] }).events ?? [];
    delete (r as PRoom & { events?: PEvent[] }).events;
    r.unread = 1;
    received += applyEvents(st, r, events, time);
    r.silent = false;
  }
  return received;
}

// ── 전체 새 메시지 확인 응답 ──

export interface RefreshResult {
  updates: { room: string; events: PEvent[] }[];
  announcements: NoticeRow[];
  invitations: PRoom[];
}

export function parseRefresh(
  raw: string, selected: Map<string, PRoom>, receive: Map<string, boolean>, announce: AnnouncementCheck, invite: InvitationCheck, st: PState, dir: Directory, contactMode: boolean,
): RefreshResult {
  try {
    let value = decodeJson(raw) as Record<string, unknown>;
    if (contactMode && value && typeof value.result === 'object' && value.result) value = value.result as Record<string, unknown>;
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('새로고침 형식이 올바르지 않아요.');
    const updates = (value.updates ?? []) as Record<string, unknown>[];
    if (!Array.isArray(updates)) fail('updates는 배열이어야 해요.');
    const announcements = validateAnnouncements(value.announcements, announce);
    const invitations = validateInvitations(value.invitations, invite, st, dir);
    const used = new Set<string>();
    const out: RefreshResult['updates'] = [];
    for (const u of updates) {
      if (!u || typeof u.room !== 'string' || !selected.has(u.room) || used.has(u.room)) fail('중복되거나 허용되지 않은 대화방이에요.');
      used.add(u.room);
      const r = selected.get(u.room)!;
      const { events } = eventsFromPatch(u.patch ?? [], r, false);
      if (events.length && receive.get(u.room) === false) fail('선톡 받기 설정이나 이번 확률 검사에서 허용하지 않은 방이에요.');
      out.push({ room: u.room, events });
    }
    return { updates: out, announcements, invitations };
  } catch (error) {
    throw new PhoneError((error as Error).message, raw);
  }
}

// ── 본편 요청에 넣는 기록 (원본 mainContext + RC.contextPack) ──

export function mainContext(st: PState, b: Bulletins, set: PhoneSettings, rules: string): string {
  if (!set.context) return '';
  const recent: { order: number; id: string; data: Record<string, unknown>; notice: boolean }[] = [];
  if (set.contextMessages) {
    for (const r of Object.values(st.rooms)) {
      for (const m of r.messages) {
        if (m.kind === 'pause' && hiddenPause(m.text)) continue;
        recent.push({
          order: m.id, id: `message:${m.id}`, notice: false,
          data: {
            room: r.id, title: roomLabel(r), recipients: m.audience.map((c) => r.people[c]?.name ?? c), kind: m.kind,
            sender: m.sender === 'me' ? '주인공' : m.sender === 'system' ? 'system' : r.people[m.sender]?.name ?? m.sender, text: describe(m.text), time: m.time, order: m.id,
          },
        });
      }
    }
  }
  if (set.contextAnnouncements) {
    for (const a of b.items.slice(-HISTORY.contextNotices)) {
      recent.push({
        order: a.order, id: `notice:${a.order}`, notice: true,
        data: { kind: 'announcement', channel: a.channel, title: a.title, sender: a.issuer, text: a.text, time: a.time, order: a.order, recipients: ['주인공'], access: 'received by owner; audience bounded by channel' },
      });
    }
  }
  recent.sort((x, y) => y.order - x.order);
  const kept: Record<string, unknown>[] = [];
  const payload = () => `[MODULE_CONTEXT_BEGIN]\n${rules}\n${JSON.stringify({ feature: 'phone', records: kept })}\n[MODULE_CONTEXT_END]`;
  let counted = 0;
  for (const item of recent) {
    if (!item.notice && counted >= HISTORY.context) continue;
    kept.unshift(item.data);
    if (tokens(payload()) > HISTORY.contextTokens) kept.shift();
    else if (!item.notice) counted++;
  }
  return kept.length ? payload() : '';
}

// ── 전화 (원본 PHONE_CALL) ──
// 채팅에 남는 기록: %%PHONE_CALL:<상대 이름 hex>%%\n<요청 본문>\n%%/PHONE_CALL%%
// 화면에는 카드만, 모델 요청에는 본문만 간다. 본문의 {{user}}는 Risu가 페르소나 이름으로 바꾼다.

const CALL_RE = /%%PHONE_CALL:([0-9a-f]*)%%\r?\n([\s\S]*?)\r?\n%%\/PHONE_CALL%%/g;
const fromHex = (h: string) => new TextDecoder().decode(new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16))));

export function callRecord(target: string, purpose: string): string {
  const body = `{{user}} places a phone call to ${target}.${purpose.trim() ? `\n\n${purpose.trim()}` : ''}`;
  return `%%PHONE_CALL:${hex(target)}%%\n${body}\n%%/PHONE_CALL%%`;
}
export const hasCall = (t: string) => typeof t === 'string' && t.includes('%%PHONE_CALL:');
export function stripCall(t: string): string {
  return t.replace(CALL_RE, (_, __, body: string) => body);
}
export function renderCalls(t: string, render: (target: string) => string): string {
  return t.replace(CALL_RE, (all, h: string) => {
    try {
      return render(fromHex(h));
    } catch {
      return all;
    }
  });
}
export function validCallTarget(name: string): boolean {
  const n = name.trim();
  return !!n && [...n].length <= 60 && !/[\r\n<>[\]{}]/.test(n);
}

// ── 그 밖 ──

export function agentStatus(chat: Chat, agentId: string | undefined): { state: string; situation: string; since: string } | undefined {
  if (!agentId) return undefined;
  const rec = readWorld(chat).agents[agentId];
  if (!rec) return undefined;
  return { state: rec.st, situation: rec.situation, since: rec.since === null ? '' : String(rec.since) };
}

export function phoneTime(chat: Chat): string {
  return dateNow(chat);
}

export function writePhone(chat: Chat, st: PState, extra: Record<string, string> = {}): Chat {
  trimRooms(st, { dm: storageCap(chat.scriptstate, 'dm'), group: storageCap(chat.scriptstate, 'group') });
  return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [PH_STATE]: JSON.stringify(st), [PH_UNREAD]: roomUnread(st) ? '1' : '0', ...extra } };
}
export function writeBulletins(b: Bulletins, state?: Record<string, unknown>): Record<string, string> {
  trimBulletins(b, storageCap(state, 'notice'));
  return { [PH_BULLETINS]: JSON.stringify(b) };
}

export { cut };
