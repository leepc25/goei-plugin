// 지침 절 쪼개기: 쪼개서 그대로 합치면 원문과 같다 (편집 창이 절 본문만 바꾼다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_NAMES, guideDefault, joinGuide, splitGuide } from '../dist-test/core.mjs';

test('지침 절 쪼개기·합치기는 원문을 보존한다', () => {
  for (const n of GUIDE_NAMES) {
    const text = guideDefault(n);
    const parts = splitGuide(text);
    assert.ok(parts.length > 1, `${n}: 절이 여럿`);
    assert.equal(joinGuide(parts), text, `${n}: 합치면 원문`);
    assert.ok(parts.every((p) => !/\s$/.test(p.body)), `${n}: 본문 끝에 빈 줄 없음`);
  }
  const d = splitGuide(guideDefault('Directive'));
  assert.deepEqual(d.map((p) => p.title), ['COMMON', 'OPENING', 'CONTINUATION', 'CONTEXT', 'FORMAT']);
  d[0] = { ...d[0], body: '바꾼 글' };
  assert.match(joinGuide(d), /^===COMMON===\n바꾼 글\n\n===OPENING===/);
});
