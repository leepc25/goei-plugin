// 세력 평판 (docs/설계안_세력평판.md): 시작값·재계산·구간·갱신기 검사·필드 목격 경로·본편 주입·지침
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-fac-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/affinity.ts', 'src/core/people/faction.ts', 'src/core/people/field.ts', 'src/core/people/request.ts', 'src/core/people/prompt/index.ts', 'src/core/people/identity.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const F = await mod('faction');
const Fd = await mod('field');
const R = await mod('request');
const P = await mod('prompt/index');
const I = await mod('identity');

const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const person = (name, faction = 'A00') => ({ name, faction, seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const chat = (...msgs) => ({ scriptstate: { $st_faction: 'A00' }, message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }, { name: '곽성주', aliases: [], titles: [] }];
const c = chat(['user', '출근', 'u1'], ['char', '가짜 관리국이 공문으로 출입 금지를 통보했다. 곽성주가 혼자 화를 냈다.', 'c1'], ['user', 'x', 'u2'], ['char', '관리국이 공식 포상을 내렸다. 쟈알디가 웃었다.', 'c2']);

test('기본 켬: 시작값은 조직×조직 표, 유저 소속 기준. 구간은 설정 경계로, 되감기·고정은 인물과 같은 엔진', () => {
  const s = settings();
  assert.ok(s.features.has('faction_rep') && s.factionInject);
  assert.deepEqual(s.factionBounds, [61, 21, -20, -60]);
  assert.deepEqual(St.parseBounds('70,30,0,-50'), [70, 30, 0, -50]);
  assert.deepEqual(St.parseBounds('10,20,30,40'), [61, 21, -20, -60], '내림차순 아니면 기본값');
  const store = T.emptyStore();
  const live = S.liveness(c);
  const f = F.factionNow(store, 'B00', [], 'A00', s);
  assert.equal(f.base, -25);
  assert.equal(f.stage.id, 'wary', '가짜 관리국 → 관리국 소속 유저: −25 경계');
  assert.equal(F.factionNow(store, 'A00', [], 'A00', s).stage.id, 'neutral');
  // 계기 합과 메시지당 ±10, 범위 ±100
  const log = [
    { id: '1', anchor: 'c1', seq: 1, src: 'story', who: T.factionWho('B00'), kind: 'cue', cue: '파탄', reason: 'r' },
    { id: '2', anchor: 'c1', seq: 2, src: 'story', who: T.factionWho('B00'), kind: 'cue', cue: '파탄', reason: 'r' },
    { id: '3', anchor: 'c2', seq: 1, src: 'story', who: T.factionWho('B00'), kind: 'cue', cue: '중대위반', reason: 'r' },
  ];
  store.log = log;
  const changes = S.liveChanges(store, live);
  assert.equal(F.factionNow(store, 'B00', changes, 'A00', s).value, -85, '−25 −10(상한) −50');
  assert.equal(F.factionNow(store, 'B00', changes, 'A00', s).stage.id, 'hostile');
  const cut = chat(['user', '출근', 'u1'], ['char', 'x', 'c1']);
  assert.equal(F.factionNow(store, 'B00', S.liveChanges(store, S.liveness(cut)), 'A00', s).value, -35, 'c2 가 사라지면 그 계기도');
  store.log.push({ id: '4', anchor: 'c2', seq: 2, src: 'manual', who: T.factionWho('B00'), kind: 'cue', pin: 40, reason: '고정' });
  assert.equal(F.factionNow(store, 'B00', S.liveChanges(store, live), 'A00', s).stage.id, 'favorable');
});

test('갱신기: 장면 세력 자료, 집단 행위만 받고 구성원 한 명의 일은 버림, 이름→코드, 세력당 1건, 끄면 전부 없음', () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디', 'A00');
  store.people.곽성주 = person('곽성주', 'B00');
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, factionNames: { A00: '관리국', B00: '가짜 관리국' } });
  assert.deepEqual(input.factions, ['A00'], '확정 구간(m3·m4)에 나온 세력과 장면 인물 소속만. 가짜 관리국은 맥락 구간(m2)에만 있어 빠짐');
  assert.ok(input.data.factions_now.some((f) => f.code === 'A00' && f.stage === '중립'));
  const input1 = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names, factionNames: { A00: '관리국', B00: '가짜 관리국' } });
  assert.ok(input1.factions.includes('B00') && input1.data.factions_now.some((f) => f.code === 'B00' && f.stage === '경계'));
  const r = {
    faction_cues: [
      { faction: '관리국', cue: '큰도움', m: 'm4', quote: '공식 포상을 내렸다', reason: '공식 포상' },
      { faction: 'A00', cue: '도움', m: 'm4', quote: '공식 포상을 내렸다', reason: '공식 포상 또' },
      { faction: 'A00', cue: '작은친절', m: 'm4', quote: '쟈알디가 웃었다', reason: '쟈알디가 웃음' },
      { faction: '회사 어딘가', cue: '도움', m: 'm4', quote: '공식 포상', reason: '포상' },
    ],
  };
  const rep = U.applyUpdate(store, c, input, r, { settings: s });
  assert.equal(rep.applied.factions, 1);
  assert.ok(rep.dropped.some((d) => d.reason === '세력당 1건'));
  assert.ok(rep.dropped.some((d) => /집단 반응 근거 없음/.test(d.reason)));
  assert.ok(rep.dropped.some((d) => d.reason === '모르는 세력 이름'));
  assert.ok(store.factions.A00 && store.factions.A00.name === '관리국');
  const live = S.liveness(c);
  assert.equal(F.factionNow(store, 'A00', S.liveChanges(store, live), 'A00', s).value, 5);
  const off = settings(); off.features = new Set([...off.features].filter((f) => f !== 'faction_rep'));
  const input2 = U.buildUpdate(c, store, [3], { settings: off, system: 'S', values: {}, names });
  assert.deepEqual(input2.factions, []);
  assert.equal(input2.data.factions_now, undefined);
  const rep2 = U.applyUpdate(store, c, input2, r, { settings: off });
  assert.equal(rep2.applied.factions, 0);
  const sys = U.assemblePrompt(P.promptFor(off), U.enabledSections(off), '');
  assert.ok(!sys.includes('Faction standing') && !sys.includes('faction_cues'));
  for (const prompt of ['detailed', 'compact']) {
    const on = settings({ prompt });
    const sysOn = U.assemblePrompt(P.promptFor(on), U.enabledSections(on), '');
    assert.ok(sysOn.includes('Faction standing') && sysOn.includes('"faction_cues"'), prompt);
  }
});

test('필드 목격 경로: 명단 인물은 원래 값, 몹은 절반(소수점 버림, 0 이면 없음), 설정 같음·안 씀', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const ev = (id, kind, witness) => ({ id, at: 1, anchor: 'c1', kind, text: '필드 일', who: [], witness });
  Fd.applyFieldEvent(store, c, ev('e1', 'quest', { faction: 'B00', named: true }), '주인공');
  Fd.applyFieldEvent(store, c, ev('e2', 'quest', { faction: 'B00', named: false }), '주인공');
  Fd.applyFieldEvent(store, c, ev('e3', 'gift', { faction: 'B00', named: false }), '주인공');
  Fd.applyFieldEvent(store, c, ev('e4', 'kill', { faction: 'C00', named: false }), '주인공');
  const live = S.liveness(c);
  const changes = S.liveChanges(store, live);
  const s = settings();
  assert.equal(F.factionNow(store, 'B00', changes, 'A00', s).value, -25 + 3 + 1, '도움 3 + 몹 도움 1 (몹 작은친절 0.5→0)');
  assert.equal(F.factionNow(store, 'C00', changes, 'A00', s).value, -25 - 25, '몹 목격 중대위반 −50 → −25');
  const store2 = T.emptyStore();
  Fd.applyFieldEvent(store2, c, ev('e2', 'quest', { faction: 'B00', named: false }), '주인공', { mobWeight: 'full' });
  assert.equal(F.factionNow(store2, 'B00', S.liveChanges(store2, live), 'A00', s).value, -22);
  const store3 = T.emptyStore();
  Fd.applyFieldEvent(store3, c, ev('e2', 'quest', { faction: 'B00', named: false }), '주인공', { mobWeight: 'off' });
  assert.equal(store3.log.length, 0);
  Fd.applyFieldEvent(store3, c, ev('e5', 'quest', { faction: 'B00', named: true }), '주인공', { mobWeight: 'off' });
  assert.equal(store3.log.length, 1, '안 씀이어도 명단 인물 목격은 기록');
});

test('본편 주입: 장면 세력 가운데 중립이 아닌 것만, 주입 끄면 없음; 글에서 세력 이름 찾기', () => {
  assert.deepEqual(I.factionCodesIn('가짜 관리국과 백일몽이 나왔다'), ['B00', 'C00'], '가짜 관리국은 관리국으로 또 잡히지 않음');
  assert.deepEqual(I.factionCodesIn('관리국 요원'), ['A00']);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디', 'A00');
  const s = settings();
  const c2 = chat(['user', '출근', 'u1'], ['char', '쟈알디가 왔다.', 'c1'], ['user', 'x', 'u2'], ['char', '가짜 관리국이 공문을 보냈다. 쟈알디가 읽었다.', 'c2']);
  const out = R.peopleBlockFor(c2, { settings: s, store, sheetOf: () => null, factionNames: { A00: '관리국', B00: '가짜 관리국' } });
  assert.match(out.text, /## Factions → \{\{user\}\}/);
  assert.match(out.text, /- 가짜 관리국 → \{\{user\}\}: Wary\./, '가짜 관리국 −25 경계');
  assert.ok(!/- 관리국 → /.test(out.text), '관리국은 중립이라 생략');
  const off = settings({ factionInject: false });
  assert.ok(!R.peopleBlockFor(c2, { settings: off, store, sheetOf: () => null }).text.includes('Factions'));
  const block = F.factionsBlock([{ code: 'A00', name: '관리국', value: 0, stage: T.factionStage(0), base: 0 }], '주인공');
  assert.equal(block, '', '중립뿐이면 절 자체가 없음');
});
