import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  decode, encode, applyBoard, acceptComments, deleteComment, reconcileUnread, incomingPlan, commitIncoming, applyActivity, activityContext,
  mainContext, gnetSettings, parseJsonPayload, parseDmBody, parsePostDraft, addUserPost, addUserComment, addOutgoingDm, dmThreads, writeGnet,
  readGnet, refreshPrompt, commentPrompt, dmPrompt, postPrompt, bodyParts, G_POST_BASE, CFG, GnetError,
} from '../dist-test/core.mjs';

const REAL = '/mnt/project-files/analysis/extracted/module.json';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;

const S = (over = {}) => gnetSettings(Object.fromEntries(Object.entries(over).map(([k, v]) => [CFG(k), v])));
const post = (id, extra = {}) => ({ id, date: '2025.05.13 14:00', nick: `n${id}`, title: `t${id}`, views: 10, votes: 1, body: `b${id}`, mine: false, comments: [], ...extra });
const cm = (nick, body, parent = 0, mine = false) => ({ nick, body, parent, mine, unread: false });

test('GN1 storage round-trips escapes and shifts legacy ids once', () => {
  const st = { seq: G_POST_BASE + 2, posts: [post(G_POST_BASE + 2, { body: 'a|b\\c\n둘째 줄', comments: [cm('x', 'y|z\n', 0)] })], dms: [{ nick: 'q', side: 'me', body: '안녕|', unread: false, date: '' }], sources: { q: { postid: G_POST_BASE + 2, title: 't', body: 'b', author: 'n', quote: '', quoteAuthor: '' } } };
  const back = decode(encode(st));
  assert.equal(back.posts[0].body, 'a|b\\c\n둘째 줄');
  assert.equal(back.posts[0].comments[0].body, 'y|z\n');
  assert.equal(back.dms[0].body, '안녕|');
  assert.equal(back.sources.q.postid, G_POST_BASE + 2);
  const legacy = decode('GN1\nQ|5\nP|5|2025.01.01|a|t|1|1|b|0');
  assert.equal(legacy.posts[0].id, G_POST_BASE + 5);
  assert.equal(decode(encode(legacy)).posts[0].id, G_POST_BASE + 5, '다시 읽어도 또 옮기지 않음');
});

test('board refresh: stored records win, user-nick entries dropped, protected kept, trimmed to cap', () => {
  const mineP = post(G_POST_BASE + 3, { nick: '나', mine: true, title: '내 글', body: '내 본문' });
  const npc = post(G_POST_BASE + 2, { comments: [cm('a', 'c1')] });
  const st = { seq: G_POST_BASE + 3, posts: [mineP, npc], dms: [], sources: {} };
  const value = { posts: [
    { author: '바꾼이름', id: G_POST_BASE + 2, title: '바꾼 제목', time: '15:00', date: '2025.05.13 15:00', views: 5, upvotes: 9, content: '바꾼 본문', mine: false,
      comments: [{ author: 'a', content: 'c1', parent: 0, mine: false }, { author: 'b', content: 'c2', parent: 1, mine: false }, { author: '나', content: '사칭', parent: 0, mine: false }, { author: 'c', content: '사칭에 답', parent: 3, mine: false }] },
    { author: '나', id: G_POST_BASE + 9, title: '사칭 글', time: '', date: '', views: 1, upvotes: 1, content: 'x', mine: false, comments: [] },
    ...Array.from({ length: 9 }, (_, i) => ({ author: `z${i}`, id: G_POST_BASE + 10 + i, title: `새 글 ${i}`, time: '14:10', date: '', views: 3, upvotes: 1, content: '내용', mine: false, comments: [] })),
    { author: 'dup', id: 5, title: '번호 오류', time: '', date: '', views: 1, upvotes: 0, content: 'x', mine: false, comments: [] },
  ], incoming: [] };
  const res = applyBoard(st, structuredClone(st), value, { nick: '나', settings: S(), date: '2025.05.13 16:00' });
  const old = res.st.posts.find((p) => p.id === G_POST_BASE + 2);
  assert.equal(old.title, 't' + (G_POST_BASE + 2), '저장된 제목 유지');
  assert.equal(old.body, 'b' + (G_POST_BASE + 2));
  assert.equal(old.views, 10, 'max(old,new)');
  assert.equal(old.votes, 9);
  assert.deepEqual(old.comments.map((c) => [c.nick, c.parent]), [['a', 0], ['b', 1]], '중복은 합치고 사용자 명의와 그 답글은 뺌');
  assert.ok(!res.st.posts.some((p) => p.title === '사칭 글'));
  assert.ok(res.st.posts.some((p) => p.id === mineP.id && p.body === '내 본문'), '보호한 내 글은 뒤에 붙음');
  assert.ok(res.st.posts.length <= 8 && res.st.posts.length >= 7, `상한 7 + 보호 글: ${res.st.posts.length}`);
  assert.ok(res.notice.includes('새 글 1개'));
  assert.ok(res.st.posts.every((p, i, a) => a.findIndex((q) => q.id === p.id) === i), '번호 중복 없음');
  assert.throws(() => applyBoard(st, { ...structuredClone(st), seq: st.seq + 1 }, value, { nick: '나', settings: S(), date: '' }), GnetError);
  assert.throws(() => applyBoard(st, structuredClone(st), { posts: [] }, { nick: '나', settings: S(), date: '' }), /게시글이 없어/);
});

test('reaction comments: parents must be supplied or earlier new, reply stays under target, user handle dropped', () => {
  const existing = [cm('a', '1'), cm('나', '내 댓글', 1, true)];
  const t = { postId: 1, replyTo: 2, total: 2, supplied: new Set([1, 2]) };
  const got = acceptComments([
    { author: 'b', content: '답', parent: 2 },
    { author: 'c', content: '답의 답', parent: 3 },
    { author: 'd', content: '엉뚱한 곳', parent: 1 },
    { author: '나', content: '사칭', parent: 2 },
    { author: 'e', content: '부모 없음', parent: 0 },
  ], existing, t, '나');
  assert.deepEqual(got.comments.map((c) => [c.author, c.parent]), [['b', 2], ['c', 3]], '상한 4개, 나머지는 규칙 위반으로 빠짐');
  assert.equal(got.dropped, 3);
  const fresh = acceptComments([{ author: 'x', content: 'a', parent: 0 }, { author: 'y', content: 'b', parent: 1 }], [], { postId: 1, replyTo: 0, total: 0, supplied: new Set() }, '나');
  assert.deepEqual(fresh.comments.map((c) => c.parent), [0, 1]);
});

test('deleting my comment re-parents its children and shifts later indices', () => {
  const st = { seq: 1, posts: [post(1, { comments: [cm('a', '1'), cm('나', '2', 1, true), cm('b', '3', 2), cm('c', '4', 3), cm('d', '5', 1)] })], dms: [], sources: {} };
  assert.equal(deleteComment(st, 1, 1), false, '남의 댓글은 못 지움');
  assert.ok(deleteComment(st, 1, 2));
  assert.deepEqual(st.posts[0].comments.map((c) => [c.body, c.parent]), [['1', 0], ['3', 1], ['4', 2], ['5', 1]]);
});

test('unread: only replies to the user, carried over by record match', () => {
  const prev = { seq: 1, posts: [post(1, { comments: [cm('나', 'q', 0, true)] })], dms: [], sources: {} };
  const next = structuredClone(prev);
  next.posts[0].comments.push(cm('a', '내 댓글에 답', 1), cm('b', '그냥 댓글', 0));
  next.dms.push({ nick: 'x', side: 'npc', body: 'hi', unread: false, date: '' });
  reconcileUnread(next, prev);
  assert.deepEqual(next.posts[0].comments.map((c) => c.unread), [false, true, false]);
  assert.equal(next.dms[0].unread, true);
});

test('incoming DM: needs my post or comment, cooldown, commits once with its public origin', () => {
  const chat = { message: [{ role: 'char', data: 'a' }, { role: 'char', data: 'b' }], scriptstate: {} };
  const mine = post(G_POST_BASE + 1, { nick: '나', mine: true });
  const st = { seq: mine.id, posts: [mine], dms: [], sources: {} };
  const plan = incomingPlan(chat, st, S(), '나', () => 0.5);
  assert.equal(plan.allowed, true);
  assert.ok(commitIncoming(st, [{ nick: '익명독자', body: '혹시 그 글 진짜임?' }], plan, '2025.05.13 14:00'));
  assert.equal(st.dms.length, 1);
  assert.equal(st.sources['익명독자'].postid, mine.id);
  assert.equal(commitIncoming(st, [{ nick: '익명독자', body: '혹시 그 글 진짜임?' }], plan, ''), false, '같은 쪽지는 다시 안 넣음');
  assert.throws(() => commitIncoming(st, [{ nick: '나', body: 'x' }], plan, ''), /사용자/);
  const cool = { ...chat, scriptstate: { $cooldown_received_gnet: '2' } };
  assert.equal(incomingPlan(cool, st, S(), '나', () => 0).allowed, false, '받은 뒤 2턴 대기');
  assert.equal(incomingPlan(chat, { ...st, posts: [post(5)] }, S(), '나', () => 0).allowed, false, '내 글·댓글이 없으면 안 됨');
  assert.equal(incomingPlan(chat, st, S({ incoming: '0' }), '나', () => 0).allowed, false);
});

test('activity: deltas and new comments per post, changed or disallowed rows skipped', () => {
  const st = { seq: 3, posts: [post(3, { comments: [cm('a', '1')] }), post(2)], dms: [], sources: {} };
  const ctx = activityContext(st, 2);
  assert.equal(ctx.posts.find((p) => p.id === 2).commentsAllowed, false);
  const [changed, skipped] = applyActivity(st, [
    { id: 3, viewsDelta: 7, upvotesDelta: 1, comments: [{ author: 'r', content: 'follow', parent: 1 }] },
    { id: 2, viewsDelta: 3, comments: [{ author: 'r', content: 'x', parent: 0 }] },
    { id: 99, viewsDelta: 1 },
  ], ctx.snapshots, '나');
  assert.equal(changed, true);
  assert.equal(skipped, 2);
  assert.equal(st.posts[0].views, 17);
  assert.deepEqual(st.posts[0].comments.map((c) => [c.nick, c.parent]), [['a', 0], ['r', 1]]);
  assert.equal(st.posts[1].views, 10);
});

test('parsing helpers tolerate fences, wrappers and a duplicated empty comments object', () => {
  assert.deepEqual(parseJsonPayload('```json\n{"comments":[]}\n```'), { comments: [] });
  assert.deepEqual(parseJsonPayload('<output>{"a":1}</output>'), { a: 1 });
  // 괴담톡과 같은 손질 (2026-10-21): 끝 쉼표, 글 속 날것 줄바꿈, 닫히지 않은 생각 칸
  assert.deepEqual(parseJsonPayload('{"posts":[{"a":1},],"incoming":[]}'), { posts: [{ a: 1 }], incoming: [] });
  assert.deepEqual(parseJsonPayload('{"body":"첫 줄\n둘째 줄"}'.replace('\\n', '\n')), { body: '첫 줄\n둘째 줄' });
  assert.deepEqual(parseJsonPayload('<think>생각 {a}\n{"body":"x"}'), { body: 'x' });
  assert.deepEqual(parseJsonPayload('{"comments":[{"author":"a"}]}\n{"comments":[]}'), { comments: [{ author: 'a' }] });
  assert.equal(parseDmBody('{"body":" 응 "}'), '응');
  assert.throws(() => parseDmBody('그냥 문장'), GnetError);
  assert.deepEqual(parsePostDraft({ post: { title: '제목\n둘째', content: '본문' } }), { title: '제목', content: '본문' });
  assert.deepEqual(bodyParts('사진 봐\n[[ATTACH:photo]]흐릿한 관람차[[/ATTACH]]').map((p) => p.kind), ['text', 'photo']);
});

test('user records, threads and the main-request context block', () => {
  const st = { seq: G_POST_BASE, posts: [], dms: [], sources: {} };
  const p = addUserPost(st, '나', '제목', '본문', '2025.05.13 14:00');
  assert.equal(p.id, G_POST_BASE + 1);
  assert.equal(addUserComment(st, p.id, 0, '나', '셀프 댓글'), 1);
  addOutgoingDm(st, 'x', '안녕', '');
  st.dms.push({ nick: 'x', side: 'npc', body: '응', unread: true, date: '2025.05.13 14:05' });
  assert.equal(dmThreads(st)[0].unread, 1);
  const text = mainContext(st, '나', 'RULES');
  assert.ok(text.startsWith('[MODULE_CONTEXT_BEGIN]\nRULES\n{"feature":"gnet"'));
  assert.ok(text.endsWith('[MODULE_CONTEXT_END]'));
  const records = JSON.parse(text.split('\n')[2]).records;
  assert.equal(records.filter((r) => r.kind === 'private_message').length, 2);
  assert.equal(records.find((r) => r.kind === 'private_message' && r.sender === 'x').access, 'sender and recipient only');
  const chat = writeGnet({ message: [], scriptstate: {} }, st);
  assert.equal(chat.scriptstate.$st_unread_gnet, '1');
  assert.equal(readGnet(chat).posts[0].title, '제목');
});

test('prompts from the real card: frame, CBS settled, privacy branch, references, role binding', { skip: !realLore }, () => {
  const scriptstate = { $st_faction: 'B00', $ib_affiliation: '관리국', $an_report: '소라 랜드 발생', [CFG('privacy')]: '4', [CFG('mood')]: '조용한 아저씨 말투' };
  const chat = { message: [{ role: 'user', data: '소라 랜드로 간다' }, { role: 'char', data: '관람차가 돈다.' }], scriptstate, note: '' };
  const src = { char: { name: '괴이봇', desc: '설명', globalLore: realLore }, chat };
  const mine = post(G_POST_BASE + 1, { nick: '나', mine: true, comments: [cm('a', '진짜?')] });
  const st = { seq: mine.id, posts: [mine], dms: [], sources: {} };
  const plan = incomingPlan(chat, st, gnetSettings(scriptstate), '나', () => 0);
  const r = refreshPrompt(src, st, plan, '나', { A00: '가짜 관리국', B00: '관리국' });
  assert.equal(r.messages.length, 2);
  const [sys, user] = r.messages.map((m) => m.content);
  assert.ok(!sys.includes('{{') && !user.includes('{{'), 'CBS가 남지 않음');
  assert.ok(sys.includes('## User-controlled protagonist (narrator reference only)'));
  assert.ok(sys.includes('조용한 아저씨 말투'));
  assert.ok(sys.includes('Do not discuss the protagonist or partners themselves'), '사생활 4단계 문장');
  assert.ok(!sys.includes('Users may discuss the protagonist'), '다른 단계 문장은 빠짐');
  assert.ok(sys.includes('Target 5-7 posts'));
  assert.ok(sys.endsWith('Use the language of the actual conversation; default to Korean.'));
  assert.ok(sys.includes('incomingAllowed=true permits'));
  assert.ok(user.startsWith('[참고 자료 — 작중 인물에게 자동 공개되지 않음]\n'));
  assert.ok(user.includes('[활성 로어북: 현재 발생 상황]') && user.includes('Anomalies: 소라 랜드 발생'));
  assert.ok(user.includes('[최근 본문]\n[user]\n소라 랜드로 간다'));
  assert.ok(user.includes(`Every newly generated post ID must be greater than ${mine.id}`));
  assert.ok(user.includes('"incomingAllowed":true'));
  assert.ok(!/\bB00\b/.test(user), '소속 코드는 이름으로');
  const c = commentPrompt(src, st, mine.id, 1, '내 답', plan, '나', {});
  assert.ok(c.messages[0].content.includes('{"comments":[{"author":"nickname","content":"reply","parent":3}],"incoming":[],"activity":[]}'));
  assert.ok(c.messages[1].content.includes('"replyTo":1'));
  assert.ok(c.messages[1].content.includes('"commentsAllowed":false'));
  const p = postPrompt(src, st, '관람차 본 사람?', plan, {});
  assert.ok(p.messages[0].content.includes('Write a short natural forum title'));
  st.dms.push({ nick: 'x', side: 'me', body: '안녕', unread: false, date: '' });
  const d = dmPrompt(src, st, 'x', '안녕', '나', {});
  assert.ok(d.messages[0].content.includes('ROLE BINDING (application-owned metadata):\n{"speaker":{"role":"npc_correspondent","handle":"x"}'));
  assert.ok(d.messages[1].content.includes('YOU ARE: x'));
  assert.ok(d.messages[1].content.includes('No verified public post links'));
});

test('댓글 시각: 모델 시각을 글·부모·지금 사이로 맞추고, 틀리면 앱이 고친다', async () => {
  const { stampComments, decode, encode, commentWhen } = await import('../dist-test/core.mjs');
  const post = (date, comments = []) => ({ id: 1, date, nick: 'a', title: 't', views: 0, votes: 0, body: 'b', mine: false, comments });
  const c = (parent = 0, time) => ({ parent, nick: 'n', body: 'x', mine: false, unread: false, ...(time ? { time } : {}) });
  const now = '2025.05.13 14:40';
  // 정상
  let p = post('2025.05.13 14:02', [c(), c(1), c()]);
  stampComments(p, 0, ['14:11', '14:23', '14:37'], now);
  assert.deepEqual(p.comments.map((x) => x.time), ['2025.05.13 14:11', '2025.05.13 14:23', '2025.05.13 14:37']);
  // 글보다 이름 → 글 1–3분 뒤, 미래 → 지금, 순서 거꾸로 → 앞 댓글 뒤
  p = post('2025.05.13 14:02', [c(), c(), c()]);
  stampComments(p, 0, ['13:50', '15:30', '14:00'], now);
  const [a, b, d] = p.comments.map((x) => x.time);
  assert.ok(a > '2025.05.13 14:02' && a <= '2025.05.13 14:05', a);
  assert.equal(b, '2025.05.13 14:40');
  assert.ok(d >= b && d <= now, d);
  // 비었거나 이상한 값 → 사이로 채움
  p = post('2025.05.13 14:00', [c(), c(), c()]);
  stampComments(p, 0, ['14:10', 'soon', '14:30'], now);
  const mid = p.comments[1].time;
  assert.ok(mid > '2025.05.13 14:10' && mid < '2025.05.13 14:30', mid);
  // 자정 넘김: 글 23:50, 지금 다음 날 00:30, 모델 00:10 → 다음 날
  p = post('2025.05.13 23:50', [c()]);
  stampComments(p, 0, ['00:10'], '2025.05.14 00:30');
  assert.equal(p.comments[0].time, '2025.05.14 00:10');
  // 답글은 부모보다 뒤
  p = post('2025.05.13 14:00', [c(0, '2025.05.13 14:30'), c(1)]);
  stampComments(p, 1, ['14:20'], now);
  assert.ok(p.comments[1].time > '2025.05.13 14:30', p.comments[1].time);
  // 저장·읽기에 시각이 남고, 옛 댓글(시각 없음)도 그대로 읽힌다
  const st = { seq: 100001, posts: [post('2025.05.13 14:00', [c(0, '2025.05.13 14:30'), c()])], sources: {}, dms: [] };
  const back = decode(encode(st));
  assert.equal(back.posts[0].comments[0].time, '2025.05.13 14:30');
  assert.equal(back.posts[0].comments[1].time, undefined);
  assert.equal(commentWhen(back.posts[0], back.posts[0].comments[0]), '14:30');
  // 날짜도 시각도 모르면 비워 둔다
  p = post('', [c()]);
  stampComments(p, 0, ['14:00'], '');
  assert.equal(p.comments[0].time, undefined);
});
