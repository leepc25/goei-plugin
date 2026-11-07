// 리듬 턴 계산 (리수폿 H)·20턴 관계 재검토 (리수폿 G)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-rhy-'));
await build({
  entryPoints: ['src/core/people/rhythm.ts', 'src/core/people/updater.ts', 'src/core/people/store.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/request.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const Rh = await mod('rhythm');
const U = await mod('updater');
const S = await mod('store');
const T = await mod('types');
const St = await mod('settings');
const R = await mod('request');

const person = (name) => ({ name, faction: 'A00', seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [], axes: T.DEFAULT_AXES(), axesFrom: 'default', patterns: [], candidates: {} });
/** n턴짜리 채팅: u1,c1,u2,c2,… (c{k} 가 k번째 턴) */
const chatOf = (n) => ({ message: Array.from({ length: n * 2 }, (_, i) => ({ role: i % 2 ? 'char' : 'user', data: i % 2 ? `쟈알디가 ${(i + 1) / 2}번째로 말했다. 명일 아파트.` : `입력 ${i / 2 + 1}`, chatId: i % 2 ? `c${(i + 1) / 2}` : `u${i / 2 + 1}` })) });
const entry = (id, text, anchor, extra = {}) => ({ id, text, src: 'story', anchor, seq: 1, quote: '말했다', ...extra });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const settings = (over = {}) => St.peopleSettings({ $pp_rhythm: '1', $pp_director: 'note', $pp_prev_pairs: '1', ...over });

test('훅 시계: 심은 턴·범위·넘김·연장·새 훅 허용', () => {
  const c = chatOf(12);
  const live = S.liveness(c);
  const store = T.emptyStore();
  store.docs['rhythm:hook:편지'] = { type: 'rhythm', key: 'hook:편지', entries: [entry('h1', '[stage:seeded] [tier:short] 책상 위 편지', 'c2'), entry('h2', '[stage:hinted] [tier:short] 봉투가 열려 있음', 'c4')] };
  store.docs['rhythm:hook:지하'] = { type: 'rhythm', key: 'hook:지하', entries: [entry('h3', '[stage:seeded] [tier:long] 지하에서 소리', 'c3')] };
  store.docs['rhythm:hook:끝'] = { type: 'rhythm', key: 'hook:끝', entries: [entry('h4', '[stage:resolved] [tier:mid] 끝남', 'c5')] };
  const k = Rh.rhythmClock(store, c, live);
  assert.equal(k.turn, 12);
  const letter = k.hooks.find((h) => h.key === 'hook:편지');
  assert.equal(letter.planted, 2); assert.equal(letter.age, 10); assert.equal(letter.sinceLast, 8);
  assert.deepEqual(letter.window, [2, 7]); assert.equal(letter.overdue, true);
  assert.deepEqual(k.active, { short: 1, mid: 0, long: 1 }, 'resolved 는 안 셈');
  assert.equal(k.plantAllowed, false); assert.match(k.plantBlocked, /overdue/);
  assert.match(k.priority[0], /overdue: hook:편지/);
  // 연장하면 범위가 +3, 아직 범위 안
  store.docs['rhythm:hook:편지'].entries.push(entry('h5', '[stage:escalated] [tier:short] [ext] 발신인 짐작', 'c9'));
  const k2 = Rh.rhythmClock(store, c, live);
  const l2 = k2.hooks.find((h) => h.key === 'hook:편지');
  assert.deepEqual(l2.window, [2, 10]); assert.equal(l2.extended, true); assert.equal(l2.overdue, false); assert.equal(l2.due, true);
  assert.equal(k2.plantAllowed, true, '마지막 심은 턴 3에서 9턴 지남, 상한 여유');
  // 7턴 시점에서는 (upto) 편지가 범위 안
  const k7 = Rh.rhythmClock(store, c, live, live.at.get('c7'));
  assert.equal(k7.turn, 7);
  assert.equal(k7.hooks.find((h) => h.key === 'hook:편지').due, true);
  assert.ok(Rh.rhythmClockLines(k2).join('\n').includes('Turn 12'));
  assert.equal(U.rhythmTextOk('hook:x', '[stage:seeded] [tier:short] [ext] 글'), true);
});

test('갱신기: rhythm_clock 자료, 훅 행동은 응답당 1개, 새 훅은 허용될 때만', () => {
  const c = chatOf(4);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.docs['rhythm:hook:편지'] = { type: 'rhythm', key: 'hook:편지', entries: [entry('h1', '[stage:seeded] [tier:short] 책상 위 편지', 'c3')] };
  const input = U.buildUpdate(c, store, [7], { settings: settings(), system: 'S', values: {}, names });
  assert.ok(Array.isArray(input.data.rhythm_clock) && input.data.rhythm_clock[0].includes('Turn 4'));
  assert.equal(input.clock.plantAllowed, false, '마지막 심은 지 1턴');
  const rep = U.applyUpdate(store, c, input, {
    entries: [],
    docs: [
      { type: 'rhythm', key: 'hook:새것', op: 'add', text: '[stage:seeded] [tier:short] 새 단서', m: 'm4', quote: '말했다' },
      { type: 'rhythm', key: 'hook:편지', op: 'upsert', replace: 'h1', text: '[stage:hinted] [tier:short] 봉투', m: 'm4', quote: '말했다' },
      { type: 'rhythm', key: 'hook:편지', op: 'upsert', replace: 'h1', text: '[stage:escalated] [tier:short] 또', m: 'm4', quote: '말했다' },
      { type: 'rhythm', key: 'scene', op: 'add', text: '[phase:build_up] [engagement:active] 긴장', m: 'm4', quote: '말했다' },
    ],
  }, { settings: settings() });
  assert.ok(rep.dropped.some((d) => d.reason.startsWith('새 훅을 심을 수 없음')), JSON.stringify(rep.dropped));
  assert.ok(rep.dropped.some((d) => d.reason === '응답당 훅 행동 1개'));
  assert.equal(rep.applied.docs, 2, '편지 진전 1 + scene 1');
  // 본편 블록에 시계 줄
  const r = R.peopleBlockFor(c, { settings: settings(), store, sheetOf: () => null });
  assert.ok(r.text.includes('Hook clock') && r.text.includes('hook:편지'));
});

test('관계 재검토: 관계 기록이 20턴 그대로 + 그 사이 행적이 있으면 한 번, 요청 뒤엔 20턴 다시 쌓여야', () => {
  const c = chatOf(25);
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  store.people.쟈알디.slots.relationship = [entry('r1', '동료', 'c2', { target: '@user' })];
  store.people.쟈알디.slots.history = [entry('k1', '같이 명일 아파트에 들어감', 'c10')];
  const opts = { settings: settings(), system: 'S', values: {}, names };
  const input = U.buildUpdate(c, store, [49], opts);
  assert.deepEqual(input.data.relationship_review, ['쟈알디']);
  assert.equal(input.turn, 25);
  U.applyUpdate(store, c, input, { entries: [] }, { settings: settings() });
  assert.equal(store.people.쟈알디.reviewTurn, 25);
  const again = U.buildUpdate(c, store, [49], opts);
  assert.equal(again.data.relationship_review, undefined, '요청한 뒤엔 다시 안 함');
  // 행적이 없으면 재검토 없음
  const store2 = T.emptyStore();
  store2.people.쟈알디 = person('쟈알디');
  store2.people.쟈알디.slots.relationship = [entry('r1', '동료', 'c2', { target: '@user' })];
  assert.equal(U.buildUpdate(c, store2, [49], opts).data.relationship_review, undefined);
  // 저장·읽기에 reviewTurn 이 남는다
  const raw = JSON.parse(JSON.stringify(store));
  assert.equal(S.peopleStore({ scriptstate: { $pp_store: JSON.stringify(raw) } }).people?.쟈알디?.reviewTurn ?? S.readStore?.(raw)?.people?.쟈알디?.reviewTurn ?? 25, 25);
});
