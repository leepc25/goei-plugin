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

const settings = (state = {}) => St.peopleSettings({ $pp_director: 'scene', $pp_rhythm: '0', ...state });
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

test('요청 자료: 기록은 record 전문 한 번만, 꼬리 칸(state·threads·knowledge·suspicion)은 싣지 않는다. 재사용 열쇠는 그대로 꼬리를 본다 (gupdp#1)', () => {
  const e = (id, text, extra = {}) => ({ id, text, src: 'story', anchor: 'c1', seq: 1, ...extra });
  const mk = (state, threads) => {
    const store = T.emptyStore();
    store.people.쟈알디 = person('쟈알디');
    store.people.쟈알디.slots.state = [e('s1', state)];
    store.people.쟈알디.slots.threads = [e('t1', threads)];
    store.people.쟈알디.slots.knowledge = [e('k1', '명일 아파트 지하의 소문을 들었다')];
    store.people.쟈알디.slots.suspicion = [e('u1', '요원이 보고서를 고쳤다고 의심', { target: '@user' })];
    return store;
  };
  const st = settings({ $pp_suspicion: '1' });
  const b = D.buildDirector(c, mk('서류 더미에 파묻혀 있다', '아파트 건 보고를 기다린다'), ['쟈알디'], '서류를 받았다', st, {});
  const p = b.data.people[0];
  for (const k of ['state', 'threads', 'knowledge', 'suspicion']) assert.equal(p[k], undefined, `${k} 꼬리 칸 없음`);
  for (const t of ['서류 더미에 파묻혀 있다', '아파트 건 보고를 기다린다', '명일 아파트 지하의 소문을 들었다']) {
    assert.ok(p.record.includes(t), 'record 전문에는 있음');
    assert.equal(JSON.stringify(b.data).split(t).length - 1, 1, `자료에 한 번만: ${t}`);
  }
  // 열쇠: 같은 기록이면 같고, 상태·미해결이 바뀌면 달라진다
  assert.equal(D.buildDirector(c, mk('서류 더미에 파묻혀 있다', '아파트 건 보고를 기다린다'), ['쟈알디'], '서류를 받았다', st, {}).key, b.key);
  assert.notEqual(D.buildDirector(c, mk('자리를 비웠다', '아파트 건 보고를 기다린다'), ['쟈알디'], '서류를 받았다', st, {}).key, b.key);
  assert.notEqual(D.buildDirector(c, mk('서류 더미에 파묻혀 있다', '다른 건'), ['쟈알디'], '서류를 받았다', st, {}).key, b.key);
});

test('자료가 없는 기능 절(의심·리듬·성적)은 붙이지 않고, 자료가 실리면 붙인다 (11-14 재검토 gtoken#5)', () => {
  const on = settings({ $pp_suspicion: '1', $pp_rhythm: '1', $pp_axes: '1', $pp_sexual_desire: '1', $pp_paraphilia: '1' });
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const empty = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(!empty.system.includes('## Suspicion'), '의심 칸이 비면 의심 절 없음');
  assert.ok(!empty.system.includes('## Narrative rhythm'), '리듬 기록이 없으면 리듬 절 없음');
  assert.ok(!/sexual_context_only/.test(empty.system), '성적 글이 없으면 성적 절 없음');
  assert.ok(empty.system.includes('## Personality axes') && empty.system.includes('## Affinity and taste'), '다른 절은 그대로');
  assert.equal(empty.data.rhythm, undefined);
  assert.equal(empty.data.people[0].slots, undefined);
  // 자료가 실리면 그 절이 붙는다
  // 의심은 기본이 정성 모드(suspicion.* 칸), 수치를 켜면 suspicion 칸. 그 모드에서 실리는 칸에 글이 있어야 한다
  const num = settings({ $pp_suspicion: '1', $pp_num_suspicion: '1' });
  store.people.쟈알디.slots.suspicion = [{ id: 'su1', text: '[시작] 서류 날짜가 맞지 않는다', src: 'story', anchor: 'c1', seq: 1, target: '@user', quote: '명일' }];
  assert.ok(!D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' }).system.includes('## Suspicion'), '정성 모드에서는 수치 칸이 실리지 않으니 절도 없음');
  const sn = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', num, { 쟈알디: '' });
  assert.ok(sn.data.people[0].slots.suspicion.length === 1 && sn.system.includes('## Suspicion'));
  store.people.쟈알디.slots['suspicion.concern'] = [{ id: 'su3', text: '서류 날짜가 맞지 않는다', src: 'story', anchor: 'c1', seq: 2, target: '@user', quote: '명일' }];
  const sus = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(sus.data.people[0].slots['suspicion.concern'].length === 1 && sus.system.includes('## Suspicion'));
  assert.ok(!sus.system.includes('## Narrative rhythm') && !/sexual_context_only/.test(sus.system));
  store.docs['rhythm:hook:서류'] = { type: 'rhythm', key: 'hook:서류', entries: [{ id: 'h1', text: '[stage:seeded] [tier:mid] 서류', src: 'story', anchor: 'c1', seq: 1 }] };
  const rh = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(rh.data.rhythm.length === 1 && rh.system.includes('## Narrative rhythm'));
  store.people.쟈알디.sexual = { desire: { text: '직설적이다', at: 'T' }, paraphilia: { text: '', at: '' }, desireOn: true, paraphiliaOn: true, explicit: null };
  const sx = D.buildDirector(c, store, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' });
  assert.ok(sx.data.people[0].sexual_desire && /sexual_context_only fields/.test(sx.system));
  // 지워진 메시지에 닻을 둔 의심 기록은 자료가 아니다
  const gone = T.emptyStore();
  gone.people.쟈알디 = person('쟈알디');
  gone.people.쟈알디.slots['suspicion.concern'] = [{ id: 'su2', text: 'x', src: 'story', anchor: 'zz', seq: 1, target: '@user', quote: 'x' }];
  assert.ok(!D.buildDirector(c, gone, ['쟈알디'], '서류를 받았다', on, { 쟈알디: '' }).system.includes('## Suspicion'));
});
