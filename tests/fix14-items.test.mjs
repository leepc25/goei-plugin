// 사용자 2026-11-14: 소지품 창에서 직접 버린 물건은 다음 메인 요청 「This turn」에 버렸다고 알린다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, removeItem, droppedNow } from '../dist-test/core.mjs';

test('직접 버린 물건: 버린 때의 마지막 응답 키와 같으면 「버렸다」 한 줄, 다른 응답 뒤면 없음', () => {
  const alive = new Set(['c1']);
  let it = addItem({ list: [], log: [] }, alive, { name: '코트', from: 'story', anchor: 'c1', quote: '코트를 입었다' });
  const id = it.list[0].id;
  it = removeItem(it, id, 'drop', 'manual', '', { key: 'c1' });
  assert.deepEqual(droppedNow(it, 'c1'), ['threw 코트 away — the protagonist discarded it on purpose and no longer has it']);
  assert.deepEqual(droppedNow(it, 'c2'), [], '다음 응답이 오면 더는 이번 턴 사건이 아님');
  assert.deepEqual(droppedNow(it, ''), []);
});
