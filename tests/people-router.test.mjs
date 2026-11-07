// 모델 Router (리수폿 A): 이름 목록만 보고 장면 인물을 고르고 미등록 이름을 힌트로
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-router-'));
await build({
  entryPoints: ['src/core/people/router.ts', 'src/core/people/affinity.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/request.ts', 'src/core/people/updater.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const Ro = await mod('router');
const T = await mod('types');
const St = await mod('settings');
const R = await mod('request');
const U = await mod('updater');

const person = (name, aliases = []) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases, axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const names = [{ name: '쟈알디', aliases: ['Jyaldi'], titles: ['부장'] }, { name: '데쥬레', aliases: [], titles: [] }];
const c = chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 말했다. "그 사람 말대로 해." 옆에서 미나가 웃었다.', 'c1']);

test('Router 자료: 이름 목록만(기록 본문 없음), 제외 인물 빼기, 응답 읽기(별명→정식 이름, 상한, 미등록 힌트)', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디', ['부장님']);
  store.people.데쥬레 = person('데쥬레');
  store.people.나 = person('나');
  const b = Ro.buildRouter(c, store, names, '부장님께 물었다', { exclude: ['나'] });
  assert.deepEqual(b.data.catalog.map((x) => x.name), ['쟈알디', '데쥬레']);
  assert.ok(b.data.catalog[0].aliases.includes('Jyaldi') && b.data.catalog[0].aliases.includes('부장님') && b.data.catalog[0].titles.includes('부장'));
  assert.ok(!JSON.stringify(b.data).includes('slots'));
  assert.ok(b.system.includes('At most 6'));
  const r = Ro.parseRouter('```json\n{"selected":[{"name":"Jyaldi","reason":"말함"},{"name":"데쥬레"},{"name":"쟈알디"},{"name":"없는사람"}],"new_characters":[{"name":"미나","aliases":["미나씨"],"quote":"미나가 웃었다"},{"name":"쟈알디"},{"name":"미나"}]}\n```', store, names);
  assert.deepEqual(r.selected, ['쟈알디', '데쥬레']);
  assert.deepEqual(r.newCharacters, [{ name: '미나', aliases: ['미나씨'], quote: '미나가 웃었다' }]);
  assert.deepEqual(Ro.parseRouter('{"selected":["데쥬레","쟈알디","데쥬레"]}', store, names, 1).selected, ['데쥬레']);
  assert.throws(() => Ro.parseRouter('{"x":1}', store, names), /selected/);
});

test('본편: 코드 Router(이름 나온 사람) ∪ 모델 Router 가 고른 인물 (2026-11-07: 대체 아님); 갱신기 자료에 name_hints', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.데쥬레 = person('데쥬레');
  const s = St.peopleSettings({ $pp_router: 'model' });
  assert.equal(s.router, 'model');
  assert.equal(St.peopleSettings({}).router, 'code');
  const base = { settings: s, store, sheetOf: () => null };
  assert.deepEqual(R.peopleBlockFor(c, base).people, ['쟈알디'], '코드: 이름이 나온 사람만');
  assert.deepEqual(R.peopleBlockFor(c, { ...base, people: ['데쥬레', '쟈알디', '없음'] }).people, ['쟈알디', '데쥬레'], '이름 나온 사람 먼저, 모델이 더 고른 사람 뒤에');
  assert.deepEqual(R.peopleBlockFor(c, { ...base, people: ['데쥬레'] }).people, ['쟈알디', '데쥬레'], '모델이 빠뜨린 이름 나온 사람도 들어감');
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names, hints: [{ name: '미나', aliases: ['미나씨'], quote: '미나가 웃었다' }, { name: '쟈알디', aliases: [], quote: '' }] });
  assert.deepEqual(input.data.name_hints, [{ name: '미나', aliases: ['미나씨'], quote: '미나가 웃었다' }]);
  const none = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names });
  assert.equal(none.data.name_hints, undefined);
});

test('2026-11-07 설정 L·M·N·P: 항상 포함 인물, 최근 글 범위, 증가·감소 승수, Router 지침 덮어쓰기·덧붙이기, 직전 쌍 기본 2', async () => {
  const A = await mod('affinity');
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.데쥬레 = person('데쥬레');
  // L: always 는 기록에 있는 이름만, 맨 앞. 갱신기도 되짚고 tracking_review 규칙을 넣는다
  const s = St.peopleSettings({ $pp_always: '데쥬레, 없는사람\n쟈알디' });
  assert.deepEqual(s.always, ['데쥬레', '없는사람', '쟈알디']);
  assert.deepEqual(R.peopleBlockFor(c, { settings: s, store, sheetOf: () => null }).people, ['데쥬레', '쟈알디']);
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names });
  assert.ok(input.people.includes('데쥬레'), '글에 안 나온 always 인물도 갱신 대상');
  assert.deepEqual(input.data.tracking_review.refs.sort(), ['데쥬레', '쟈알디']);
  assert.equal(U.buildUpdate(c, store, [1], { settings: St.peopleSettings({}), system: 'S', values: {}, names }).data.tracking_review, undefined);
  // M: Router·Director 최근 글 수 (기본 4, 0 이면 없음), 갱신기 직전 쌍 기본 2
  assert.equal(St.peopleSettings({}).recentMsgs, 4);
  assert.equal(St.peopleSettings({}).prevPairs, 2);
  const long = chat(...Array.from({ length: 6 }, (_, i) => [i % 2 ? 'char' : 'user', `글 ${i}`, `m${i}`]));
  assert.equal(Ro.buildRouter(long, store, names, '입력', { recent: 2 }).data.recent.length, 2);
  assert.equal(Ro.buildRouter(long, store, names, '입력', { recent: 0 }).data.recent.length, 0, '0 이면 최근 글 없음 (slice(-0) 함정 아님)');
  assert.equal(Ro.buildRouter(long, store, names, '입력').data.recent.length, 4);
  // N: 감소 승수 따로. same 이면 증가와 같게
  assert.equal(St.peopleSettings({ $pp_speed: '2' }).speedDown, 2);
  assert.equal(St.peopleSettings({ $pp_speed: '2', $pp_speed_down: '0.5' }).speedDown, 0.5);
  const cue = (name, pin) => ({ id: 'x', anchor: 'c1', seq: 0, src: 'story', who: '쟈알디', kind: 'cue', cue: name });
  assert.equal(A.cueDelta(cue('도움'), { speed: 2, speedDown: 0.5 }), 6);
  assert.equal(A.cueDelta(cue('무시'), { speed: 2, speedDown: 0.5 }), -2);
  assert.equal(A.cueDelta(cue('무시'), { speed: 2 }), -8, 'speedDown 없으면 speed');
  // P: Router 지침 덮어쓰기(ps_router_base)와 덧붙이기(router_rules)
  const p = St.peopleSettings({ $pp_ps_router_base: '# 내 Router\n최대 {{MAX}}명', $pp_router_rules: '민간인은 빼라' });
  const b = Ro.buildRouter(c, store, names, '입력', { prompt: p.routerPrompt, rules: p.routerRules });
  assert.ok(b.system.startsWith('# 내 Router\n최대 6명'));
  assert.ok(/## User rules\n민간인은 빼라/.test(b.system));
  assert.ok(Ro.buildRouter(c, store, names, '입력').system.startsWith('# Router'));
});
