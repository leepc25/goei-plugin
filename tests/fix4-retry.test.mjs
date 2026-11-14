// 11-14 재검토 ①-2: 재시도 판정용 기억(body.ts lastAdded)에는 「새로 끼운」 system 글만. 고친 system 글은 넣지 않는다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { insertedSystemTexts, lore } from '../dist-test/core.mjs';

const sys = (content) => ({ role: 'system', content });
const user = (content) => ({ role: 'user', content });
const bot = (content) => ({ role: 'assistant', content });

test('끼운 글만: 고친 system 글은 빠지고 새로 끼운 system 글은 남는다', () => {
  const before = [sys('프리셋 머리'), sys('옛 로어 글'), bot('첫 장면'), user('행동')];
  const after = [sys('프리셋 머리'), sys('새 로어 글'), bot('첫 장면'), sys('[참고 기록]'), sys('[상태]'), user('행동')];
  assert.deepEqual(insertedSystemTexts(before, after), ['[참고 기록]', '[상태]']);
});

test('옛 카드 리롤: 자리 로어북 보정(patchSlots)으로 고친 글은 기억하지 않는다 → 다음 새 요청에 같은 글이 있어도 재시도가 아니다', () => {
  const old = { $goei_lore_agent: '### Character - 가\n옛 글' };
  const next = { $goei_lore_agent: '### Character - 나\n새 글' };
  const before = [sys('프리셋'), sys(old.$goei_lore_agent), bot('첫 장면'), user('행동')];
  const patched = lore.patchSlots(before, old, next);
  assert.equal(patched.changed, 1);
  const after = [...patched.messages.slice(0, 3), sys('[Inventory] …'), patched.messages[3]];
  const added = new Set(insertedSystemTexts(before, after));
  assert.deepEqual([...added], ['[Inventory] …']);
  // 다음 새 요청: 입력 처리(storeLore)가 같은 변수를 적어 Risu 가 고친 글과 똑같은 글을 넣는다
  const nextInput = [sys('프리셋'), sys(next.$goei_lore_agent), bot('첫 장면'), user('행동'), bot('응답'), user('다음 행동')];
  assert.equal(nextInput.some((m) => m.role === 'system' && added.has(m.content)), false);
  // 자동 재시도(직전 조립 결과가 그대로 다시 들어옴)는 여전히 알아본다
  assert.equal(after.some((m) => m.role === 'system' && added.has(m.content)), true);
});

test('통째로 바뀐 글·이웃에 끼운 글: 없어진 수만큼만 고친 글로 본다', () => {
  // 자리 글이 메시지 전체라 앞뒤가 하나도 안 닮았어도 고친 글로 본다
  assert.deepEqual(insertedSystemTexts([sys('가나다'), user('u')], [sys('XYZ'), user('u')]), []);
  // 고친 글 바로 옆에 끼운 글: 닮은 쪽이 고친 글
  assert.deepEqual(insertedSystemTexts([sys('로어: 옛 글 끝'), user('u')], [sys('[끼움]'), sys('로어: 새 글 끝'), user('u')]), ['[끼움]']);
  // 고친 것이 없으면 새 system 글은 모두 끼운 글. 다른 역할은 세지 않는다
  assert.deepEqual(insertedSystemTexts([user('a'), bot('b [▣|x]'), user('c')], [sys('머리'), user('a'), bot('b'), sys('[상태]'), user('c')]), ['머리', '[상태]']);
  // 자리만 옮긴 글(입력에 있던 글)은 끼운 글이 아니다
  assert.deepEqual(insertedSystemTexts([sys('A'), user('u'), sys('B')], [sys('B'), sys('A'), user('u')]), []);
  // 바뀐 것이 없으면 빈 목록
  const same = [sys('A'), user('u')];
  assert.deepEqual(insertedSystemTexts(same, same), []);
  assert.deepEqual(insertedSystemTexts([], [sys('A')]), ['A']);
});

test('body.ts 연결: lastAdded 는 끼운 글만 (입력에 없던 system 글 전부가 아니다)', async () => {
  const body = await readFile(new URL('../src/body.ts', import.meta.url), 'utf8');
  assert.match(body, /lastAdded = new Set\(insertedSystemTexts\(input0, out\)\);/);
  assert.doesNotMatch(body, /lastAdded = new Set\(sysTexts\(out\)/);
});
