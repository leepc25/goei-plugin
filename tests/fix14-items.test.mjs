// 사용자 2026-11-14: 소지품 창에서 직접 버린 물건은 다음 메인 요청 「This turn」에 버렸다고 알린다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, removeItem, droppedNow, inventoryText, itemsVars, keysAfterLastBot } from '../dist-test/core.mjs';

test('직접 버린 물건: 버린 때의 마지막 응답 키와 같으면 「버렸다」 한 줄, 다른 응답 뒤면 없음', () => {
  const alive = new Set(['c1']);
  let it = addItem({ list: [], log: [] }, alive, { name: '코트', from: 'story', anchor: 'c1', quote: '코트를 입었다' });
  const id = it.list[0].id;
  it = removeItem(it, id, 'drop', 'manual', '', { key: 'c1' });
  assert.deepEqual(droppedNow(it, 'c1'), ['threw 코트 away — the protagonist discarded it on purpose and no longer has it']);
  assert.deepEqual(droppedNow(it, 'c2'), [], '다음 응답이 오면 더는 이번 턴 사건이 아님');
  assert.deepEqual(droppedNow(it, ''), []);
});

// 11-14 재검토 ①-1: 화면은 버린 때의 「마지막 메시지(누구 글이든)」 키를 outKey 로 적는다. 마지막 글이 사용자 글이어도 넘어가야 한다
test('직접 버린 물건: 마지막 메시지가 사용자 글일 때 버려도 「버렸다」 한 줄이 넘어간다', () => {
  const line = 'threw 코트 away — the protagonist discarded it on purpose and no longer has it';
  let it = addItem({ list: [], log: [] }, new Set(['c1']), { name: '코트', from: 'story', anchor: 'c1', quote: '코트를 입었다' });
  it = removeItem(it, it.list[0].id, 'drop', 'manual', '', { key: 'u1' });
  assert.deepEqual(droppedNow(it, 'c1'), [], '응답 키만으로는 못 찾는다');
  assert.deepEqual(droppedNow(it, 'c1', ['u1']), [line]);
  assert.deepEqual(droppedNow(it, '', ['u1']), [line], '봇 응답이 아직 없어도');
  assert.deepEqual(droppedNow(it, 'c2', ['u2']), [], '다음 응답이 오면 더는 이번 턴 사건이 아님');
  assert.deepEqual(droppedNow(it, '', []), []);

  const msg = (role, chatId) => ({ role, data: role, chatId });
  const chat = { message: [msg('char', 'c1'), msg('user', 'u1')], scriptstate: itemsVars(it) };
  assert.deepEqual(keysAfterLastBot(chat), ['u1']);
  assert.ok(inventoryText(chat).includes(line), '메인 요청 글에 실린다');
  const next = { message: [...chat.message, msg('char', 'c2'), msg('user', 'u2')], scriptstate: chat.scriptstate };
  assert.deepEqual(keysAfterLastBot(next), ['u2']);
  assert.ok(!inventoryText(next).includes('threw 코트 away'), '다음 턴에는 안 실린다');
});

// 11-14 재검토 ①-2: 찬 장비 칸에 다른 장비를 끌어 놓아 바꾸면, 밀려난 장비는 장착이 풀리니 「사용 예정」에서도 빠져야 한다
// (화면 ui/items.ts items-dnd 가 gearUnseated 로 밀려난 장비를 찾아 dropUse 한다). 손 칸에서 밀려난 물건은 넣지 않는다
test('칸으로 끌어다 바꾸기: 밀려난 장비(gear)만 찾아 사용 예정에서 뺀다', async () => {
  const { equipItem, liveItems, gearUnseated, addUse, dropUse, isEquipped } = await import('../dist-test/core.mjs');
  const alive = new Set();
  let it = { list: [], log: [] };
  for (const [name, equip] of [['방독면', 'gear'], ['코트', 'gear'], ['망치', 'weapon'], ['손전등', undefined], ['칼', 'weapon']]) {
    it = addItem(it, alive, { name, use: true, ...(equip ? { equip } : {}), from: 'manual', anchor: '' });
  }
  const id = (name) => it.list.find((x) => x.name === name).id;
  it = equipItem(it, alive, id('방독면'), 0, 'gear');
  const before = liveItems(it, alive);
  let queue = addUse([], before.find((x) => x.name === '방독면'), undefined);
  assert.deepEqual(queue.map((u) => u.id), [id('방독면')]);

  const swapped = equipItem(it, alive, id('코트'), 0, 'gear');
  const after = liveItems(swapped, alive);
  assert.ok(!isEquipped(after.find((x) => x.name === '방독면'), after), '방독면은 칸에서 밀려났다');
  const bumped = gearUnseated(before, after);
  assert.deepEqual(bumped, [id('방독면')]);
  for (const b of bumped) queue = dropUse(queue, b);
  assert.deepEqual(queue, [], '밀려난 장비의 사용 예정이 빠진다');

  // 빈 칸에 장착 · 같은 물건을 다른 칸으로 옮기기: 밀려난 것 없음
  assert.deepEqual(gearUnseated(before, liveItems(equipItem(it, alive, id('코트'), 1, 'gear'), alive)), []);
  assert.deepEqual(gearUnseated(before, liveItems(equipItem(it, alive, id('방독면'), 3, 'gear'), alive)), []);
  // 손 칸에서 밀려난 물건(손 물건·갈래 없는 물건)은 넣지 않는다
  let hand = equipItem(it, alive, id('망치'), 0, 'weapon');
  hand = equipItem(hand, alive, id('손전등'), 1, 'weapon');
  const hb = liveItems(hand, alive);
  let ha = liveItems(equipItem(hand, alive, id('칼'), 0, 'weapon'), alive);
  assert.ok(!isEquipped(ha.find((x) => x.name === '망치'), ha));
  assert.deepEqual(gearUnseated(hb, ha), []);
  ha = liveItems(equipItem(hand, alive, id('칼'), 1, 'weapon'), alive);
  assert.ok(!isEquipped(ha.find((x) => x.name === '손전등'), ha));
  assert.deepEqual(gearUnseated(hb, ha), []);
});

// 여쭐 것 C-12 사용자 답 (나): 원래 손에 드는 물건(무기·도구)만 손에서 빠질 때 「사용 예정」을 빼고,
// 들지 않아도 쓸 수 있는 물건은 남긴다. 넣기·격자로 끌기·밀려남 모두 같게. 장비가 밀려난 경우는 지금처럼 뺀다
test('C-12: 칸에서 빠질 때 사용 예정을 뺄 물건 — 손에 드는 물건·장비는 빼고, 갈래 없는 물건은 남긴다', async () => {
  const { equipItem, unequipItem, liveItems, seatLost, useNeedsSeat, isEquipped } = await import('../dist-test/core.mjs');
  const alive = new Set();
  let it = { list: [], log: [] };
  for (const [name, equip] of [['방독면', 'gear'], ['코트', 'gear'], ['망치', 'weapon'], ['손전등', undefined], ['칼', 'weapon'], ['라디오', undefined]]) {
    it = addItem(it, alive, { name, use: true, ...(equip ? { equip } : {}), from: 'manual', anchor: '' });
  }
  const id = (name) => it.list.find((x) => x.name === name).id;
  const of = (name) => it.list.find((x) => x.name === name);
  // 넣기·격자로 끌기: 물건 갈래로 정한다
  assert.equal(useNeedsSeat(of('망치')), true, '손에 드는 물건');
  assert.equal(useNeedsSeat(of('방독면')), true, '장비');
  assert.equal(useNeedsSeat(of('손전등')), false, '들지 않아도 쓸 수 있는 물건');
  // 손에 든 채(held)여도 갈래 없는 물건은 남긴다
  let hand = equipItem(it, alive, id('망치'), 0, 'weapon');
  hand = equipItem(hand, alive, id('손전등'), 1, 'weapon');
  assert.equal(useNeedsSeat(hand.list.find((x) => x.name === '손전등')), false);
  const hb = liveItems(hand, alive);
  // 밀려남: 손에 드는 물건은 뺀다
  let ha = liveItems(equipItem(hand, alive, id('칼'), 0, 'weapon'), alive);
  assert.deepEqual(seatLost(hb, ha), [id('망치')]);
  // 밀려남: 들지 않아도 쓸 수 있는 물건은 남긴다 (누가 밀어내든)
  ha = liveItems(equipItem(hand, alive, id('칼'), 1, 'weapon'), alive);
  assert.ok(!isEquipped(ha.find((x) => x.name === '손전등'), ha));
  assert.deepEqual(seatLost(hb, ha), []);
  ha = liveItems(equipItem(hand, alive, id('라디오'), 1, 'weapon'), alive);
  assert.deepEqual(seatLost(hb, ha), []);
  // 손 칸 사이 옮기기(자리 바꿈 없이 빈 칸으로)·넣기 뒤 비교: 밀려난 것만
  assert.deepEqual(seatLost(hb, liveItems(unequipItem(hand, id('망치')), alive)), [id('망치')]);
  assert.deepEqual(seatLost(hb, liveItems(unequipItem(hand, id('손전등')), alive)), []);
  // 장비가 밀려난 경우는 지금처럼 뺀다 (장비 칸 · 손 칸에 든 장비 모두)
  const g = equipItem(it, alive, id('방독면'), 0, 'gear');
  assert.deepEqual(seatLost(liveItems(g, alive), liveItems(equipItem(g, alive, id('코트'), 0, 'gear'), alive)), [id('방독면')]);
  const gh = equipItem(it, alive, id('방독면'), 0, 'weapon');
  assert.deepEqual(seatLost(liveItems(gh, alive), liveItems(equipItem(gh, alive, id('칼'), 0, 'weapon'), alive)), [id('방독면')]);
});
