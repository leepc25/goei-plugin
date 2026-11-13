// 기능별 넘길 내용·양 시험의 공용 자료 (tests/reffn.test.mjs): 게시판 넷·괴담톡의 요청 종류마다 요청문을 만든다.
// core = dist-test/core.mjs 의 내보낸 것 전부. vars = 채팅 변수(설정). 돌려주는 것: 이름 → 요청문 글(system + user)
import { existsSync, readFileSync } from 'node:fs';
import { REAL } from './realcard.mjs';

export const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;

/** 상시 로어북 표식 (core/refs.ts ACTIVE_BOOKS 의 이름으로 넣는다) */
export const ACTIVE_MARK = '상시표식가나다';
/** 괴담톡 상대(이름 「상대」)의 인물 로어북 원문 */
export const PERSON_MARK = '인물원문표식';
export const lore = (core) => [...(realLore ?? []), ...core.ACTIVE_BOOKS.map((n) => ({ comment: n, content: `${ACTIVE_MARK} ${n}` })), { comment: '상대', content: PERSON_MARK }];

const MESSAGES = [
  { role: 'user', data: '첫째 턴 글' }, { role: 'char', data: '첫째 응답' },
  { role: 'user', data: '둘째 턴 글' }, { role: 'char', data: '둘째 응답' },
  { role: 'user', data: '셋째 턴 글' }, { role: 'char', data: '셋째 응답' },
];
export const source = (core, vars = {}, extra = {}) => ({
  char: { name: '괴이봇', desc: '봇설명표식', globalLore: lore(core) },
  chat: { message: MESSAGES, scriptstate: { $st_faction: 'B00', ...vars }, note: '작가노트표식', localLore: [], ...extra },
  persona: '페르소나표식',
});

/** 게시판: 글 14개(글마다 댓글 3개), 쪽지 6통 */
export function boardState(core) {
  const base = core.G_POST_BASE;
  const posts = [];
  for (let i = 0; i < 14; i++) {
    posts.push({ id: base + 20 - i, date: '2025.05.13 14:00', nick: `닉${i}`, title: `글제목${i}번`, views: 1, votes: 0, body: `본문${i}`, mine: false,
      comments: [0, 1, 2].map((k) => ({ parent: 0, nick: `댓닉${k}`, body: `글${i}댓글${k}`, mine: false, unread: false })) });
  }
  const dms = [];
  for (let i = 0; i < 6; i++) dms.push({ nick: 'x', side: i % 2 ? 'npc' : 'me', body: `쪽지글${i}번`, unread: false, date: '' });
  return { seq: base + 20, posts, dms, sources: {} };
}

/** 괴담톡: 1:1 방 하나(말풍선 40개) + 보기 전용 방 하나(말풍선 40개) */
export function phoneState(core) {
  const P = core.phone;
  const st = P.blankState();
  const r = { id: 'dm_c_1', kind: 'dm', members: ['c_1'], people: { c_1: { id: 'c_1', name: '상대' } }, messages: [], draft: '', unread: 0 };
  st.rooms[r.id] = r;
  st.order.push(r.id);
  for (let i = 0; i < 40; i++) P.push(st, r, i % 2 ? 'c_1' : 'me', `말풍선${i}번`, 't');
  return { st, room: r };
}
export const VIEWS = JSON.stringify([{ id: 'v_1', preset: 'side', name: '방', pov: 'a', people: [{ id: 'a', name: '가' }], time: 't', unread: false,
  messages: Array.from({ length: 40 }, (_, i) => ({ sender: 'a', type: 'text', text: `앞방말${i}번` })) }]);
const PH_VARS = { '$ph_incoming': '1', '$ph_incoming_chance': '100', '$ph_group_invites': '0', '$ph_announcements': '0', '$ph_banter': '0' };

const text = (p) => p.messages.map((m) => m.content).join('\n␞\n');

/** 게시판 한 곳(site)의 요청 다섯: 새로고침·글 쓰기·댓글·글 하나만 새로고침·쪽지 */
export function boardPrompts(core, vars = {}, site = 'gn') {
  const st = boardState(core);
  const src0 = source(core, vars);
  const src = { ...src0, chat: core.boards.boardView(src0.chat, site) };
  const set = core.gnetSettings(src.chat.scriptstate);
  const plan = core.incomingPlan(src.chat, st, { ...set, incoming: false }, '나', () => 0.99);
  const target = st.posts[0].id;
  return {
    refresh: text(core.refreshPrompt(src, st, plan, '나', {})),
    post: text(core.postPrompt(src, st, '내가 적은 글', plan, {})),
    comment: text(core.commentPrompt(src, st, target, 1, '내 답', plan, '나', {})),
    refreshOne: text(core.commentPrompt(src, st, target, 0, '', plan, '나', {}, core.POST_REFRESH_ACTION, 'refresh')),
    dm: text(core.dmPrompt(src, st, 'x', '안녕', '나', {})),
  };
}

/** 괴담톡의 요청 셋: 답장·새 메시지 확인·보기 전용 방 */
export function phonePrompts(core, vars = {}) {
  const PP = core.phonePrompt;
  const { st, room } = phoneState(core);
  const src = source(core, { ...PH_VARS, '$ph_views': VIEWS, ...vars });
  const dir = { contacts: [], map: new Map(), tabs: [] };
  return {
    reply: text(PP.replyPrompt(src, st, room, dir, {})),
    check: text(PP.refreshPrompt(src, st, dir, {}, () => 0).prompt),
    view: text(PP.viewPrompt(src, {}, core.phoneView.readViews(src.chat.scriptstate))),
  };
}
