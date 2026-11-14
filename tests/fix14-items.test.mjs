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
