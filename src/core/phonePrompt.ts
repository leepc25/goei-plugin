// 괴담톡 요청문 (원본 buildPrompt·refreshPrompt·ruleBuilder·contactPrompts).
// 지침은 카드의 Phone 로어북 @@SECTION을 요청 조건에 맞는 것만 골라 이어 붙이고, 자료는 JSON 하나로 보낸다.
import { sitePicAsPhoto } from './attach';
import { publicAccess, publicBoard } from './gnetPrompt';
import { readGnet } from './gnet';
import {
  agentStatus, announcementPacket, chancePassed, conversationState, eventCap, hasAttachment, invitationPacket, LIMITS, HISTORY, listedRooms, phoneSettings,
  refreshAllowed, roomLabel, PhoneError, type AnnouncementCheck, type Contact, type Directory, type InvitationCheck, type PMsg, type PPerson, type PRoom,
  type PState, phoneTime, hiddenPause, cooldownReady, readHabits,
} from './phone';
import { applyAdvanced, genSettings, type RefToggles } from './advanced';
import { fnHistory, fnNum, fnRefs } from './reffn';
import { previousView, viewSettings, type ViewRoom } from './phoneView';
import { craftMessages, craftSettings, memoTexts, retryAnalyze, type CraftMessage } from './craft';
import { fillVars } from './guides';
import { trimRelated, trimSecondary, trimTurns } from './budget';
import { playerAgent } from './player';
import { bookText, PERSONA_SOURCE, collectRefs, factionCodesToNames, policySections, recentTurns, type RefSource } from './refs';

export interface PhonePrompt {
  messages: CraftMessage[];
  contactMode: boolean;
  /** 새로고침 응답이 형식에 안 맞을 때 다시 묻는 글 (지침 절 RETRY.REFRESH). 없으면 코드에 남긴 글 */
  retryRule?: string;
}

const LANGUAGE = 'Reply in the dominant language of the actual conversation; default to Korean when no conversation is available.';

/** 언어 문장: 지침 「괴담톡」 LANGUAGE 절 (없으면 위 글) */
const languageLine = (p: Record<string, string>): string => p.LANGUAGE?.trim() || LANGUAGE;

function sections(src: RefSource): Record<string, string> {
  applyAdvanced(src.chat.scriptstate);
  const p = policySections(src.char.globalLore, 'Phone');
  if (!Object.keys(p).length) throw new PhoneError('Phone 로어북을 찾지 못했어요.');
  return p;
}

function section(p: Record<string, string>, name: string, limits: Partial<Record<keyof typeof LIMITS, number>> = {}): string {
  const raw = p[name];
  if (raw === undefined) throw new PhoneError(`Phone 로어북의 ${name} 항목이 없어요.`);
  return raw
    .replace(/__LIMIT_(\w+?)__/g, (m, k: string) => (k in LIMITS ? String(limits[k as keyof typeof LIMITS] ?? LIMITS[k as keyof typeof LIMITS]) : m))
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
  textingHabits?: { sender: string; note: string }[];
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
    // 이모지 반응 (라이트보드 미니톡, 2026-11-06). 옛 카드에 절이 없으면 붙이지 않는다
    if (phoneSettings(src.chat.scriptstate).reactions && p.REACTIONS !== undefined) keys.push('REACTIONS');
  }
  keys.push(mode);
  if (mode === 'REPLY') {
    const action = body.room?.action?.type ?? 'refresh';
    const map: Record<string, string> = { send: 'ACTION_SEND', invite_initial: 'ACTION_INVITE_INITIAL', invite_more: 'ACTION_INVITE_MORE', refresh: 'ACTION_REFRESH' };
    keys.push(map[action] ?? 'ACTION_REFRESH');
  } else {
    if (body.rooms?.some((x) => x.banter) && p.BANTER !== undefined) keys.push('BANTER');
    if (body.invitationCheck?.allowed) keys.push('GROUP_INVITES');
    if (body.announcementCheck?.allowed) keys.push('ANNOUNCEMENTS');
  }
  // 직접 추가한 연락처: 「저장한 이름만으로는 친분이 없다」 규칙만. 관계·지식 근거 뽑기는 뺐고, 처음 연락하는 사이는 앱이 판정해 relationshipToOwner 로 넘긴다 (사용자 11-13 7번 (가))
  if (manual) keys.push('MANUAL_CONTACT');
  keys.push(`OUTPUT_${mode}`);
  // 말버릇 기록 (라이트보드 미니톡, 2026-11-06). 출력 계약 뒤에 붙는 유일한 예외 칸이라 맨 끝에 둔다
  if ((direct || group) && phoneSettings(src.chat.scriptstate).habits && p.HABITS !== undefined) keys.push('HABITS');
  const br = phoneSettings(src.chat.scriptstate).banterRows;
  // 수다가 든 확인 요청은 방마다 말풍선 상한을 수다 줄 수까지: 지침 숫자와 저장 상한을 맞춘다 (전수검사 11-13)
  const limits = { events: eventCap(src.chat.scriptstate, mode === 'REFRESH' && !!body.rooms?.some((x) => x.banter)) };
  return [...keys.map((k) => dropSitePicGuide(section(p, k, limits)).replace(/__PH_BANTER_RANGE__/g, br[0] === br[1] ? String(br[0]) : `${br[0]}-${br[1]}`)), genSettings(src.chat.scriptstate).language ?? languageLine(p)].join('\n\n');
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
  messages: { sender: string; type: string; time: string; content: string; audience: string[]; recordID: number; reactions?: string }[];
  conversationState: ReturnType<typeof conversationState> & { directReplyPending?: boolean; followupAlreadySent?: boolean; defaultNextAction?: string };
  candidateOnly: boolean;
  directoryEstablishesRelationship: false;
  action: { type: string; invited?: string[] };
  receiveMessages?: boolean;
  /** 단톡 수다를 꼭 만들 방 */
  banter?: boolean;
}

/** 인물이 에셋 그림을 사진으로 보내던 기능은 괴담톡에서 뺐다 (2026-11-12 사용자: 감정 표시처럼 썼다). 고쳐 저장해 둔 옛 지침에 그 줄이 남아 있으면 지운다 */
const SITE_PIC_GUIDE = 'Real photos: when the subject is one of the pictures listed below, an NPC may send [사진:Name] instead of a photo description, or [사진:Name_expression] for a person in the People list; the app shows the actual picture. Write the listed name exactly, on its own line inside the content/body string. Anything not listed stays a described [[ATTACH:photo]]. Send one only when that character would plausibly have or take such a photo.';
const dropSitePicGuide = (text: string): string => (text.includes('__SITE_PICS__') ? text.split('\n').filter((l) => l.trim() !== '__SITE_PICS__' && l.trim() !== SITE_PIC_GUIDE).join('\n') : text);

/** limit = 넘길 말풍선 수 (양 표의 그 기능 줄 「지난 기록」) */
export function roomPacket(r: PRoom, reactions = false, limit = HISTORY.room): RoomPacket {
  const messages = r.messages
    .slice(-limit)
    .filter((m) => m.kind !== 'pause' || !hiddenPause(m.text))
    .map((m) => ({
      sender: m.sender === 'system' ? '-' : m.sender,
      type: m.kind === 'message' ? 'text' : m.kind === 'invite' ? 'invited' : m.kind,
      time: m.time,
      content: m.kind === 'invite' || m.kind === 'exit' ? m.participant ?? '' : m.kind === 'skip' ? '-' : sitePicAsPhoto(m.text),
      audience: m.audience,
      recordID: m.id,
      ...(reactions && m.kind === 'message' ? { reactions: m.reactions || '-' } : {}),
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
  relationshipToOwner?: string;
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
  owner: { name: string; faction: string; factionDisplayName: string; character?: string; rank?: string };
  recentStory: { role: string; text: string; turn: number }[];
  currentSceneEntries: number;
  currentSceneTime: string;
  factionLabels: Record<string, string>;
  universe: { characterDescription: string; authorsNote: string; userPersona?: string; activeLoreBooks: { source: string; content: string; kind: string }[] };
}

/** 캐릭터로 플레이: 폰 주인이 어느 요원인지 (이름·직급). 다른 요원은 로어북의 관계대로 대한다 */
function ownerCharacter(src: RefSource): { character?: string; rank?: string } {
  const a = playerAgent(src.char.globalLore, src.chat.scriptstate);
  return a ? { character: a.name, ...(a.rank ? { rank: a.rank } : {}) } : {};
}

/** fn = 기능(요청 종류): 넘길 내용·챗로그 턴 수를 기능 표·양 표의 그 줄에서 읽는다 (core/reffn.ts) */
function narrator(src: RefSource, names: Record<string, string>, fn: string, t: RefToggles, text: string): Narrator {
  applyAdvanced(src.chat.scriptstate);
  const n = trimTurns(fnNum(src.chat.scriptstate, 'ph', fn, 'turns'));
  const turns = n ? recentTurns(src.chat, n, genSettings(src.chat.scriptstate).userMessages) : [];
  const recentStory: Narrator['recentStory'] = [];
  turns.forEach((t, i) => {
    if (t.user) recentStory.push({ role: 'user', text: t.user, turn: i + 1 });
    for (const c of t.char) recentStory.push({ role: 'char', text: c, turn: i + 1 });
  });
  const last = turns[turns.length - 1];
  const faction = String(src.chat.scriptstate?.['$st_faction'] ?? '') || 'none';
  const rows = collectRefs(src, {
    scope: 'phone', text: `${text}\n${recentStory.map((m) => m.text).join('\n')}`, description: t.description, authors: t.authors, persona: t.persona,
    active: t.active, related: t.related && !trimRelated(), secondary: t.secondary && !trimSecondary(),
  });
  const universe: Narrator['universe'] = { characterDescription: '', authorsNote: '', activeLoreBooks: [] };
  for (const r of rows) {
    if (r.sources.includes('봇 설명') && r.kind === 'base') universe.characterDescription = r.content;
    else if (r.sources.includes('작가 노트') && r.kind === 'base') universe.authorsNote = r.content;
    else if (r.sources.includes(PERSONA_SOURCE) && r.kind === 'base') universe.userPersona = r.content;
    else universe.activeLoreBooks.push({ source: r.sources.join(' / '), content: r.content, kind: r.kind });
  }
  return {
    owner: { name: '주인공', faction, factionDisplayName: names[faction] ?? faction, ...ownerCharacter(src) },
    recentStory, currentSceneEntries: last ? (last.user ? 1 : 0) + last.char.length : 0, currentSceneTime: phoneTime(src.chat), factionLabels: names, universe,
  };
}

/** 다른 방에서 이 참여자들이 보내거나 받은 말 (원본 P.bindCrossRoomMemory) */
function crossRoom(body: Body, st: PState, limit: number): void {
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
      if (n < limit) {
        counts.set(c, n + 1);
        knownBy.push(c);
      }
    }
    if (knownBy.length) {
      records.push({
        room: e.room.id, roomName: e.room.kind === 'group' ? roomLabel(e.room) : undefined, kind: e.room.kind, recordID: e.m.id, sender: e.m.sender,
        senderName: e.room.people[e.m.sender]?.name, time: e.m.time, content: sitePicAsPhoto(e.m.text), knownBy: knownBy.sort(),
      });
    }
  }
  if (records.length) body.crossRoomMessages = records.reverse();
}

/** 직접 추가한 연락처가 주인과 처음 연락하는 사이인지 앱이 판정한다 (사용자 11-13 7번 (가): 수동으로 추가한 사람이 무조건 아는 사이로 그려지던 문제).
 *  메모가 비고, 인물 로어북이 없고, 넘기는 스토리·설정·로어북에 그 이름이 없고, 어느 방에서도 말을 주고받은 적이 없으면 처음 연락하는 사이 */
function firstContact(p: Participant, body: Body, st: PState): boolean {
  if (!p.manuallySavedContact || p.contactMemo?.trim() || p.hasCharacterLore) return false;
  const name = p.name.trim();
  const u = body.narratorOnly.universe;
  const texts = [u.characterDescription, u.authorsNote, u.userPersona ?? '', ...u.activeLoreBooks.map((b) => b.content), ...body.narratorOnly.recentStory.map((m) => m.text)];
  if (name.length >= 2 && texts.some((t) => t.includes(name))) return false;
  if ((body.rooms ?? (body.room ? [body.room] : [])).some((r) => r.messages.some((m) => m.sender === p.sender))) return false;
  return !Object.values(st.rooms).some((r) => r.messages.some((m) => m.kind === 'message' && m.sender === p.sender));
}

function finish(src: RefSource, st: PState, body: Body, mode: 'REPLY' | 'REFRESH', names: Record<string, string>): PhonePrompt {
  // 인물 로어북이 participants[].lore 와 universe.activeLoreBooks 에 똑같이 두 번 실리지 않게 참여자 쪽만 남긴다 (전수검사 11-13, 확인 1회 약 1.7만 토큰)
  const ownLore = body.participants.map((p) => p.lore).filter((l): l is string => typeof l === 'string' && !!l);
  if (ownLore.length) body.narratorOnly.universe.activeLoreBooks = body.narratorOnly.universe.activeLoreBooks.filter((b) => !ownLore.some((l) => l.includes(b.content)));
  for (const p of body.participants) if (firstContact(p, body, st)) p.relationshipToOwner = 'none: never met or talked with the owner before; the owner only saved this contact';
  if (phoneSettings(src.chat.scriptstate).habits) {
    const ids = new Set(body.participants.map((x) => x.sender));
    const rows = readHabits(src.chat.scriptstate).filter((h) => ids.has(h.id)).map((h) => ({ sender: h.id, note: h.note }));
    if (rows.length) body.textingHabits = rows;
  }
  const system = rules(src, body, mode);
  const p = sections(src);
  const read = (k: string) => (p[k] === undefined ? '' : section(p, k));
  const messages: CraftMessage[] = [
    { role: 'system', content: factionCodesToNames(system, names) },
    { role: 'user', content: factionCodesToNames(JSON.stringify(body), names) },
  ];
  return { messages: craftMessages(messages, craftSettings(src.chat.scriptstate, 'ph'), { thoughts: read('THOUGHTS'), memo: memoTexts(read) }), contactMode: false, retryRule: read('RETRY.REFRESH') };
}

function gnetBoard(src: RefSource, query: string): unknown {
  try {
    return publicBoard(readGnet(src.chat), query, publicAccess(src)) ?? undefined;
  } catch {
    return undefined;
  }
}

/** 한 방에 대한 답장 요청 (보내기·단톡 만들기·초대·방 새로고침) */
export function replyPrompt(src: RefSource, st: PState, r: PRoom, dir: Directory, names: Record<string, string>): PhonePrompt {
  const set = phoneSettings(src.chat.scriptstate);
  const t = fnRefs(src.chat.scriptstate, 'ph', 'reply');
  const history = fnHistory(src.chat.scriptstate, 'ph', 'reply');
  const packet = roomPacket(r, set.reactions, history);
  const participants = r.members.map((cid) => participant(src, dir.map.get(cid) ?? r.people[cid] ?? { id: cid, name: cid }, t.related && !trimRelated(), set.status, names));
  const body: Body = { room: packet, participants, narratorOnly: narrator(src, names, 'reply', t, JSON.stringify(packet)) };
  crossRoom(body, st, history);
  body.publicBoard = gnetBoard(src, JSON.stringify(packet));
  return finish(src, st, body, 'REPLY', names);
}

export interface RefreshPlan {
  prompt: PhonePrompt | null;
  selected: Map<string, PRoom>;
  receive: Map<string, boolean>;
  announce: AnnouncementCheck;
  invite: InvitationCheck;
  /** 확률·대기로 이번에 아무것도 묻지 않은 이유 */
  reason: string;
  /** 방마다 한 번에 넣을 말풍선 상한 (수다가 들면 수다 줄 수까지, 전수검사 11-13) */
  cap: number;
}

/** 전체 새 메시지 확인 (원본 refreshPrompt): 대화 중인 방 + 공개된 연락처 전부 + 공지 + 단톡 초대 */
export function refreshPrompt(src: RefSource, st: PState, dir: Directory, names: Record<string, string>, rng: () => number): RefreshPlan {
  const chat = src.chat;
  const set = phoneSettings(chat.scriptstate);
  const t = fnRefs(chat.scriptstate, 'ph', 'check');
  const history = fnHistory(chat.scriptstate, 'ph', 'check');
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
    return { prompt: null, selected, receive, announce, invite: emptyInvite, reason: why, cap: LIMITS.events };
  }
  const rooms: RoomPacket[] = [];
  const memo = new Map<string, Participant>();
  for (const r of candidates) {
    const packet = roomPacket(r, set.reactions, history);
    packet.action = { type: 'refresh' };
    packet.receiveMessages = refreshAllowed(chat, r, set, incomingOn)[0];
    // 대화가 없는 연락처 방은 빈 칸(대화 상태·참여자·pov·action 등)을 싣지 않는다
    rooms.push(packet.candidateOnly && !packet.messages.length ? ({ id: packet.id, kind: packet.kind, name: packet.name, activeMembers: packet.activeMembers, messages: packet.messages, candidateOnly: true, receiveMessages: packet.receiveMessages } as RoomPacket) : packet);
    selected.set(r.id, r);
    receive.set(r.id, packet.receiveMessages);
    for (const cid of r.members) {
      if (!memo.has(cid)) memo.set(cid, participant(src, dir.map.get(cid) ?? r.people[cid] ?? { id: cid, name: cid }, t.related && !trimRelated(), set.status, names));
    }
  }
  // 단톡 수다: NPC가 둘 이상인 내 단톡방 하나를 골라 대화 한 조각을 꼭 만들게 한다
  if (set.banter && chancePassed(set.banterChance, rng)) {
    const groups = rooms.filter((x) => x.kind === 'group' && x.receiveMessages && x.activeMembers.length >= 2);
    if (groups.length) groups[Math.min(groups.length - 1, Math.floor(rng() * groups.length))].banter = true;
  }
  const participants = [...memo.values()];
  const { channel: _channel, ...publicAnnounce } = announce;
  void _channel;
  const invite = invitationPacket(st, participants.map((p) => p.sender), inviteOn);
  const body: Body = {
    rooms, participants, narratorOnly: narrator(src, names, 'check', t, JSON.stringify(rooms)), announcementCheck: publicAnnounce,
    activityCheck: { incoming: incomingOn, groupInvites: inviteOn }, invitationCheck: invite,
  };
  crossRoom(body, st, history);
  body.publicBoard = gnetBoard(src, JSON.stringify(rooms));
  return { prompt: finish(src, st, body, 'REFRESH', names), selected, receive, announce, invite, reason: '', cap: eventCap(chat.scriptstate, rooms.some((x) => x.banter)) };
}

function personOfContact(c: Contact): PPerson {
  const p: PPerson = { id: c.id, name: c.name };
  for (const k of ['agentId', 'english', 'lore', 'group', 'rank', 'department', 'note'] as const) if (c[k]) p[k] = c[k];
  if (c.custom) p.custom = true;
  return p;
}

/** 새로고침 응답이 형식에 안 맞을 때 같은 자료로 한 번 더 (원본 재시도 문구) */
export function refreshRetry(prompt: PhonePrompt, reason: string): PhonePrompt['messages'] {
  const [sys, ...rest] = prompt.messages;
  // 글은 지침 「괴담톡」 RETRY.REFRESH 절. 절이 없으면 아래에 남긴 글
  const rule = prompt.retryRule?.trim();
  return [
    {
      role: 'system',
      content: rule ? `${sys.content}\n${fillVars(rule, { reason: reason.slice(0, 600), analyze: retryAnalyze() })}` : `${sys.content}\nThe previous response was rejected and nothing was saved. Recreate the complete result from the same supplied data, following the REFRESH OUTPUT CONTRACT. Return a compact COMPLETE JSON object. The configured message lengths/counts are ceilings, not targets; reduce optional messages rather than ending mid-JSON. Omit silent rooms from updates. Use valid JSON string escaping for newlines, quotation marks and backslashes. Do not copy these instructions into messages. Validation error: ${reason.slice(0, 600)}\n${retryAnalyze()}`,
    },
    ...rest,
  ];
}

// ── 보기 전용 방 (라이트보드 미니톡 사전설정, 2026-11-06) ──
/** 보기 전용 방 한 개를 만드는 요청 */
export function viewPrompt(src: RefSource, names: Record<string, string>, views: ViewRoom[]): PhonePrompt {
  const set = viewSettings(src.chat.scriptstate);
  const p = sections(src);
  const opt = (k: string) => (p[k] === undefined ? '' : section(p, k));
  const keys = ['VIEW.COMMON'];
  if (set.preset === 'side') keys.push('VIEW.SIDE', `VIEW.SIDE.SPEAK.${set.speak ? 1 : 0}`, `VIEW.SCOPE.${set.scope}`, ...(set.size === '0' ? [] : [`VIEW.SIZE.${set.size}`]));
  else keys.push('VIEW.MIND', set.preset === 'mono' ? 'VIEW.MONO' : 'VIEW.MULTI', ...(set.preset === 'multi' ? [`VIEW.MULTI.SPEAK.${set.speak ? 1 : 0}`] : []));
  keys.push('VIEW.OUTPUT');
  const system = [...keys.map(opt).filter(Boolean), genSettings(src.chat.scriptstate).language ?? languageLine(p)].join('\n\n');
  if (!system.includes('OUTPUT CONTRACT')) throw new PhoneError('Phone 로어북에 보기 전용 방 항목이 없어요.');
  const previousRoom = previousView(views, set.preset, fnHistory(src.chat.scriptstate, 'ph', 'view'));
  const owner = ownerCharacter(src).character;
  const body = {
    viewpoint: { name: set.pov || owner || '주인공', isPhoneOwner: !set.pov || set.pov === owner },
    kind: set.preset,
    ...(previousRoom ? { previousRoom } : {}),
    narratorOnly: narrator(src, names, 'view', fnRefs(src.chat.scriptstate, 'ph', 'view'), `${set.pov}\n${JSON.stringify(previousRoom ?? '')}`),
  };
  const read = (k: string) => opt(k);
  const messages: CraftMessage[] = [
    { role: 'system', content: factionCodesToNames(system, names) },
    { role: 'user', content: factionCodesToNames(JSON.stringify(body), names) },
  ];
  return { messages: craftMessages(messages, craftSettings(src.chat.scriptstate, 'ph'), { thoughts: read('THOUGHTS'), memo: memoTexts(read) }), contactMode: false };
}
