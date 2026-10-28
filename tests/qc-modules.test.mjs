// QC 2026-10-28 · 플러그인 창 안 기능 모듈 회귀 시험 (docs/qc/04_modules.md): 괴담넷 상한, 통합 자동 확인 실패 보충, 인물 기록 갱신 요청 잇기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { G_POST_BASE, CFG, gnetSettings, trimBoard, applyBoard, addUserPost, encode, decode } from '../dist-test/core.mjs';

mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/host/joint.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/joint.mjs', logLevel: 'silent' });
const { Joint } = await import('../dist-test/joint.mjs');

const S = (over = {}) => gnetSettings(Object.fromEntries(Object.entries(over).map(([k, v]) => [CFG(k), v])));
const post = (id, extra = {}) => ({ id, date: '2025.05.13 14:00', nick: `n${id}`, title: `t${id}`, views: 10, votes: 1, body: `b${id}`, mine: false, comments: [], ...extra });

test('괴담넷 상한: 보호한 글(내 글·내 댓글 있는 글)은 상한 밖, 보호하지 않은 글만 상한까지 — 내 글이 상한만큼 쌓여도 새 글이 들어온다', () => {
  const mine = Array.from({ length: 9 }, (_, i) => post(G_POST_BASE + 100 + i, { nick: '나', mine: true }));
  const st = { seq: G_POST_BASE + 200, posts: [...mine], dms: [], sources: {} };
  const value = { posts: Array.from({ length: 5 }, (_, i) => ({ author: `z${i}`, id: G_POST_BASE + 300 + i, title: `새 글 ${i}`, time: '14:10', date: '', views: 3, upvotes: 1, content: '내용', mine: false, comments: [] })), incoming: [] };
  const res = applyBoard(st, structuredClone(st), value, { nick: '나', settings: S({ quantity: '1' }), date: '2025.05.13 16:00' });
  assert.equal(res.st.posts.filter((p) => !p.mine).length, 5, '새 글 5개가 모두 남는다 (예전엔 전부 잘렸다)');
  assert.equal(res.st.posts.filter((p) => p.mine).length, 9, '보호한 내 글 9개도 그대로');
  // 보호하지 않은 글은 상한(7)까지만: 새 글 9개 + 내 글 2개 → 7 + 2
  const st2 = { seq: G_POST_BASE + 200, posts: [post(G_POST_BASE + 1, { mine: true }), post(G_POST_BASE + 2, { mine: true })], dms: [], sources: {} };
  const many = { posts: Array.from({ length: 9 }, (_, i) => ({ author: `z${i}`, id: G_POST_BASE + 300 + i, title: `새 글 ${i}`, time: '14:10', date: '', views: 3, upvotes: 1, content: '내용', mine: false, comments: [] })), incoming: [] };
  const r2 = applyBoard(st2, structuredClone(st2), many, { nick: '나', settings: S({ quantity: '1' }), date: '2025.05.13 16:00' });
  assert.equal(r2.st.posts.filter((p) => !p.mine).length, 7);
  assert.equal(r2.st.posts.length, 9);
  // 글쓰기 뒤 trimBoard: 내 글은 늘 남고, 보호 끄면(keepown 0) 내 글도 상한에 센다
  const st3 = decode(encode({ seq: G_POST_BASE + 10, posts: Array.from({ length: 7 }, (_, i) => post(G_POST_BASE + 1 + i)), dms: [], sources: {} }));
  addUserPost(st3, '나', '제목', '본문', '2025.05.13 16:00');
  trimBoard(st3, S({ quantity: '1' }));
  assert.equal(st3.posts.length, 8, '내 글 1 + 남 글 7');
  trimBoard(st3, S({ quantity: '1', keepown: '0' }));
  assert.equal(st3.posts.length, 7, '보호를 끄면 전체가 상한');
  assert.ok(st3.posts.some((p) => p.mine), '맨 앞(최신)인 내 글이 남고 맨 뒤 글이 빠진다');
});

test('통합 자동 확인: 응답을 못 가르면 버리지 않고 두 작업을 따로 한 번씩 보낸다', async () => {
  const calls = [];
  let n = 0;
  globalThis.risuai = {
    runLLMModel: async (o) => {
      calls.push(o);
      n++;
      if (n === 1) return { type: 'success', result: '죄송합니다, JSON 이 아니라 설명문으로 답합니다.' };
      return { type: 'success', result: o.messages[0].content === 'g' ? '{"posts": []}' : '{"updates": []}' };
    },
  };
  const j = new Joint('aux');
  const [g, p] = await Promise.all([j.ask('gnet', [{ role: 'user', content: 'g' }]), j.ask('phone', [{ role: 'user', content: 'p' }])]);
  assert.equal(calls.length, 3, '통합 1회 + 따로 2회');
  assert.equal(g, '{"posts": []}');
  assert.equal(p, '{"updates": []}');
  // 모델 연결 자체가 실패하면 둘 다 그 오류 (따로 보내지 않는다)
  globalThis.risuai = { runLLMModel: async () => ({ type: 'fail', result: 'Failed to fetch' }) };
  const k = new Joint('aux');
  const results = await Promise.allSettled([k.ask('gnet', [{ role: 'user', content: 'g' }]), k.ask('phone', [{ role: 'user', content: 'p' }])]);
  assert.ok(results.every((r) => r.status === 'rejected' && /모델 요청에 실패/.test(r.reason.message)));
});

test('인물 기록 갱신 요청: 돌고 있을 때 들어온 요청은 끝난 뒤 자기 이유·옵션으로 이어서 돌고, 부른 쪽은 자기 결과를 받는다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'goei-qc-people-'));
  // host/people.ts 는 risuai·loadContext 에 기대므로 runOnce 가 바로 끝나게 (채팅 없음) 흉내 낸다
  globalThis.risuai = {
    getCurrentCharacterIndex: async () => -1,
    getCurrentChatIndex: async () => -1,
    pluginStorage: { getItem: async () => null, setItem: async () => {} },
  };
  await build({ entryPoints: ['src/host/people.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  const H = await import(pathToFileURL(join(dir, 'people.mjs')));
  const order = [];
  // loadContext 가 null 을 돌려주므로 runOnce 는 빈 결과로 끝난다. 세 요청이 차례로, 각자 결과를 받는지 본다
  const a = H.requestPeopleUpdate('turn').then((r) => (order.push('turn'), r));
  assert.equal(H.peopleUpdating(), true);
  const b = H.requestPeopleUpdate('manual', { manual: true }).then((r) => (order.push('manual'), r));
  const c = H.requestPeopleUpdate('reread', { manual: true, scope: { only: ['x'] } }).then((r) => (order.push('reread'), r));
  const rs = await Promise.all([a, b, c]);
  assert.deepEqual(order, ['turn', 'manual', 'reread']);
  assert.ok(rs.every((r) => r && Array.isArray(r.skipped)), '각 요청이 자기 결과를 받는다');
  assert.equal(H.peopleUpdating(), false);
});
