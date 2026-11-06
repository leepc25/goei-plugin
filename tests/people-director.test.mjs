// 연출형 Director: 기능별 지침(C)·2차 검색(B)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-dir-'));
await build({
  entryPoints: ['src/core/people/director.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const D = await mod('director');
const T = await mod('types');
const St = await mod('settings');

const settings = (state = {}) => St.peopleSettings({ $pp_director: 'scene', ...state });
const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
const chat = (...msgs) => ({ message: msgs.map(([role, data, chatId]) => ({ role, data, chatId })) });
const c = chat(['user', '출근했다', 'u1'], ['char', '쟈알디가 말했다. "명일 아파트 건은 네가 맡아."', 'c1'], ['user', '알겠다고 했다', 'u2'], ['char', '쟈알디가 서류를 건넸다.', 'c2']);

test('기능별 지침: 켜진 기능의 절과 전용 칸만, 끄면 기본 지침만', () => {
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots['register.context'] = [{ id: 'e1', text: '사무실에선 요원님, 둘이면 너', src: 'story', anchor: 'c1', seq: 1, target: '@user', quote: '명일' }];
  const b = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', settings(), { 쟈알디: '규칙' });
  assert.ok(b.system.includes('## Affinity and taste') && b.system.includes('## Address and speech register') && b.system.includes('## Personality axes'));
  assert.ok(!b.system.includes('## Openness') && !b.system.includes('## Narrative rhythm'), '꺼진 기능 절은 없음');
  assert.ok(b.system.includes('Missing material'));
  assert.equal(b.data.people[0].slots['register.context'][0].text, '사무실에선 요원님, 둘이면 너');
  assert.equal(b.data.people[0].axes.length, 6);
  assert.equal(b.data.people[0].affinity, '무관심');
  const plain = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', settings({ $pp_director_features: '0', $pp_director_search: '0' }), {});
  assert.ok(!plain.system.includes('## Affinity and taste') && !plain.system.includes('Missing material'));
  assert.equal(plain.data.people[0].slots, undefined);
  assert.equal(plain.data.people[0].axes, undefined);
  // 정성 모드면 단계 없음
  const q = D.buildDirector(c, store, ['쟈알디'], 'x', settings({ $pp_num_affinity: '0' }), {});
  assert.equal(q.data.people[0].affinity, undefined);
});

test('2차 검색: need → 코드 검색(채팅·로어북·위키) → found 를 얹은 2차 자료, 2차에서는 need 거부', () => {
  const r = D.parseDirectorAny('{"need":[{"kind":"chat","query":"명일 아파트","reason":"어떤 건인지"},{"kind":"lore","query":"명일","reason":"x"},{"kind":"wiki","query":"쟈알디"},{"kind":"nope","query":"x"},{"kind":"chat","query":"명일 아파트"}]}', ['쟈알디'], true, true);
  assert.ok('need' in r);
  assert.deepEqual(r.need.map((n) => n.kind), ['chat', 'lore', 'wiki']);
  assert.throws(() => D.parseDirectorAny('{"need":[{"kind":"chat","query":"x"}]}', ['쟈알디'], true, false), /2차/);
  const lore = [{ comment: '명일 아파트', key: '명일,아파트', content: '재개발이 멈춘 아파트. 지하에 뭔가 있다.' }, { comment: '다른', key: 'z', content: 'zzz' }];
  const found = D.runSearches(r.need, { chat: c, lore });
  assert.equal(found[0].hits.length, 1, '마지막 메시지(답하지 않은 입력)는 빼고 그 전 메시지에서 찾음');
  assert.equal(found[0].hits[0].ref, 'm#2');
  assert.ok(found[0].hits[0].text.includes('명일 아파트'));
  assert.equal(found[1].hits[0].ref, 'lore:명일 아파트');
  assert.equal(found[2].hits.length, 0);
  const built = { system: 'SYS', data: { people: [] }, key: 'k', people: ['쟈알디'], search: true };
  const p2 = D.buildDirectorPass2(built, found);
  assert.ok(p2.system.includes('second pass') && p2.data.found === found && p2.search === false);
  const notes = D.parseDirectorAny('{"notes":[{"who":"쟈알디","now":"서류를 넘김","react":"짧게 확인","must_not_reveal":["지하"]}]}', ['쟈알디'], true, false);
  assert.deepEqual(notes.notes, [{ who: '쟈알디', now: '서류를 넘김', react: '짧게 확인', mustNot: ['지하'] }]);
  assert.equal(D.parseDirector('{"notes":[]}', ['쟈알디'], true).length, 0);
});
