// 지침 절 쪼개기: 쪼개서 그대로 합치면 원문과 같다 (편집 창이 절 본문만 바꾼다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_NAMES, guideDefault, guidePrompt, joinGuide, setUserRules, splitGuide } from '../dist-test/core.mjs';

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

test('내가 추가한 규칙은 붙일 지침의 늘 쓰이는 절 끝에 들어간다', () => {
  setUserRules([{ id: 'a', title: '대사 길이', text: 'Three sentences max per speaker.', to: ['RP', 'Directive', 'GNet', 'Phone'], on: true }, { id: 'b', title: '꺼진 것', text: 'never', to: ['RP'], on: false }]);
  assert.match(guidePrompt('RP'), /\n\n## User Rules\n### 대사 길이\nThree sentences max per speaker\.\n$/);
  assert.ok(!guidePrompt('RP').includes('never'), '끈 규칙은 안 붙음');
  const d = guidePrompt('Directive');
  assert.match(d, /===COMMON===\n[\s\S]*## User Rules\n### 대사 길이\nThree sentences max per speaker\.\n\n===OPENING===/);
  assert.match(guidePrompt('GNet'), /@@SECTION LB\n[\s\S]*## User Rules[\s\S]*\n@@END/);
  assert.match(guidePrompt('Phone'), /@@SECTION COMMON\n[\s\S]*## User Rules[\s\S]*\n@@END/);
  assert.equal(guidePrompt('Wiki'), guideDefault('Wiki'), '붙일 곳이 아니면 그대로');
  setUserRules([]);
  assert.equal(guidePrompt('RP'), guideDefault('RP'));
});
