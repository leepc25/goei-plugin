// 리수폿 선택 기능: 취향 띠·음란도·서사 리듬 (기본 끔)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-extra-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/affinity.ts', 'src/core/people/inject.ts', 'src/core/people/request.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const A = await mod('affinity');
const I = await mod('inject');
const R = await mod('request');
const P = await mod('prompt/index');

const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const withFeatures = (...fs) => { const s = settings(); s.features = new Set([...s.features, ...fs]); return s; };
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 눈을 가늘게 떴다. 손을 잡았다. 부끄러워 물러섰다.', 'c1'], ['user', 'x', 'u2'], ['char', '쟈알디가 웃었다. 키스했다.', 'c2']);

test('기본 끔: 기능이 꺼져 있으면 지침·자료·반영 어디에도 없다', () => {
  const s = settings();
  assert.ok(!s.features.has('taste') && !s.features.has('openness') && !s.features.has('rhythm'));
  const sys = U.assemblePrompt(P.promptFor(s), U.enabledSections(s), '');
  assert.ok(!sys.includes('Taste band') && !sys.includes('Openness') && !sys.includes('Narrative rhythm') && !sys.includes('"taste"'));
  const store = T.emptyStore(); store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names });
  assert.ok(!('taste_now' in input.data.people[0]) && !('openness_now' in input.data.people[0]));
  const rep = U.applyUpdate(store, c, input, { taste: [{ who: '쟈알디', band: 1, m: 'm4', quote: '웃었다' }], openness: [{ who: '쟈알디', op: 'init', value: 90, m: 'm4', quote: '웃었다' }] }, { settings: s });
  assert.equal(rep.applied.taste, 0); assert.equal(rep.applied.openness, 0);
});

test('취향 띠: 처음은 한 번에 정하고, 오를 땐 한 칸, 내릴 땐 여러 칸; 본편 한 줄', () => {
  const s = withFeatures('taste');
  const store = T.emptyStore(); store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names });
  assert.equal(input.data.people[0].taste_now, null);
  let rep = U.applyUpdate(store, c, input, { taste: [{ who: '쟈알디', band: 2, m: 'm2', quote: '눈을 가늘게', reason: '첫인상' }] }, { settings: s });
  assert.equal(rep.applied.taste, 1);
  const live = S.liveness(c);
  assert.equal(A.tasteOf(store.people.쟈알디, S.liveChanges(store, live)), 2);
  const input2 = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names });
  assert.equal(input2.data.people[0].taste_now, 2);
  rep = U.applyUpdate(store, c, input2, { taste: [{ who: '쟈알디', band: 3, m: 'm4', quote: '웃었다' }] }, { settings: s });
  assert.equal(rep.applied.taste, 1, '+1 은 됨');
  const store2 = T.emptyStore(); store2.people.쟈알디 = person('쟈알디');
  U.applyUpdate(store2, c, input, { taste: [{ who: '쟈알디', band: 0, m: 'm2', quote: '눈을 가늘게' }] }, { settings: s });
  rep = U.applyUpdate(store2, c, input2, { taste: [{ who: '쟈알디', band: 2, m: 'm4', quote: '웃었다' }] }, { settings: s });
  assert.ok(rep.dropped.some((d) => /한 칸/.test(d.reason)), '+2 는 거부');
  rep = U.applyUpdate(store2, c, input2, { taste: [{ who: '쟈알디', band: -3, m: 'm4', quote: '웃었다' }] }, { settings: s });
  assert.equal(rep.applied.taste, 1, '내릴 땐 여러 칸');
  const block = I.personBlock(store.people.쟈알디, store, live, S.liveChanges(store, live), { taste: true });
  assert.match(block, /First impression \(taste\) → \{\{user\}\}: \+3/);
  assert.ok(!I.personBlock(store.people.쟈알디, store, live, S.liveChanges(store, live), {}).includes('First impression'));
});

test('음란도: 시작값은 표의 값으로 한 번, 변화량은 표의 값, 기준 메시지당 -5~+10, 단계·피임 태도', () => {
  const s = withFeatures('openness');
  const store = T.emptyStore(); store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names });
  assert.equal(input.data.people[0].openness_now, null);
  let rep = U.applyUpdate(store, c, input, { openness: [
    { who: '쟈알디', op: 'event', delta: 3, m: 'm2', quote: '손을 잡았다' },
  ] }, { settings: s });
  assert.ok(rep.dropped.some((d) => /먼저 init/.test(d.reason)), '시작값 없이 event 는 거부');
  rep = U.applyUpdate(store, c, input, { openness: [
    { who: '쟈알디', op: 'init', value: 100, m: 'm2', quote: '손을 잡았다' },
    { who: '쟈알디', op: 'init', value: 90, m: 'm2', quote: '손을 잡았다' },
    { who: '쟈알디', op: 'event', delta: 3, m: 'm2', quote: '손을 잡았다' },
    { who: '쟈알디', op: 'event', delta: 10, m: 'm2', quote: '손을 잡았다' },
    { who: '쟈알디', op: 'event', delta: 7, m: 'm2', quote: '손을 잡았다' },
  ] }, { settings: s });
  assert.equal(rep.applied.openness, 3, 'init 90 + 두 event');
  assert.ok(rep.dropped.some((d) => /0·90·150/.test(d.reason)) && rep.dropped.some((d) => /변화량은/.test(d.reason)));
  const live = S.liveness(c);
  const v = A.opennessOf(store.people.쟈알디, S.liveChanges(store, live));
  assert.equal(v, 100, '90 + min(13, 10)');
  assert.equal(T.opennessStage(v).label, '수줍음');
  const input2 = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names });
  assert.deepEqual(input2.data.people[0].openness_now, { value: 100, stage: 'Shy' });
  rep = U.applyUpdate(store, c, input2, { openness: [{ who: '쟈알디', op: 'init', value: 150, m: 'm4', quote: '키스했다' }, { who: '쟈알디', op: 'event', delta: -5, m: 'm4', quote: '키스했다' }] }, { settings: s });
  assert.ok(rep.dropped.some((d) => /이미 시작값/.test(d.reason)));
  assert.equal(A.opennessOf(store.people.쟈알디, S.liveChanges(store, S.liveness(c))), 95);
  const block = I.personBlock(store.people.쟈알디, store, live, S.liveChanges(store, live), { openness: true });
  assert.match(block, /Openness: Shy \(\d+\/300\) — contraception attitude: hesitant/);
  // 되감기: c2 가 사라지면 그 변화도 사라진다
  const cut = chat(['user', '출근', 'u1'], ['char', '쟈알디가 눈을 가늘게 떴다. 손을 잡았다. 부끄러워 물러섰다.', 'c1']);
  assert.equal(A.opennessOf(store.people.쟈알디, S.liveChanges(store, S.liveness(cut))), 100);
});

test('서사 리듬: 문서 종류 rhythm (표식 검사), 리듬 메모, 본편 블록', () => {
  const s = withFeatures('rhythm');
  const store = T.emptyStore(); store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names });
  assert.ok(input.data.doc_types.includes('rhythm'));
  const rep = U.applyUpdate(store, c, input, {
    docs: [
      { type: 'rhythm', key: 'scene', op: 'add', text: '[phase:build_up] [engagement:active] 키스 뒤 긴장', m: 'm4', quote: '키스했다' },
      { type: 'rhythm', key: 'hook:명단', op: 'add', text: '[stage:seeded] [tier:mid] 명단 언급', m: 'm4', quote: '웃었다' },
      { type: 'rhythm', key: 'scene', op: 'add', text: '표식 없음', m: 'm4', quote: '웃었다' },
    ],
    rhythm_note: 'Tension is moving; let the kiss land before any new stimulus.',
  }, { settings: s });
  assert.equal(rep.applied.docs, 2);
  assert.ok(rep.dropped.some((d) => /표식/.test(d.reason)));
  assert.equal(rep.applied.notes, 1);
  const off = settings();
  assert.ok(!off.features.has('rhythm'));
  const rep2 = U.applyUpdate(store, c, U.buildUpdate(c, store, [3], { settings: off, system: 'S', values: {}, names }), { docs: [{ type: 'rhythm', key: 'chapter', op: 'add', text: 'x', m: 'm4', quote: '웃었다' }], rhythm_note: 'y' }, { settings: off });
  assert.equal(rep2.applied.docs, 0, '꺼져 있으면 리듬 문서를 받지 않음');
  const out = R.peopleBlockFor(c, { settings: s, store, sheetOf: () => null });
  assert.match(out.text, /## Scene rhythm/);
  assert.match(out.text, /- scene: \[phase:build_up\]/);
  assert.match(out.text, /Direction for this reply: Tension is moving/);
  assert.ok(!R.peopleBlockFor(c, { settings: off, store, sheetOf: () => null }).text.includes('Scene rhythm'));
});

test('지침: 세 절이 두 벌에 있고 켜면 들어가고 끄면 빠진다', () => {
  for (const prompt of ['detailed', 'compact']) {
    const on = withFeatures('taste', 'openness', 'rhythm'); on.prompt = prompt;
    const sys = U.assemblePrompt(P.promptFor(on), U.enabledSections(on), '');
    assert.ok(sys.includes('Taste band') && sys.includes('Openness') && sys.includes('Narrative rhythm') && sys.includes('"taste"') && sys.includes('"openness"') && sys.includes('"rhythm_note"'), prompt);
    assert.ok(sys.includes('event|location|faction|item|rhythm'));
  }
});
