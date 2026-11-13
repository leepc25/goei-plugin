// 전수검사 11-13 고침: 지시문 풀기(마지막 카드·Situation 틀), 생각 칸 지우기, 상태창 거래 줄, 호출 기록 턴별 저장
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/pipe';
mkdirSync(dir, { recursive: true });
const S = JSON.stringify;
await build({
  stdin: {
    contents: `
      export { unwrapScenes, unwrapCalls } from './src/core/request';
      export { sceneRecord } from './src/core/dispatch';
      export { setGuideOverride, guideDefault } from './src/core/guides';
      export { callRecord } from './src/core/phone';
      export { stripThoughts } from './src/host/llm';
      export { withStatusBlock } from './src/core/statusctx';
      export { traceBegin, traceMain, traceCall, loadTrace, clearTrace } from './src/host/trace';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(dir, 'pipe.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text' },
  define: { __UPDATE_BASE__: S(''), __PLUGIN_VERSION__: S('0.0.0'), __WORLD_PACK__: S('{}'), __INSTALL_PACK__: S('{}'), __ITEMS_PACK__: S('{}'), __LOOKS_PACK__: S('{}'), __HOMESHOP_PACK__: S('{}') },
});

// 가짜 플러그인 저장소
const store = new Map();
globalThis.risuai = {
  pluginStorage: {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
    keys: async () => [...store.keys()],
  },
};
const url = pathToFileURL(join(dir, 'pipe.mjs')).href;
const M = await import(url);

test('지시문: 카드가 채팅의 마지막이면 뒤의 프리셋 user 글을 합치지 않는다', () => {
  const rec = M.sceneRecord({ target: 'T', party: 'P' }, 'BODY');
  const msgs = [{ role: 'user', content: rec }, { role: 'user', content: '<Preset> 끝 지시' }];
  assert.deepEqual(M.unwrapScenes(msgs, { cardIsLast: true }).messages.map((m) => m.content), ['BODY', '<Preset> 끝 지시']);
  // 옵션 없으면 전과 같다
  assert.deepEqual(M.unwrapScenes(msgs).messages.map((m) => m.content), ['BODY\n\nSituation:\n<Preset> 끝 지시']);
  // 같은 메시지의 「추가 요청」 꼬리는 그대로 합친다
  const tail = M.unwrapScenes([{ role: 'user', content: `${rec}\n문을 연다` }, { role: 'user', content: 'P' }], { cardIsLast: true }).messages.map((m) => m.content);
  assert.deepEqual(tail, ['BODY\n\nSituation:\n문을 연다', 'P']);
});

test('지시문: Situation 틀은 지침 FORMAT.user_input 을 쓰고, 지침이 깨지면 기본 글', () => {
  const rec = M.sceneRecord({ target: 'T', party: 'P' }, 'BODY');
  const def = M.guideDefault('Directive');
  assert.ok(def.includes('"user_input": "Situation:\\n[[INPUT]]"'));
  try {
    M.setGuideOverride('Directive', def.replace('"user_input": "Situation:\\n[[INPUT]]"', '"user_input": "상황:\\n[[INPUT]]"'));
    assert.equal(M.unwrapScenes([{ role: 'user', content: rec }, { role: 'user', content: '간다' }]).messages[0].content, 'BODY\n\n상황:\n간다');
    M.setGuideOverride('Directive', def.replace('===OPENING===', '===OPEN==='));
    assert.equal(M.unwrapScenes([{ role: 'user', content: rec }, { role: 'user', content: '간다' }]).messages[0].content, 'BODY\n\nSituation:\n간다');
  } finally {
    M.setGuideOverride('Directive', '');
  }
});

test('전화: 기록이 채팅의 마지막이면 뒤의 user 글을 통화 내용으로 합치지 않는다', () => {
  const rec = M.callRecord('쟈알디', '보고');
  const msgs = [{ role: 'user', content: rec }, { role: 'user', content: '<Preset>' }];
  assert.deepEqual(M.unwrapCalls(msgs, { callIsLast: true }).messages.map((m) => m.content), ['{{user}} places a phone call to 쟈알디.\n\n보고', '<Preset>']);
  assert.equal(M.unwrapCalls(msgs).messages.length, 1);
});

test('생각 칸: <thinking> 도 지우고, 맨 앞의 닫히지 않은 칸은 답 줄부터 남긴다', () => {
  assert.equal(M.stripThoughts('<thinking>{a}</thinking>{"x":1}'), '{"x":1}');
  assert.equal(M.stripThoughts('<think>a</think>b'), 'b');
  assert.equal(M.stripThoughts('<lb-process>\nstep\n{"x":1}'), '{"x":1}');
  assert.equal(M.stripThoughts('<lb-process>\nstep\n<lb-result>ok</lb-result>'), '<lb-result>ok</lb-result>');
  assert.equal(M.stripThoughts('<lb-process>\nonly thoughts'), '');
  assert.equal(M.stripThoughts('답\n<think>tail'), '답\n');
});

test('상태창: 거래 줄은 기본 지침이면 전과 같은 글', () => {
  const msgs = [{ role: 'assistant', content: '본문\n[▣|2025.01.01|02:47 AM|☀️|4°C|남해지사|없음]' }, { role: 'user', content: 'go' }];
  const block = M.withStatusBlock(msgs, '', { cols: ['date', 'time', 'weather', 'temp', 'place', 'target'], recent: ['a', 'b'], recentPoints: ['p'] }).find((m) => m.role === 'system')?.content ?? '';
  assert.ok(block.endsWith('\nRecent cash transactions (oldest first): a; b\nRecent Baekilmong point transactions (oldest first): p'), block);
  const none = M.withStatusBlock(msgs, '', { cols: ['date', 'time', 'weather', 'temp', 'place', 'target'], recent: [], recentPoints: [] }).find((m) => m.role === 'system')?.content ?? '';
  assert.ok(none && !none.includes('Recent'), none);
});

test('호출 기록: 턴마다 따로 저장하고 다시 읽으면 같다', async () => {
  await M.traceBegin();
  M.traceMain([{ role: 'user', content: '안녕하세요' }], []);
  await M.traceCall({ label: '라우터', at: new Date().toISOString(), ms: 1, model: 'aux', ok: true, request: 'q', requestChars: 1, response: 'r', responseChars: 1 });
  await new Promise((r) => setTimeout(r, 1700));
  const idx = JSON.parse(store.get('goei-trace'));
  assert.equal(idx.length, 1);
  assert.equal(typeof idx[0], 'string');
  const saved = JSON.parse(store.get(`goei-trace:${idx[0]}`));
  assert.equal(saved.calls.length, 1);
  assert.equal(typeof saved.main.totalTokens, 'number');
  // 새 모듈로 다시 읽기
  const N = await import(`${url}?v=2`);
  const back = await N.loadTrace();
  assert.equal(back.length, 1);
  assert.equal(back[0].id, idx[0]);
  // 옛 모양(턴 배열 통째)도 읽는다
  store.clear();
  store.set('goei-trace', JSON.stringify([{ id: 'old1', at: 'x', calls: [] }]));
  const O = await import(`${url}?v=3`);
  assert.deepEqual((await O.loadTrace()).map((t) => t.id), ['old1']);
  await O.clearTrace();
  assert.equal(store.get('goei-trace'), '[]');
  assert.ok(![...store.keys()].some((k) => k.startsWith('goei-trace:')));
});

test('호출 기록: 본편에 덧붙인 글의 토큰 수를 main.added 에 남긴다 (pipeline#10)', async () => {
  const P = await import(`${url}?v=4`);
  await P.traceBegin();
  P.traceMain([{ role: 'user', content: '안녕하세요' }], [], ['abc']);
  await new Promise((r) => setTimeout(r, 20)); // 토큰 수는 보낸 뒤에 센다
  const t = (await P.loadTrace()).at(-1);
  assert.equal(typeof t.main.added, 'number');
  assert.ok(t.main.added > 0, `added=${t.main.added}`);
  // 덧붙인 글이 없으면 칸도 없다
  await P.traceBegin();
  P.traceMain([{ role: 'user', content: '안녕하세요' }], []);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await P.loadTrace()).at(-1).main.added, undefined);
  await new Promise((r) => setTimeout(r, 1700)); // 모아 쓰기가 끝난 뒤 정리
  await P.clearTrace();
});
