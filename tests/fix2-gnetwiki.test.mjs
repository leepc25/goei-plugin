// 전수검사 11-13 게시판 고침 시험 2: 되살린 글이 새로고침에 유지돼도 기한(back) 유지, 이번 턴에 쓴 글·댓글 단 글은 본편 요청에 꼭 넣기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/gnetwiki';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/gnet.ts'],
  outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent',
});
const G = await import(pathToFileURL(join(dir, 'gnet.mjs')));

const S = (over = {}) => G.gnetSettings(Object.fromEntries(Object.entries(over).map(([k, v]) => [G.CFG(k), v])));
const B = G.G_POST_BASE;
const post = (id, extra = {}) => ({ id, date: '2025.05.13 14:00', nick: `n${id}`, title: `t${id}`, views: 10, votes: 1, body: `b${id}`, mine: false, comments: [], ...extra });
const msgs = (n) => Array.from({ length: n }, () => [{ role: 'user', data: 'u' }, { role: 'char', data: '응답' }]).flat();
const scene = { scene: '', terms: [] };
const titles = (t) => (t ? JSON.parse(t.split('\n')[2]).records.map((r) => r.title) : []);

test('되살린 글을 모델이 유지해도 back 이 남아 본편 응답 뒤 보관함으로 간다', () => {
  const st = { seq: B + 5, posts: [post(B + 5)], archive: [post(B + 1, { mine: true, nick: '나', title: '옛 글' })], dms: [], sources: {} };
  let chat = G.writeGnet({ message: msgs(2), scriptstate: {} }, st);
  const cur = G.readGnet(chat);
  G.addUserComment(cur, B + 1, 0, '나', '댓글', '2025.05.13 15:10', 2);
  chat = G.writeGnet(chat, cur);
  const before = G.readGnet(chat);
  const value = { posts: [{ id: B + 1, author: '나', title: '옛 글', content: 'x', comments: [] }, { id: B + 5, author: 'n', title: 't', content: 'b', comments: [] }] };
  const res = G.applyBoard(before, structuredClone(before), value, { nick: '나', settings: S(), date: '2025.05.13 16:00' });
  assert.equal(res.st.posts.find((p) => p.id === B + 1)?.back, 2, '유지된 글에 back 이 남는다');
  chat = G.writeGnet(chat, res.st);
  const next = G.readGnet({ ...chat, message: msgs(3) });
  assert.ok(next.archive.some((p) => p.id === B + 1) && !next.posts.some((p) => p.id === B + 1), '본편 응답이 오면 보관함으로');
});

test('이번 턴에 쓴 글·댓글 단 옛 글은 장면과 무관해도 본편 요청에 들어가고, 다음 턴에는 빠진다', () => {
  const posts = Array.from({ length: 9 }, (_, i) => post(B + 1 + i, { title: `글 ${i + 1}` })).reverse();
  const st = { seq: B + 9, posts, archive: [], dms: [], sources: {} };
  let chat = G.writeGnet({ message: msgs(4), scriptstate: {} }, st);
  const cur = G.readGnet(chat);
  G.addUserComment(cur, B + 3, 0, '나', '내 댓글', '2025.05.13 15:10', 4);
  chat = G.writeGnet(chat, cur);
  const now = G.readGnet(chat);
  assert.equal(now.posts.find((p) => p.id === B + 3)?.touch, 4, '저장·읽기에서 touch 유지');
  assert.equal(now.posts.find((p) => p.id === B + 3)?.back, undefined, '게시판에 있던 글은 보관함 기한이 붙지 않는다');
  const got = titles(G.mainContext(now, '나', '', scene));
  assert.ok(got.includes('글 3') && got.includes('글 9'), got.join(','));
  const later = G.readGnet({ ...chat, message: msgs(5) });
  assert.equal(later.posts.find((p) => p.id === B + 3)?.touch, undefined);
  assert.ok(!titles(G.mainContext(later, '나', '', scene)).includes('글 3'), '다음 턴에는 다시 장면 기준');
});

test('내가 쓴 글은 더 새 글이 생겨도 그 턴에는 들어간다. 턴을 안 주면 예전 그대로', () => {
  const st = { seq: B + 1, posts: [post(B + 1, { title: '남의 글' })], archive: [], dms: [], sources: {} };
  G.addUserPost(st, '나', '내 글', '본문', '2025.05.13 15:00', 2);
  st.posts.unshift(post(B + 50, { title: '더 새 글' }));
  st.seq = B + 50;
  const got = titles(G.mainContext(st, '나', '', scene));
  assert.ok(got.includes('내 글') && got.includes('더 새 글'), got.join(','));
  const p = G.addUserPost(st, '나', '턴 없음', '본문', '');
  assert.equal(p.touch, undefined);
  // back 없이 touch 만 있는 줄도 읽고 쓴다
  const back = G.decode(G.encode(st));
  assert.equal(back.posts.find((q) => q.title === '내 글')?.touch, 2);
  assert.equal(back.posts.find((q) => q.title === '내 글')?.back, undefined);
});
