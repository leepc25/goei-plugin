// 리수폿 J: 지침 편집(절 덮어쓰기)·단계별 모델·하이파 참조·마지막 갱신 되돌리기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-j-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/hypa.ts', 'src/core/people/director.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const H = await mod('hypa');
const D = await mod('director');
const P = await mod('prompt/index');

const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const c = chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 커피를 내밀었다. "고마웠어, 어제." 미나가 옆에서 웃었다.', 'c1']);

test('지침 편집: 절 본문 읽기, 첫 번째(본문) 절만 덮어쓰고 출력 계약 줄은 그대로, 설정에서 읽기', () => {
  const body = U.sectionBody(P.UPDATER_DETAILED, 'register');
  assert.ok(body.startsWith('"## 8.') || body.includes('## 8. Relationship'), body.slice(0, 80));
  const over = U.overrideSections(P.UPDATER_DETAILED, { register: '## 8. MY RULES\nonly this', nope: 'x', 'bad name!': 'y' });
  assert.ok(over.includes('<<SECTION:register>>\n## 8. MY RULES\nonly this\n<<END:register>>'));
  assert.ok(over.includes('"address":['), '출력 계약 줄의 register 절은 남는다');
  const s = St.peopleSettings({ $pp_ps_detailed_register: '## 8. MY RULES\nonly this', $pp_ps_compact_register: 'other', $pp_ps_detailed_empty: '   ' });
  assert.deepEqual(s.promptOverrides, { register: '## 8. MY RULES\nonly this' });
  const full = U.assemblePrompt(P.UPDATER_DETAILED, U.enabledSections(s), '', 'ko', s.promptOverrides);
  assert.ok(full.includes('MY RULES') && !full.includes('### 8.2') && full.includes('"address":['));
  assert.equal(St.PS('detailed', 'register'), '$pp_ps_detailed_register');
});

test('단계별 모델·전용 ID: same 은 갱신 모델을 따르고, ID 는 비면 없음', () => {
  const a = St.peopleSettings({ $pp_model: 'main', $pp_model_router: 'aux', $pp_model_id_director: ' gpt-x ' });
  assert.deepEqual(a.stageModel, { update: 'main', director: 'main', router: 'aux', tidy: 'main' });
  assert.deepEqual(a.stageModelId, { update: '', director: 'gpt-x', router: '', tidy: '' });
  const b = St.peopleSettings({});
  assert.deepEqual(b.stageModel, { update: 'aux', director: 'aux', router: 'aux', tidy: 'aux' });
});

test('하이파 참조: V3 요약 → 없으면 V2, 글자 상한은 최근 것부터, 자료 memory 에 배경으로', () => {
  const v3 = { ...c, hypaV3Data: { summaries: [{ text: '옛 요약 하나' }, { text: '둘' }, { text: '' }] } };
  assert.deepEqual(H.hypaSummaries(v3), ['옛 요약 하나', '둘']);
  assert.deepEqual(H.hypaSummaries(v3, 3), ['둘']);
  const v2 = { ...c, hypaV2Data: { mainChunks: [{ text: 'v2 요약' }] } };
  assert.deepEqual(H.hypaSummaries(v2), ['v2 요약']);
  assert.deepEqual(H.hypaSummaries(c), []);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const s = St.peopleSettings({ $pp_hypa: '1' });
  assert.equal(s.hypa, true);
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names, memory: ['옛 요약'] });
  assert.deepEqual(input.data.memory, ['옛 요약']);
  assert.equal(U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names }).data.memory, undefined);
  const d = D.buildDirector(c, store, ['쟈알디'], 'x', St.peopleSettings({ $pp_director: 'scene', $pp_ps_director_base: '# MY DIRECTOR' }), {}, ['옛 요약']);
  assert.deepEqual(d.data.memory, ['옛 요약']);
  assert.ok(d.system.startsWith('# MY DIRECTOR') && !d.system.includes('# Scene Director · facts'), 'Director 기본 지침 덮어쓰기');
  assert.ok(d.system.includes('## Affinity and taste'), '기능별 절은 그대로');
  assert.ok(D.DIRECTOR_BASE_TEXT.includes('# Scene Director'));
});

test('되돌리기: 갱신이 만든 항목·계기·새 인물을 전부 취소하고, 전 것은 그대로', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.state = [{ id: 'old', text: '본부', src: 'seed', anchor: '#0', seq: 1 }];
  const s = St.peopleSettings({});
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names });
  const before = S.snapshotRun(store);
  U.applyUpdate(store, c, input, {
    entries: [{ who: '쟈알디', slot: 'knowledge', op: 'add', text: '유저가 어제 도움', m: 'm2', quote: '고마웠어' }],
    cues: [{ who: '쟈알디', cue: '도움', m: 'm2', quote: '고마웠어', reason: 'x' }],
    new_people: [{ name: '미나', aliases: [], m: 'm2', quote: '미나가 옆에서', identity: '미확인', speech: null }],
  }, { settings: s });
  const run = S.recordRun(store, before, 'now');
   assert.equal(run.entries.filter((e) => e.who === "쟈알디").length, 1); assert.equal(run.changes.length, 1);
  assert.ok(store.people.미나 && run.newPeople.includes('미나'), '새 인물도 되돌리기 대상');
  const live = S.liveness(c);
  assert.equal(S.liveEntries(store.people.쟈알디.slots.knowledge, live).length, 1);
  const n = S.undoLastRun(store);
  assert.ok(n >= 2);
  assert.equal(S.liveEntries(store.people.쟈알디.slots.knowledge, live).length, 0);
  assert.equal(S.liveEntries(store.people.쟈알디.slots.state, live).length, 1, '전 항목은 그대로');
  assert.equal(S.liveChanges(store, live).length, 0);
  assert.equal(store.lastRun, undefined);
  assert.equal(store.people.미나, undefined, '새 인물은 지워짐');
  assert.equal(S.undoLastRun(store), 0);
  // 저장·읽기
  const copy = S.peopleStore({ [T.PEOPLE_KEY]: JSON.parse(JSON.stringify({ ...store, lastRun: run })) });
  assert.equal(copy.lastRun.entries.length, 2);
});
