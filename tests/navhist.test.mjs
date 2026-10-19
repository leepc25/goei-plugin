import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NavHistory } from '../dist-test/core.mjs';

test('앞뒤 이동: 브라우저처럼 뒤로·앞으로, 새 화면이면 앞 기록 버림', () => {
  const h = new NavHistory();
  h.record({ tab: 'board' });
  h.record({ tab: 'board' });
  h.record({ tab: 'wiki' });
  h.record({ tab: 'wiki', doc: '관리국' });
  assert.equal(h.can(1), false);
  assert.deepEqual(h.go(-1), { tab: 'wiki' });
  assert.deepEqual(h.go(-1), { tab: 'board' });
  assert.equal(h.go(-1), null);
  assert.deepEqual(h.go(1), { tab: 'wiki' });
  // 돌아간 화면을 다시 적어도 기록은 그대로
  h.record({ tab: 'wiki' });
  assert.equal(h.can(1), true);
  h.record({ tab: 'phone' });
  assert.equal(h.can(1), false);
  assert.deepEqual(h.go(-1), { tab: 'wiki' });
});
