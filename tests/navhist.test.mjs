import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyWikiNav, NavHistory } from '../dist-test/core.mjs';

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

test('옛 즐겨찾기 호환: 위키 안 인물·개인 기록·기록 문서·세력 화면은 기록 메뉴 위치로, 문서 화면은 그대로', () => {
  assert.deepEqual(legacyWikiNav('people', ''), { sub: 'people', view: 'list', id: '' });
  assert.deepEqual(legacyWikiNav('person', '쟈알디'), { sub: 'people', view: 'person', id: '쟈알디' });
  assert.deepEqual(legacyWikiNav('docs', ''), { sub: 'people', view: 'docs', id: '' });
  assert.deepEqual(legacyWikiNav('faction', 'C00'), { sub: 'factions', view: 'faction', id: 'C00' });
  for (const v of ['home', 'doc', 'compose', 'settings', 'new', '']) assert.equal(legacyWikiNav(v, '관리국'), null, v);
});
