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
  const msgs = combinedPrompts([{ key: 'gnet', messages: [{ role: 'user', content: `${long}게시판 지시` }] }, { key: 'phone', messages: [{ role: 'user', content: `${long}톡 지시` }] }]);
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
  // 앞뒤 설명문은 떼고 읽는다
  assert.equal(splitCombined('Here you go:\n{"gnet": null, "phone": {"u": 1}}\nDone.').phone, '{"u": 1}');
  // 게시판 넷 + 괴담톡
  const q = splitCombined('{"gnet": {"a": 1}, "gal": {"b": 2}, "wpf": null, "sm": {"c": 3}, "phone": null}', ['gnet', 'gal', 'wpf', 'sm', 'phone']);
  assert.equal(q.gal, '{"b": 2}');
  assert.equal(q.wpf, null);
});

test('joint sends one request when both ask, alone when the other skips', async () => {
  calls.length = 0;
  reply = () => '{"gnet": {"posts": []}, "phone": {"updates": []}}';
  const j = new Joint('aux');
  const [g, p] = await Promise.all([j.ask('gn', [{ role: 'user', content: 'g' }]), j.ask('phone', [{ role: 'user', content: 'p' }])]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, 'submodel');
  assert.equal(g, '{"posts": []}');
  assert.equal(p, '{"updates": []}');

  calls.length = 0;
  reply = () => '{"only": "phone"}';
  const k = new Joint('main');
  const wait = k.ask('phone', [{ role: 'user', content: 'p' }]);
  k.done('gn');
  assert.equal(await wait, '{"only": "phone"}');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].messages[0].content, 'p');
});

test('joint with four boards and phone sends one request and splits five ways', async () => {
  calls.length = 0;
  reply = () => '{"gnet": {"a": 1}, "gal": {"b": 2}, "wpf": {"c": 3}, "sm": {"d": 4}, "phone": {"e": 5}}';
  const j = new Joint('aux', undefined, ['phone', 'gn', 'gal', 'wpf', 'sm']);
  const out = await Promise.all(['gn', 'gal', 'wpf', 'sm', 'phone'].map((k) => j.ask(k, [{ role: 'user', content: k }])));
  assert.equal(calls.length, 1);
  assert.ok(calls[0].messages[0].content.includes('"gnet", "gal", "wpf", "sm", "phone"'));
  assert.ok(calls[0].messages[0].content.includes('DIFFERENT websites'));
  assert.deepEqual(out, ['{"a": 1}', '{"b": 2}', '{"c": 3}', '{"d": 4}', '{"e": 5}']);
});

test('joint repairs an unparsable envelope with one more ask before falling back', async () => {
  calls.length = 0;
  let n = 0;
  // 첫 답에서 한 칸도 못 읽어야 다시 묻는다 (부분 읽기, 전수검사 11-13)
  reply = () => (n++ === 0 ? 'Sorry, I cannot do that.' : '{"gnet": {"a": 1}, "phone": {"b": 2}}');
  const j = new Joint('aux');
  const [g, p] = await Promise.all([j.ask('gn', [{ role: 'user', content: 'g' }]), j.ask('phone', [{ role: 'user', content: 'p' }])]);
  assert.equal(calls.length, 2);
  assert.equal(g, '{"a": 1}');
  assert.equal(p, '{"b": 2}');
});
