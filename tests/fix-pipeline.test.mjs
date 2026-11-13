// 전수검사 11-13 고침: 보조 모델 이미지 태그의 생각 칸, 통합 요청 첨부, 참고 기록 고르기, 통합 응답 가르기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-fix-pipeline-'));
await build({
  entryPoints: ['src/core/asset.ts', 'src/core/attach.ts', 'src/core/focus.ts', 'src/host/joint.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, loader: { '.txt': 'text' }, logLevel: 'silent',
});
const mod = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const AS = await mod('core/asset');
const AT = await mod('core/attach');
const F = await mod('core/focus');
const J = await mod('host/joint');

const calls = [];
let reply = () => '';
globalThis.risuai = { runLLMModel: async (o) => (calls.push(o), { type: 'success', result: reply(o, calls.length) }) };

test('asset: 맨 앞 <Thoughts> 칸은 번호에서 빠지고 저장 본문 앞에 그대로 남는다', () => {
  const think = '<Thoughts>\nAileen [▣| should smile\n\nmore\n</Thoughts>\n\n';
  const s = AS.splitNarrative(`${think}첫 단락\n\n둘째 단락\n[▣|상태]`);
  assert.equal(s.leading, think);
  assert.equal(s.narrative, '첫 단락\n\n둘째 단락');
  assert.equal(s.trailing, '[▣|상태]');
  const plain = AS.splitNarrative('<thoughts>x</thoughts>본문');
  assert.equal(plain.leading, '');
  assert.equal(plain.narrative, '본문');
  const job = { original: '', paras: ['첫 단락', '둘째 단락'], leading: think, trailing: '[▣|상태]', messages: [] };
  const d = { characters: ['Aileen'], aliases: new Map([['aileen', 'Aileen']]), keywords: ['smile'], keywordSet: new Set(['smile']) };
  const out = AS.finishAsset(job, '[{"line": 1, "tag": "<img=Aileen_smile>"}]', d, 2);
  assert.equal(out, `${think}첫 단락\n\n<img=Aileen_smile>\n\n둘째 단락\n[▣|상태]`);
});

test('attach: 묶음 준비는 번호를 이어 가고 system 은 그대로, 단건은 예전과 같다', () => {
  const sys = { role: 'system', content: 'Example [[ATTACH:photo]]what the picture shows[[/ATTACH]]' };
  const a = [sys, { role: 'user', content: '[[ATTACH:photo]]문[[/ATTACH]]' }];
  const b = [sys, { role: 'user', content: '[[ATTACH:gift]]꽃[[/ATTACH]] [[ATTACH:photo]]문[[/ATTACH]]' }];
  const r = AT.prepareAttachmentGroups([a, b]);
  assert.equal(r.groups[0][0], sys);
  assert.equal(r.groups[1][0], sys);
  assert.equal(r.groups[0][1].content, '[ATTACHMENT A1]');
  assert.equal(r.groups[1][1].content, '[ATTACHMENT A2] [ATTACHMENT A1]');
  assert.ok(r.data.content.includes('A2 {"kind":"gift","content":"꽃"}'));
  const one = AT.prepareAttachments(a);
  assert.equal(one.length, 3);
  assert.equal(one[1].content, '[ATTACHMENT A1]');
  const marked = AT.markPrepared([{ role: 'user', content: '[[ATTACH:photo]]x[[/ATTACH]]' }]);
  assert.equal(AT.prepareAttachments(marked), marked);
});

test('joint: 통합 요청에서도 각 작업의 system 예시는 바뀌지 않고 자료는 하나만 붙는다', async () => {
  calls.length = 0;
  reply = () => '{"gnet": {"a": 1}, "phone": {"b": 2}}';
  const sys = { role: 'system', content: 'Example [[ATTACH:photo]]what the picture shows[[/ATTACH]]' };
  const j = new J.Joint('aux');
  await Promise.all([j.ask('gn', [sys, { role: 'user', content: '[[ATTACH:photo]]골목[[/ATTACH]]' }]), j.ask('phone', [sys, { role: 'user', content: 'p' }])]);
  assert.equal(calls.length, 1);
  const msgs = calls[0].messages;
  assert.equal(msgs.length, 3);
  const body = JSON.parse(msgs[1].content);
  const texts = JSON.stringify(body);
  assert.ok(texts.includes('what the picture shows[[/ATTACH]]'), 'system 예시 그대로');
  assert.ok(texts.includes('[ATTACHMENT A1]'));
  assert.ok(msgs[2].content.includes('A1 {"kind":"photo","content":"골목"}'));
  assert.ok(!msgs[2].content.includes('what the picture shows'));
});

test('focus: cost·room 을 주면 건별 합으로 고르고 결과는 예전과 같은 규칙', () => {
  const items = [1, 2, 3, 4, 5, 6].map((n) => ({ order: n, related: n % 2 === 0, free: n === 1, data: `r${n}` }));
  let fitsCalls = 0;
  const fits = (kept) => (fitsCalls++, kept.join(',').length <= 100);
  const old = F.pickRecords(items, { focus: true, recent: 2, max: 3, fits });
  fitsCalls = 0;
  const fast = F.pickRecords(items, { focus: true, recent: 2, max: 3, fits, cost: (d) => d.length + 1, room: 100 });
  assert.deepEqual(fast, old);
  assert.ok(fitsCalls <= 1);
  // 큰 기록은 건너뛰고 뒤의 작은 기록을 넣는다
  const big = [{ order: 3, related: true, data: 'x'.repeat(50) }, { order: 2, related: true, data: 'y' }, { order: 1, related: true, data: 'z' }];
  assert.deepEqual(F.pickRecords(big, { focus: false, recent: 0, max: 5, fits: () => true, cost: (d) => d.length, room: 10 }), ['z', 'y']);
  // 합이 맞아도 실제 확인에서 넘치면 나중에 넣은 것부터 뺀다
  assert.deepEqual(F.pickRecords(big.slice(1), { focus: false, recent: 0, max: 5, fits: (k) => k.length < 2, cost: () => 1, room: 10 }), ['y']);
});

test('splitCombined partial: 잘린 칸·모르는 칸은 빼고 다 읽은 칸은 살린다, 말버릇 칸은 phone 끝에', () => {
  const keys = ['gnet', 'gal', 'phone'];
  assert.throws(() => J.splitCombined('{"gnet": {"a": 1}, "gal": {"b": 2}, "phone": {"c": ', keys), /통합 응답/);
  assert.deepEqual(J.splitCombined('{"gnet": {"a": 1}, "gal": {"b": 2}, "phone": {"c": ', keys, true), { gnet: '{"a": 1}', gal: '{"b": 2}' });
  assert.deepEqual(J.splitCombined('{"x": [1, {"y": "}"}], "gnet": "str", "gal": null, "phone": {"c": 3}}', keys, true), { gal: null, phone: '{"c": 3}' });
  assert.deepEqual(J.splitCombined('Sorry, I cannot.', keys, true), {});
  const h = J.splitCombined('{"gnet": null, "phone": {"u": 1}}\n<ph-habits>[{"id":"a"}]</ph-habits>');
  assert.equal(h.phone, '{"u": 1}<ph-habits>[{"id":"a"}]</ph-habits>');
  assert.equal(h.gnet, null);
});

test('joint: 한 칸만 잘리면 그 작업만 따로, 둘 이상 잘리면 그것들만 한 번 더 묶는다', async () => {
  calls.length = 0;
  reply = (o, n) => (n === 1 ? '{"gnet": {"a": 1}, "gal": {"b": 2}, "wpf": {"c": 3}, "sm": {"d": 4}, "phone": {"e":' : '{"only": 1}');
  const j = new J.Joint('aux', undefined, ['phone', 'gn', 'gal', 'wpf', 'sm']);
  const out = await Promise.all(['gn', 'gal', 'wpf', 'sm', 'phone'].map((k) => j.ask(k, [{ role: 'user', content: k }])));
  assert.equal(calls.length, 2);
  assert.deepEqual(out, ['{"a": 1}', '{"b": 2}', '{"c": 3}', '{"d": 4}', '{"only": 1}']);
  assert.equal(calls[1].messages[0].content, 'phone');

  calls.length = 0;
  reply = (o, n) => (n === 1 ? '{"gnet": {"a": 1}, "gal": {"b": 2}, "wpf": {"c": 3}, "sm":' : '{"sm": {"d": 4}, "phone": {"e": 5}}');
  const k = new J.Joint('aux', undefined, ['phone', 'gn', 'gal', 'wpf', 'sm']);
  const out2 = await Promise.all(['gn', 'gal', 'wpf', 'sm', 'phone'].map((x) => k.ask(x, [{ role: 'user', content: x }])));
  assert.equal(calls.length, 2);
  assert.deepEqual(out2, ['{"a": 1}', '{"b": 2}', '{"c": 3}', '{"d": 4}', '{"e": 5}']);
  assert.ok(calls[1].messages[0].content.includes('"sm", "phone"'));
});
