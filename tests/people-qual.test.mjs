// 정성 모드 (리수폿 E): 호감·의심·음란도 수치를 끄면 점수 없이 전용 칸의 글로만
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-qual-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/request.ts', 'src/core/people/prompt/index.ts', 'src/core/people/affinity.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const R = await mod('request');
const P = await mod('prompt/index');
const A = await mod('affinity');

const qualState = { $pp_num_affinity: '0', $pp_num_suspicion: '0', $pp_num_openness: '0', $pp_openness: '1', $pp_taste: '1' };
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const c = chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 커피를 내밀었다. "고마웠어, 어제." 눈을 피했다.', 'c1']);

test('설정: 수치 끔 = 정성 모드, 취향 띠는 호감 수치가 꺼지면 같이 꺼진다', () => {
  const s = St.peopleSettings(qualState);
  assert.deepEqual([...s.qualitative].sort(), ['affinity', 'openness', 'suspicion']);
  assert.equal(s.numeric.size, 0);
  assert.ok(!s.features.has('taste'), '취향 띠는 호감 숫자 위에서만');
  const d = St.peopleSettings({ $pp_taste: '1' });
  assert.equal(d.qualitative.size, 0);
  assert.ok(d.features.has('taste'));
  assert.deepEqual([...d.numeric].sort(), ['affinity', 'openness', 'suspicion']);
});

test('칸: 정성 칸은 정성 모드에서만, 의심 점수 칸은 수치 모드에서만', () => {
  const on = new Set(['affinity', 'suspicion', 'openness']);
  const num = T.slotsFor(on);
  const qual = T.slotsFor(on, new Set(['affinity', 'suspicion', 'openness']));
  assert.ok(num.includes('suspicion') && !num.includes('affinity.regard') && !num.includes('suspicion.concern') && !num.includes('openness.attitude'));
  assert.ok(!qual.includes('suspicion') && qual.includes('affinity.regard') && qual.includes('suspicion.behavior') && qual.includes('openness.speech') && qual.includes('openness.context'));
});

test('지침: 수치 절과 정성 절은 하나만 들어가고 겹친 절도 잘린다', () => {
  const s = St.peopleSettings(qualState);
  const on = U.enabledSections(s);
  assert.ok(on.has('affinity_qual') && on.has('suspicion_qual') && on.has('openness_qual') && !on.has('affinity_num') && !on.has('taste'));
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const q = U.assemblePrompt(txt, on, '');
    assert.ok(q.includes('Qualitative mode') && q.includes('affinity.regard') && q.includes('suspicion.concern') && q.includes('openness.attitude'));
    assert.ok(!q.includes('"cues"') && !q.includes('"suspicion":[') && !q.includes('"openness":[') && !q.includes('| 작은친절 |'), '수치 출력 계약·계기표 없음');
    assert.ok(!/<<[A-Z_:a-z]+>>/.test(q));
    const n = U.assemblePrompt(txt, U.enabledSections(St.peopleSettings({ $pp_openness: '1' })), '');
    assert.ok(n.includes('"cues"') && n.includes('| 작은친절 |') && n.includes('"openness":[') && !n.includes('Qualitative mode'));
  }
});

test('갱신기: 정성 모드면 자료에 계기·단계·숫자가 없고, 계기는 무시되고, 정성 칸 항목은 들어간다', () => {
  const s = St.peopleSettings(qualState);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'SYS', values: {}, names });
  assert.deepEqual(input.data.cues, []);
  const me = input.data.people[0];
  assert.equal(me.affinity_now, undefined);
  assert.equal(me.openness_now, undefined);
  assert.equal(me.taste_now, undefined);
  assert.equal(input.data.suspicion_now, undefined);
  assert.ok(input.data.slots.includes('affinity.regard') && !input.data.slots.includes('suspicion'));
  const rep = U.applyUpdate(store, c, input, {
    entries: [
      { who: '쟈알디', slot: 'affinity.regard', op: 'add', text: '어제 일로 고마워함, 눈을 피하는 건 쑥스러움', m: 'm2', quote: '고마웠어' },
      { who: '쟈알디', slot: 'suspicion.concern', op: 'add', text: '없음', m: 'm2', quote: '고마웠어' },
      { who: '쟈알디', slot: 'suspicion', op: 'add', text: '[시작] x', m: 'm2', quote: '고마웠어' },
    ],
    cues: [{ who: '쟈알디', cue: '도움', m: 'm2', quote: '고마웠어', reason: 'x' }],
    suspicion: [{ who: '쟈알디', target: '@user', kind: '거짓말', op: 'open', text: 'x', m: 'm2', quote: '고마웠어' }],
    openness: [{ who: '쟈알디', op: 'init', value: 90, m: 'm2', quote: '고마웠어', reason: 'x' }],
  }, { settings: s });
  assert.equal(rep.applied.entries, 2);
  assert.equal(rep.applied.cues, 0);
  assert.equal(rep.applied.suspicion, 0);
  assert.equal(rep.applied.openness, 0);
  const live = S.liveness(c);
  const changes = S.liveChanges(store, live);
  assert.equal(A.affinityOf(store.people.쟈알디, changes), 0, '숫자는 멈춘다');
  assert.equal(A.opennessOf(store.people.쟈알디, changes), null);
  assert.equal(S.liveEntries(store.people.쟈알디.slots['affinity.regard'], live)[0].target, '@user');
  assert.equal((store.people.쟈알디.slots.suspicion ?? []).length, 0, '수치 칸은 정성 모드에서 못 씀');
  // 본편: 단계 없이, 정성 칸 묶음으로
  const r = R.peopleBlockFor(c, { settings: s, store, sheetOf: () => null });
  assert.ok(r.text.includes('Goodwill (qualitative') && r.text.includes('어제 일로 고마워함'));
  assert.ok(!r.text.includes('무관심') && !r.text.includes('Openness:'));
  const numeric = R.peopleBlockFor(c, { settings: St.peopleSettings({}), store, sheetOf: () => null });
  assert.ok(numeric.text.includes('무관심') && !numeric.text.includes('Goodwill (qualitative'));
});
