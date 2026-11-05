import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropAssets, planPictures, pictures } from '../dist-test/core.mjs';

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

test('사진 업데이트: 새 카드에서 뺀 사진(옛 요원 그림)은 drop 에, 직접 넣은 사진은 안 뺀다', () => {
  const assets = [['Aileen', 'assets/a.avif', 'avif'], ['Aileen_default', 'assets/b.avif', 'avif'], ['MyOwn', 'assets/c.webp', 'webp']];
  const cur = m([['Aileen', 'aaa', 'avif', 10], ['Aileen_default', 'bbb', 'avif', 20]]);
  const next = m([['Aileen_default', 'bbb', 'avif', 20]]);
  const plan = planPictures(assets, cur, next);
  assert.deepEqual(plan.drop, ['Aileen']);
  assert.equal(plan.get.length, 0);
  assert.deepEqual(dropAssets(assets, plan.drop).map((r) => r[0]), ['Aileen_default', 'MyOwn']);
  assert.deepEqual(planPictures(assets, cur, null).drop, []);
});
