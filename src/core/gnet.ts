// 괴담넷: 저장 형식(원본 gn_raw GN1과 같음), 게시판 규칙, 모델 응답 검사와 반영.
// 원칙(원본과 같음): 사용자 글·댓글·쪽지는 앱이 소유한다. 모델은 NPC 글·댓글·쪽지와 조회·추천 증가만 보탤 수 있고,
// 저장된 글의 본문·작성자·날짜는 절대 바꾸지 못한다. 글 번호는 줄지 않는다(1846000부터).
import type { Chat } from './types';
import { readWorld } from './world/output';
import { attachmentRecords, bodyParts as parts, describe, hasAttachment, stripForged } from './attach';
import { pickRecords, related, type Focus, type Pick } from './focus';

export const G_POST_BASE = 1846000;
export const GN_RAW = '$gn_raw';
export const GN_NICK = '$gn_nick';
export const GN_COOLDOWN = '$cooldown_received_gnet';

export interface GComment {
  /** 같은 글 안의 1부터 세는 부모 번호, 0이면 글에 단 댓글 */
  parent: number;
  nick: string;
  body: string;
  mine: boolean;
  unread: boolean;
  /** 단 시각 「YYYY.MM.DD HH:MM」 (이야기 속 시각). v0.16.32 전 댓글은 없음 */
  time?: string;
}
export interface GPost {
  id: number;
  date: string;
  nick: string;
  title: string;
  views: number;
  votes: number;
  body: string;
  mine: boolean;
  comments: GComment[];
}
/** 쪽지 상대와 처음 이어진 공개 글 (원본 T 줄) */
export interface GSource {
  postid: number;
  title: string;
  body: string;
  author: string;
  quote: string;
  quoteAuthor: string;
}
export interface GDm {
  nick: string;
  side: 'me' | 'npc';
  body: string;
  unread: boolean;
  date: string;
}
export interface GState {
  posts: GPost[];
  dms: GDm[];
  sources: Record<string, GSource>;
  seq: number;
}

export class GnetError extends Error {
  constructor(message: string, readonly raw = '') {
    super(message);
  }
}

// ── 설정 (원본과 같은 채팅 변수 이름: 로어북 CBS가 그대로 읽는다) ──

export const CFG = (key: string) => `$lb_cfg_lb-gn.${key}`;
export const GN_DEFAULTS: Record<string, string> = {
  mode: '2', quantity: '1', subject: '', mood: '', privacy: '1', protagonist: '', sampling: '0',
  keepown: '1', keepreplied: '0', context: '0', incoming: '1', incoming_chance: '100', lazy: '1',
  /** 게시판 성격: gal 괴담갤(일반 커뮤니티) / net 괴담넷(업계 관계자) / wpf 세정게(세계정치 게시판). 지침의 이용자 구성·기본 말투만 바뀐다 */
  style: 'net',
};

export type GnetStyle = 'gal' | 'net' | 'wpf';
export const GN_STYLE_NAME: Record<GnetStyle, string> = { gal: '괴담갤', net: '괴담넷', wpf: '세정게' };
export function gnetStyle(state: Record<string, unknown> | undefined): GnetStyle {
  const v = String(state?.[CFG('style')] ?? '');
  return v === 'gal' || v === 'wpf' ? v : 'net';
}
/** 메뉴·창 머리에 쓰는 게시판 이름 (설정에 따라) */
export const gnetLabel = (state: Record<string, unknown> | undefined): string => GN_STYLE_NAME[gnetStyle(state)];
/** 쪽지 보관 (원본 gnet_retention: 자동 정리 켬/끔, 상대별 상한) */
export const GN_STORAGE_AUTO = '$gn_storage_auto_dm';
export const GN_STORAGE_LIMIT = '$gn_storage_limit_dm';
export const STORAGE_MAX = 20000;

export function gnetRetention(state: Record<string, unknown> | undefined): { auto: boolean; limit: number } {
  const flag = String(state?.[GN_STORAGE_AUTO] ?? '');
  const n = Number(state?.[GN_STORAGE_LIMIT]);
  const limit = Number.isInteger(n) && n >= 1 && n <= STORAGE_MAX ? n : HISTORY.dmKeep;
  return { auto: flag !== '0', limit };
}
export const LIMITS = { replies: 4, post_tokens: 4000, title_tokens: 80, dm_tokens: 1500, comment_tokens: 1000, origin_tokens: 2000, quote_tokens: 1000, history_tokens: 1500 };
export const HISTORY = { refresh: 10, post: 99999, comment: 30, dmHistory: 50, turns: 8, dmKeep: 40, cooldown: 2 };
export const CONTEXT = { posts: 5, comments: 10, dms: 30, tokens: 3000, includePosts: true, includeDms: true, ownOnly: false, focus: true, recentPosts: 1, recentDms: 5 };
export const QUANTITY: Record<string, { range: string; max: number; label: string }> = {
  '0': { range: '4-6', max: 6, label: '4~6' },
  '1': { range: '5-7', max: 7, label: '5~7' },
  '2': { range: '6-8', max: 8, label: '6~8' },
  '3': { range: '7-9', max: 9, label: '7~9' },
};

export interface GnetSettings {
  /** 괴담넷 사용 (원본 mode 0 = 끄기) */
  enabled: boolean;
  /** 본편 응답마다 자동 새로고침 (원본 lazy 0) */
  auto: boolean;
  /** 괴담넷 탭을 열 때, 본편이 진행됐으면 새로고침 (lazy 'open', v0.16.27) */
  autoOpen: boolean;
  model: 'main' | 'aux';
  quantity: string;
  subject: string;
  mood: string;
  privacy: string;
  protagonist: string;
  sampling: boolean;
  keepOwn: boolean;
  keepReplied: boolean;
  context: boolean;
  incoming: boolean;
  incomingChance: number;
}

export function gnetVars(state: Record<string, unknown> | undefined): Record<string, unknown> {
  const vars: Record<string, unknown> = { ...(state ?? {}) };
  for (const [k, v] of Object.entries(GN_DEFAULTS)) {
    const cur = vars[CFG(k)];
    if (cur === undefined || cur === null || cur === 'null') vars[CFG(k)] = v;
  }
  return vars;
}

export function gnetSettings(state: Record<string, unknown> | undefined): GnetSettings {
  const v = gnetVars(state);
  const s = (k: string) => String(v[CFG(k)] ?? GN_DEFAULTS[k]).trim();
  const clean = (k: string) => (s(k) === '-' ? '' : s(k));
  const q = QUANTITY[s('quantity')] ? s('quantity') : '1';
  const chance = Number(s('incoming_chance'));
  return {
    enabled: s('mode') !== '0',
    auto: s('mode') !== '0' && s('lazy') === '0',
    autoOpen: s('mode') !== '0' && s('lazy') === 'open',
    model: s('mode') === '1' ? 'main' : 'aux',
    quantity: q,
    subject: clean('subject'),
    mood: clean('mood'),
    privacy: ['0', '1', '2', '3', '4'].includes(s('privacy')) ? s('privacy') : '1',
    protagonist: clean('protagonist'),
    sampling: s('sampling') === '1',
    keepOwn: s('keepown') === '1',
    keepReplied: s('keepreplied') === '1',
    context: s('context') === '0',
    incoming: s('incoming') !== '0',
    incomingChance: Number.isFinite(chance) ? Math.max(0, Math.min(100, chance)) : 100,
  };
}

export function userNick(state: Record<string, unknown> | undefined): string {
  const n = String(state?.[GN_NICK] ?? '').trim();
  return n && n !== 'null' ? cut(n, 36) : '익명';
}

// ── 글자 수·토큰 ──

/** 대략적인 토큰 수 (한글·한자·가나 1자 ≈ 1토큰, 그 밖 ≈ 0.3) */
export function tokens(s: string): number {
  let n = 0;
  for (const ch of String(s ?? '')) n += /[ᄀ-ᇿ぀-ヿ㄰-㆏一-鿿가-힣]/.test(ch) ? 1 : 0.3;
  return Math.ceil(n);
}

export function trimTokens(s: string, cap: number): string {
  const text = String(s ?? '');
  if (tokens(text) <= cap) return text;
  const chars = [...text];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (tokens(chars.slice(0, mid).join('')) <= cap) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join('');
}

export function cut(s: string, n: number): string {
  return [...String(s ?? '')].slice(0, n).join('');
}

export function validDate(s: unknown): string {
  const v = String(s ?? '').trim();
  if (!v || v === 'null' || v === 'undefined' || v === '날짜 미상') return '';
  return /^\d{4}[.-]\d\d[.-]\d\d/.test(v) ? cut(v, 24) : '';
}

function postId(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= Number.MAX_SAFE_INTEGER ? n : null;
}

// ── GN1 저장 형식 ──

const en = (s: unknown) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\p').replace(/\r/g, '').replace(/\n/g, '\\n');

function fields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let esc = false;
  for (const c of line) {
    if (esc) {
      cur += c === 'n' ? '\n' : c === 'p' ? '|' : c === '\\' ? '\\' : `\\${c}`;
      esc = false;
    } else if (c === '\\') esc = true;
    else if (c === '|') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  if (esc) cur += '\\';
  out.push(cur);
  return out;
}

export const blank = (): GState => ({ posts: [], dms: [], sources: {}, seq: 0 });

export function decode(raw: unknown): GState {
  const st = blank();
  const map = new Map<number, GPost>();
  for (const line of String(raw ?? '').split('\n')) {
    const p = fields(line);
    if (p[0] === 'Q' && Number.isFinite(Number(p[1]))) st.seq = Math.max(st.seq, postId(p[1]) ?? 0);
    else if (p[0] === 'T' && p.length >= 6) {
      st.sources[cut(p[1], 80)] = { postid: postId(p[2]) ?? 0, title: p[3], body: p[4], author: cut(p[5], 80), quote: p[6] ?? '', quoteAuthor: p[7] ?? '' };
    } else if (p[0] === 'P' && p.length >= 9) {
      const id = postId(p[1]);
      if (id && !map.has(id)) {
        const post: GPost = {
          id, date: validDate(p[2]), nick: cut(p[3], 80), title: p[4], views: Math.max(0, Math.floor(Number(p[5]) || 0)),
          votes: Math.max(0, Math.floor(Number(p[6]) || 0)), body: p[7], mine: p[8] === '1', comments: [],
        };
        st.posts.push(post);
        map.set(id, post);
        st.seq = Math.max(st.seq, id);
      }
    } else if (p[0] === 'C' && p.length >= 6) {
      const post = map.get(Number(p[1]));
      if (post) post.comments.push({ parent: Math.max(0, Math.floor(Number(p[2]) || 0)), nick: cut(p[3], 80), body: p[4], mine: p[5] === '1', unread: p[6] === '1', ...(validDate(p[7]) ? { time: validDate(p[7]) } : {}) });
    } else if (p[0] === 'D' && p.length >= 4) {
      st.dms.push({ nick: cut(p[1], 80), side: p[2] === 'me' ? 'me' : 'npc', body: p[3], unread: p[4] === '1', date: validDate(p[5] ?? '') });
    }
  }
  // 예전 낮은 번호는 한 번만 옮긴다 (원본과 같음)
  if (st.seq < G_POST_BASE) {
    for (const post of st.posts) post.id += G_POST_BASE;
    for (const s of Object.values(st.sources)) if (s.postid > 0) s.postid += G_POST_BASE;
    st.seq += G_POST_BASE;
  }
  return st;
}

export function encode(st: GState): string {
  const out = ['GN1', `Q|${st.seq || G_POST_BASE}`];
  for (const p of st.posts) {
    out.push(['P', p.id, en(p.date), en(p.nick), en(p.title), p.views, p.votes, en(p.body), p.mine ? '1' : '0'].join('|'));
    for (const c of p.comments) out.push(['C', p.id, c.parent, en(c.nick), en(c.body), c.mine ? '1' : '0', c.unread ? '1' : '0', en(c.time ?? '')].join('|'));
  }
  for (const [nick, s] of Object.entries(st.sources)) out.push(['T', en(nick), s.postid || 0, en(s.title), en(s.body), en(s.author), en(s.quote), en(s.quoteAuthor)].join('|'));
  for (const d of st.dms) out.push(['D', en(d.nick), d.side, en(d.body), d.unread ? '1' : '0', en(d.date)].join('|'));
  return out.join('\n');
}

export function readGnet(chat: Chat): GState {
  return decode(chat.scriptstate?.[GN_RAW]);
}

/** 생성 도중 게시판이 바뀌었는지 볼 때 쓰는 열쇠 (읽음 표시는 뺀다) */
export function snapshotKey(st: GState): string {
  return JSON.stringify([st.seq, st.posts.map((p) => [p.id, p.nick, p.title, p.body, p.date, p.mine, p.views, p.votes, p.comments.map((c) => [c.parent, c.nick, c.body, c.mine])])]);
}
const postHead = (p: GPost) => JSON.stringify([p.id, p.nick, p.title, p.body, p.date, p.mine]);
const commentKey = (c: GComment) => JSON.stringify([c.parent, c.nick, c.body, c.mine]);
export function postKey(p: GPost | undefined): string {
  return p ? JSON.stringify([p.id, p.nick, p.title, p.body, p.date, p.mine, p.comments.map((c) => [c.parent, c.nick, c.body, c.mine])]) : '';
}

export function findPost(st: GState, id: number): GPost | undefined {
  return st.posts.find((p) => p.id === id);
}

// ── 시각 ──

/** 상황판 시각 → 마지막 상태창 [▣|YYYY.MM.DD|HH:MM AM] → 없음 */
export function dateNow(chat: Chat): string {
  const minute = readWorld(chat).minute;
  const p = (n: number) => String(n).padStart(2, '0');
  if (minute !== null && minute > 0) {
    const d = new Date(minute * 60000);
    return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  }
  const msgs = chat.message ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== 'char' || typeof m.data !== 'string') continue;
    const t = /\[▣\s*\|\s*(\d{4})\.(\d{2})\.(\d{2})\s*\|\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])/.exec(m.data);
    if (t) {
      let h = Number(t[4]) % 12;
      if (t[6].toUpperCase() === 'PM') h += 12;
      return `${t[1]}.${t[2]}.${t[3]} ${p(h)}:${t[5]}`;
    }
  }
  return '';
}

/** 응답이 있는 본편 턴 수 (선쪽지 대기 계산) */
export function storyTurns(chat: Chat): number {
  return (chat.message ?? []).filter((m) => m.role === 'char' && String(m.data ?? '').trim() && !String(m.data).includes('%%')).length;
}

// ── 게시판 규칙 ──

export function postLimit(s: GnetSettings): number {
  return QUANTITY[s.quantity]?.max ?? 7;
}

export function protectedPost(s: GnetSettings, p: GPost): boolean {
  if (p.mine) return s.keepOwn;
  return s.keepReplied && p.comments.some((c) => c.mine);
}

export function trimBoard(st: GState, s: GnetSettings): void {
  const cap = postLimit(s);
  while (st.posts.length > cap) {
    let idx = -1;
    for (let i = st.posts.length - 1; i >= 0; i--) {
      if (!protectedPost(s, st.posts[i])) {
        idx = i;
        break;
      }
    }
    if (idx < 0) break; // 보호한 글은 상한을 넘어도 지우지 않는다
    st.posts.splice(idx, 1);
  }
}

/** 상대별 쪽지 보관 상한 (최근 것부터) */
export function trimDms(st: GState, cap = HISTORY.dmKeep): void {
  const counts = new Map<string, number>();
  const keep = new Set<number>();
  for (let i = st.dms.length - 1; i >= 0; i--) {
    const n = (counts.get(st.dms[i].nick) ?? 0) + 1;
    counts.set(st.dms[i].nick, n);
    if (n <= cap) keep.add(i);
  }
  st.dms = st.dms.filter((_, i) => keep.has(i));
}

// ── 안 읽은 알림 ──

/** 사용자 글에 단 댓글, 또는 사용자 댓글 아래 달린 답글만 알림 대상 */
export function replyForUser(p: GPost, c: GComment): boolean {
  if (c.mine) return false;
  if (p.mine) return true;
  let parent = c.parent;
  const seen = new Set<number>();
  while (parent && p.comments[parent - 1] && !seen.has(parent)) {
    seen.add(parent);
    const row = p.comments[parent - 1];
    if (row.mine) return true;
    parent = row.parent;
  }
  return false;
}

/** 저장 직전: 예전에 있던 기록은 읽음 상태를 물려받고, 새 기록만 알림 대상이면 안 읽음 */
export function reconcileUnread(st: GState, previous: GState): void {
  const old = new Map(previous.posts.map((p) => [p.id, p]));
  const run = <T extends { nick: string; body: string; unread: boolean }>(rows: T[], prior: T[], side: (r: T) => string, wanted: (r: T) => boolean) => {
    const queue = new Map<string, T[]>();
    for (const r of prior) {
      const k = `${side(r)}\0${r.nick}\0${r.body}`;
      queue.set(k, [...(queue.get(k) ?? []), r]);
    }
    for (const r of rows) {
      const before = queue.get(`${side(r)}\0${r.nick}\0${r.body}`)?.shift();
      r.unread = before ? before.unread : wanted(r);
      if (!wanted(r)) r.unread = false;
    }
  };
  for (const p of st.posts) run(p.comments, old.get(p.id)?.comments ?? [], (c) => (c.mine ? 'me' : 'npc'), (c) => replyForUser(p, c));
  run(st.dms, previous.dms, (d) => d.side, (d) => d.side !== 'me');
}

export function acknowledge(st: GState, post?: number, nick?: string): boolean {
  let changed = false;
  if (post !== undefined) for (const c of findPost(st, post)?.comments ?? []) if (c.unread) [c.unread, changed] = [false, true];
  if (nick !== undefined) for (const d of st.dms) if (d.nick === nick && d.unread) [d.unread, changed] = [false, true];
  return changed;
}

export const postUnread = (p: GPost) => p.comments.some((c) => c.unread);
export const boardUnread = (st: GState) => st.posts.some(postUnread);
export const dmUnread = (st: GState, nick?: string) => st.dms.some((d) => d.unread && (nick === undefined || d.nick === nick));

/** 바뀐 상태를 채팅 변수에 넣는다 (읽음 상태 맞춤 + 쪽지 정리) */
export function writeGnet(chat: Chat, st: GState, opts: { reconcile?: boolean; ack?: { post?: number | null; nick?: string | null } } = {}): Chat {
  if (opts.reconcile !== false) reconcileUnread(st, readGnet(chat));
  // 지금 보고 있는 글·쪽지는 읽음 처리 (읽음 맞춤 뒤에 해야 새 답글이 다시 안 읽음이 되지 않는다)
  if (opts.ack) acknowledge(st, opts.ack.post ?? undefined, opts.ack.nick ?? undefined);
  const keep = gnetRetention(chat.scriptstate);
  if (keep.auto) trimDms(st, keep.limit);
  const raw = encode(st);
  const unread = boardUnread(st) || dmUnread(st);
  return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [GN_RAW]: raw, '$st_unread_gnet': unread ? '1' : '0' } };
}

// ── 사용자 기록 (앱이 직접 씀) ──

export function addUserPost(st: GState, nick: string, title: string, body: string, date: string): GPost {
  st.seq += 1;
  const p: GPost = {
    id: st.seq, date: validDate(date), nick: cut(nick, 80), title: trimTokens(title, LIMITS.title_tokens), body: trimTokens(body, LIMITS.post_tokens),
    views: 0, votes: 0, mine: true, comments: [],
  };
  st.posts.unshift(p);
  return p;
}

export function addUserComment(st: GState, postIdValue: number, parent: number, nick: string, body: string, now = ''): number {
  const p = findPost(st, postIdValue);
  if (!p) throw new GnetError('대상 글이 없어졌어요.');
  if (parent > 0 && !p.comments[parent - 1]) throw new GnetError('답글을 달 댓글이 없어졌어요.');
  p.comments.push({ parent, nick, body: trimTokens(body, LIMITS.comment_tokens), mine: true, unread: false });
  stampComments(p, p.comments.length - 1, [now ? hhmm(now) : ''], now);
  return p.comments.length;
}

export function deletePost(st: GState, id: number): boolean {
  const i = st.posts.findIndex((p) => p.id === id && p.mine);
  if (i < 0) return false;
  st.posts.splice(i, 1);
  return true;
}

/** 내 댓글 k 삭제: 자식은 k의 부모로 옮기고 뒤 번호는 하나씩 당긴다 */
export function deleteComment(st: GState, id: number, k: number): boolean {
  const p = findPost(st, id);
  const target = p?.comments[k - 1];
  if (!p || !target?.mine) return false;
  const up = target.parent;
  p.comments.splice(k - 1, 1);
  for (const c of p.comments) {
    if (c.parent === k) c.parent = up;
    else if (c.parent > k) c.parent -= 1;
  }
  return true;
}

export function deleteThread(st: GState, nick: string): boolean {
  const before = st.dms.length;
  st.dms = st.dms.filter((d) => d.nick !== nick);
  const had = nick in st.sources;
  delete st.sources[nick];
  return before !== st.dms.length || had;
}

export interface DmThread {
  nick: string;
  rows: GDm[];
  unread: number;
  last: number;
  lastDate: string;
}

export function dmThreads(st: GState): DmThread[] {
  const map = new Map<string, DmThread>();
  st.dms.forEach((d, i) => {
    const t = map.get(d.nick) ?? { nick: d.nick, rows: [], unread: 0, last: -1, lastDate: '' };
    t.rows.push(d);
    if (d.unread) t.unread++;
    t.last = i;
    if (d.side === 'npc' && d.date) t.lastDate = d.date;
    map.set(d.nick, t);
  });
  return [...map.values()].sort((a, b) => b.last - a.last);
}

/** 공개 글에서 상대를 찾되, 한 글로만 이어질 때만 (원본 findPublicSource) */
export function findPublicSource(st: GState, nick: string): GSource | undefined {
  let found: GSource | undefined;
  let match: number | null = null;
  for (const p of st.posts) {
    if (p.nick === nick && !p.mine) {
      if (match !== null && match !== p.id) return undefined;
      found = { postid: p.id, title: p.title, body: trimTokens(p.body, LIMITS.origin_tokens), author: p.nick, quote: '', quoteAuthor: '' };
      match = p.id;
    }
    for (const c of p.comments) {
      if (c.nick === nick && !c.mine) {
        if (match !== null && match !== p.id) return undefined;
        found = { postid: p.id, title: p.title, body: trimTokens(p.body, LIMITS.origin_tokens), author: p.nick, quote: trimTokens(c.body, LIMITS.quote_tokens), quoteAuthor: c.nick };
        match = p.id;
      }
    }
  }
  return found;
}

export function sourceFor(p: GPost, ci: number): GSource {
  const c = ci > 0 ? p.comments[ci - 1] : undefined;
  return {
    postid: p.id, title: p.title, body: trimTokens(p.body, LIMITS.origin_tokens), author: p.nick,
    quote: c ? trimTokens(c.body, LIMITS.quote_tokens) : '', quoteAuthor: c ? c.nick : '',
  };
}

export function addOutgoingDm(st: GState, nick: string, body: string, date: string, source?: GSource): void {
  if (!st.sources[nick]) {
    const s = source ?? findPublicSource(st, nick);
    if (s) st.sources[nick] = s;
  }
  st.dms.push({ nick, side: 'me', body: trimTokens(body, LIMITS.dm_tokens), unread: false, date });
}

// ── 모델 응답 꺼내기 ──

/** 생각 블록, 전체를 감싼 코드 펜스, <output>/<json>/<lb-gn> 감싸개를 벗기고 JSON으로 읽는다 (원본 parseReaction) */
export function parseJsonPayload(raw: string): unknown {
  let text = String(raw ?? '').replace(/^﻿/, '').trim();
  for (let i = 0; i < 12; i++) {
    const before = text;
    if (text.startsWith('{')) break;
    const tag = /^<(think|thoughts|analysis|lb-process)(?:\s[^>]*)?>/i.exec(text);
    if (tag) {
      const end = text.toLowerCase().indexOf(`</${tag[1].toLowerCase()}>`);
      if (end >= 0) text = text.slice(end + tag[1].length + 3).trim();
      // 닫히지 않은 생각 칸: 생각 속 중괄호를 JSON으로 잘못 잡지 않게, 줄 첫머리에서 시작하는 { 부터
      else if (/\n\s*\{/.test(text)) text = text.slice(text.search(/\n\s*\{/)).trim();
    } else {
      const fence = /^```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/.exec(text);
      if (fence) text = fence[1].trim();
      else {
        const wrap = /^<(output|json|lb-gn)(\s[^>]*)?>([\s\S]*)<\/\1>\s*$/i.exec(text);
        if (wrap) text = wrap[3].trim();
      }
    }
    if (text === before) break;
  }
  try {
    return JSON.parse(text);
  } catch {
    // 끝에 빈 {"comments":[]}가 한 번 더 붙은 경우만 고친다
    const dup = /^([\s\S]*\})\s*\{\s*"comments"\s*:\s*\[\s*\]\s*\}\s*$/.exec(text);
    if (dup) {
      try {
        return JSON.parse(dup[1]);
      } catch {
        /* 아래 */
      }
    }
    // 앞뒤 설명이 붙었으면 가장 바깥 중괄호만. 그다음 괴담톡과 같은 손질: 끝 쉼표, 글 속 날것 줄바꿈 (2026-10-21)
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a >= 0 && b > a) {
      const body = text.slice(a, b + 1);
      try {
        return JSON.parse(body);
      } catch {
        const fixed = body.replace(/,(\s*[}\]])/g, '$1').replace(/[\u0000-\u001f]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
        try {
          return JSON.parse(fixed.replace(/"((?:[^"\\]|\\.)*)"/g, (m) => m.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')));
        } catch {
          /* 아래 */
        }
      }
    }
    throw new GnetError('AI 응답을 JSON으로 읽지 못했어요.', raw);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const int = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) ? n : null;
};

// ── 새로고침 ──

export interface BoardResult {
  st: GState;
  notice: string;
  /** 댓글이 하나도 없는 게시판이 왔을 때 (적용은 함) */
  emptyComments: boolean;
}

export interface BoardOptions {
  nick: string;
  settings: GnetSettings;
  date: string;
}

/** 새로고침 응답 반영 (원본 normalize + applyNode). before: 요청할 때의 게시판, current: 지금 게시판 */
export function applyBoard(before: GState, current: GState, value: unknown, o: BoardOptions): BoardResult {
  if (snapshotKey(before) !== snapshotKey(current)) throw new GnetError('생성하는 동안 게시판이 바뀌어서 새로고침 결과를 적용하지 않았어요.');
  if (!isObj(value)) throw new GnetError('게시판 JSON 객체가 아니에요.');
  const rows = o.settings.sampling && Array.isArray(value.alternativePosts) && value.alternativePosts.length ? value.alternativePosts : value.posts;
  if (!Array.isArray(rows) || !rows.length) throw new GnetError('posts 배열에 게시글이 없어서 기존 게시판을 유지했어요.');
  const st: GState = structuredClone(current);
  const old = new Map(st.posts.map((p) => [p.id, p]));
  const posts: GPost[] = [];
  const seen = new Set<number>();
  let skippedPosts = 0;
  let skippedComments = 0;
  let commentTotal = 0;
  const day = /^(\d{4}[.-]\d\d[.-]\d\d)/.exec(o.date)?.[1]?.replace(/-/g, '.');
  // 새 글 번호는 요청 때 저장된 최고 번호보다 커야 한다 (원본: > max(100000, seq))
  const floor = Math.max(100000, current.seq);
  for (const raw of rows) {
    if (!isObj(raw)) continue;
    let pid = int(raw.id);
    const prev = pid !== null ? old.get(pid) : undefined;
    const author = str(raw.author).trim();
    if (!prev && (raw.mine === true || author === o.nick)) {
      skippedPosts++;
      continue;
    }
    // 새 글 번호가 규칙(저장된 최고 번호보다 큼)을 어기면 앱이 다음 번호를 준다
    if (!prev && (pid === null || pid <= floor || seen.has(pid))) pid = Math.max(st.seq, floor) + 1;
    if (pid === null || seen.has(pid)) continue;
    seen.add(pid);
    st.seq = Math.max(st.seq, pid);
    const comments = Array.isArray(raw.comments) ? raw.comments : [];
    commentTotal += comments.length;
    let date = validDate(raw.date);
    if (!date) date = day && str(raw.time).trim() ? `${day} ${str(raw.time).trim()}` : o.date;
    const q: GPost = {
      id: pid, nick: cut(author || 'ㅇㅇ', 80), title: str(raw.title), body: stripForged(str(raw.content)), date,
      views: Math.max(0, int(raw.views) ?? 0), votes: Math.max(0, int(raw.upvotes) ?? 0), mine: prev?.mine ?? false, comments: [],
    };
    // 저장된 기록의 작성자·제목·본문·날짜가 이긴다. 모델은 NPC 댓글과 조회·추천만 보탠다
    const sigs = new Map<string, number>();
    const remap = new Map<number, number | false>([[0, 0]]);
    if (prev) {
      Object.assign(q, { nick: prev.nick, title: prev.title, body: prev.body, date: prev.date, views: Math.max(prev.views, q.views), votes: Math.max(prev.votes, q.votes) });
      for (const c of prev.comments) {
        q.comments.push(c);
        sigs.set(`${c.nick}\0${c.body}`, q.comments.length);
      }
    }
    const raws: string[] = [];
    comments.forEach((c, i) => {
      const n = i + 1;
      if (!isObj(c)) return void remap.set(n, false);
      const cAuthor = str(c.author).trim();
      const content = stripForged(str(c.content));
      let parent = int(c.parent) ?? 0;
      if (parent < 0 || parent >= n) parent = 0;
      const sig = `${cAuthor}\0${content}`;
      if (sigs.has(sig)) return void remap.set(n, sigs.get(sig)!);
      if (!cAuthor || !content.trim() || c.mine === true || cAuthor === o.nick || remap.get(parent) === false) {
        skippedComments++;
        return void remap.set(n, false);
      }
      q.comments.push({ nick: cut(cAuthor, 80), body: content, parent: (remap.get(parent) as number | undefined) ?? 0, mine: false, unread: false });
      raws.push(str(c.time).trim());
      sigs.set(sig, q.comments.length);
      remap.set(n, q.comments.length);
    });
    // 새 댓글 시각: 모델이 쓴 「HH:MM」을 글 시각과 지금 사이로 맞춘다 (틀리면 앱이 고침)
    stampComments(q, q.comments.length - raws.length, raws, o.date);
    if (!q.title.trim() && !q.body.trim()) continue;
    posts.push(q);
  }
  if (!posts.length) throw new GnetError('적용할 정상 게시글이 없어서 기존 게시판을 유지했어요.');
  for (const p of st.posts) if (protectedPost(o.settings, p) && !seen.has(p.id)) posts.push(p);
  st.posts = posts;
  trimBoard(st, o.settings);
  const notice = skippedPosts + skippedComments > 0 ? `게시판을 새로 불러왔어요. 사용자 명의로 온 새 글 ${skippedPosts}개와 댓글·연결 답글 ${skippedComments}개는 뺐어요.` : '';
  return { st, notice, emptyComments: commentTotal === 0 };
}

// ── 글·댓글 반응 ──

export interface CommentTarget {
  postId: number;
  /** 사용자가 답글을 단 댓글 번호, 글에 단 댓글·새 글이면 0 */
  replyTo: number;
  /** 요청할 때 그 글의 댓글 수 */
  total: number;
  /** 요청에 보낸 기존 댓글 번호 */
  supplied: Set<number>;
}

/** 모델이 쓴 새 댓글 검사 (원본 react onValidate + filterOwnerComments). 잘못된 것은 하나씩 버린다 */
export function acceptComments(
  rows: unknown, existing: GComment[], t: CommentTarget, nick: string, base = t.total,
): { comments: NewComment[]; dropped: number } {
  const list = Array.isArray(rows) ? rows.slice(0, LIMITS.replies) : [];
  let dropped = Array.isArray(rows) ? Math.max(0, rows.length - LIMITS.replies) : 0;
  const out: NewComment[] = [];
  const map = new Map<number, number | false>();
  const seen = new Set(existing.map((c) => `${c.nick}\0${c.body}`));
  list.forEach((c, i) => {
    const own = t.total + i + 1;
    const bad = () => {
      dropped++;
      map.set(own, false);
    };
    if (!isObj(c)) return bad();
    const author = str(c.author).trim();
    const content = stripForged(str(c.content)).trim();
    let n = int(c.parent);
    if (n === null || n === 0) n = t.replyTo;
    if (!author || [...author].length > 80 || author === nick || !content) return bad();
    if (n > t.total) {
      const m = map.get(n);
      if (m === undefined || m === false) return bad();
      n = m;
    } else if (n < 0 || (n > 0 && !t.supplied.has(n) && n !== t.replyTo)) return bad();
    if (t.replyTo > 0 && n !== t.replyTo && n <= t.total) return bad();
    const sig = `${author}\0${content}`;
    if (seen.has(sig)) return bad();
    seen.add(sig);
    out.push({ author: cut(author, 80), content: trimTokens(content, LIMITS.comment_tokens), parent: n, time: str(c.time).trim() });
    map.set(own, base + out.length);
  });
  return { comments: out, dropped };
}

/** 모델이 쓴 새 댓글 (time: 모델이 적은 「HH:MM」 그대로, 앱이 stampComments로 맞춘다) */
export interface NewComment {
  author: string;
  content: string;
  parent: number;
  time?: string;
}

// ── 댓글 시각 (v0.16.32, 사용자 결정: 모델이 시각을 쓰고 앱이 검사·보정) ──

/** 「YYYY.MM.DD HH:MM」 → 분 (못 읽으면 null) */
export function stampMinutes(stamp: string | undefined): number | null {
  const m = /^(\d{4})[.-](\d\d)[.-](\d\d)\s+(\d\d):(\d\d)/.exec(String(stamp ?? '').trim());
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isFinite(t) ? Math.floor(t / 60000) : null;
}
export function minutesStamp(min: number): string {
  const d = new Date(min * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
/** 「HH:MM」 (모델에게 줄 때·목록에 보일 때) */
export const hhmm = (stamp: string | undefined) => /(\d\d:\d\d)/.exec(String(stamp ?? ''))?.[1] ?? '';
/** 모델이 쓴 시각 → 하루 안의 분 (「14:05」「2:05」「14:05:30」「2025.05.13 14:05」 모두) */
function clockMinutes(raw: string): number | null {
  const m = /(?:^|\s|T)(\d{1,2}):(\d\d)(?::\d\d)?\s*$/.exec(raw.trim()) ?? /^(\d{1,2}):(\d\d)/.exec(raw.trim());
  if (!m) return null;
  const h = +m[1];
  const mi = +m[2];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

/**
 * from번째(0부터)부터의 새 댓글에 시각을 붙인다. raws[i]는 모델이 쓴 시각(없으면 빈칸).
 * 규칙: 글 시각·부모 댓글·바로 앞 댓글보다 늦고 지금보다 이르지 않게.
 * - 「HH:MM」만 오므로 날짜는 허용 범위 안에서 맞는 날로 (자정 넘김 포함)
 * - 범위보다 이르면 아래 경계 1–3분 뒤, 늦으면(미래) 지금으로
 * - 비었거나 못 읽으면 앞뒤 댓글 사이로 나눠 채운다
 * 모델이 정한 순서(답글 번호가 여기에 묶임)는 바꾸지 않는다. 글 시각도 지금도 모르면 비워 둔다.
 */
export function stampComments(p: GPost, from: number, raws: string[], now: string): void {
  const nowMin = stampMinutes(now);
  const postMin = stampMinutes(p.date);
  const floorOf = (i: number): number | null => {
    const c = p.comments[i];
    const cands = [postMin, stampMinutes(c.parent > 0 ? p.comments[c.parent - 1]?.time : undefined), i > 0 ? stampMinutes(p.comments[i - 1]?.time) : null];
    const known = cands.filter((x): x is number => x !== null);
    return known.length ? Math.max(...known) : null;
  };
  const pending: number[] = [];
  const settle = (upto: number | null) => {
    // 비어 있던 댓글들을 앞 댓글 시각과 upto 사이에 고르게
    if (!pending.length) return;
    const lo = floorOf(pending[0]);
    const hi = upto ?? nowMin ?? lo;
    if (lo === null || hi === null) return void (pending.length = 0);
    const span = Math.max(0, hi - lo);
    pending.forEach((idx, k) => {
      const min = Math.max(floorOf(idx) ?? lo, lo + Math.round((span * (k + 1)) / (pending.length + 1)));
      p.comments[idx].time = minutesStamp(nowMin !== null ? Math.min(min, Math.max(nowMin, lo)) : min);
    });
    pending.length = 0;
  };
  for (let i = from; i < p.comments.length; i++) {
    const c = p.comments[i];
    const raw = String(raws[i - from] ?? '').trim();
    const lo = floorOf(i);
    const clock = raw ? clockMinutes(raw) : null;
    if (clock === null || (lo === null && nowMin === null)) {
      pending.push(i);
      continue;
    }
    const hi = nowMin ?? Number.POSITIVE_INFINITY;
    const base = lo ?? (nowMin as number) - 24 * 60;
    // 아래 경계 날부터 하루씩 보며 그 시각이 범위 안에 드는 첫날
    let pick: number | null = null;
    for (let day = Math.floor(base / 1440); day * 1440 <= Math.min(hi, base + 40 * 1440); day++) {
      const t = day * 1440 + clock;
      if (t >= base && t <= hi) {
        pick = t;
        break;
      }
    }
    if (pick === null) {
      // 범위 밖: 오늘 그 시각이 지금보다 뒤면 미래 → 지금. 아니면 글(앞 댓글)보다 이른 것 → 1–3분 뒤
      const ahead = 1 + (i % 3);
      const future = nowMin !== null && Math.floor(nowMin / 1440) * 1440 + clock > nowMin;
      if (future && (lo === null || lo <= nowMin!)) pick = nowMin!;
      else if (lo !== null && (nowMin === null || lo + ahead <= nowMin)) pick = lo + ahead;
      else pick = lo !== null && nowMin !== null && lo > nowMin ? lo : (nowMin ?? base);
    }
    settle(pick);
    c.time = minutesStamp(pick);
  }
  settle(null);
}

/** 모델에게 보일 댓글 시각: 글과 같은 날이면 「HH:MM」, 다른 날이면 「YYYY.MM.DD HH:MM」. 시각 없는 옛 댓글은 빈칸 */
export function commentWhen(p: GPost, c: GComment): string {
  if (!c.time) return '';
  return c.time.slice(0, 10) === String(p.date).slice(0, 10) ? hhmm(c.time) : c.time;
}
/** 댓글 줄에 붙일 시각 칸 (없으면 칸을 아예 뺀다) */
export const whenField = (p: GPost, c: GComment): { time?: string } => {
  const t = commentWhen(p, c);
  return t ? { time: t } : {};
};

/** 모델이 쓴 새 댓글을 글에 붙이고 시각을 맞춘다 */
export function pushComments(p: GPost, rows: NewComment[], now: string): void {
  const from = p.comments.length;
  for (const c of rows) p.comments.push({ nick: c.author, body: c.content, parent: c.parent, mine: false, unread: false });
  stampComments(p, from, rows.map((c) => c.time ?? ''), now);
}

export function parsePostDraft(value: unknown): { title: string; content: string } {
  if (!isObj(value) || !isObj(value.post)) throw new GnetError('응답에 post.title과 post.content가 없어요.');
  const title = str(value.post.title).split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';
  const content = str(value.post.content).trim();
  if (!title || !content) throw new GnetError('게시글 제목이나 본문이 비어 있어요.');
  return { title: trimTokens(title, LIMITS.title_tokens), content: trimTokens(content, LIMITS.post_tokens) };
}

/**
 * 첨부가 있는 글: 모델이 다듬은 본문에서 첨부 기록과 "(첨부파일: …)" 같은 중복 설명 줄을 빼고, 사용자가 붙인 첨부를 그대로 뒤에 붙인다
 * (원본 AT.cleanPostDraft). 사용자 첨부는 앱이 소유하므로 모델이 바꾸지 못한다.
 */
export function attachPostDraft(draft: { title: string; content: string }, input: string): { title: string; content: string } {
  if (!hasAttachment(input)) return draft;
  const literal = new Set<string>();
  for (const p of parts(input)) if (p.kind === 'text') for (const line of p.text.split('\n')) literal.add(line.trim());
  const plain = parts(draft.content).filter((p) => p.kind === 'text').map((p) => p.text).join('').replace(/\[ATTACHMENT A\d+\]/g, '');
  const kept = plain.split('\n').filter((line) => {
    const t = line.trim();
    const note = /^[(\[](.*)[)\]]$/.exec(t)?.[1];
    const label = note?.replace(/：/g, ':').match(/^\s*(.*?)\s*:/)?.[1]?.toLowerCase();
    const dup = !!label && ['첨부파일', '첨부 파일', '첨부자료', '첨부 자료', '첨부', 'attachment', 'attached file'].includes(label);
    return literal.has(t) || !dup;
  });
  const records = attachmentRecords(input).map((r) => r.text);
  const content = [kept.join('\n').trim(), ...records].filter(Boolean).join('\n');
  return { title: draft.title, content };
}

// ── 다른 글 활동 (조회·추천 증가 + 새 댓글) ──

export interface ActivityPost {
  id: number;
  author: string;
  title: string;
  content: string;
  date: string;
  views: number;
  upvotes: number;
  comments: { index: number; parent: number; author: string; time?: string; content: string }[];
  commentCount: number;
  commentsAllowed: boolean;
}
export interface ActivitySnapshot {
  head: string;
  rows: string[];
  count: number;
  selected: Set<number>;
  commentsAllowed: boolean;
}

export function activityContext(st: GState, targetId: number | null): { posts: ActivityPost[]; snapshots: Map<number, ActivitySnapshot> } {
  const posts: ActivityPost[] = [];
  const snapshots = new Map<number, ActivitySnapshot>();
  for (const p of st.posts.slice(0, HISTORY.refresh)) {
    const selected = new Set<number>();
    for (let n = Math.max(1, p.comments.length - HISTORY.comment + 1); n <= p.comments.length; n++) {
      let k = n;
      const visited = new Set<number>();
      while (p.comments[k - 1] && !visited.has(k)) {
        visited.add(k);
        selected.add(k);
        k = p.comments[k - 1].parent;
      }
    }
    const allowed = p.id !== targetId;
    posts.push({
      id: p.id, author: p.nick, title: p.title, content: p.body, date: p.date, views: p.views, upvotes: p.votes,
      comments: p.comments.map((c, i) => ({ index: i + 1, parent: c.parent, author: c.nick, ...whenField(p, c), content: c.body })).filter((c) => selected.has(c.index)),
      commentCount: p.comments.length, commentsAllowed: allowed,
    });
    snapshots.set(p.id, { head: postHead(p), rows: p.comments.map(commentKey), count: p.comments.length, selected, commentsAllowed: allowed });
  }
  return { posts, snapshots };
}

/** 줄마다 따로 검사해서 맞는 것만 반영. [바뀌었는지, 버린 줄 수] */
export function applyActivity(st: GState, rows: unknown, snapshots: Map<number, ActivitySnapshot>, nick: string, now = ''): [boolean, number] {
  if (rows === undefined || rows === null) return [false, 0];
  if (!Array.isArray(rows)) return [false, 1];
  let changed = false;
  let skipped = 0;
  const done = new Set<number>();
  for (const u of rows) {
    const id = isObj(u) ? int(u.id) : null;
    const ref = id !== null ? snapshots.get(id) : undefined;
    const p = id !== null ? findPost(st, id) : undefined;
    // 글 자체와 요청 때 있던 댓글이 그대로여야 한다 (뒤에 붙은 댓글은 괜찮음)
    if (!isObj(u) || id === null || done.has(id) || !ref || !p || postHead(p) !== ref.head || ref.rows.some((k, i) => !p.comments[i] || commentKey(p.comments[i]) !== k)) {
      skipped++;
      continue;
    }
    done.add(id);
    const delta = (v: unknown) => {
      const n = int(v);
      return n !== null && n >= 0 ? Math.min(n, 1e7) : 0;
    };
    const comments = Array.isArray(u.comments) ? u.comments : [];
    if (!ref.commentsAllowed && comments.length) {
      skipped++;
      continue;
    }
    const got = acceptComments(comments, p.comments, { postId: id, replyTo: 0, total: ref.count, supplied: ref.selected }, nick, p.comments.length);
    p.views += delta(u.viewsDelta);
    p.votes += delta(u.upvotesDelta);
    pushComments(p, got.comments, now);
    if (got.dropped) skipped++;
    changed = changed || delta(u.viewsDelta) > 0 || delta(u.upvotesDelta) > 0 || got.comments.length > 0;
  }
  return [changed, skipped];
}

// ── 선쪽지 ──

export interface IncomingPlan {
  allowed: boolean;
  userHandle: string;
  history: { nick: string; body: string; date?: string }[];
  post?: GPost;
  comment?: GComment;
  commentIndex?: number;
}

export interface IncomingOrigin {
  post: number;
  comment?: number;
}

/** 선쪽지를 허용할지 (원본 batch.incoming). 출처는 내 글이나 내 댓글이어야 한다 */
export function incomingPlan(
  chat: Chat, st: GState, s: GnetSettings, nick: string, rand: () => number,
  origin?: { post: GPost; commentIndex?: number }, saved?: IncomingOrigin | null,
): IncomingPlan {
  const plan: IncomingPlan = { allowed: false, userHandle: nick, history: [] };
  for (const m of st.dms) if (m.side === 'npc') plan.history.push({ nick: m.nick, body: m.body, ...(m.date ? { date: m.date } : {}) });
  if (!s.incoming) return plan;
  const last = Number(chat.scriptstate?.[GN_COOLDOWN]);
  const now = storyTurns(chat);
  if (Number.isFinite(last) && String(chat.scriptstate?.[GN_COOLDOWN] ?? '') !== '' && now >= last && now - last < HISTORY.cooldown) return plan;
  let post = origin?.post;
  let ci = origin?.commentIndex;
  if (!post && saved) {
    post = findPost(st, saved.post);
    ci = saved.comment;
  }
  if (!post) {
    for (const p of st.posts) {
      if (p.mine) {
        post = p;
        break;
      }
      for (let i = p.comments.length; i >= 1; i--) {
        if (p.comments[i - 1].mine) {
          post = p;
          ci = i;
          break;
        }
      }
      if (post) break;
    }
  }
  const comment = post && ci ? post.comments[ci - 1] : undefined;
  if (!post || (ci && (!comment || !comment.mine)) || (!comment && !post.mine)) return plan;
  if (s.incomingChance <= 0 || (s.incomingChance < 100 && Math.floor(rand() * 100) + 1 > s.incomingChance)) return plan;
  return { ...plan, allowed: true, post, comment, commentIndex: ci };
}

export function incomingTask(plan: IncomingPlan, activityPosts?: ActivityPost[]): string {
  const body: Record<string, unknown> = { userHandle: plan.userHandle, incomingAllowed: plan.allowed };
  if (plan.allowed && plan.post) {
    body.incomingOrigin = {
      title: plan.post.title, author: plan.post.nick, content: plan.post.body,
      ...(plan.comment ? { comment: { author: plan.comment.nick, content: plan.comment.body } } : {}),
    };
    body.previousIncoming = plan.history;
  }
  if (activityPosts) body.activityPosts = activityPosts;
  return `\nCOMBINED OUTPUT OPTIONS:\n${JSON.stringify(body)}`;
}

/** 선쪽지 반영 (첫 번째 올바르고 중복 아닌 것 하나). 반영했으면 true */
export function commitIncoming(st: GState, rows: unknown, plan: IncomingPlan, date: string, postOverride?: GPost): boolean {
  if (!plan.allowed || !plan.post) return false;
  if (rows === undefined || rows === null) return false;
  if (typeof rows === 'string') {
    if (rows.trim() === 'D|__NONE__|__NONE__' || !rows.trim()) return false;
    throw new GnetError('선쪽지 형식이 올바르지 않아요.');
  }
  const list = Array.isArray(rows) ? rows : isObj(rows) ? [rows] : null;
  if (!list) throw new GnetError('선쪽지 형식이 올바르지 않아요.');
  let pick: { nick: string; body: string } | null = null;
  const reasons: string[] = [];
  let quiet = 0;
  list.forEach((c, i) => {
    if (pick) return;
    if (!isObj(c)) return void reasons.push(`${i + 1}번: 객체가 아님`);
    const nick = str(c.nick).trim();
    const body = trimTokens(stripForged(str(c.body)).trim(), LIMITS.dm_tokens);
    if (nick === '__NONE__') return void quiet++;
    if (!nick || [...nick].length > 80) return void reasons.push(`${i + 1}번: 발신자 없음`);
    if (nick === plan.userHandle) return void reasons.push(`${i + 1}번: 발신자가 사용자`);
    if (!body || body === '__NONE__') return void reasons.push(`${i + 1}번: 본문 없음`);
    if (st.dms.some((m) => m.side === 'npc' && m.nick === nick && m.body === body)) return void quiet++;
    pick = { nick, body };
  });
  if (!pick) {
    if (!reasons.length) return false;
    throw new GnetError(`선쪽지 형식을 확인해 주세요 (${reasons.join('; ')}).`);
  }
  const chosen = pick as { nick: string; body: string };
  const post = postOverride ? findPost(st, postOverride.id) : findPost(st, plan.post.id);
  if (!post) return false;
  const comment = plan.commentIndex ? post.comments[plan.commentIndex - 1] : undefined;
  if (plan.commentIndex && (!comment || !comment.mine || comment.body !== plan.comment?.body)) return false;
  if (!plan.commentIndex && !post.mine) return false;
  st.sources[chosen.nick] = sourceFor(post, plan.commentIndex ?? 0);
  st.dms.push({ nick: chosen.nick, side: 'npc', body: chosen.body, unread: true, date });
  return true;
}

/** 쪽지 답장 {"body":"…"} */
export function parseDmBody(raw: string): string {
  let value: unknown;
  try {
    value = parseJsonPayload(raw);
  } catch {
    throw new GnetError('Expected {"body":"reply text"}.', raw);
  }
  const body = isObj(value) ? stripForged(str(value.body)).trim() : '';
  if (!body) throw new GnetError('Expected {"body":"reply text"} with a non-empty body.', raw);
  return trimTokens(body, LIMITS.dm_tokens);
}

// ── 본편 요청에 넣는 기록 (원본 RC.gnetContext + contextPack) ──

export function mainContext(st: GState, nick: string, rules: string, focus?: Focus | null): string {
  const posts: Pick<Record<string, unknown>>[] = [];
  // 내가 쓴 것만: 내 글, 내 댓글이 달린 글(그 댓글과 위쪽 댓글만), 내가 주고받은 쪽지는 원래 모두 내 것 (원본 context_own_only)
  for (const p of CONTEXT.includePosts ? st.posts : []) {
    if (CONTEXT.ownOnly && !p.mine && !p.comments.some((c) => c.mine)) continue;
    const wanted = new Set<number>();
    const include = (n: number) => {
      if (n <= 0 || wanted.has(n) || !p.comments[n - 1]) return;
      wanted.add(n);
      include(p.comments[n - 1].parent);
    };
    let selected = 0;
    for (let j = p.comments.length; j >= 1 && selected < CONTEXT.comments; j--) {
      if (CONTEXT.ownOnly && !p.mine && !p.comments[j - 1].mine) continue;
      include(j);
      selected++;
    }
    const comments = p.comments.map((c, i) => ({ id: i + 1, parent: c.parent, author: c.nick, ...whenField(p, c), content: describe(c.body) })).filter((c) => wanted.has(c.id));
    posts.push({
      order: p.id,
      related: related(focus, [p.nick, p.title, ...comments.map((c) => c.author)], `${p.title}\n${p.body}\n${comments.map((c) => c.content).join('\n')}`),
      data: { kind: 'public_post', title: p.title, date: p.date, author: p.nick, content: describe(p.body), comments, access: 'publicly accessible; reading by each character is not established' },
    });
  }
  const dms: Pick<Record<string, unknown>>[] = [];
  for (let i = 0; CONTEXT.includeDms && i < st.dms.length; i++) {
    const d = st.dms[i];
    dms.push({
      order: i + 1,
      related: related(focus, [d.nick], d.body),
      data: {
        kind: 'private_message', sender: d.side === 'me' ? nick : d.nick, recipient: d.side === 'me' ? d.nick : nick, content: describe(d.body),
        ...(d.date ? { date: d.date } : {}), order: i + 1, access: 'sender and recipient only',
      },
    });
  }
  const payload = (records: unknown[]) => `[MODULE_CONTEXT_BEGIN]\n${rules}\n${JSON.stringify({ feature: 'gnet', records })}\n[MODULE_CONTEXT_END]`;
  const fits = (records: unknown[]) => !(CONTEXT.tokens > 0 && tokens(payload(records)) > CONTEXT.tokens);
  const keptPosts = pickRecords(posts, { focus: CONTEXT.focus, recent: CONTEXT.recentPosts, max: CONTEXT.posts, fits });
  const keptDms = pickRecords(dms, { focus: CONTEXT.focus, recent: CONTEXT.recentDms, max: CONTEXT.dms, fits: (k) => fits([...keptPosts, ...k]) });
  const kept = [...keptPosts, ...keptDms];
  return kept.length ? payload(kept) : '';
}

// 화면용 첨부 나누기는 attach.ts (예전 이름 그대로 내보냄)
export { bodyParts, type BodyPart } from './attach';
