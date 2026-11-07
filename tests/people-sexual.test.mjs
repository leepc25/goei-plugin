// 성적 욕망·이상성욕 (리수폿 원본 sexualDesire·paraphilia·explicitSexualStyle 이식, 2026-11-07)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-sexual-'));
await build({
  entryPoints: ['src/core/people/sexual.ts', 'src/core/people/axes.ts', 'src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/inject.ts', 'src/core/people/director.ts', 'src/core/people/request.ts', 'src/core/people/prompt/detailed.ts', 'src/core/people/prompt/compact.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const Sx = await mod('sexual');
const Ax = await mod('axes');
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const I = await mod('inject');
const D = await mod('director');
const R = await mod('request');
const PD = await mod('prompt/detailed');
const PC = await mod('prompt/compact');

const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '존댓말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'model', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const sexy = (i) => ['user', `입력 ${i}`, `u${i}`];
const scene = (i) => ['char', `쟈알디와 유저가 침대에서 몸을 섞었다 ${i}.`, `c${i}`];

test('설정: 원본 새 설치 기본값(셋 다 켬), 성격 6축을 끄면 둘 다 꺼짐, 인물별 켬/끔·발정 버전 덮어쓰기', () => {
  const s = St.peopleSettings({});
  assert.deepEqual([s.sexualDesire, s.paraphilia, s.explicitStyle], [true, true, true]);
  assert.deepEqual(Sx.sexualGlobal(s), { desire: true, paraphilia: true });
  assert.deepEqual(Sx.sexualGlobal(St.peopleSettings({ $pp_axes: '0' })), { desire: false, paraphilia: false });
  assert.equal(Sx.sexualAnyOn(St.peopleSettings({ $pp_sexual_desire: '0', $pp_paraphilia: '0' })), false);
  const p = person('쟈알디');
  assert.equal(Sx.sexualFieldOn(p, 'desire', s), true);
  Sx.ensureSexual(p).desireOn = false;
  assert.equal(Sx.sexualFieldOn(p, 'desire', s), false);
  assert.equal(Sx.explicitOn(p, s), true, '덮어쓰기 없으면 전체');
  p.sexual.explicit = false;
  assert.equal(Sx.explicitOn(p, s), false);
  assert.equal(Sx.explicitOn(p, St.peopleSettings({ $pp_explicit_style: '0' })), false);
  p.sexual.explicit = true;
  assert.equal(Sx.explicitOn(p, St.peopleSettings({ $pp_explicit_style: '0' })), true);
  // 저장·읽기
  Sx.setSexualText(p, 'paraphilia', '  관음 성향 <추정> — 훔쳐보는 장면에 반응  ', 'now', true);
  const st = S.peopleStore({ goeiPeopleV1: { people: { 쟈알디: { ...p } } } });
  assert.deepEqual(st.people.쟈알디.sexual, { desire: { text: '', at: '' }, paraphilia: { text: '관음 성향 <추정> — 훔쳐보는 장면에 반응', at: 'now', manual: true }, desireOn: false, paraphiliaOn: true, explicit: true });
});

test('지침: 켜진 칸·발정모드에 따라 절이 조립되고, 끄면 절이 빠진다 (자세히·간결 둘 다)', () => {
  const on = St.peopleSettings({});
  const sec = Sx.sexualWriterSection(on);
  assert.ok(/sexual_init/.test(sec) && /sexual_context_only/.test(sec) && /replace/.test(sec) && /six independent observations across four scenes/.test(sec));
  assert.ok(/자지/.test(Sx.sexualPromptRules(true)) && !/자지/.test(Sx.sexualPromptRules(false)));
  assert.equal(Sx.sexualWriterSection(St.peopleSettings({ $pp_sexual_desire: '0', $pp_paraphilia: '0' })), '');
  assert.ok(!/`paraphilia`/.test(Sx.sexualWriterSection(St.peopleSettings({ $pp_paraphilia: '0' })).split('\n')[1]), '이상성욕만 끄면 그 칸은 지침에서 빠짐');
  for (const text of [PD.UPDATER_DETAILED, PC.UPDATER_COMPACT]) {
    const full = U.assemblePrompt(text, U.enabledSections(on), '', 'ko', {}, '', Sx.sexualWriterSection(on));
    assert.ok(/## 7b\. Sexual desire and paraphilia/.test(full) && /"sexual_init"/.test(full) && !/<<SEXUAL_RULES>>/.test(full));
    const off = St.peopleSettings({ $pp_sexual_desire: '0', $pp_paraphilia: '0' });
    const none = U.assemblePrompt(text, U.enabledSections(off), '', 'ko', {}, '', Sx.sexualWriterSection(off));
    assert.ok(!/7b\. Sexual/.test(none) && !/"sexual_init"/.test(none) && !/<<SEXUAL_RULES>>/.test(none));
  }
  assert.ok(U.enabledSections(on).has('sexual') && !U.enabledSections(St.peopleSettings({ $pp_axes: '0' })).has('sexual'));
});

test('갱신기: 자료에 sexual(칸·현재 글·init_needed·어휘), sexual_init 은 빈 칸에 한 번, 성적 축 관찰은 replace 로 모아 6·4·75 에 검토 → 승인하면 글 교체', () => {
  const msgs = [];
  for (let i = 1; i <= 8; i++) msgs.push(sexy(i), scene(i));
  const c = chat(...msgs);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const settings = St.peopleSettings({ $pp_prev_pairs: '1', $pp_director: 'note', $pp_explicit_style: '0' });
  let input = U.buildUpdate(c, store, [1], { settings, system: 'S', values: {}, names });
  assert.deepEqual(input.data.sexual_profile, { sexual_desire_enabled: true, paraphilia_enabled: true, explicit_sexual_style_enabled: false, policy: 'sexual_context_only' });
  const me = input.data.people.find((p) => p.name === '쟈알디');
  assert.deepEqual(me.sexual, { fields: ['sexual_desire', 'paraphilia'], explicit_style: false, sexual_desire: null, paraphilia: null, init_needed: ['sexual_desire', 'paraphilia'] });
  // 관찰은 첫 글이 없으면 거부, sexual_init 으로 첫 글
  let rep = U.applyUpdate(store, c, input, { observations: [{ who: '쟈알디', axis: 'sexual_desire', direction: 'replace', pattern: '거칠게 리드하는 걸 좋아한다', m: 'm2', quote: '몸을 섞었다 1' }] }, { settings });
  assert.ok(rep.dropped.some((d) => d.kind === 'observation' && /첫 글이 없음/.test(d.reason)));
  rep = U.applyUpdate(store, c, input, { sexual_init: [{ who: '쟈알디', sexual_desire: '위에서 리드하는 걸 좋아한다. 목을 물리면 흥분한다.', paraphilia: '미확인', m: 'm2', quote: '몸을 섞었다 1' }] }, { settings });
  assert.equal(rep.applied.sexualInit, 2);
  assert.equal(store.people.쟈알디.sexual.desire.text, '위에서 리드하는 걸 좋아한다. 목을 물리면 흥분한다.');
  assert.equal(store.people.쟈알디.sexual.paraphilia.text, '미확인');
  // 다시 쓰려 하면 거부 (변경은 관찰로)
  rep = U.applyUpdate(store, c, input, { sexual_init: [{ who: '쟈알디', sexual_desire: '다른 글', m: 'm2', quote: '몸을 섞었다 1' }] }, { settings });
  assert.equal(rep.applied.sexualInit, 0);
  assert.ok(rep.dropped.some((d) => /이미 글이 있음/.test(d.reason)));
  // 인물별로 끈 칸은 거부
  store.people.쟈알디.sexual.paraphiliaOn = false;
  input = U.buildUpdate(c, store, [1], { settings, system: 'S', values: {}, names });
  assert.deepEqual(U.buildUpdate(c, store, [1], { settings, system: 'S', values: {}, names }).data.people[0].sexual.fields, ['sexual_desire']);
  rep = U.applyUpdate(store, c, input, { observations: [{ who: '쟈알디', axis: 'paraphilia', direction: 'replace', pattern: '마조히즘', m: 'm2', quote: '몸을 섞었다 1' }] }, { settings });
  assert.ok(rep.dropped.some((d) => /꺼진 성적 칸/.test(d.reason)));
  // 성적 축 관찰: replace 만, 장면(메시지)마다 하나, 6·4·75 로 검토
  const live = S.liveness(c);
  for (let i = 1; i <= 6; i++) {
    const inp = U.buildUpdate(c, store, [2 * i - 1], { settings, system: 'S', values: {}, names });
    const r = U.applyUpdate(store, c, inp, { observations: [{ who: '쟈알디', axis: 'sexual_desire', direction: i === 1 ? 'up' : 'replace', pattern: `뒤에서 거칠게 당하는 걸 더 좋아하게 됐다 ${i}`, reason: '실제 장면', strength: 80, confidence: 80, m: inp.data.span.find((x) => x.confirmed && x.role === 'assistant').m, quote: `몸을 섞었다 ${i}` }] }, { settings });
    if (i === 1) assert.ok(r.dropped.some((d) => /replace/.test(d.reason)), '성적 축은 replace 만');
    else assert.equal(r.applied.observations, 1, `관찰 ${i}`);
  }
  const cands = Object.values(store.people.쟈알디.candidates);
  assert.equal(cands.length, 1, '설명이 달라도 성적 축은 후보 하나');
  let st = Ax.candidateStats(cands[0], live);
  assert.deepEqual([st.n, st.scenes, st.ready, st.delta], [5, 5, false, 0]);
  assert.equal(cands[0].pattern, '뒤에서 거칠게 당하는 걸 더 좋아하게 됐다 6', '제안 글은 최신');
  const inp7 = U.buildUpdate(c, store, [13], { settings, system: 'S', values: {}, names });
  U.applyUpdate(store, c, inp7, { observations: [{ who: '쟈알디', axis: 'sexual_desire', direction: 'replace', pattern: '뒤에서 거칠게 당하는 걸 더 좋아하게 됐다 7', reason: 'x', strength: 80, confidence: 80, m: inp7.data.span.find((x) => x.confirmed && x.role === 'assistant').m, quote: '몸을 섞었다 7' }] }, { settings });
  st = Ax.candidateStats(cands[0], live);
  assert.deepEqual([st.n, st.scenes, st.ready], [6, 6, true]);
  assert.equal(Ax.approveCandidate(store.people.쟈알디, cands[0].id, live, 'T'), null);
  assert.equal(store.people.쟈알디.sexual.desire.text, '뒤에서 거칠게 당하는 걸 더 좋아하게 됐다 7');
  assert.deepEqual(cands[0].applied, { sexual: 'sexual_desire', before: '위에서 리드하는 걸 좋아한다. 목을 물리면 흥분한다.', after: '뒤에서 거칠게 당하는 걸 더 좋아하게 됐다 7' });
  assert.equal(Ax.revertCandidate(store.people.쟈알디, cands[0].id, 'T2'), null);
  assert.equal(store.people.쟈알디.sexual.desire.text, '위에서 리드하는 걸 좋아한다. 목을 물리면 흥분한다.');
  // 확신이 낮으면 6·4 를 채워도 검토 안 됨
  const p2 = person('데쥬레');
  Sx.setSexualText(p2, 'desire', '글', 'T', false);
  for (let i = 1; i <= 6; i++) Ax.observe(p2, { axis: 'sexual_desire', direction: 'replace', pattern: '새 글', anchor: `c${i}`, seq: 0, quote: `몸을 섞었다 ${i}`, reason: 'r', strength: 50, confidence: 60 }, 'T');
  assert.equal(Ax.candidateStats(Object.values(p2.candidates)[0], live).ready, false);
});

test('본편·Director: 켜져 있고 글이 있을 때만 sexual_context_only 정책과 함께 들어간다', () => {
  const c = chat(['user', '출근', 'u1'], ['char', '쟈알디가 왔다.', 'c1']);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const s = St.peopleSettings({});
  const block = () => R.peopleBlockFor(c, { settings: s, store, sheetOf: () => null }).text;
  assert.ok(!/Sexual profile/.test(block()), '글이 없으면 없음');
  Sx.setSexualText(store.people.쟈알디, 'desire', '위에서 리드하는 걸 좋아한다.', 'T', false);
  assert.ok(/Sexual profile \(policy: sexual_context_only/.test(block()) && /Sexual desire: 위에서 리드하는 걸 좋아한다\./.test(block()) && !/Paraphilia:/.test(block()));
  assert.ok(!/Sexual profile/.test(R.peopleBlockFor(c, { settings: St.peopleSettings({ $pp_sexual_desire: '0' }), store, sheetOf: () => null }).text), '전체 끄면 없음');
  store.people.쟈알디.sexual.desireOn = false;
  assert.ok(!/Sexual profile/.test(block()), '인물별로 끄면 없음');
  store.people.쟈알디.sexual.desireOn = true;
  const d = D.buildDirector(c, store, ['쟈알디'], '입력', s, { 쟈알디: '' });
  assert.deepEqual(d.data.people[0].sexual_desire, { text: '위에서 리드하는 걸 좋아한다.', policy: 'sexual_context_only' });
  assert.equal(d.data.people[0].paraphilia, undefined);
  assert.ok(/sexual_context_only fields are inactive during ordinary conversation/.test(d.system));
  assert.ok(!/sexual_context_only fields/.test(D.buildDirector(c, store, ['쟈알디'], '입력', St.peopleSettings({ $pp_sexual_desire: '0', $pp_paraphilia: '0' }), { 쟈알디: '' }).system));
});
