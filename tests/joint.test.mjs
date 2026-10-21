// 괴담넷·괴담톡 자동 확인 한 번에 묶기 (src/host/joint.ts)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/host/joint.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/joint.mjs', logLevel: 'silent' });
const { Joint, combinedPrompts, splitCombined } = await import('../dist-test/joint.mjs');

const calls = [];
let reply = () => '';
globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: reply(o) }) };

test('combined prompt shares long identical paragraphs only', () => {
  const long = `${'본편 장면 '.repeat(60)}\n\n`;
  const msgs = combinedPrompts([{ role: 'user', content: `${long}게시판 지시` }], [{ role: 'user', content: `${long}톡 지시` }]);
  const body = JSON.parse(msgs[1].content);
  assert.equal(body.sharedReferences.length, 1);
  assert.deepEqual(body.gnet[0].contentParts, [{ ref: 'R1' }, { text: '게시판 지시' }]);
  assert.deepEqual(body.phone[0].contentParts, [{ ref: 'R1' }, { text: '톡 지시' }]);
});

test('split finds both results and keeps a broken string inside one task', () => {
  const p = splitCombined('```json\n{"gnet": {"posts": [{"t": "a}b"}]}, "phone": null}\n```');
  assert.equal(p.gnet, '{"posts": [{"t": "a}b"}]}');
  assert.equal(p.phone, null);
  assert.throws(() => splitCombined('{"gnet": {"a": 1}'), /통합 응답/);
});

test('joint sends one request when both ask, alone when the other skips', async () => {
  calls.length = 0;
  reply = () => '{"gnet": {"posts": []}, "phone": {"updates": []}}';
  const j = new Joint('aux');
  const [g, p] = await Promise.all([j.ask('gnet', [{ role: 'user', content: 'g' }]), j.ask('phone', [{ role: 'user', content: 'p' }])]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'submodel');
  assert.equal(g, '{"posts": []}');
  assert.equal(p, '{"updates": []}');

  calls.length = 0;
  reply = () => '{"only": "phone"}';
  const k = new Joint('main');
  const wait = k.ask('phone', [{ role: 'user', content: 'p' }]);
  k.done('gnet');
  assert.equal(await wait, '{"only": "phone"}');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].messages[0].content, 'p');
});
