// 소지품 저장 (2026-11-07): 기준 메시지가 사라지면 줄도 빠짐, 같은 이름은 설명만 갱신, 합치기·버리기는 기록으로, 본편 글
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addItem, addUse, equipItem, equippedOf, isEquipped, gridItems, itemLeft, itemsBlock, liveItems, mergeItems, parseTraits, readItemUse, readItems, removeItem, itemSlots, itemUseVars, itemsVars, searchItems,
  setItemLeft, traitsText, unequipItem, updateItem, ITEM_SLOTS_DEFAULT, itemLine, setItemRules, ITEM_RULES_DEFAULT,
  canMerge, mergedNow, itemWeight, weightText, totalWeight, itemCarry, itemEditOn, ITEM_CARRY_DEFAULT,
} from '../dist-test/core.mjs';

const alive = new Set(['c1', 'c2']);
const empty = { list: [], log: [] };

test('더하기: 기준 메시지가 사라지면 빠지고, 직접 넣은 건 늘 산다. 판정 기본은 사용 X·비소모·장착 X·멀쩡', () => {
  let it = addItem(empty, alive, { name: '소금 봉지', desc: '두 봉지', use: true, uses: 3, from: 'story', anchor: 'c1', quote: '소금을 챙겼다' });
  it = addItem(it, alive, { name: '손전등', from: 'manual', anchor: '' });
  assert.equal(liveItems(it, alive).length, 2);
  assert.deepEqual(liveItems(it, new Set(['c2'])).map((e) => e.name), ['손전등']);
  assert.deepEqual([it.list[0].use, it.list[0].uses, it.list[0].state], [true, 3, 'ok']);
  assert.deepEqual([it.list[1].use, it.list[1].uses, it.list[1].equip, it.list[1].state], [false, undefined, undefined, 'ok']);
  assert.equal(addItem(it, alive, { name: '  ', from: 'manual', anchor: '' }), it);
  // 소모성이면 늘 사용 가능
  assert.equal(addItem(empty, alive, { name: '초', uses: 2, from: 'manual', anchor: '' }).list[0].use, true);
});

test('같은 이름이 또 들어오면 새 줄 없이 갱신, 둘 다 소모성이면 횟수를 더한다', () => {
  let it = addItem(empty, alive, { name: '소금 봉지', desc: '두 봉지', uses: 2, from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '소금봉지', desc: '새로 샀다', uses: 3, from: 'story', anchor: 'c2' });
  assert.equal(it.list.length, 1);
  assert.equal(it.list[0].desc, '새로 샀다');
  assert.equal(it.list[0].uses, 5);
  assert.equal(it.list[0].anchor, 'c1');
  it = addItem(it, alive, { name: '소금 봉지', from: 'story', anchor: 'c2' });
  assert.equal(it.list[0].desc, '새로 샀다', '빈 설명은 있던 설명을 지우지 않는다');
  // 상점·쇼핑몰에서 산 것(store)은 같은 이름이 있어도 새 줄로 (전수검사 11-13)
  const st = addItem(it, alive, { name: '소금봉지', uses: 3, from: 'store', anchor: 'c2' });
  assert.equal(st.list.length, 2);
  assert.deepEqual([st.list[0].uses, st.list[1].from, st.list[1].anchor, st.list[1].uses], [5, 'store', 'c2', 3]);
});

test('쓰임 글 읽기·쓰기', () => {
  assert.deepEqual(parseTraits('무기·사용'), { use: true, equip: 'weapon' });
  assert.deepEqual(parseTraits('장비'), { use: false, equip: 'gear' });
  assert.deepEqual(parseTraits('소모3'), { use: true, uses: 3 });
  assert.deepEqual(parseTraits('무기, 소모'), { use: true, uses: 1, equip: 'weapon' }, '숫자 없는 소모는 1');
  assert.deepEqual(parseTraits('-'), { use: false });
  assert.equal(traitsText({ use: true, uses: 3, equip: 'weapon' }), '손·소모3', '손 칸은 「손」으로 쓴다 (사용자 2026-11-14)');
  assert.equal(traitsText({ use: false }), '-');
});

test('손 칸 (사용자 2026-11-14): 「손」 글은 손 칸, 기본 판정 표는 비어 모델이 손으로 정한 망치가 그대로, 본편 글은 in hand·worn', () => {
  assert.deepEqual(parseTraits('손'), { use: false, equip: 'weapon' });
  assert.deepEqual(parseTraits('hand·사용'), { use: true, equip: 'weapon' });
  assert.deepEqual(parseTraits('무기'), { use: false, equip: 'weapon' }, '옛 글 「무기」도 손 칸');
  assert.equal(ITEM_RULES_DEFAULT, '');
  setItemRules(undefined);
  const s = addItem(empty, alive, { name: '망치', use: true, equip: 'weapon', icon: '도구/망치/hammer', from: 'story', anchor: 'c1' });
  assert.deepEqual([s.list[0].use, s.list[0].equip], [true, 'weapon'], '도구라도 모델이 손이라 하면 손');
  const hand = { ...s.list[0], state: 'ok' };
  assert.equal(itemLine(hand, undefined, true), '- 망치 [in hand]');
  assert.equal(itemLine({ ...hand, name: '코트', equip: 'gear' }, undefined, true), '- 코트 [worn]');
  assert.equal(itemLine(hand, undefined, false), '- 망치', '장착 안 했으면 표시 없음');
});

test('소모성: 사용 기록만큼 남은 횟수가 줄고 0이면 목록에서 빠진다. 기준 응답이 지워지면 돌아온다', () => {
  let it = addItem(empty, alive, { name: '진통제', uses: 2, from: 'manual', anchor: '' });
  const id = it.list[0].id;
  it = { ...it, log: [...it.log, { id: 'u1', name: '진통제', item: id, n: 1, what: 'use', by: 'use', anchor: 'c1', at: '' }] };
  assert.equal(itemLeft(it, it.list[0], alive), 1);
  it = { ...it, log: [...it.log, { id: 'u2', name: '진통제', item: id, n: 1, what: 'use', by: 'use', anchor: 'c2', at: '' }] };
  assert.deepEqual(liveItems(it, alive), [], '다 쓰면 빠짐');
  assert.equal(liveItems(it, new Set(['c1'])).length, 1, 'c2 응답이 지워지면 하나 남음');
  // 본문대로 남은 횟수 맞추기: 처음 횟수 = 남은 + 쓴
  it = setItemLeft(it, alive, id, 3);
  assert.equal(itemLeft(it, it.list[0], alive), 3);
});

test('사용 자리: 같은 물건은 ×n, 소모성은 남은 횟수까지, 비소모는 한 번, 못 쓰는 것은 안 들어감', () => {
  const pill = { id: 'p', name: '진통제', use: true, uses: 2, state: 'ok' };
  const lamp = { id: 'l', name: '손전등', use: true, state: 'ok' };
  const radio = { id: 'r', name: '무전기', use: true, state: 'broken' };
  const key = { id: 'k', name: '열쇠', use: false, state: 'ok' };
  let q = addUse([], pill, 2);
  q = addUse(q, pill, 2);
  assert.deepEqual(addUse(q, pill, 2), q, '남은 횟수 넘지 않음');
  q = addUse(q, lamp, undefined);
  assert.deepEqual(addUse(q, lamp, undefined), q, '비소모는 한 번');
  assert.deepEqual(addUse(addUse(q, radio, undefined), key, undefined), q, '고장·사용 X');
  assert.deepEqual(q, [{ id: 'p', n: 2 }, { id: 'l', n: 1 }]);
  assert.deepEqual(readItemUse(itemUseVars(q)), q);
  assert.deepEqual(readItemUse({ $st_item_use: '[{"id":"p","n":0},{"id":"x"}]' }), [{ id: 'x', n: 1 }]);
});

test('장착: 빈 칸 첫 번째로, 칸을 주면 그 칸(있던 것은 격자로), 풀기, 격자 수는 장착한 것 빼고', () => {
  let it = addItem(empty, alive, { name: '권총', equip: 'weapon', use: true, from: 'manual', anchor: '', wear: true });
  it = addItem(it, alive, { name: '칼', equip: 'weapon', from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '조끼', equip: 'gear', from: 'manual', anchor: '', wear: true });
  it = addItem(it, alive, { name: '열쇠', from: 'manual', anchor: '' });
  const [gun, knife] = it.list;
  assert.equal(gun.slot, 0);
  // 갈래 없는 물건도 손 칸에 든다 (held), 장비 칸에는 못 넣는다 (사용자 2026-11-14)
  const keyHeld = equipItem(it, alive, it.list[3].id);
  assert.deepEqual([keyHeld.list[3].slot, keyHeld.list[3].held, isEquipped(keyHeld.list[3], keyHeld.list)], [1, true, true], '열쇠 → 손 둘째 칸');
  assert.equal(itemLine(keyHeld.list[3], undefined, true), '- 열쇠 [in hand]');
  assert.equal(unequipItem(keyHeld, it.list[3].id).list[3].held, undefined, '해제하면 held 도 빠짐');
  assert.equal(equipItem(it, alive, it.list[3].id, 0, 'gear'), it, '장비 아닌 물건은 장비 칸에 안 들어감');
  it = equipItem(it, alive, knife.id, 0);
  const eq = equippedOf(liveItems(it, alive));
  assert.equal(eq.weapon[0].name, '칼');
  assert.equal(it.list[0].slot, undefined, '있던 권총은 격자로');
  assert.deepEqual(gridItems(liveItems(it, alive)).map((e) => e.name), ['권총', '열쇠']);
  it = unequipItem(it, knife.id);
  assert.equal(gridItems(liveItems(it, alive)).length, 3);
  // 갈래를 바꾸면 칸에서 내린다
  const vest = it.list[2];
  assert.equal(updateItem(it, vest.id, { equip: 'weapon' }).list[2].slot, undefined);
});

test('손에 든 물건은 갈래를 고쳐도 손에 남는다 (손 갈래가 아니게 되면 held), 장비 칸 물건은 내린다 (재검토 11-14 ①-4)', () => {
  let it = addItem(empty, alive, { name: '권총', equip: 'weapon', use: true, from: 'manual', anchor: '', wear: true });
  it = addItem(it, alive, { name: '조끼', equip: 'gear', from: 'manual', anchor: '', wear: true });
  it = addItem(it, alive, { name: '열쇠', from: 'manual', anchor: '' });
  it = equipItem(it, alive, it.list[2].id);
  const [gun, vest, key] = it.list;
  assert.deepEqual([gun.slot, vest.slot, key.slot, key.held], [0, 0, 1, true]);
  const at = (s, id) => s.list.find((e) => e.id === id);
  const shape = (s, id) => { const e = at(s, id); return [e.equip, e.slot, e.held, isEquipped(e, liveItems(s, alive))]; };
  // 손 갈래 → 없음·장비: 손 칸 그대로, held 가 붙는다
  assert.deepEqual(shape(updateItem(it, gun.id, { equip: '' }), gun.id), [undefined, 0, true, true], '권총 갈래 없음');
  assert.deepEqual(shape(updateItem(it, gun.id, { equip: 'gear' }), gun.id), ['gear', 0, true, true], '권총 갈래 장비');
  // 갈래 없이 든 것 → 장비: 손에 그대로. → 손 갈래: held 는 빠지고 손에 그대로
  assert.deepEqual(shape(updateItem(it, key.id, { equip: 'gear' }), key.id), ['gear', 1, true, true], '열쇠 갈래 장비');
  assert.deepEqual(shape(updateItem(it, key.id, { equip: 'weapon' }), key.id), ['weapon', 1, undefined, true], '열쇠 갈래 손');
  // 장비 칸 물건은 갈래가 바뀌거나 없어지면 내린다
  assert.deepEqual(shape(updateItem(it, vest.id, { equip: '' }), vest.id), [undefined, undefined, undefined, false], '조끼 갈래 없음');
  assert.deepEqual(shape(updateItem(it, vest.id, { equip: 'weapon' }), vest.id), ['weapon', undefined, undefined, false], '조끼 갈래 손');
  // 갈래가 안 바뀌면 그대로
  assert.deepEqual(shape(updateItem(it, gun.id, { equip: 'weapon' }), gun.id), ['weapon', 0, undefined, true]);
});

test('버리기·합치기·파괴는 기록 한 줄. 합치기는 둘 다 소모성이고 이름에 같은 낱말이 있을 때만, 이름·설명은 남는 쪽 그대로 횟수만 더한다, 무게는 1개당이라 그대로 (11-08)', () => {
  let it = addItem(empty, alive, { name: '소금', desc: '한 줌', uses: 2, weight: 0.1, from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '소금 봉지', desc: '새 봉지', effect: '괴이를 늦춤', uses: 3, weight: '0.5', from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '손전등', desc: '', use: true, from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '부적', desc: '', uses: 3, from: 'manual', anchor: '' });
  const [a, b, torch, charm] = it.list;
  assert.equal(canMerge(b, a), true);
  assert.equal(canMerge(b, torch), false, '비소모는 안 됨');
  assert.equal(canMerge(b, charm), false, '같은 낱말 없음');
  assert.equal(mergeItems(it, alive, b.id, charm.id), it);
  it = mergeItems(it, alive, b.id, a.id, 'c1');
  assert.equal(it.list.length, 3);
  assert.equal(it.list.find((x) => x.id === b.id).name, '소금 봉지');
  assert.equal(it.list.find((x) => x.id === b.id).desc, '새 봉지');
  assert.equal(it.list.find((x) => x.id === b.id).uses, 5);
  assert.equal(it.list.find((x) => x.id === b.id).weight, 0.5, '1개당 무게는 남는 쪽 그대로');
  assert.equal(it.list.find((x) => x.id === b.id).anchor, '');
  assert.equal(it.log.at(-1).what, 'merge');
  assert.deepEqual(mergedNow(it, 'c1'), ['combined 소금 into 소금 봉지']);
  assert.deepEqual(mergedNow(it, 'c2'), []);
  it = removeItem(it, b.id, 'destroy', 'story', 'c1');
  assert.equal(it.list.length, 3, '줄은 지우지 않고 숨긴다 (11-12)');
  assert.equal(liveItems(it, alive).length, 2);
  assert.deepEqual(it.log.filter((l) => l.what !== 'get').map((l) => l.what), ['merge', 'destroy']);
  assert.equal(removeItem(it, 'nope', 'drop', 'manual'), it);
});

test('무게: 1개당 무게 × 개수·합계(장착 포함)·소지 한도(명부 값 > 설정 값)·[Inventory] 무게 줄 (11-08)', () => {
  assert.equal(itemWeight('1,5kg'), 1.5);
  assert.equal(itemWeight(-1), undefined);
  assert.equal(itemWeight('abc'), undefined);
  assert.equal(weightText(0.25), '250g');
  assert.equal(weightText(1.23), '1.23kg');
  assert.equal(weightText(12.4), '12.4kg');
  let it = addItem(empty, alive, { name: '권총', equip: 'weapon', weight: 1.2, wear: true, from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '물병', uses: 2, weight: 1, from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '물병', uses: 1, weight: 0.5, from: 'manual', anchor: '' });
  assert.equal(it.list.find((x) => x.name === '물병').weight, 1, '무게는 1개당: 더 들어와도 그대로');
  assert.equal(it.list.find((x) => x.name === '물병').uses, 3);
  assert.equal(totalWeight(it.list), 4.2, '1개당 × 개수 (1.2 + 1×3)');
  assert.equal(totalWeight(it.list, (e) => (e.uses !== undefined ? 1 : undefined)), 2.2, '남은 개수만큼만');
  assert.equal(itemCarry({}), ITEM_CARRY_DEFAULT);
  assert.equal(itemCarry({ $it_carry: '40' }), 40);
  assert.equal(itemCarry({ $it_carry: '40', $it_carry_pc: '18' }), 18);
  assert.equal(itemCarry({ $it_carry: '40', $it_carry_pc: '' }), 40);
  const under = itemsBlock(it.list, { slots: 16, limit: '가방', carry: 10 });
  assert.match(under, /^Weight: 4\.2 kg \/ 10 kg$/m);
  const over = itemsBlock(it.list, { slots: 16, limit: '가방', carry: 4 });
  assert.match(over, /^Weight: 4\.2 kg \/ 4 kg \(0\.2 kg over\)$/m);
  assert.doesNotMatch(over, /heavy/i);
  assert.equal(itemEditOn({}), false);
  assert.equal(itemEditOn({ $it_edit: '1' }), true);
});

test('고치기·읽기·저장 왕복·찾기', () => {
  let it = addItem(empty, alive, { name: '녹음기', desc: '테이프 하나', use: true, icon: 'Voice Recorder!', from: 'story', anchor: 'c1' });
  assert.equal(it.list[0].icon, 'voice recorder');
  it = updateItem(it, it.list[0].id, { desc: '테이프 없음', state: 'damaged' });
  const back = readItems(itemsVars(it));
  assert.deepEqual(back, it);
  assert.deepEqual(readItems({ $st_items: '{bad' }), empty);
  assert.deepEqual(searchItems(it, alive, '테이프').items.map((e) => e.name), ['녹음기']);
  assert.deepEqual(searchItems(it, alive, '손상').items.map((e) => e.name), ['녹음기']);
  assert.deepEqual(searchItems(it, alive, '없는말').items, []);
  assert.equal(itemSlots({}), ITEM_SLOTS_DEFAULT);
  assert.equal(itemSlots({ $it_slots: '3' }), 8);
  assert.equal(itemSlots({ $it_slots: '99' }), 40);
});

test('본편 글: 목록 전부(장착·남은 횟수·상태)·한계·이번 턴 사건, 격자 수는 장착 빼고, 비면 빈 문자열', () => {
  assert.equal(itemsBlock([], { slots: 16, limit: '가방 하나' }), '');
  let it = addItem(empty, alive, { name: '소금 봉지', desc: '두 봉지', effect: '괴이를 늦춤', uses: 3, from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '손전등', use: true, state: 'broken', from: 'manual', anchor: '' });
  it = addItem(it, alive, { name: '권총', equip: 'weapon', use: true, from: 'manual', anchor: '', wear: true });
  const text = itemsBlock(it.list, { slots: 1, limit: '가방 하나', left: (e) => itemLeft(it, e, alive), use: [{ name: '소금 봉지', n: 2, after: 1 }], bought: ['손전등'] });
  assert.equal(text, [
    '[Inventory] 2/1 (over the limit)', '- 소금 봉지 — 두 봉지 (괴이를 늦춤) [3 uses left]', '- 손전등 [broken, cannot be used]', '- 권총 [in hand]',
    'Carry limit: 가방 하나', 'This turn: uses 소금 봉지 ×2 (1 left after this); just bought 손전등; carrying more than the limit',
  ].join('\n'));
});

test('본편 넘기기: 마지막 유저 메시지 앞에 [Inventory], 보낸 자리는 같은 턴 리롤에만 다시 가고, 소모성은 응답이 붙으면 줄어든다', async () => {
  const { withInventory, settleItemUse, ITEM_USE_AT_VAR, pendingItemUse } = await import('../dist-test/core.mjs');
  const msgs = (chat) => chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const it = addItem(empty, new Set(['u1', 'b1']), { name: '소금 봉지', desc: '두 봉지', uses: 2, from: 'story', anchor: 'b1' });
  const id = it.list[0].id;
  const chat = { message: [{ role: 'user', data: '간다', chatId: 'u1' }, { role: 'char', data: '갔다', chatId: 'b1' }, { role: 'user', data: '뿌린다', chatId: 'u2' }], scriptstate: { ...itemsVars(it), ...itemUseVars([{ id, n: 2 }]) } };
  const out = withInventory(msgs(chat), chat);
  assert.equal(out.length, 4);
  assert.equal(out[2].role, 'system');
  assert.match(out[2].content, /^\[Inventory\] 1\/16\n- 소금 봉지 — 두 봉지 \[2 uses left\]\nWeight: 0 kg \/ 25 kg\nCarry limit: .+\nRecently: got 소금 봉지\nThis turn: uses 소금 봉지 ×2 \(used up after this\)\n/);
  assert.equal(withInventory(out, chat), out);
  // 2026-11-11 사용자: 「컨텍스트 포함」을 따로 끄는 줄은 없앴다 (사용과 같은 값). 소지품을 끄면 안 넣는다
  assert.equal(withInventory(msgs(chat), { ...chat, scriptstate: { ...chat.scriptstate, $it_on: '0' } }).length, 3, '소지품을 끄면 안 넣는다');
  assert.equal(withInventory(msgs(chat), { ...chat, scriptstate: { ...chat.scriptstate, $it_push: '0' } }).length, 4, '옛 끔 값이 남아 있어도 넣는다');
  // 응답이 붙은 뒤: 사용 기록(id·횟수)이 응답에 묶이고, 다 써서 목록에서 빠진다
  chat.message.push({ role: 'char', data: '뿌렸다', chatId: 'b2' });
  const vars = settleItemUse(chat, 3);
  assert.equal(vars[ITEM_USE_AT_VAR], 'u2');
  const after = readItems(vars);
  assert.deepEqual(after.log.filter((l) => l.what !== 'get').map((l) => [l.what, l.anchor, l.item, l.n]), [['use', 'b2', id, 2]]);
  assert.deepEqual(liveItems(after, new Set(['u1', 'b1', 'u2', 'b2'])), []);
  Object.assign(chat.scriptstate, vars);
  // 유저 메시지 없이 이어 받는 응답(옛 응답이 살아 있다): 그 사용은 이미 쓴 것이라 다시 넘기지 않고, 다 쓴 물건이 목록에 돌아오지도 않는다 (11-14 재검토)
  assert.deepEqual(pendingItemUse(chat.scriptstate, 'u2'), [{ id, n: 2 }]);
  const cont = withInventory(msgs(chat), chat).find((m) => m.role === 'system')?.content ?? '';
  assert.doesNotMatch(cont, /uses 소금 봉지/);
  assert.doesNotMatch(cont, /^- 소금 봉지/m);
  chat.message.push({ role: 'char', data: '이어서', chatId: 'b2b' });
  assert.equal(settleItemUse(chat, 4), null, '이어 받은 응답에 또 적지 않는다');
  chat.message.pop();
  // 같은 턴 리롤: 리수가 옛 응답을 먼저 지우고 요청한다 → 횟수가 돌아온 채로 다시 넘기고, 새 응답에 다시 묶는다
  chat.message.pop();
  assert.match(withInventory(msgs(chat), chat).find((m) => m.role === 'system').content, /\[2 uses left\]\n[^]*uses 소금 봉지 ×2 \(used up after this\)/);
  chat.message.push({ role: 'char', data: '다시 뿌렸다', chatId: 'b3' });
  const again = settleItemUse(chat, 3);
  assert.deepEqual(readItems(again).log.filter((l) => l.what !== 'get').map((l) => l.anchor), ['b2', 'b3']);
  Object.assign(chat.scriptstate, again);
  assert.equal(settleItemUse(chat, 3), null, '바뀔 게 없으면 null');
  // 다음 턴: 넘기지 않고, 응답 뒤 자리를 비운다
  chat.message.push({ role: 'user', data: '다음', chatId: 'u3' }, { role: 'char', data: '응', chatId: 'b4' });
  assert.deepEqual(pendingItemUse(chat.scriptstate, 'u3'), []);
  assert.deepEqual(settleItemUse(chat, 5), { $st_item_use: '', [ITEM_USE_AT_VAR]: '' });
});

// 11-14 재검토 (v0.21.16 전): 유저 메시지가 없는 채팅에서는 보낸 자리 표식이 비어 응답마다 또 쓰이고 또 깎였다
test('사용: 유저 메시지가 없는 채팅(시작 직후 빈 전송)에서도 한 번만 쓰인다. 다시 굴리면 다시 나가고, 첫 유저 메시지에는 안 나간다', async () => {
  const { settleItemUse, ITEM_USE_AT_VAR, usesToSend, queueUseVars, readItemUse, itemLeft: left } = await import('../dist-test/core.mjs');
  let it = addItem(empty, new Set(), { name: '붕대', desc: '', use: true, uses: 3, from: 'manual', anchor: '' });
  it = addItem(it, new Set(), { name: '소금', desc: '', use: true, uses: 3, from: 'manual', anchor: '' });
  const [id, salt] = it.list.map((x) => x.id);
  const chat = { message: [{ role: 'char', data: '시작', chatId: 'b0' }], scriptstate: { ...itemsVars(it), ...itemUseVars([{ id, n: 1 }]) } };
  const aliveNow = () => new Set(chat.message.map((m) => m.chatId));
  const leftNow = (x = id) => { const cur = readItems(chat.scriptstate); return left(cur, cur.list.find((e) => e.id === x), aliveNow()); };
  /** 요청에 실린 것으로 응답을 받고 정리한다 → 실린 이름 */
  const turn = (chatId) => {
    const sent = usesToSend(chat);
    chat.message.push({ role: 'char', data: '응', chatId });
    Object.assign(chat.scriptstate, settleItemUse(chat, chat.message.length - 1, new Set(sent.map((u) => u.id))) ?? {});
    return sent.map((u) => u.name);
  };
  assert.deepEqual(turn('b1'), ['붕대']);
  assert.equal(leftNow(), 2);
  assert.ok(chat.scriptstate[ITEM_USE_AT_VAR], '보낸 자리로 적힌다 (칩이 남지 않는다)');
  // 빈 전송을 또 해도 다시 안 나간다
  assert.deepEqual(turn('b2'), []);
  assert.equal(leftNow(), 2);
  chat.message.pop();
  // 그 응답을 다시 굴리면 다시 나간다
  chat.message.pop();
  assert.equal(leftNow(), 3);
  assert.deepEqual(turn('b1b'), ['붕대']);
  assert.equal(leftNow(), 2);
  // 응답을 지운 채 다른 물건을 넣으면 이어 넣는다 (둘 다 나간다)
  chat.message.pop();
  Object.assign(chat.scriptstate, queueUseVars(chat, (q) => [...q, { id: salt, n: 1 }]));
  assert.deepEqual(readItemUse(chat.scriptstate).map((u) => u.id), [id, salt]);
  assert.deepEqual(turn('b1c'), ['붕대', '소금']);
  // 답이 온 뒤 새로 넣으면 지난 자리는 비우고 새로 시작한다
  Object.assign(chat.scriptstate, queueUseVars(chat, (q) => [...q, { id: salt, n: 1 }]));
  assert.deepEqual(readItemUse(chat.scriptstate), [{ id: salt, n: 1 }]);
  assert.deepEqual(turn('b3'), ['소금']);
  assert.equal(leftNow(salt), 1);
  // 첫 유저 메시지: 지난 자리는 안 나가고 비워진다
  chat.message.push({ role: 'user', data: '간다', chatId: 'u1' });
  assert.deepEqual(turn('b4'), []);
  assert.deepEqual(readItemUse(chat.scriptstate), []);
  assert.equal(chat.scriptstate[ITEM_USE_AT_VAR], '');
  assert.equal(leftNow(), 2);
  assert.equal(leftNow(salt), 1);
});

// 11-14 재검토: 답이 온 뒤 같은 물건을 다시 「사용」에 넣고 유저 메시지 없이 다음 응답을 받아도, 새로 넣은 사용은 보내고 적는다
test('사용: 답이 온 뒤 같은 물건을 새로 넣으면 이어 받는 응답에도 보내고 적는다. 넘어온 자리는 또 보내지 않는다', async () => {
  const { withInventory, settleItemUse, ITEM_USE_AT_VAR, usesToSend, removeItem, itemLeft: left } = await import('../dist-test/core.mjs');
  const msgs = (chat) => chat.message.map((m) => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.data }));
  const inv = (chat) => withInventory(msgs(chat), chat).find((m) => m.role === 'system')?.content ?? '';
  const live = (chat) => new Set(chat.message.map((m) => m.chatId));
  const it = addItem(empty, new Set(['u1', 'b1']), { name: '소금 봉지', desc: '', uses: 3, from: 'story', anchor: 'b1' });
  const id = it.list[0].id;
  const chat = { message: [{ role: 'user', data: '간다', chatId: 'u1' }, { role: 'char', data: '갔다', chatId: 'b1' }, { role: 'user', data: '뿌린다', chatId: 'u2' }, { role: 'char', data: '뿌렸다', chatId: 'b2' }], scriptstate: { ...itemsVars(it), ...itemUseVars([{ id, n: 1 }]) } };
  Object.assign(chat.scriptstate, settleItemUse(chat, 3));
  assert.equal(chat.scriptstate[ITEM_USE_AT_VAR], 'u2');
  // 넘어온 자리(at = u2): 이어 받는 응답에는 또 보내지 않는다
  assert.deepEqual(usesToSend(chat), []);
  assert.doesNotMatch(inv(chat), /uses 소금 봉지/);
  // 답이 온 뒤 새로 넣었다 (ui/items.ts queueUse: 자리를 비우고 at 을 '' 로)
  Object.assign(chat.scriptstate, itemUseVars([{ id, n: 1 }]), { [ITEM_USE_AT_VAR]: '' });
  assert.deepEqual(usesToSend(chat).map((u) => [u.id, u.n, u.after]), [[id, 1, 1]]);
  assert.match(inv(chat), /\[2 uses left\][^]*uses 소금 봉지 \(1 left after this\)/);
  chat.message.push({ role: 'char', data: '또 뿌렸다', chatId: 'b3' });
  const vars = settleItemUse(chat, 4, new Set([id]));
  assert.equal(vars[ITEM_USE_AT_VAR], 'u2');
  const after = readItems(vars);
  assert.deepEqual(after.log.filter((l) => l.what === 'use').map((l) => [l.anchor, l.n]), [['b2', 1], ['b3', 1]]);
  assert.equal(left(after, after.list[0], live(chat)), 1);
  Object.assign(chat.scriptstate, vars);
  assert.equal(settleItemUse(chat, 4, new Set([id])), null, '같은 응답에 두 번 적지 않는다');

  // 요청에 실린 것을 알면: 요청에 없던 물건은 적지 않고, 보낸 뒤 버린 물건은 적는다 (다시 주우면 횟수가 맞게)
  let two = addItem(empty, new Set(['b1']), { name: '소금 봉지', desc: '', uses: 3, from: 'story', anchor: 'b1' });
  two = addItem(two, new Set(['b1']), { name: '진통제', desc: '', uses: 2, from: 'story', anchor: 'b1' });
  const [salt, pill] = two.list.map((e) => e.id);
  const c2 = (items, use) => ({ message: [{ role: 'user', data: '간다', chatId: 'u1' }, { role: 'char', data: '갔다', chatId: 'b1' }, { role: 'user', data: '뿌린다', chatId: 'u2' }, { role: 'char', data: '뿌렸다', chatId: 'b2' }], scriptstate: { ...itemsVars(items), ...itemUseVars(use) } });
  const used = (vars) => readItems(vars).log.filter((l) => l.what === 'use').map((l) => l.name);
  assert.deepEqual(used(settleItemUse(c2(two, [{ id: salt, n: 1 }, { id: pill, n: 1 }]), 3, new Set([salt]))), ['소금 봉지'], '요청에 없던 진통제는 안 적는다');
  assert.deepEqual(used(settleItemUse(c2(two, [{ id: salt, n: 1 }, { id: pill, n: 1 }]), 3)), ['소금 봉지', '진통제'], '모르면 전처럼 전부');
  const dropped = removeItem(two, salt, 'drop', 'manual', '', { key: 'u2' });
  const v = settleItemUse(c2(dropped, [{ id: salt, n: 1 }]), 3, new Set([salt]));
  assert.deepEqual(used(v), ['소금 봉지'], '보낸 뒤 버린 물건도 쓴 것으로 적는다');
  const row = readItems(v).list.find((e) => e.id === salt);
  assert.equal(left(readItems(v), row, new Set(['u1', 'b1', 'u2', 'b2'])), 2);
  assert.deepEqual(used(settleItemUse(c2(dropped, [{ id: salt, n: 1 }]), 3) ?? {}), [], '보낸 것을 모르면 버린 물건은 안 적는다');
});

// 11-08 전수점검: 상점에 판 물건은 판 응답에 묶여 숨고, 그 응답이 사라지면 돌아온다
test('팔기: 판 응답이 살아 있는 동안만 숨고 장착 칸에서 빠진다', async () => {
  const { sellItem } = await import('../dist-test/core.mjs');
  let it = addItem(empty, alive, { name: '단검', equip: 'weapon', from: 'manual', anchor: '', wear: true });
  const id = it.list[0].id;
  assert.equal(equippedOf(liveItems(it, alive)).weapon[0]?.id, id);
  it = sellItem(it, id, 'c2', '철물점에 팖');
  assert.equal(liveItems(it, alive).length, 0);
  assert.equal(it.log.at(-1).what, 'sell');
  const back = liveItems(it, new Set(['c1']));
  assert.deepEqual(back.map((e) => e.name), ['단검']);
  assert.equal(back[0].slot, undefined);
});

// 2026-11-13: 삭제(기록까지 지움), 물건으로 만드는 범위, 만들지 않을 것
import { applyItemChanges as _apply, purgeItem as _purge, itemScope as _scope, itemsRule as _rule, ITEM_SCOPE_SKIP as _skip } from '../dist-test/core.mjs';
test('삭제: 목록과 그 물건의 기록 줄이 같이 지워진다', () => {
  let it = addItem(empty, alive, { name: '정장', desc: '', from: 'story', anchor: 'c1' });
  it = addItem(it, alive, { name: '손전등', desc: '', from: 'story', anchor: 'c1' });
  const id = it.list.find((x) => x.name === '정장').id;
  const out = _purge(it, id);
  assert.deepEqual(out.list.map((x) => x.name), ['손전등']);
  assert.ok(!out.log.some((l) => l.item === id));
  assert.equal(_purge(out, 'none'), out);
});
test('물건으로 만드는 범위: 기본은 넓게, 좁게는 옷을 새로 만들지 않고 갖고 있던 것은 받는다', () => {
  assert.equal(_scope({}), 'wide');
  assert.equal(_scope({ $it_scope: 'narrow' }), 'narrow');
  assert.equal(_rule({}), undefined);
  assert.match(_rule({ $it_scope: 'mid', $it_skip: '명함, 영수증' }), /Do not report food.*Never report as `new`: 명함, 영수증/);
  const ch = [{ name: '정장', action: 'new', desc: '', icon: '옷/정장/suit', anchor: 'c1' }, { name: '권총', action: 'new', desc: '', icon: '무기/권총/pistol', anchor: 'c1' }];
  assert.deepEqual(_apply(empty, alive, ch, { skipKinds: _skip.narrow }).list.map((x) => x.name), ['권총']);
  assert.deepEqual(_apply(empty, alive, ch, { skipKinds: _skip.wide }).list.map((x) => x.name).sort(), ['권총', '정장'].sort());
});
