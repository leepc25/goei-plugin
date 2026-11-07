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
  assert.deepEqual(it.log.filter((l) => l.what === 'get').map((l) => l.by).sort(), ['manual', 'story'], '얻음 기록');
  it = removeItem(it, it.list[0].id, 'drop', 'manual');
  assert.equal(it.list.length, 0);
  assert.deepEqual(it.log.filter((l) => l.what !== 'get').map((l) => l.what), ['merge', 'drop']);
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

test('본편 넘기기: 마지막 유저 메시지 앞에 [Inventory], 보낸 상자는 같은 턴 리롤에만 다시 간다', async () => {
  const { withInventory, settleItemUse, ITEM_USE_AT_VAR, pendingItemUse } = await import('../dist-test/core.mjs');
  const msgs = (chat) => chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  let it = addItem(empty, new Set(['u1', 'b1']), { name: '소금 봉지', desc: '두 봉지', from: 'story', anchor: 'b1' });
  const chat = { message: [{ role: 'user', data: '간다', chatId: 'u1' }, { role: 'char', data: '갔다', chatId: 'b1' }, { role: 'user', data: '뿌린다', chatId: 'u2' }], scriptstate: { ...itemsVars(it), ...itemUseVars(['소금 봉지']) } };
  const out = withInventory(msgs(chat), chat);
  assert.equal(out.length, 4);
  assert.equal(out[2].role, 'system');
  assert.match(out[2].content, /^\[Inventory\] 1\/16\n- 소금 봉지 — 두 봉지\nCarry limit: .+\nThis turn: uses 소금 봉지\n/);
  assert.equal(withInventory(out, chat), out);
  // 끄면 안 넣는다
  assert.equal(withInventory(msgs(chat), { ...chat, scriptstate: { ...chat.scriptstate, $it_push: '0' } }).length, 3);
  // 응답이 붙은 뒤: 사용 기록이 응답에 묶이고, at 에 유저 키
  chat.message.push({ role: 'char', data: '뿌렸다', chatId: 'b2' });
  const vars = settleItemUse(chat, 3);
  assert.equal(vars[ITEM_USE_AT_VAR], 'u2');
  const after = readItems(vars);
  assert.deepEqual(after.log.filter((l) => l.what !== 'get').map((l) => [l.what, l.anchor, l.name]), [['use', 'b2', '소금 봉지']]);
  Object.assign(chat.scriptstate, vars);
  // 같은 턴 리롤: 다시 넘기고, 새 응답에 다시 묶는다 (두 번 묶지 않음)
  assert.deepEqual(pendingItemUse(chat.scriptstate, 'u2'), ['소금 봉지']);
  chat.message[3] = { role: 'char', data: '다시 뿌렸다', chatId: 'b3' };
  const again = settleItemUse(chat, 3);
  assert.deepEqual(readItems(again).log.filter((l) => l.what !== 'get').map((l) => l.anchor), ['b2', 'b3']);
  Object.assign(chat.scriptstate, again);
  assert.equal(settleItemUse(chat, 3), null, '바뀔 게 없으면 null');
  // 다음 턴: 넘기지 않고, 응답 뒤 상자를 비운다
  chat.message.push({ role: 'user', data: '다음', chatId: 'u3' }, { role: 'char', data: '응', chatId: 'b4' });
  assert.deepEqual(pendingItemUse(chat.scriptstate, 'u3'), []);
  assert.equal(withInventory(msgs(chat), chat).find((m) => m.role === 'system').content.includes('uses 소금'), false);
  assert.deepEqual(settleItemUse(chat, 5), { $st_item_use: '', [ITEM_USE_AT_VAR]: '' });
});

test('그림 매칭 (game-src/items/README.md 규칙): 키워드 → 특징 → 몸통 대표 → 종류 기본', async () => {
  const { applyItemsPack, matchItemIcon } = await import('../dist-test/core.mjs');
  const { itemsPackText } = await import('../scripts/data-pack.mjs');
  const pack = applyItemsPack(itemsPackText());
  assert.ok(pack.table.length > 2500 && Object.keys(pack.icons).length >= new Set(pack.table.map((r) => r.f)).size, '표·그림');
  assert.ok(!pack.table.some((r) => r.k.includes('우산 칼')), '「빼」한 줄은 없음');
  assert.equal(matchItemIcon(pack, '접이식 칼', 'weapon'), 'weapon_001.webp');
  assert.equal(matchItemIcon(pack, '낡은 접이식 칼 하나', 'weapon'), 'weapon_001.webp', '몸통 말만 맞으면 그 몸통의 대표');
  assert.equal(matchItemIcon(pack, 'folding knife', 'weapon'), 'weapon_001.webp', '영어 키워드');
  const rows = (f) => pack.table.filter((r) => r.f === f).map((r) => r.k[0]);
  // ② 특징 말: 「피 묻은 곰인형」 → 피 묻은 인형, ③ 몸통 대표: 「속삭이는 거울」 → 거울 대표 (README 예)
  assert.ok(rows(matchItemIcon(pack, '피 묻은 곰인형', 'misc')).some((n) => /피.*인형/.test(n)), `피 묻은 인형: ${rows(matchItemIcon(pack, '피 묻은 곰인형', 'misc'))}`);
  assert.equal(matchItemIcon(pack, '속삭이는 거울', 'anomaly'), pack.rep['거울']);
  assert.equal(matchItemIcon(pack, '전혀 모르는 ㅁㄴㅇ', 'charm'), pack.base.charm);
  assert.equal(matchItemIcon(pack, '', 'misc'), pack.base.misc);
  for (const k of ['weapon', 'wear', 'tool', 'device', 'charm', 'medical', 'food', 'paper', 'key', 'seal', 'anomaly', 'valuable', 'consumable', 'misc']) assert.ok(pack.base[k], `${k} 기본 그림`);
  assert.throws(() => applyItemsPack('{"schema":1,"kind":"world"}'));
});
