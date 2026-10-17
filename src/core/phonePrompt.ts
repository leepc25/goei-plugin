// 괴담톡 요청문 (원본 buildPrompt·refreshPrompt·ruleBuilder·contactPrompts).
// 지침은 카드의 Phone 로어북 @@SECTION을 요청 조건에 맞는 것만 골라 이어 붙이고, 자료는 JSON 하나로 보낸다.
import { publicBoard } from './gnetPrompt';
import { readGnet } from './gnet';
import {
  agentStatus, announcementPacket, chancePassed, conversationState, hasAttachment, invitationPacket, LIMITS, HISTORY, listedRooms, phoneSettings,
  refreshAllowed, roomLabel, PhoneError, type AnnouncementCheck, type Contact, type Directory, type InvitationCheck, type PMsg, type PPerson, type PRoom,
  type PState, phoneTime, emptyPause, cooldownReady,
} from './phone';
import { bookText, collectRefs, factionCodesToNames, policySections, recentTurns, type RefSource } from './refs';

export interface PhonePrompt {
  messages: { role: 'system' | 'user'; content: string }[];
  contactMode: boolean;
}

const LANGUAGE = 'Reply in the dominant language of the actual conversation; default to Korean when no conversation is available.';

function sections(src: RefSource): Record<string, string> {
  const p = policySections(src.char.globalLore, 'Phone');
  if (!Object.keys(p).length) throw new PhoneError('Phone 로어북을 찾지 못했어요.');
  return p;
}

function section(p: Record<string, string>, name: string): string {
  const raw = p[name];
  if (raw === undefined) throw new PhoneError(`Phone 로어북의 ${name} 항목이 없어요.`);
  return raw
    .replace(/__LIMIT_(\w+?)__/g, (m, k: string) => (k in LIMITS ? String(LIMITS[k as keyof typeof LIMITS]) : m))
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

export function mainContextRules(src: RefSource): string | null {
  return policySections(src.char.globalLore, 'Phone').MAIN_CONTEXT?.trim() || null;
}

interface Body {
  room?: RoomPacket;
  rooms?: RoomPacket[];
  participants: Participant[];
  narratorOnly: Narrator;
  crossRoomMessages?: unknown[];
  publicBoard?: unknown;
  announcementCheck?: Omit<AnnouncementCheck, 'channel'>;
  activityCheck?: { incoming: boolean; groupInvites: boolean };
  invitationCheck?: InvitationCheck;
  recipientEvidenceSources?: { id: string; kind: string; text: string; sender?: string }[];
  singlePassContact?: boolean;
}

/** 원본 ruleBuilder: 실제 요청에 해당하는 섹션만 */
function rules(src: RefSource, body: Body, mode: 'REPLY' | 'REFRESH'): string {
  const p = sections(src);
  const keys = ['COMMON'];
  let direct = false;
  let group = false;
  for (const r of body.rooms ?? (body.room ? [body.room] : [])) {
    if (r.receiveMessages === false) continue;
    if (r.kind === 'group') group = true;
    else direct = true;
  }
  if (body.invitationCheck?.allowed) group = true;
  const manual = body.participants.some((x) => x.manuallySavedContact);
  if (direct || group) {
    keys.push('CONVERSATION');
    if (direct) keys.push('DIRECT_ROOMS');
    if (group) keys.push('GROUP_ROOMS');
    if ((body.publicBoard as { posts?: unknown[] } | undefined)?.posts?.length) keys.push('PUBLIC_BOARD');
    if (body.crossRoomMessages?.length || (body.rooms?.length ?? 0) > 1) keys.push('CROSS_ROOM');
    if (hasAttachment(JSON.stringify(body))) keys.push('ATTACHMENT_READ');
    keys.push('ATTACHMENT_OUTPUT', 'PATCH');
  }
  keys.push(mode);
  if (mode === 'REPLY') {
    const action = body.room?.action?.type ?? 'refresh';
    const map: Record<string, string> = { send: 'ACTION_SEND', invite_initial: 'ACTION_INVITE_INITIAL', invite_more: 'ACTION_INVITE_MORE', refresh: 'ACTION_REFRESH' };
    keys.push(map[action] ?? 'ACTION_REFRESH');
  } else {
    if (body.invitationCheck?.allowed) keys.push('GROUP_INVITES');
    if (body.announcementCheck?.allowed) keys.push('ANNOUNCEMENTS');
  }
  if (manual) keys.push('MANUAL_CONTACT', 'CONTACT_CONTEXT', 'SINGLE_PASS_CONTACT');
  keys.push(`OUTPUT_${manual ? 'CONTACT_' : ''}${mode}`);
  return [...keys.map((k) => section(p, k)), LANGUAGE].join('\n\n');
}

// ── 자료 ──

interface RoomPacket {
  id: string;
  kind: 'dm' | 'group';
  name: string;
  privateDirection: string;
  activeMembers: string[];
  participants: { id: string; name?: string }[];
  pov: 'me';
  messages: { sender: string; type: string; time: string; content: string; audience: string[]; recordID: number }[];
  conversationState: ReturnType<typeof conversationState> & { directReplyPending?: boolean; followupAlreadySent?: boolean; defaultNextAction?: string };
  candidateOnly: boolean;
  directoryEstablishesRelationship: false;
  action: { type: string; invited?: string[] };
  receiveMessages?: boolean;
}

export function roomPacket(r: PRoom): RoomPacket {
  const messages = r.messages
    .slice(-HISTORY.room)
    .filter((m) => m.kind !== 'pause' || !emptyPause(m.text))
    .map((m) => ({
      sender: m.sender === 'system' ? '-' : m.sender,
      type: m.kind === 'message' ? 'text' : m.kind === 'invite' ? 'invited' : m.kind,
      time: m.time,
      content: m.kind === 'invite' || m.kind === 'exit' ? m.participant ?? '' : m.text,
      audience: m.audience,
      recordID: m.id,
    }));
  const participants: RoomPacket['participants'] = [{ id: 'me' }, ...Object.entries(r.people).map(([id, c]) => ({ id, name: c.name }))];
  const hasTalk = !!r.conversationBaseline?.lastSender || r.messages.some((m) => m.kind === 'message');
  const conv: RoomPacket['conversationState'] = conversationState(r);
  conv.directReplyPending = r.kind === 'dm' && !!conv.ownerHasNotReplied;
  conv.followupAlreadySent = conv.directReplyPending ? !!r.followupSent : false;
  if (conv.directReplyPending) conv.defaultNextAction = 'wait_for_owner';
  return {
    id: r.id, kind: r.kind, name: roomLabel(r), privateDirection: r.topic ?? '', activeMembers: r.members, participants, pov: 'me', messages,
    conversationState: conv, candidateOnly: !hasTalk && r.kind === 'dm', directoryEstablishesRelationship: false, action: r.pending?.action ?? { type: 'refresh' },
  };
}

interface Participant {
  sender: string;
  name: string;
  faction?: string;
  factionDisplayName?: string;
  rank?: string;
  department?: string;
  source: string;
  lore: string;
  hasCharacterLore: boolean;
  manuallySavedContact: boolean;
  contactMemo?: string;
  narratorOnlyAgentStatus?: unknown;
}

function participant(src: RefSource, c: PPerson, related: boolean, status: boolean, names: Record<string, string>): Participant {
  let lore = '';
  let title = '';
  if (related) {
    const candidates = c.custom ? [c.name] : c.lore ? [c.lore] : [`${c.english} ${c.name}`, `${c.name} ${c.english}`, c.name, c.english ?? ''];
    for (const n of candidates) {
      const t = bookText(src, n);
      if (t) {
        lore = t;
        title = n;
        break;
      }
    }
  }
  return {
    sender: c.id, name: c.name, faction: c.group, factionDisplayName: names[c.group ?? ''] ?? c.group, rank: c.rank, department: c.department, source: title, lore,
    hasCharacterLore: !!lore.trim(), manuallySavedContact: !!c.custom, contactMemo: c.custom ? c.note ?? '' : undefined,
    narratorOnlyAgentStatus: status && c.agentId ? agentStatus(src.chat, c.agentId) : undefined,
  };
}

interface Narrator {
  owner: { name: string; faction: string; factionDisplayName: string };
  recentStory: { role: string; text: string; turn: number }[];
  currentSceneEntries: number;
  currentSceneTime: string;
  factionLabels: Record<string, string>;
  universe: { characterDescription: string; authorsNote: string; activeLoreBooks: { source: string; content: string; kind: string }[] };
}

function narrator(src: RefSource, names: Record<string, string>, related: boolean, text: string): Narrator {
  const turns = recentTurns(src.chat, HISTORY.turns);
  const recentStory: Narrator['recentStory'] = [];
  turns.forEach((t, i) => {
    if (t.user) recentStory.push({ role: 'user', text: t.user, turn: i + 1 });
    for (const c of t.char) recentStory.push({ role: 'char', text: c, turn: i + 1 });
  });
  const last = turns[turns.length - 1];
  const faction = String(src.chat.scriptstate?.['$st_faction'] ?? '') || 'none';
  const rows = collectRefs(src, { scope: 'phone', text: `${text}\n${recentStory.map((m) => m.text).join('\n')}`, related, secondary: false });
  const universe: Narrator['universe'] = { characterDescription: '', authorsNote: '', activeLoreBooks: [] };
  for (const r of rows) {
    if (r.sources.includes('봇 설명') && r.kind === 'base') universe.characterDescription = r.content;
    else if (r.sources.includes('작가 노트') && r.kind === 'base') universe.authorsNote = r.content;
    else universe.activeLoreBooks.push({ source: r.sources.join(' / '), content: r.content, kind: r.kind });
  }
  return {
    owner: { name: '주인공', faction, factionDisplayName: names[faction] ?? faction },
    recentStory, currentSceneEntries: last ? (last.user ? 1 : 0) + last.char.length : 0, currentSceneTime: phoneTime(src.chat), factionLabels: names, universe,
  };
}

/** 다른 방에서 이 참여자들이 보내거나 받은 말 (원본 P.bindCrossRoomMemory) */
function crossRoom(body: Body, st: PState): void {
  const wanted = new Set(body.participants.map((p) => p.sender));
  if (!wanted.size) return;
  const covered = new Set((body.rooms ?? (body.room ? [body.room] : [])).map((r) => r.id));
  const counts = new Map<string, number>();
  const candidates: { room: PRoom; m: PMsg; allowed: Set<string> }[] = [];
  for (const [rid, r] of Object.entries(st.rooms)) {
    if (covered.has(rid)) continue;
    for (const m of r.messages) {
      if (m.kind !== 'message' || m.sender === 'system') continue;
      const allowed = new Set<string>();
      if (wanted.has(m.sender)) allowed.add(m.sender);
      for (const c of m.audience ?? []) if (wanted.has(c)) allowed.add(c);
      if (allowed.size) candidates.push({ room: r, m, allowed });
    }
  }
  candidates.sort((a, b) => b.m.id - a.m.id || a.room.id.localeCompare(b.room.id));
  const records: unknown[] = [];
  for (const e of candidates) {
    const knownBy: string[] = [];
    for (const c of e.allowed) {
      const n = counts.get(c) ?? 0;
      if (n < HISTORY.room) {
        counts.set(c, n + 1);
        knownBy.push(c);
      }
    }
    if (knownBy.length) {
      records.push({
        room: e.room.id, roomName: e.room.kind === 'group' ? e.room.name : undefined, kind: e.room.kind, recordID: e.m.id, sender: e.m.sender,
        senderName: e.room.people[e.m.sender]?.name, time: e.m.time, content: e.m.text, knownBy: knownBy.sort(),
      });
    }
  }
  if (records.length) body.crossRoomMessages = records.reverse();
}

/** 직접 추가한 연락처: 관계·지식 근거로 고를 원문 목록 (원본 contactSources) */
function contactSources(body: Body): NonNullable<Body['recipientEvidenceSources']> {
  const out: NonNullable<Body['recipientEvidenceSources']> = [];
  const add = (kind: string, text: unknown, sender?: string) => {
    const t = String(text ?? '').trim();
    if (t) out.push({ id: `s${out.length + 1}`, kind, text: t, ...(sender ? { sender } : {}) });
  };
  const u = body.narratorOnly.universe;
  add('world', u.characterDescription);
  add('author_note', u.authorsNote);
  for (const b of u.activeLoreBooks) add('world', b.content);
  for (const m of body.narratorOnly.recentStory) add(m.role === 'user' ? 'story_input' : 'story', m.text);
  for (const p of body.participants) {
    add('character', p.lore, p.sender);
    add('contact_memo', p.contactMemo, p.sender);
    if (p.narratorOnlyAgentStatus) add('status', JSON.stringify(p.narratorOnlyAgentStatus), p.sender);
  }
  for (const r of body.rooms ?? (body.room ? [body.room] : [])) {
    for (const c of r.activeMembers) add('private_direction', r.privateDirection, c);
    for (const m of r.messages) if (m.type === 'text') for (const c of m.audience ?? []) if (c !== m.sender) add('received_message', m.content, c);
  }
  for (const m of (body.crossRoomMessages ?? []) as { knownBy: string[]; sender: string; content: string }[]) for (const c of m.knownBy) if (c !== m.sender) add('received_message', m.content, c);
  for (const post of ((body.publicBoard as { posts?: unknown[] } | undefined)?.posts ?? [])) add('public_board', JSON.stringify(post));
  return out;
}

function finish(src: RefSource, body: Body, mode: 'REPLY' | 'REFRESH', names: Record<string, string>): PhonePrompt {
  const contactMode = body.participants.some((p) => p.manuallySavedContact);
  if (contactMode) {
    body.recipientEvidenceSources = contactSources(body);
    body.singlePassContact = true;
  }
  const system = rules(src, body, mode);
  return {
    messages: [
      { role: 'system', content: factionCodesToNames(system, names) },
      { role: 'user', content: factionCodesToNames(JSON.stringify(body), names) },
    ],
    contactMode,
  };
}

function gnetBoard(src: RefSource, query: string): unknown {
  try {
    return publicBoard(readGnet(src.chat), query) ?? undefined;
  } catch {
    return undefined;
  }
}

/** 한 방에 대한 답장 요청 (보내기·단톡 만들기·초대·방 새로고침) */
export function replyPrompt(src: RefSource, st: PState, r: PRoom, dir: Directory, names: Record<string, string>): PhonePrompt {
  const set = phoneSettings(src.chat.scriptstate);
  const packet = roomPacket(r);
  const participants = r.members.map((cid) => participant(src, dir.map.get(cid) ?? r.people[cid] ?? { id: cid, name: cid }, set.related, set.status, names));
  const body: Body = { room: packet, participants, narratorOnly: narrator(src, names, set.related, JSON.stringify(packet)) };
  crossRoom(body, st);
  body.publicBoard = gnetBoard(src, JSON.stringify(packet));
  return finish(src, body, 'REPLY', names);
}

export interface RefreshPlan {
  prompt: PhonePrompt | null;
  selected: Map<string, PRoom>;
  receive: Map<string, boolean>;
  announce: AnnouncementCheck;
  invite: InvitationCheck;
  /** 확률·대기로 이번에 아무것도 묻지 않은 이유 */
  reason: string;
}

/** 전체 새 메시지 확인 (원본 refreshPrompt): 대화 중인 방 + 공개된 연락처 전부 + 공지 + 단톡 초대 */
export function refreshPrompt(src: RefSource, st: PState, dir: Directory, names: Record<string, string>, rng: () => number): RefreshPlan {
  const chat = src.chat;
  const set = phoneSettings(chat.scriptstate);
  const inviteOn = set.invites && cooldownReady(chat, 'invitation') && chancePassed(set.inviteChance, rng);
  const incomingOn = set.incoming && cooldownReady(chat, 'incoming') && chancePassed(set.incomingChance, rng);
  const announce = announcementPacket(chat, set, names, src.char.globalLore);
  const candidates: PRoom[] = [];
  const seen = new Set<string>();
  for (const rid of listedRooms(st)) {
    const r = st.rooms[rid];
    if (!r.pending && r.members.length && (refreshAllowed(chat, r, set, incomingOn)[0] || inviteOn)) {
      candidates.push(r);
      seen.add(rid);
    }
  }
  if (incomingOn || inviteOn) {
    for (const c of dir.contacts) {
      const rid = `dm_${c.id}`;
      const existing = st.rooms[rid];
      if (seen.has(rid) || existing?.pending) continue;
      if (existing && !(refreshAllowed(chat, existing, set, incomingOn)[0] || inviteOn)) continue;
      candidates.push(existing ?? { id: rid, kind: 'dm', members: [c.id], people: { [c.id]: personOfContact(c) }, messages: [], draft: '', unread: 0 });
      seen.add(rid);
    }
  }
  const selected = new Map<string, PRoom>();
  const receive = new Map<string, boolean>();
  const emptyInvite = invitationPacket(st, [], false);
  if (!candidates.length && !announce.allowed) {
    const why = !set.incoming && !set.invites ? '선톡·단톡 초대 받기가 모두 꺼져 있어요.' : '이번 확인은 대기 턴이나 요청 확률에 따라 건너뛰었어요.';
    return { prompt: null, selected, receive, announce, invite: emptyInvite, reason: why };
  }
  const rooms: RoomPacket[] = [];
  const memo = new Map<string, Participant>();
  for (const r of candidates) {
    const packet = roomPacket(r);
    packet.action = { type: 'refresh' };
    packet.receiveMessages = refreshAllowed(chat, r, set, incomingOn)[0];
    rooms.push(packet);
    selected.set(r.id, r);
    receive.set(r.id, packet.receiveMessages);
    for (const cid of r.members) {
      if (!memo.has(cid)) memo.set(cid, participant(src, dir.map.get(cid) ?? r.people[cid] ?? { id: cid, name: cid }, set.related, set.status, names));
    }
  }
  const participants = [...memo.values()];
  const { channel: _channel, ...publicAnnounce } = announce;
  void _channel;
  const invite = invitationPacket(st, participants.map((p) => p.sender), inviteOn);
  const body: Body = {
    rooms, participants, narratorOnly: narrator(src, names, set.related, JSON.stringify(rooms)), announcementCheck: publicAnnounce,
    activityCheck: { incoming: incomingOn, groupInvites: inviteOn }, invitationCheck: invite,
  };
  crossRoom(body, st);
  body.publicBoard = gnetBoard(src, JSON.stringify(rooms));
  return { prompt: finish(src, body, 'REFRESH', names), selected, receive, announce, invite, reason: '' };
}

function personOfContact(c: Contact): PPerson {
  const p: PPerson = { id: c.id, name: c.name };
  for (const k of ['agentId', 'english', 'lore', 'group', 'rank', 'department', 'note'] as const) if (c[k]) p[k] = c[k];
  if (c.custom) p.custom = true;
  return p;
}

/** 새로고침 응답이 형식에 안 맞을 때 같은 자료로 한 번 더 (원본 재시도 문구) */
export function refreshRetry(prompt: PhonePrompt, reason: string): PhonePrompt['messages'] {
  const [sys, user] = prompt.messages;
  return [
    {
      role: 'system',
      content: `${sys.content}\nThe previous response was rejected and nothing was saved. Recreate the complete result from the same supplied data, following the REFRESH OUTPUT CONTRACT. Return a compact COMPLETE JSON object. The configured message lengths/counts are ceilings, not targets; reduce optional messages rather than ending mid-JSON. Omit silent rooms from updates. Use valid JSON string escaping for newlines, quotation marks and backslashes. Do not copy these instructions into messages. Validation error: ${reason.slice(0, 600)}`,
    },
    user,
  ];
}
