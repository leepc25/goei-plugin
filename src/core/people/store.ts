// 인물 기록 저장·읽기와 「살아 있음」 판정. 저장은 채팅 최상위 키 하나, 값은 매번 다시 계산한다.
// 다시 굴리기·삭제·편집: 항목은 기준 메시지가 채팅에 있고(story 는 인용도 그 메시지에 남아 있어야) 살아 있다.
// 사라진 항목은 지우지 않는다 (화면에서 회색, 되살리기 가능).
import type { Chat, ChatMessage } from '../types';
import { messageText } from '../refs';
import { anchorOf } from '../visit';
import { PEOPLE_KEY, SLOTS, DOC_TYPES, emptyStore, type Change, type Doc, type Entry, type PeopleStore, type Person, type SlotId } from './types';

export { anchorOf };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const isEntry = (e: unknown): e is Entry => !!e && typeof (e as Entry).id === 'string' && typeof (e as Entry).text === 'string' && typeof (e as Entry).anchor === 'string';

/** 간단한 해시 (FNV-1a 32bit, 36진수) — 항목 id·읽음 표시용 */
export function hash(text: string): string {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** 저장된 기록을 너그럽게 읽는다 (깨진 항목은 버림) */
export function peopleStore(chat: Chat): PeopleStore {
  const raw = chat[PEOPLE_KEY] as Partial<PeopleStore> | undefined;
  const out = emptyStore();
  if (!raw || typeof raw !== 'object') return out;
  for (const [name, p] of Object.entries(raw.people ?? {})) {
    if (!p || typeof p !== 'object' || typeof p.name !== 'string') continue;
    const slots: Person['slots'] = {};
    for (const s of SLOTS) {
      const list = (p.slots as Record<string, unknown> | undefined)?.[s];
      if (Array.isArray(list)) slots[s] = list.filter(isEntry);
    }
    out.people[name] = {
      name: p.name,
      faction: str(p.faction),
      seeded: p.seeded && typeof p.seeded === 'object' ? p.seeded : { from: 'none', at: '' },
      slots,
      affinity: { base: Number(p.affinity?.base) || 0 },
      address: { toUser: str(p.address?.toUser), register: p.address?.register === '존댓말' || p.address?.register === '혼합' ? p.address.register : '반말', ...(p.address?.pin ? { pin: true } : {}) },
      express: ([0, 1, 2, 3] as const).includes(p.express as 0) ? (p.express as 0 | 1 | 2 | 3) : 1,
      ...(p.minor ? { minor: true } : {}),
      aliases: Array.isArray(p.aliases) ? p.aliases.filter((a): a is string => typeof a === 'string') : [],
    };
  }
  for (const [k, d] of Object.entries(raw.docs ?? {})) {
    if (!d || !DOC_TYPES.includes(d.type) || typeof d.key !== 'string') continue;
    out.docs[k] = { type: d.type, key: d.key, entries: Array.isArray(d.entries) ? d.entries.filter(isEntry) : [] };
  }
  out.log = Array.isArray(raw.log) ? raw.log.filter((c): c is Change => !!c && typeof c.id === 'string' && typeof c.anchor === 'string' && typeof c.who === 'string' && typeof c.kind === 'string') : [];
  out.folded = raw.folded && typeof raw.folded === 'object' ? Object.fromEntries(Object.entries(raw.folded).filter(([, v]) => typeof v === 'number')) as Record<string, number> : {};
  out.read = raw.read && typeof raw.read === 'object' ? Object.fromEntries(Object.entries(raw.read).filter(([, v]) => typeof v === 'string')) as Record<string, string> : {};
  out.pending = raw.pending && typeof raw.pending === 'object' ? (raw.pending as PeopleStore['pending']) : {};
  if (raw.identity && typeof raw.identity === 'object') out.identity = raw.identity;
  if (Array.isArray(raw.migrated)) out.migrated = raw.migrated.filter((m): m is string => typeof m === 'string');
  return out;
}

export const withPeople = (chat: Chat, store: PeopleStore): Chat => ({ ...chat, [PEOPLE_KEY]: store });

// ── 기준 메시지 ──

const msgs = (chat: Chat): ChatMessage[] => (Array.isArray(chat.message) ? chat.message : []);

/** 기준 → 메시지 위치. chatId 가 없는 메시지는 '#메시지수' 로 적혔으니 그 수만큼 메시지가 있으면 산 것. '#0' 은 첫 응답 전 = 늘 살아 있음 */
export function anchorPositions(chat: Chat): Map<string, number> {
  const at = new Map<string, number>();
  const list = msgs(chat);
  at.set('#0', -1);
  list.forEach((m, i) => {
    const id = (m as { chatId?: unknown }).chatId;
    if (typeof id === 'string' && id) at.set(id, i);
    at.set(`#${i + 1}`, i);
  });
  return at;
}

/** 인용 검사용 정규화: 공백·따옴표·말줄임표 차이를 무시 */
export const norm = (s: string) => String(s ?? '').replace(/[\s​]+/g, '').replace(/[“”"'‘’「」『』]/g, '').replace(/\.{3}|…/g, '').toLowerCase();

export interface Liveness {
  at: Map<string, number>;
  texts: Map<number, string>;
}
export function liveness(chat: Chat): Liveness {
  const at = anchorPositions(chat);
  const texts = new Map<number, string>();
  msgs(chat).forEach((m, i) => texts.set(i, norm(messageText(str(m.data)))));
  return { at, texts };
}

/** 항목·변경이 살아 있나: 기준 메시지가 있고, story 인용은 그 메시지에 아직 있어야 */
export function isAlive(x: { anchor: string; quote?: string; src?: string; void?: boolean }, live: Liveness): boolean {
  if (x.void) return false;
  const pos = live.at.get(x.anchor);
  if (pos === undefined) return false;
  if (x.src === 'story' && x.quote) {
    const t = live.texts.get(pos);
    if (!t || !t.includes(norm(x.quote))) return false;
  }
  return true;
}

/** 칸의 살아 있는 항목. 대체 항목이 죽으면 그것이 대체했던 이전 항목이 되살아난다 */
export function liveEntries(list: Entry[] | undefined, live: Liveness): Entry[] {
  if (!list?.length) return [];
  const alive = new Set(list.filter((e) => isAlive(e, live)).map((e) => e.id));
  const replaced = new Set(list.filter((e) => alive.has(e.id) && e.replaces).map((e) => e.replaces!));
  return list.filter((e) => alive.has(e.id) && !replaced.has(e.id));
}

/** 살아 있는 변경 기록 (기준 메시지 순서 → seq 순서) */
export function liveChanges(store: PeopleStore, live: Liveness): Change[] {
  return store.log
    .filter((c) => isAlive(c, live))
    .map((c) => ({ c, pos: live.at.get(c.anchor) ?? -1 }))
    .sort((a, b) => a.pos - b.pos || a.c.seq - b.c.seq)
    .map((x) => x.c);
}

// ── 쓰기 ──

export const entryId = (who: string, slot: string, anchor: string, seq: number, text: string) => `e${hash(`${who}|${slot}|${anchor}|${seq}|${text}`)}`;
export const changeId = (who: string, kind: string, anchor: string, seq: number, text: string) => `c${hash(`${who}|${kind}|${anchor}|${seq}|${text}`)}`;

/** 요청 글에 들어갈 수 있으니 템플릿 기호·줄바꿈을 막는다 */
export const plain = (s: unknown, max = 200) =>
  String(s ?? '').replace(/\{\{/g, '｛｛').replace(/\}\}/g, '｝｝').replace(/%%/g, '％％').replace(/\s+/g, ' ').trim().slice(0, max);

/** 항목 하나를 칸에 더한다 (같은 id 무시). 상한을 넘으면 오래된 살아 있는 항목을 합친다 */
export function putEntry(store: PeopleStore, who: string, slot: SlotId, entry: Entry): boolean {
  const p = store.people[who];
  if (!p) return false;
  const list = (p.slots[slot] ??= []);
  if (list.some((e) => e.id === entry.id)) return false;
  list.push({ ...entry, text: plain(entry.text), ...(entry.quote ? { quote: plain(entry.quote, 60) } : {}) });
  return true;
}

export function putDoc(store: PeopleStore, type: Doc['type'], key: string, entry: Entry): boolean {
  const k = `${type}:${key}`;
  const d = (store.docs[k] ??= { type, key, entries: [] });
  if (d.entries.some((e) => e.id === entry.id)) return false;
  d.entries.push({ ...entry, text: plain(entry.text) });
  return true;
}

export function putChange(store: PeopleStore, c: Change): boolean {
  if (store.log.some((x) => x.id === c.id)) return false;
  store.log.push({ ...c, reason: plain(c.reason, 80), ...(c.quote ? { quote: plain(c.quote, 60) } : {}) });
  return true;
}

// ── 읽음 표시 (어느 응답을 갱신기가 읽었나) ──

export const messageKey = (m: ChatMessage, index: number) => {
  const id = (m as { chatId?: unknown }).chatId;
  return typeof id === 'string' && id ? id : `#${index + 1}`;
};
export const messageHash = (m: ChatMessage) => hash(str(m.data));

/** 아직 읽지 않은(또는 내용이 바뀐) 봇 응답의 위치들 */
export function unreadIndexes(chat: Chat, store: PeopleStore): number[] {
  const out: number[] = [];
  msgs(chat).forEach((m, i) => {
    if (m.role !== 'char') return;
    if (store.read[messageKey(m, i)] !== messageHash(m)) out.push(i);
  });
  return out;
}

export function markRead(store: PeopleStore, chat: Chat, indexes: number[]): void {
  const list = msgs(chat);
  for (const i of indexes) {
    const m = list[i];
    if (m) store.read[messageKey(m, i)] = messageHash(m);
  }
  // 채팅에 없는 열쇠는 정리 (다시 굴리기로 사라진 응답)
  const keep = new Set(list.map((m, i) => messageKey(m, i)));
  for (const k of Object.keys(store.read)) if (!keep.has(k)) delete store.read[k];
}

// ── 접기 ──

export const LOG_CAP = 800;
/** 변경 기록이 상한을 넘으면 오래된(최근 200개 메시지 밖) 계기를 인물별 합으로 접는다. 접은 것은 되돌릴 수 없다 */
export function foldLog(store: PeopleStore, chat: Chat, computeDelta: (c: Change) => number): void {
  if (store.log.length <= LOG_CAP) return;
  const live = liveness(chat);
  const cut = msgs(chat).length - 200;
  const keep: Change[] = [];
  for (const c of store.log) {
    const pos = live.at.get(c.anchor);
    if (pos !== undefined && pos < cut && c.kind === 'cue' && isAlive(c, live)) store.folded[c.who] = (store.folded[c.who] ?? 0) + computeDelta(c);
    else if (pos === undefined || pos >= cut || c.kind !== 'cue') keep.push(c);
  }
  store.log = keep;
}
