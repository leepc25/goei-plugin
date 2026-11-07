// 소지품 저장 (2026-11-07): 기준 메시지가 사라지면 줄도 빠짐, 같은 이름은 설명만 갱신, 합치기·버리기는 기록으로, 본편 글
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, itemsBlock, liveItems, mergeItems, readItemUse, readItems, removeItem, itemSlots, itemUseVars, itemsVars, searchItems, updateItem, ITEM_SLOTS_DEFAULT } from '../dist-test/core.mjs';

const alive = new Set(['c1', 'c2']);
const empty = { list: [], log: [] };

test('더하기: 기준 메시지가 사라지면 빠지고, 직접 넣은 건 늘 산다', () => {
  let it = addItem(empty, alive, { name: '소금 봉지', desc: '두 봉지', kind: 'charm', from: 'story', anchor: 'c1', quote: '소금을 챙겼다' });
  it = addItem(it, alive, { name: '손전등', from: 'manual', anchor: '' });
  assert.equal(liveItems(it, alive).length, 2);
  assert.deepEqual(liveItems(it, new Set(['c2'])).map((e) => e.name), ['손전등']);
  assert.equal(it.list[0].kind, 'charm');
  assert.equal(addItem(it, alive, { name: '  ', from: 'manual', anchor: '' }), it);
});

test('같은 이름이 또 들어오면 새 줄 없이 설명만 갱신 (띄어쓰기·대소문자 무시)', () => {
  let it = addItem(empty, alive, { name: '소금 봉지', desc: '두 봉지', from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '소금봉지', desc: '한 봉지 남음', from: 'story', anchor: 'c2' });
  assert.equal(it.list.length, 1);
  assert.equal(it.list[0].desc, '한 봉지 남음');
  assert.equal(it.list[0].anchor, 'c1');
  // 빈 설명은 있던 설명을 지우지 않는다
  it = addItem(it, alive, { name: '소금 봉지', from: 'story', anchor: 'c2' });
  assert.equal(it.list[0].desc, '한 봉지 남음');
  // 모르는 종류는 misc
  assert.equal(addItem(empty, alive, { name: 'x', kind: '뭐', from: 'manual', anchor: '' }).list[0].kind, 'misc');
});

test('버리기·합치기는 기록 한 줄, 합치기는 이름이 달라도 되고 설명은 둘 다 남는다', () => {
  let it = addItem(empty, alive, { name: '소금', desc: '한 줌', from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '소금 봉지', desc: '새 봉지', effect: '괴이를 늦춤', from: 'manual', anchor: '' });
  const [a, b] = it.list;
  it = mergeItems(it, b.id, a.id);
  assert.equal(it.list.length, 1);
  assert.equal(it.list[0].name, '소금 봉지');
  assert.equal(it.list[0].desc, '새 봉지 / 한 줌');
  assert.equal(it.list[0].anchor, '');
  assert.equal(it.log.at(-1).what, 'merge');
  it = removeItem(it, it.list[0].id, 'drop', 'manual');
  assert.equal(it.list.length, 0);
  assert.deepEqual(it.log.map((l) => l.what), ['merge', 'drop']);
  assert.equal(removeItem(it, 'nope', 'drop', 'manual'), it);
});

test('고치기·읽기·저장 왕복·찾기', () => {
  let it = addItem(empty, alive, { name: '녹음기', desc: '테이프 하나', kind: 'device', from: 'story', anchor: 'c1' });
  it = updateItem(it, it.list[0].id, { desc: '테이프 없음', kind: 'anomaly' });
  const back = readItems(itemsVars(it));
  assert.deepEqual(back, it);
  assert.deepEqual(readItems({ $st_items: '{bad' }), empty);
  assert.deepEqual(searchItems(it, alive, '테이프').items.map((e) => e.name), ['녹음기']);
  assert.deepEqual(searchItems(it, alive, '없는말').items, []);
  assert.equal(itemSlots({}), ITEM_SLOTS_DEFAULT);
  assert.equal(itemSlots({ $it_slots: '3' }), 8);
  assert.equal(itemSlots({ $it_slots: '99' }), 40);
});

test('본편 글: 목록 전부·한계·이번 턴 사건, 비면 빈 문자열', () => {
  assert.equal(itemsBlock([], { slots: 16, limit: '가방 하나' }), '');
  let it = addItem(empty, alive, { name: '소금 봉지', desc: '두 봉지', effect: '괴이를 늦춤', from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '손전등', from: 'manual', anchor: '' });
  const text = itemsBlock(it.list, { slots: 1, limit: '가방 하나', use: ['소금 봉지'], bought: ['손전등'] });
  assert.equal(text, ['[Inventory] 2/1 (over the limit)', '- 소금 봉지 — 두 봉지 (괴이를 늦춤)', '- 손전등', 'Carry limit: 가방 하나', 'This turn: uses 소금 봉지; just bought 손전등; carrying more than the limit'].join('\n'));
  assert.deepEqual(readItemUse(itemUseVars(['소금 봉지', ''])), ['소금 봉지']);
  assert.deepEqual(readItemUse({ $st_item_use: '' }), []);
});
