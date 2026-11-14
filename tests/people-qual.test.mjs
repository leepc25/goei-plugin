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
  assert.ok(St.peopleSettings({}).qualitative.has('suspicion') && St.peopleSettings({}).features.has('rhythm'), '기본값: 의심 정성·리듬 켬 (11-07 사용자 결정)');
  const s = St.peopleSettings(qualState);
  assert.deepEqual([...s.qualitative].sort(), ['affinity', 'openness', 'suspicion']);
  assert.equal(s.numeric.size, 0);
  assert.ok(!s.features.has('taste'), '취향 띠는 호감 숫자 위에서만');
  const d = St.peopleSettings({ $pp_taste: '1', $pp_num_suspicion: '1' }); // 기본 의심은 정성(11-07 결정) — 수치 전부 켠 모양을 시험
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
  // 세력 평판 수치가 켜져 있으면 계기표가 실리므로 (사용자 11-14 A-8) 세력도 정성으로 두고 본다. 그 조합은 아래 계기표 시험에서
  const s = St.peopleSettings({ ...qualState, $pp_num_faction_rep: '0' });
  const on = U.enabledSections(s);
  assert.ok(!on.has('cue_table'));
  assert.ok(on.has('affinity_qual') && on.has('suspicion_qual') && on.has('openness_qual') && !on.has('affinity_num') && !on.has('taste'));
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const q = U.assemblePrompt(txt, on, '');
    assert.ok(q.includes('Qualitative mode') && q.includes('affinity.regard') && q.includes('suspicion.concern') && q.includes('openness.attitude'));
    assert.ok(!q.includes('"cues"') && !q.includes('"suspicion":[') && !q.includes('"openness":[') && !q.includes('| 작은친절 |'), '수치 출력 계약·계기표 없음');
    assert.ok(!/<<[A-Z_:a-z]+>>/.test(q));
    const n = U.assemblePrompt(txt, U.enabledSections(St.peopleSettings({ $pp_openness: '1', $pp_num_suspicion: '1' })), '');
    assert.ok(n.includes('"cues"') && n.includes('| 작은친절 |') && n.includes('"openness":[') && !n.includes('Qualitative mode'));
  }
});

// 계기 뜻풀이 표 (사용자 2026-11-14 A-8): 호감 수치나 세력 평판 수치 중 하나만 켜져도 실린다. 표 글은 그대로, 자리만
const count = (t, part) => t.split(part).length - 1;
const CUE_NAMES = ['작은친절', '도움', '큰도움', '헌신', '실망', '무시', '배신', '파탄', '중대위반'];
/** 고치기 전 지침 글: cue_table 표식과 <<CUE_TABLE>> 자리만 걷어 낸 것 */
const beforeA8 = (txt) => txt.replace('<<SECTION:cue_table>>\n### 7.8 Cues', '### 7.8 Cues').replace(/<<(?:SECTION|END):cue_table>>/g, '').replace('<<CUE_TABLE>>', '');

test('계기표: 호감 수치가 켜져 있으면 조립 결과가 고치기 전과 같고 표는 한 번', () => {
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    const old = beforeA8(txt);
    assert.ok(!old.includes('cue_table') && !old.includes('CUE_TABLE') && old.length < txt.length);
    // 기본 설정 · 세력 평판 글로만 · 세력 평판 끔 · 다른 기능을 더 켠 경우
    for (const state of [{}, { $pp_num_faction_rep: '0' }, { $pp_faction_rep: '0' }, { $pp_openness: '1', $pp_taste: '1', $pp_num_suspicion: '1' }]) {
      const st = St.peopleSettings(state);
      assert.ok(st.features.has('affinity') && !st.qualitative.has('affinity'));
      const on = U.enabledSections(st);
      const now = U.assemblePrompt(txt, on, '내 규칙');
      const onOld = new Set(on);
      onOld.delete('cue_table');
      assert.equal(now, U.assemblePrompt(old, onOld, '내 규칙'), JSON.stringify(state));
      assert.equal(count(now, '| 작은친절 |'), 1);
      assert.equal(count(now, '### 7.8 Cues (what the program scores)'), 1);
      assert.ok(!/<<[A-Z_:a-z]+>>/.test(now));
    }
  }
});

test('계기표: 호감 글로만(또는 끔) + 세력 평판 수치면 표가 한 번 실리고 호감 점수 규칙은 안 실린다', () => {
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    // 호감 수치가 켜진 요청에 실리는 표 (제목 줄부터 마지막 줄까지) 를 그대로 떼어 견준다
    const num = U.assemblePrompt(txt, U.enabledSections(St.peopleSettings({})), '');
    const table = num.slice(num.indexOf('| Cue | Base | Meaning |'), num.indexOf('\n', num.indexOf('| 중대위반 |')));
    assert.equal(count(table, '\n'), 10, '머리 2줄 + 계기 9줄');
    for (const state of [{ $pp_num_affinity: '0' }, { $pp_affinity: '0' }, qualState]) {
      const st = St.peopleSettings(state);
      assert.ok(st.features.has('faction_rep') && !st.factionQual && !(st.features.has('affinity') && !st.qualitative.has('affinity')));
      const on = U.enabledSections(st);
      assert.ok(on.has('cue_table') && !on.has('affinity_num'));
      const q = U.assemblePrompt(txt, on, '');
      assert.equal(count(q, table), 1, '표 글이 그대로 한 번');
      assert.equal(count(q, '| 작은친절 |'), 1);
      assert.equal(count(q, '### 7.8 Cues (what the program scores)'), 1, '「7.8 표」가 가리키는 제목');
      for (const n of CUE_NAMES) assert.ok(q.includes(`| ${n} |`), n);
      // 호감 수치 전용 문장은 없다
      assert.ok(!q.includes("Report only events in which the USER'S CHARACTER") && !q.includes('Never a cue:') && !q.includes('Initial values') && !q.includes('극도의 적대') && !q.includes('"cues":['));
      assert.ok(q.includes('"faction_cues"'));
      assert.ok(!/<<[A-Z_:a-z]+>>/.test(q));
      // 「목록이 없다」 문장 (A-8 ①)
      assert.ok(!q.includes('there is no `cues` list') && !q.includes('no `cues`,'));
      if (st.features.has('affinity')) assert.ok(q.includes('Qualitative mode') && /Affinity numbers are off[^.]*?(there are no person cues,|: no person cues,)/.test(q));
      // 표는 호감 절(7) 뒤, 8절 앞
      if (st.features.has('affinity')) assert.ok(q.indexOf('### 7.8 Qualitative mode') < q.indexOf('| 작은친절 |'));
      assert.ok(q.indexOf('| 작은친절 |') < q.indexOf('## 8. Relationship, address and speech register'));
    }
  }
});

test('계기표: 호감 수치도 세력 평판 수치도 없으면 표가 없다', () => {
  for (const txt of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) {
    for (const a of [{ $pp_num_affinity: '0' }, { $pp_affinity: '0' }]) for (const f of [{ $pp_num_faction_rep: '0' }, { $pp_faction_rep: '0' }]) {
      const on = U.enabledSections(St.peopleSettings({ ...a, ...f }));
      assert.ok(!on.has('cue_table'));
      const q = U.assemblePrompt(txt, on, '');
      assert.ok(!q.includes('| 작은친절 |') && !q.includes('| Cue | Base | Meaning |') && !q.includes('7.8 Cues'));
      assert.ok(!/<<[A-Z_:a-z]+>>/.test(q));
      assert.equal(q, U.assemblePrompt(beforeA8(txt), on, ''), '표 말고는 그대로');
    }
  }
});

test('갱신기: 정성 모드면 자료에 계기·단계·숫자가 없고, 계기는 무시되고, 정성 칸 항목은 들어간다', () => {
  // 세력 평판 수치가 켜져 있으면 계기표가 들어가므로 (전수검사 11-13) 세력도 정성으로
  const s = St.peopleSettings({ ...qualState, $pp_num_faction_rep: '0' });
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
