import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPictures, pictures } from '../dist-test/core.mjs';

const m = (list) => ({ schema: 1, plugin: 'goei-plugin', greetings: {}, pictures: list });

test('사진 업데이트: 지문이 바뀐 카드 사진과 새 사진만 받고, 사용자 사진은 그대로', () => {
  const assets = [['map01', 'assets/a.avif', 'avif'], ['Ghost', 'assets/b.avif', 'avif'], ['MyOwn', 'assets/c.webp', 'webp']];
  const cur = m([['map01', 'aaa', 'avif', 10], ['Ghost', 'bbb', 'avif', 20]]);
  const next = m([['map01', 'aaa', 'avif', 10], ['Ghost', 'ccc', 'avif', 30], ['Witch', 'ddd', 'avif', 40]]);
  const plan = planPictures(assets, cur, next);
  assert.deepEqual(plan.get.map((p) => p[0]), ['Ghost', 'Witch']);
  assert.equal(plan.replaced, 1);
  assert.equal(plan.added, 1);
  assert.equal(plan.bytes, 70);
});

test('사진 업데이트: 지문 기록이 없는 옛 카드는 카드 이름 사진을 모두 새로 받는다', () => {
  const assets = [['map01', 'assets/a.avif', 'avif'], ['MyOwn', 'assets/c.webp', 'webp']];
  const plan = planPictures(assets, m(undefined), m([['map01', 'aaa', 'avif', 10]]));
  assert.equal(plan.replaced, 1);
  assert.equal(plan.added, 0);
  assert.deepEqual(pictures(null), []);
  assert.equal(planPictures(assets, null, null).get.length, 0);
});
