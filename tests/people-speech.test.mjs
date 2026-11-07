// 말투의 다변화 (리수폿 원본 speech-variety 이식, 2026-11-07 K): 조짐 집계·표지·승인, 갱신기 반영, 지침 덩어리
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-speech-'));
await build({
  entryPoints: ['src/core/people/speech.ts', 'src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/affinity.ts', 'src/core/people/director.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const Sp = await mod('speech');
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const A = await mod('affinity');
const D = await mod('director');

const two = { level: 'two', mode: 'ask', limit: 3 };

test('조짐 집계: 같은 방향 3번이면 승인 대기(묻기)·변경 가능(자동), 반대 방향이면 1부터, 저장 글은 안 바뀜', () => {
  const base = '요원 (존댓말). 보고할 때만 짧게 말한다.';
  const s1 = Sp.applySpeechSign(base, `${base} SIGN closer: 농담을 받아 줌`, two);
  assert.equal(s1, `${base} [말투 변화 조짐 가까워짐 1/3] 농담을 받아 줌`);
  const s2 = Sp.applySpeechSign(s1, '아예 다른 글로 바꿔 보려 함 SIGN closer: 이름을 부름', two);
  assert.equal(s2, `${base} [말투 변화 조짐 가까워짐 2/3] 농담을 받아 줌 / 이름을 부름`, '조짐은 저장된 글을 바꾸지 않음');
  const back = Sp.applySpeechSign(s2, `${base} SIGN distant: 상관 앞에서 거리 둠`, two);
  assert.equal(back, `${base} [말투 변화 조짐 멀어짐 1/3] 상관 앞에서 거리 둠`, '반대 방향은 처음부터');
  const s3 = Sp.applySpeechSign(s2, `${base} SIGN closer: 사적인 부탁`, two);
  assert.equal(s3, `${base} [말투 변경 승인 대기 가까워짐] 농담을 받아 줌 / 이름을 부름 / 사적인 부탁`);
  assert.equal(Sp.speechState(s3), 'pending');
  // 대기 중엔 또 조짐이 와도 그대로. 거절 = 집계 지움. 승인 = 변경 가능
  assert.equal(Sp.applySpeechSign(s3, `${base} SIGN closer: 또`, two), s3);
  assert.equal(Sp.decideSpeechPending(s3, false), base);
  const ready = Sp.decideSpeechPending(s3, true);
  assert.equal(ready, `${base} [말투 변경 가능 가까워짐] 농담을 받아 줌 / 이름을 부름 / 사적인 부탁`);
  // 변경 가능 상태에서 쓴 글은 그대로 (표지 사라짐)
  assert.equal(Sp.applySpeechSign(ready, '이름 (반말). 편하게 부른다.', two), '이름 (반말). 편하게 부른다.');
  // 자동 반영이면 3번째에 바로 변경 가능
  assert.equal(Sp.speechState(Sp.applySpeechSign(s2, `${base} SIGN closer: 사적인 부탁`, { ...two, mode: 'auto' })), 'ready');
  // 조짐 없는 upsert 는 글은 바꾸고 표지는 유지
  assert.equal(Sp.applySpeechSign(s2, '요원 (존댓말). 보고할 때만 짧게, 끝을 「~입니다」로 맺는다.', two), '요원 (존댓말). 보고할 때만 짧게, 끝을 「~입니다」로 맺는다. [말투 변화 조짐 가까워짐 2/3] 농담을 받아 줌 / 이름을 부름');
  // 3 미만 = AI 판단: 세지 않고 SIGN·표지 지움. 1단계·끔도 SIGN 지움
  assert.equal(Sp.applySpeechSign(s2, `${base} SIGN closer: x`, { ...two, limit: 2 }), base);
  assert.equal(Sp.applySpeechSign('', `${base} SIGN closer: x`, { level: 'one' }), base);
  assert.equal(Sp.applySpeechSign('', `${base} [말투 변화 조짐 가까워짐 2/3] 베낀 표지 SIGN closer: 첫 조짐`, two), `${base} [말투 변화 조짐 가까워짐 1/3] 첫 조짐`, '모델이 베낀 표지는 무시');
});

test('설정: register_variety/change/sign_limit, 기능 register 끄면 off, 지침 덩어리', () => {
  assert.equal(St.peopleSettings({}).registerVariety, 'off');
  const s = St.peopleSettings({ $pp_register_variety: 'two', $pp_register_change: 'auto', $pp_register_sign_limit: '5' });
  assert.deepEqual(Sp.speechVariety(s), { level: 'two', mode: 'auto', limit: 5, counted: true });
  assert.equal(Sp.speechVariety(St.peopleSettings({ $pp_register_variety: 'two', $pp_register: '0' })).level, 'off');
  assert.equal(Sp.speechVariety(St.peopleSettings({ $pp_register_variety: 'two', $pp_register_sign_limit: '2' })).counted, false);
  assert.equal(Sp.speechVarietyBlock(St.peopleSettings({}), 'writer'), '');
  const one = Sp.speechVarietyBlock(St.peopleSettings({ $pp_register_variety: 'one' }), 'writer');
  assert.ok(/Speech variety/.test(one) && !/SIGN/.test(one));
  assert.ok(/SIGN closer/.test(Sp.speechVarietyBlock(s, 'writer')));
  assert.ok(/own judgment/.test(Sp.speechVarietyBlock(St.peopleSettings({ $pp_register_variety: 'two', $pp_register_sign_limit: '1' }), 'writer')));
  assert.ok(/말투 변화 조짐/.test(Sp.speechVarietyBlock(s, 'director')));
  // 갱신기 지침에 덧붙음 (사용자 지침보다 앞), Director 자료의 register 지침 뒤에
  const sys = U.assemblePrompt('# P\n<<USER_RULES>>', new Set(), '내 규칙', 'ko', {}, Sp.speechVarietyBlock(s, 'writer'));
  assert.ok(sys.indexOf('Speech variety') < sys.indexOf('내 규칙'));
});

const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '존댓말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];

test('갱신기 반영: speech upsert 의 SIGN 을 세고, 집계 중 address 는 거부, 변경 가능이면 address 허용 + 표지 지움', () => {
  const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 웃으며 "요원, 농담도 하네." 라고 했다.', 'c1']);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.speech = [{ id: 'sp1', text: '요원 (존댓말). 짧게 말한다.', src: 'seed', anchor: '#0', seq: 0, target: '@user' }];
  const settings = St.peopleSettings({ $pp_register_variety: 'two', $pp_prev_pairs: '1', $pp_director: 'note' });
  const input = U.buildUpdate(c, store, [1], { settings, system: 'S', values: {}, names });
  assert.deepEqual(input.data.speech_variety, { level: 'two', counted: true, limit: 3, mode: 'ask' });
  const live = S.liveness(c);
  const speechNow = () => S.liveEntries(store.people.쟈알디.slots.speech, live).find((e) => e.target === '@user').text;
  let rep = U.applyUpdate(store, c, input, {
    entries: [{ who: '쟈알디', slot: 'speech', op: 'upsert', replace: 'sp1', target: '@user', text: '요원 (존댓말). 짧게 말한다. SIGN closer: 농담을 함', m: 'm2', quote: '농담도 하네' }],
    address: [{ who: '쟈알디', toUser: '너', register: '반말', m: 'm2', quote: '농담도 하네' }],
  }, { settings });
  assert.equal(rep.applied.entries, 1);
  assert.equal(speechNow(), '요원 (존댓말). 짧게 말한다. [말투 변화 조짐 가까워짐 1/3] 농담을 함');
  assert.equal(rep.applied.address, 0);
  assert.ok(rep.dropped.some((d) => d.kind === 'address' && /집계 중/.test(d.reason)), JSON.stringify(rep.dropped));
  // 승인 대기 → 승인(변경 가능) 상태를 만들어 두고 address 를 보내면 바뀌고 표지가 지워진다
  const cur = S.liveEntries(store.people.쟈알디.slots.speech, live).find((e) => e.target === '@user');
  cur.text = Sp.decideSpeechPending('요원 (존댓말). 짧게 말한다. [말투 변경 승인 대기 가까워짐] a / b / c', true);
  assert.equal(Sp.speechState(cur.text), 'ready');
  rep = U.applyUpdate(store, c, input, { address: [{ who: '쟈알디', toUser: '너', register: '반말', m: 'm2', quote: '농담도 하네' }] }, { settings });
  assert.equal(rep.applied.address, 1);
  assert.deepEqual(A.addressOf(store.people.쟈알디, S.liveChanges(store, live)), { toUser: '너', register: '반말' });
  assert.equal(Sp.speechState(speechNow()), 'none', '표지 지워짐');
  assert.equal(speechNow(), '요원 (존댓말). 짧게 말한다.');
  // 변형 끔이면 address 는 지금까지대로 바로 반영 (SIGN 은 지워짐)
  const store2 = T.emptyStore();
  store2.people.쟈알디 = person('쟈알디');
  const s0 = St.peopleSettings({ $pp_prev_pairs: '1', $pp_director: 'note' });
  const in0 = U.buildUpdate(c, store2, [1], { settings: s0, system: 'S', values: {}, names });
  assert.equal(in0.data.speech_variety, undefined);
  rep = U.applyUpdate(store2, c, in0, { entries: [{ who: '쟈알디', slot: 'speech', op: 'add', target: '@user', text: '요원 (존댓말) SIGN closer: x', m: 'm2', quote: '농담도 하네' }], address: [{ who: '쟈알디', toUser: '너', register: '반말', m: 'm2', quote: '농담도 하네' }] }, { settings: s0 });
  assert.equal(rep.applied.address, 1);
  assert.equal(S.liveEntries(store2.people.쟈알디.slots.speech, live)[0].text, '요원 (존댓말)');
});

test('Director 자료: 말투 다변화가 켜지면 register 지침 뒤에 안내가 붙는다', () => {
  const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 왔다.', 'c1']);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const on = D.buildDirector(c, store, ['쟈알디'], '입력', St.peopleSettings({ $pp_register_variety: 'one' }), { 쟈알디: '' });
  assert.ok(/not to repeat a quoted example line/.test(on.system));
  const off = D.buildDirector(c, store, ['쟈알디'], '입력', St.peopleSettings({}), { 쟈알디: '' });
  assert.ok(!/not to repeat a quoted example line/.test(off.system));
});
