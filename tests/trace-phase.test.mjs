// 재검토 11-14: 턴이 끝난 뒤 손으로 누른 호출(manual)은 「지난 턴」 줄별 수에서 빠지고, 응답이 안 온 턴은 10분 뒤 끝난 턴으로 본다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1114/trace-phase';
mkdirSync(dir, { recursive: true });
const S = JSON.stringify;
await build({
  stdin: {
    contents: `
      export { traceBegin, traceMain, traceReply, traceEnd, traceTurnId, traceCall, loadTrace, clearTrace } from './src/host/trace';
      export { real } from './src/ui/editor/flowpage';
      export { traceUi } from './src/ui/editor/trace';
    `,
    resolveDir: process.cwd(), loader: 'ts',
  },
  outfile: join(dir, 'm.mjs'), bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  loader: { '.txt': 'text', '.css': 'text' },
  define: { __UPDATE_BASE__: S(''), __PLUGIN_VERSION__: S('0.0.0'), __WORLD_PACK__: S('{}'), __INSTALL_PACK__: S('{}'), __ITEMS_PACK__: S('{}'), __LOOKS_PACK__: S('{}'), __HOMESHOP_PACK__: S('{}') },
});

const store = new Map();
globalThis.risuai = {
  pluginStorage: {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => void store.set(k, v),
    removeItem: async (k) => void store.delete(k),
    keys: async () => [...store.keys()],
  },
};
const M = await import(pathToFileURL(join(dir, 'm.mjs')).href);
const call = (label, requestTokens = 0) => ({ label, at: new Date().toISOString(), ms: 1, model: 'aux', ok: true, request: 'q', requestChars: 1, requestTokens, response: 'r', responseChars: 1 });
const phases = async () => (await M.loadTrace()).at(-1).calls.map((c) => `${c.label}:${c.phase}`);

test('호출 기록: 턴이 끝난 뒤 손으로 누른 호출은 「지난 턴」 줄별 수에 더하지 않는다', async () => {
  await M.clearTrace();
  await M.traceBegin();
  M.traceMain([{ role: 'user', content: '안녕' }], []);
  const id = M.traceTurnId();
  M.traceReply('응답');
  await M.traceCall(call('상점 진열', 7000));
  M.traceEnd(id);
  await M.traceCall(call('상점 진열', 5000));
  assert.deepEqual(await phases(), ['상점 진열:after', '상점 진열:manual']);
  M.traceUi.turns = await M.loadTrace();
  const row = M.real((l) => l === '상점 진열');
  // 맨 위 합계와 같은 셈: manual 을 뺀 요청 토큰
  const top = M.traceUi.turns.at(-1).calls.filter((c) => c.phase !== 'manual').reduce((s, c) => s + c.requestTokens, 0);
  assert.equal(top, 7000);
  assert.equal(row, M.real(() => true));
  assert.equal(row.replace(/\D/g, ''), '7000', row);
  // 손으로만 부른 줄은 비어 있다
  await M.traceCall(call('괴담톡 답장', 300));
  M.traceUi.turns = await M.loadTrace();
  assert.equal(M.real((l) => l === '괴담톡 답장'), '');
});

test('호출 기록: 응답이 안 온 턴은 10분 뒤 끝난 턴으로 본다 (그 뒤 호출은 manual)', async () => {
  await M.clearTrace();
  const now = Date.now;
  try {
    await M.traceBegin();
    M.traceMain([{ role: 'user', content: '안녕' }], []);
    await M.traceCall(call('라우터'));
    const base = now();
    Date.now = () => base + 9 * 60 * 1000;
    await M.traceCall(call('디렉터'));
    Date.now = () => base + 11 * 60 * 1000;
    await M.traceCall(call('상점 진열', 7000));
    assert.deepEqual(await phases(), ['라우터:before', '디렉터:before', '상점 진열:manual']);
    M.traceUi.turns = await M.loadTrace();
    assert.equal(M.real((l) => l === '상점 진열'), '');
    // 늦게라도 응답이 붙으면 그 뒤 호출은 after
    M.traceReply('늦은 응답');
    await M.traceCall(call('갱신기'));
    assert.equal((await phases()).at(-1), '갱신기:after');
  } finally {
    Date.now = now;
  }
  await new Promise((r) => setTimeout(r, 1700)); // 모아 쓰기가 끝난 뒤 정리
  await M.clearTrace();
});
