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
const itemsNow = [{ name: '소금 봉지', desc: '두 봉지', kind: 'consumable' }, { name: '부적', desc: '', kind: 'charm' }];

test('자료·절: 켜면 items_now·item_kinds 와 소지품 절, 끄면 둘 다 없음', () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const on = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, items: itemsNow });
  assert.deepEqual(on.data.items_now, [{ name: '소금 봉지', state: '두 봉지', kind: 'consumable' }, { name: '부적', state: undefined, kind: 'charm' }]);
  assert.ok(on.data.item_kinds.includes('consumable | misc') || on.data.item_kinds.includes('consumable'));
  assert.deepEqual(on.items, ['소금 봉지', '부적']);
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
      { name: '녹음기', action: 'new', desc: '쟈알디가 준 것', kind: 'device', effect: null, m: 'm4', quote: '쟈알디가 녹음기를 내밀었다' },
      { name: '부적', action: 'gone', desc: '문틈에 끼움', m: 'm4', quote: '부적은 문틈에 끼우고 왔다' },
      { name: '손전등', action: 'new', desc: '', kind: 'tool', m: 'm2', quote: '쟈알디가 손전등을 건넸다' },
      { name: '열쇠', action: 'gone', desc: '', m: 'm4', quote: '소금 봉지를 반쯤 뿌렸다' },
      { name: '소금 봉지', action: 'new', desc: '또', m: 'm4', quote: '소금 봉지를 반쯤 뿌렸다' },
      { name: '없는 것', action: 'new', desc: '', m: 'm4', quote: '이 글은 원문에 없다' },
      { name: '이상한 것', action: 'buy', desc: '', m: 'm4', quote: '소금 봉지를' },
    ],
  };
  const rep = U.applyUpdate(store, c, input, r, { settings: s, items: true });
  assert.deepEqual(rep.items.map((e) => [e.anchor, e.name, e.action, e.desc, e.kind]), [['c2', '소금 봉지', 'update', '한 봉지 반 남음', undefined], ['c2', '녹음기', 'new', '쟈알디가 준 것', 'device'], ['c2', '부적', 'gone', '문틈에 끼움', undefined]]);
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

// 2026-11-07 사용자: 「사용」했는데 소지품에 그대로 남음 → used_now 자료 + 인용 없이도 받기 + 보고 없으면 닳는 종류는 뺌
test('used_now: 자료에 들어가고, 그 물건은 인용 없이도 받으며, 보고 없는 닳는 종류는 settleUsedItems 가 뺀다', async () => {
  const s = settings();
  const store = T.emptyStore();
  store.people.쟈알디 = person('쟈알디');
  const used = [{ name: '소금 봉지', anchor: 'c2' }, { name: '부적', anchor: 'c2' }];
  const input = U.buildUpdate(c, store, [3], { settings: s, system: 'S', values: {}, names, items: itemsNow, used });
  assert.deepEqual(input.data.used_now, ['소금 봉지', '부적']);
  assert.deepEqual(input.used, used);
  for (const text of [P.UPDATER_DETAILED, P.UPDATER_COMPACT]) assert.ok(U.assemblePrompt(text, new Set(['items'])).includes('used_now'));
  const rep = U.applyUpdate(store, c, input, { items: [{ name: '부적', action: 'update', desc: '귀퉁이가 탔다', m: 'm4', quote: '' }] }, { settings: s, items: true });
  assert.deepEqual(rep.items.map((e) => [e.anchor, e.name, e.action]), [['c2', '부적', 'update']], '사용한 물건은 인용 없어도 그 응답 기준으로');
  const I = await import('../dist-test/core.mjs');
  let it = { list: [], log: [] };
  const alive = new Set(['c1', 'c2']);
  it = I.addItem(it, alive, { name: '소금 봉지', desc: '두 봉지', kind: 'consumable', from: 'story', anchor: 'c1' });
  it = I.addItem(it, alive, { name: '부적', kind: 'charm', from: 'story', anchor: 'c1' });
  it = I.addItem(it, alive, { name: '손전등', kind: 'tool', from: 'manual', anchor: '' });
  const next = I.settleUsedItems(it, alive, [...used, { name: '손전등', anchor: 'c2' }], rep.items.map((e) => e.name));
  assert.deepEqual(I.liveItems(next, alive).map((e) => e.name), ['부적', '손전등'], '보고된 부적·남는 종류 손전등은 그대로, 소모품 소금은 빠짐');
  const g = next.log.find((l) => l.what === 'gone');
  assert.equal(g.name, '소금 봉지'); assert.equal(g.by, 'use'); assert.equal(g.anchor, 'c2'); assert.equal(g.kind, 'consumable');
  assert.deepEqual(I.usedItemsAt(next, ['c2']), [], '사용 기록(what=use)은 settleItemUse 가 남기는 것이라 여기선 없음');
});
