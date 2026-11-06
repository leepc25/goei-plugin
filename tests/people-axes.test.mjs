// 성격 6축·관찰 후보·기능별 전용 칸 (리수폿 F·I)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-axes-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/axes.ts', 'src/core/people/request.ts', 'src/core/people/seed.ts', 'src/core/people/consolidate.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const X = await mod('axes');
const R = await mod('request');
const C = await mod('consolidate');
const P = await mod('prompt/index');

const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const person = (name, extra = {}) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {}, ...extra });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const base = () => chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 먼저 말을 걸었다. "같이 가자." 손을 내밀었다.', 'c1'], ['user', '고개를 끄덕였다', 'u2'], ['char', '쟈알디가 다시 먼저 다가와 웃었다. "오늘도 같이."', 'c2'], ['user', '좋다고 했다', 'u3'], ['char', '쟈알디가 먼저 전화를 걸었다. "내일도 보자."', 'c3'], ['user', '응', 'u4'], ['char', '쟈알디가 먼저 약속을 잡았다. "주말에 봐."', 'c4']);

test('축: 시작값은 express 에서, 띠·영어 줄, 없는 자료는 50', () => {
  const a = X.axesFromExpress(3);
  assert.equal(a.emotionalExpressiveness, 85);
  assert.equal(a.guardedness, 50);
  assert.equal(T.expressOf(a), 3);
  assert.equal(T.expressOf({ ...a, emotionalExpressiveness: 10 }), 0);
  assert.equal(X.readAxes({ guardedness: 999, impulsivity: -5 }).guardedness, 100);
  assert.equal(X.readAxes(undefined).impulsivity, 50);
  assert.equal(X.axesLinesEn(undefined).length, 6);
  assert.ok(X.axesLinesEn(a).some((l) => l.includes('85/100')));
});

test('관찰 → 검토 조건(4개·3장면·확신 55) → 승인하면 축이 움직이고 되돌리기', () => {
  const c = base();
  const live = S.liveness(c);
  const p = person('쟈알디');
  const o = (anchor, seq, quote, conf = 70) => X.observe(p, { axis: 'relationalInitiative', direction: 'up', pattern: '먼저 다가오는 일이 잦아짐', anchor, seq, quote, reason: '먼저 말을 걸었다', strength: 60, confidence: conf }, 'now');
  assert.equal(o('c1', 1, '먼저 말을 걸었다').ok, true);
  assert.equal(o('c1', 2, '손을 내밀었다').ok, false, '같은 메시지는 하나만');
  o('c2', 3, '먼저 다가와');
  o('c3', 4, '먼저 전화를');
  assert.equal(X.reviewCandidates(p, live).length, 0, '3개는 아직');
  o('c4', 5, '먼저 약속을');
  const cands = X.reviewCandidates(p, live);
  assert.equal(cands.length, 1);
  const st = X.candidateStats(cands[0], live);
  assert.equal(st.n, 4); assert.equal(st.scenes, 4); assert.equal(st.delta, 4); assert.ok(st.ready);
  assert.equal(X.approveCandidate(p, cands[0].id, live, 'now'), null);
  assert.equal(p.axes.relationalInitiative, 54);
  assert.equal(p.axesFrom, 'manual');
  assert.equal(X.reviewCandidates(p, live).length, 0);
  // 승인 뒤 같은 설명은 새 후보(~1)
  assert.equal(o('c1', 6, '먼저 말을 걸었다').ok, true);
  assert.ok(Object.keys(p.candidates).some((k) => k.endsWith('~1')));
  assert.equal(X.revertCandidate(p, cands[0].id, 'now'), null);
  assert.equal(p.axes.relationalInitiative, 50);
  // 거절한 후보는 더 모으지 않는다
  const p2 = person('쟈알디');
  const r = X.observe(p2, { axis: 'pattern', direction: 'new', pattern: '약속을 지킴', anchor: 'c1', seq: 1, quote: '같이 가자', reason: 'x', strength: 50, confidence: 60 }, 'now');
  assert.equal(X.rejectCandidate(p2, r.candidate.id, 'now'), null);
  assert.equal(X.observe(p2, { axis: 'pattern', direction: 'new', pattern: '약속을 지킴', anchor: 'c2', seq: 2, quote: '오늘도', reason: 'x', strength: 50, confidence: 60 }, 'now').ok, false);
  // 메시지가 사라지면 관찰도 죽고, 다 죽으면 후보를 지운다
  const dead = S.liveness(chat(['user', '다른 글', 'u9']));
  assert.equal(X.pruneCandidates(p, dead) > 0, true);
});

test('갱신기: axes_init 은 한 번, 관찰은 인물당 2개·축/방향 검사, 끄면 자료·반영 없음', () => {
  const c = base();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [7], { settings: settings(), system: 'SYS', values: {}, names });
  const me = input.data.people.find((p) => p.name === '쟈알디');
  assert.equal(me.axes_init_needed, true);
  assert.equal(me.axes.length, 6);
  assert.ok(input.data.slots.includes('affinity.appraisal') && input.data.slots.includes('register.context') && input.data.slots.includes('perception.secret'));
  assert.ok(!input.data.slots.includes('openness.context'), '꺼진 기능의 칸은 없음');
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    assert.ok(U.assemblePrompt(txt, U.enabledSections(settings()), '').includes('7a. Personality axes'));
    assert.ok(U.assemblePrompt(txt, U.enabledSections(settings()), '').includes('"axes_init"'));
  }
  const six = { relationalInitiative: 70, expressionDirectness: 40, emotionalExpressiveness: 30, guardedness: 55, impulsivity: 20, relationshipPersistence: 80 };
  const rep = U.applyUpdate(store, c, input, {
    entries: [],
    axes_init: [{ who: '쟈알디', axes: six, m: 'm4', quote: '먼저 약속을' }, { who: '쟈알디', axes: six, m: 'm4', quote: '먼저 약속을' }],
    observations: [
      { who: '쟈알디', axis: 'relationalInitiative', direction: 'up', pattern: 'a', reason: 'r', strength: 60, confidence: 70, m: 'm4', quote: '먼저 약속을' },
      { who: '쟈알디', axis: 'guardedness', direction: 'new', pattern: 'b', m: 'm4', quote: '먼저 약속을' },
      { who: '쟈알디', axis: 'nope', direction: 'up', pattern: 'c', m: 'm4', quote: '먼저 약속을' },
      { who: '쟈알디', axis: 'pattern', direction: 'new', pattern: 'd', m: 'm4', quote: '주말에 봐' },
      { who: '쟈알디', axis: 'pattern', direction: 'weaken', pattern: 'e', m: 'm4', quote: '주말에 봐' },
    ],
  }, { settings: settings() });
  assert.equal(rep.applied.axesInit, 1);
  assert.ok(rep.dropped.some((d) => d.reason === '이미 시작값이 있음'));
  assert.equal(store.people.쟈알디.axes.emotionalExpressiveness, 30);
  assert.equal(store.people.쟈알디.express, 1, 'express 는 축에서 다시 계산');
  assert.equal(store.people.쟈알디.axesFrom, 'model');
  assert.equal(rep.applied.observations, 2);
  assert.ok(rep.dropped.some((d) => d.reason.startsWith('방향은')));
  assert.ok(rep.dropped.some((d) => d.reason === '없는 축'));
  assert.ok(rep.dropped.some((d) => d.reason === '인물당 2개 상한'));
  const input2 = U.buildUpdate(c, store, [7], { settings: settings(), system: 'SYS', values: {}, names });
  assert.equal(input2.data.people.find((p) => p.name === '쟈알디').axes_init_needed, undefined);
  // 끄면
  const off = settings({ features: new Set([...settings().features].filter((f) => f !== 'axes')) });
  const input3 = U.buildUpdate(c, store, [7], { settings: off, system: 'SYS', values: {}, names });
  assert.equal(input3.data.people.find((p) => p.name === '쟈알디').axes, undefined);
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) assert.ok(!U.assemblePrompt(txt, U.enabledSections(off), '').includes('Personality axes'));
  const store2 = T.emptyStore(); store2.people.쟈알디 = person('쟈알디');
  const rep3 = U.applyUpdate(store2, c, input3, { entries: [], axes_init: [{ who: '쟈알디', axes: six, m: 'm4', quote: '먼저 약속을' }] }, { settings: off });
  assert.equal(rep3.applied.axesInit, undefined);
  assert.equal(store2.people.쟈알디.axesFrom, 'default');
});

test('전용 칸: 첫인상은 한 번만, 대상 기본 @user, 꺼진 기능의 칸은 거부, 본편 줄', () => {
  const c = base();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [7], { settings: settings(), system: 'SYS', values: {}, names });
  const rep = U.applyUpdate(store, c, input, {
    entries: [
      { who: '쟈알디', slot: 'affinity.appraisal', op: 'add', text: '손을 내미는 사람 → 믿을 만함', m: 'm4', quote: '먼저 약속을' },
      { who: '쟈알디', slot: 'affinity.appraisal', op: 'upsert', text: '고쳐 쓰기', m: 'm4', quote: '주말에 봐' },
      { who: '쟈알디', slot: 'register.context', op: 'add', text: '사무실에선 요원님, 둘이면 너', m: 'm4', quote: '주말에 봐' },
      { who: '쟈알디', slot: 'openness.context', op: 'add', text: 'x', m: 'm4', quote: '주말에 봐' },
    ],
  }, { settings: settings() });
  assert.equal(rep.applied.entries, 2);
  assert.ok(rep.dropped.some((d) => d.reason.startsWith('한 번 쓰면 고치지 않는 칸')));
  assert.ok(rep.dropped.some((d) => d.slot === 'openness.context' || String(d.reason).includes('칸')));
  const live = S.liveness(c);
  assert.equal(S.liveEntries(store.people.쟈알디.slots['affinity.appraisal'], live)[0].target, '@user');
  assert.deepEqual(T.slotsFor(new Set(['affinity'])).filter((s) => s.includes('.')).length, 10);
  assert.deepEqual(T.slotsFor(new Set()), T.CORE_SLOTS.filter((s) => s !== 'suspicion'));
  // 본편 주입: 축 줄 + 기능 묶음
  const r = R.peopleBlockFor(c, { settings: settings(), store, sheetOf: () => null });
  assert.ok(r.text.includes('Personality axes'));
  assert.ok(r.text.includes('Address and relationship stage') || r.text.includes('register.context') || r.text.includes('사무실에선 요원님'));
  // 정리 지침: 켜진 기능 칸 설명이 들어가고 once 칸은 빠진다
  const sys = C.CONSOLIDATE_PROMPT('ko', T.slotsFor(settings().features).filter((s) => !T.SLOT_META[s].once));
  const hints = sys.split('Slot hints: ')[1];
  assert.ok(hints.includes('register.context =') && !hints.includes('affinity.appraisal ='));
});
