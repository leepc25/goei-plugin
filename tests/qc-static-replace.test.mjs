// QC(정적 감사): String.replace 의 치환 문자열에 사용자·모델 글이 들어가면 `$&`·`$'` 같은 패턴이 풀려 글이 망가진다.
// 함수 치환으로 바꾼 자리들의 회귀 시험 (상태창 renderStatus 는 tests/qc-static-xss-browser.mjs 가 본다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withUserInput, applyPlayer, PLAYER_HEAD } from '../dist-test/core.mjs';

const EVIL = "$' $& $1 $<a> $$ 끝";

test('지시문 [[INPUT]]: 적은 글의 $ 패턴이 그대로 들어간다', () => {
  const out = withUserInput({ format: { user_input: 'Situation:\n[[INPUT]]' } }, '본문', EVIL);
  assert.ok(out.endsWith(`Situation:\n${EVIL}`), out);
  assert.ok(!out.includes('[[INPUT]]'));
});

test('캐릭터로 플레이: 요원 이름의 $ 패턴이 그대로 들어간다', () => {
  const name = '$& 요원';
  const msgs = [{ role: 'system', content: `규칙\n설명\n끝` }, { role: 'user', content: '민수가 문을 연다.' }];
  const out = applyPlayer(msgs, `${PLAYER_HEAD}\nX`, '설명', '민수', name);
  assert.equal(out.at(-1).content, `${name}가 문을 연다.`);
});
