// 입력 모음(InputHub): 여러 장치가 같은 키를 눌러도 한 번만 눌림·뗌, 프레임 끝 엣지 비우기, 메뉴 가로채기.
import test from 'node:test';
import assert from 'node:assert/strict';
import { InputHub } from '../dist-test/ui-input.mjs';

test('여러 장치가 같은 키를 누르면 마지막 장치가 뗄 때만 풀린다', () => {
  const h = new InputHub();
  const log = [];
  h.on((c, d, s) => log.push(`${c}:${d ? 'down' : 'up'}:${s}`));
  h.press('KeyA', 'kb');
  h.press('KeyA', 'touch');
  assert.ok(h.held('KeyA') && h.pressed('KeyA'));
  h.endFrame();
  assert.ok(!h.pressed('KeyA'));
  h.release('KeyA', 'kb');
  assert.ok(h.held('KeyA'), '터치가 아직 누름');
  h.release('KeyA', 'touch');
  assert.ok(!h.held('KeyA') && h.released('KeyA'));
  assert.deepEqual(log, ['KeyA:down:kb', 'KeyA:up:touch']);
});

test('Shift 오른쪽·Tab 같은 별칭', () => {
  const h = new InputHub();
  h.press('ShiftRight', 'kb');
  assert.ok(h.held('ShiftLeft'));
  h.press('Tab', 'kb');
  assert.ok(h.held('KeyZ'));
});

test('아날로그가 있으면 방향키보다 우선, 없으면 방향키', () => {
  const h = new InputHub();
  h.press('ArrowLeft', 'kb');
  assert.deepEqual(h.axis(), { x: -1, y: 0 });
  h.setAnalog('touch', 0.5, 0.25);
  assert.deepEqual(h.axis(), { x: 0.5, y: 0.25 });
  h.releaseSource('touch');
  assert.deepEqual(h.axis(), { x: -1, y: 0 });
});

test('메뉴 가로채기 중에는 게임 키가 눌리지 않는다', () => {
  const h = new InputHub();
  const got = [];
  h.capture = (c, d) => (d && got.push(c), true);
  h.press('KeyA', 'pad');
  assert.ok(!h.held('KeyA'));
  assert.deepEqual(got, ['KeyA']);
});

test('누른 시간 (Shift 짧게=회피, 길게=달리기 판정용)', () => {
  const h = new InputHub();
  let t = 1000;
  h.now = () => t;
  h.press('ShiftLeft', 'touch');
  t += 200;
  assert.equal(h.heldFor('ShiftLeft'), 0.2);
});
