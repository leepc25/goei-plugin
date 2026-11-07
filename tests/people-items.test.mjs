// 소지품 절 (2026-11-07 core/items.ts): 갱신기 자료·절·검사 — 본문에 적힌 변화만, 인용 필수, update·gone 은 목록 이름만, 끄면 절도 자료도 없음
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-people-items-'));
await build({
  entryPoints: ['src/core/people/updater.ts', 'src/core/people/types.ts', 'src/core/people/settings.ts', 'src/core/people/prompt/index.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = async (n) => import(pathToFileURL(join(dir, `core/people/${n}.mjs`)));
const U = await mod('updater');
const T = await mod('types');
const St = await mod('settings');
const P = await mod('prompt/index');

const settings = (over = {}) => ({ ...St.peopleSettings({}), ...over });
const person = (name, faction = 'A00') => ({ name, faction, seeded: { from: 'none', at: '' }, slots: {}, affinity: { base: 0 }, address: { toUser: '요원', register: '반말' }, express: 1, aliases: [] });
const names = [{ name: '쟈알디', aliases: [], titles: [] }];
const c = {
  scriptstate: { $st_faction: 'A00' },
  message: [
    ['user', '출근', 'u1'], ['char', '쟈알디가 손전등을 건넸다.', 'c1'], ['user', 'x', 'u2'],
    ['char', '소금 봉지를 반쯤 뿌렸다. 쟈알디가 녹음기를 내밀었다. "가져가." 부적은 문틈에 끼우고 왔다.', 'c2'],
  ].map(([role, data, chatId]) => ({ role, data, chatId })),
};
const itemsNow = [{ name: '소금 봉지', desc: '두 봉지', use: true, left: 2, state: 'ok' }, { name: '부적', desc: '', use: true, state: 'damaged' }, { name: '권총', desc: '', use: true, equip: 'weapon', equipped: true, state: 'ok' }];

test('자료·절: 켜면 items_now(판정·상태)와 소지품 절, 끄면 둘 다 없음', () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const on = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, items: itemsNow });
  assert.deepEqual(JSON.parse(JSON.stringify(on.data.items_now)), [{ name: '소금 봉지', desc: '두 봉지', usable: true, uses_left: 2 }, { name: '부적', usable: true, condition: 'damaged' }, { name: '권총', usable: true, equip: 'weapon', equipped: true }]);
  assert.equal(on.data.item_kinds, undefined, '종류 표는 없앰');
  assert.deepEqual(on.items, ['소금 봉지', '부적', '권총']);
  assert.equal(on.data.want.items, true);
  const empty = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, items: [] });
  assert.deepEqual(empty.data.items_now, [], '켜져 있으면 비어도 자료가 간다');
  const off = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names });
  assert.equal(off.data.items_now, undefined);
  assert.equal(off.items, null);
  for (const [kind, text] of [['detailed', P.UPDATER_DETAILED], ['compact', P.UPDATER_COMPACT]]) {
    const withI = U.assemblePrompt(text, new Set(['items']));
    const without = U.assemblePrompt(text, new Set());
    assert.ok(withI.includes('"items"') && withI.includes('items_now'), `${kind}: 소지품 절`);
    assert.ok(!without.includes('"items"') && !without.includes('items_now'), `${kind}: 끄면 없음`);
  }
});

test('검사: 인용·확정 구간, update·gone 은 목록 이름만, new 가 있는 이름이면 update 로, 중복·상한', () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, items: itemsNow });
  const r = {
    items: [
      { name: '소금봉지', action: 'update', desc: '한 봉지 반 남음', m: 'm4', quote: '소금 봉지를 반쯤 뿌렸다' },
      { name: '녹음기', action: 'new', desc: '쟈알디가 준 것', usable: true, uses: null, equip: 'none', icon: 'voice recorder', effect: null, m: 'm4', quote: '쟈알디가 녹음기를 내밀었다' },
      { name: '부적', action: 'gone', desc: '문틈에 끼움', m: 'm4', quote: '부적은 문틈에 끼우고 왔다' },
      { name: '손전등', action: 'new', desc: '', usable: true, m: 'm2', quote: '쟈알디가 손전등을 건넸다' },
      { name: '열쇠', action: 'gone', desc: '', m: 'm4', quote: '소금 봉지를 반쯤 뿌렸다' },
      { name: '소금 봉지', action: 'new', desc: '또', m: 'm4', quote: '소금 봉지를 반쯤 뿌렸다' },
      { name: '없는 것', action: 'new', desc: '', m: 'm4', quote: '이 글은 원문에 없다' },
      { name: '이상한 것', action: 'buy', desc: '', m: 'm4', quote: '소금 봉지를' },
    ],
  };
  const rep = U.applyUpdate(store, c, input, r, { settings: s, items: true });
  assert.deepEqual(rep.items.map((e) => [e.anchor, e.name, e.action, e.desc]), [['c2', '소금 봉지', 'update', '한 봉지 반 남음'], ['c2', '녹음기', 'new', '쟈알디가 준 것'], ['c2', '부적', 'gone', '문틈에 끼움']]);
  assert.deepEqual([rep.items[1].use, rep.items[1].uses, rep.items[1].equip, rep.items[1].icon], [true, undefined, null, 'voice recorder'], '판정 칸');
  assert.equal(rep.applied.items, 3);
  const reasons = rep.dropped.filter((d) => d.kind === 'items').map((d) => d.reason);
  assert.ok(reasons.includes('목록에 없는 이름'), '없는 열쇠 gone');
  assert.ok(reasons.includes('같은 물건 중복'), '소금 봉지 두 번');
  assert.ok(reasons.includes('인용이 원문에 없음'));
  assert.ok(reasons.includes('모르는 action'));
  assert.ok(reasons.some((x) => /확정 구간/.test(x)), '맥락 구간(m2)의 손전등은 버림');
  const offRep = U.applyUpdate(store, c, input, r, { settings: s, items: false });
  assert.equal(offRep.items.length, 0, '끄면 아무것도 안 받음');
  const parsed = U.parseUpdate('{"items":[{"name":"x","action":"new","m":"m4","quote":"q"}]}');
  assert.equal(parsed.items.length, 1);
});

// 2026-11-07 밤: 소모성 횟수는 프로그램이 「사용」 기록으로 센다. used_now 는 알려 주기만, 상태(손상·고장)·파괴는 모델이 본문대로
test('used_now: 자료에 횟수·소모성·남은 횟수, 그 물건은 인용 없이도 받음, 상태·파괴·남은 횟수 반영', async () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const used = [{ name: '소금 봉지', anchor: 'c2', n: 1, left: 1 }, { name: '부적', anchor: 'c2', n: 1 }];
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, items: itemsNow, used });
  assert.deepEqual(JSON.parse(JSON.stringify(input.data.used_now)), [{ name: '소금 봉지', times: 1, consumable: true, uses_left: 1 }, { name: '부적', times: 1, consumable: false }]);
  for (const text of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) assert.ok(U.assemblePrompt(text, new Set(['items'])).includes('used_now'));
  const rep = U.applyUpdate(store, c, input, { items: [{ name: '부적', action: 'update', desc: '귀퉁이가 탔다', condition: 'broken', m: 'm4', quote: '' }, { name: '권총', action: 'destroyed', desc: '총열이 휘었다', m: 'm4', quote: '소금 봉지를 반쯤 뿌렸다' }] }, { settings: s, items: true });
  assert.deepEqual(rep.items.map((e) => [e.anchor, e.name, e.action, e.state]), [['c2', '부적', 'update', 'broken'], ['c2', '권총', 'destroyed', undefined]], '사용한 물건은 인용 없어도 그 응답 기준으로');
  const I = await import('../dist-test/core.mjs');
  const alive = new Set(['c1', 'c2']);
  let it = { list: [], log: [] };
  it = I.addItem(it, alive, { name: '소금 봉지', desc: '두 봉지', uses: 3, from: 'story', anchor: 'c1' });
  it = I.addItem(it, alive, { name: '부적', use: true, from: 'story', anchor: 'c1' });
  it = I.addItem(it, alive, { name: '권총', use: true, equip: 'weapon', from: 'manual', anchor: '', wear: true });
  const next = I.applyItemChanges(it, alive, [...rep.items, { anchor: 'c2', name: '소금 봉지', action: 'update', desc: '', effect: '', quote: '', uses: 1 }]);
  assert.deepEqual(I.liveItems(next, alive).map((e) => [e.name, e.state]), [['소금 봉지', 'ok'], ['부적', 'broken']]);
  assert.equal(I.itemLeft(next, next.list[0], alive), 1, '본문대로 남은 횟수');
  const d = next.log.find((l) => l.what === 'destroy');
  assert.equal(d.name, '권총'); assert.equal(d.anchor, 'c2');
});
