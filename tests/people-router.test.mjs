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
  entryPoints: ['src/core/people/router.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/request.ts', 'src/core/people/updater.ts'],
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

test('본편: Router 가 고른 인물이 있으면 그 사람들로, 없으면 코드 Router; 갱신기 자료에 name_hints', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.데쥬레 = person('데쥬레');
  const s = St.peopleSettings({ $pp_router: 'model' });
  assert.equal(s.router, 'model');
  assert.equal(St.peopleSettings({}).router, 'code');
  const base = { settings: s, store, sheetOf: () => null };
  assert.deepEqual(R.peopleBlockFor(c, base).people, ['쟈알디'], '코드: 이름이 나온 사람만');
  assert.deepEqual(R.peopleBlockFor(c, { ...base, people: ['데쥬레', '쟈알디', '없음'] }).people, ['데쥬레', '쟈알디']);
  const input = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names, hints: [{ name: '미나', aliases: ['미나씨'], quote: '미나가 웃었다' }, { name: '쟈알디', aliases: [], quote: '' }] });
  assert.deepEqual(input.data.name_hints, [{ name: '미나', aliases: ['미나씨'], quote: '미나가 웃었다' }]);
  const none = U.buildUpdate(c, store, [1], { settings: s, system: 'S', values: {}, names });
  assert.equal(none.data.name_hints, undefined);
});
