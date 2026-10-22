import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({ stdin: { contents: `
export { World } from './src/game/action/engine/world';
export { createElevatorStage } from './src/game/action/stage/module';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const { World, createElevatorStage } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const idle = { mx: 0, my: 0, run: false, evade: false, downDouble: false, held: new Set(), pressed: new Set(), released: new Set() };

function setup(seed) {
  const stage = createElevatorStage({ load: () => null, save() {} });
  const run = { seed, agent: 'jyaldi', stageId: 'elevator' };
  const w = new World(run, {}, stage);
  w.enterFloor(stage.firstFloor(run));
  const travel = kind => {
    const prop = w.props.find(p => p.kind === kind);
    assert.ok(prop, `missing ${kind}`);
    // Placement fixture only; interaction and floor transition use the real engine.
    w.player.x = w.player.px = prop.x;
    w.player.move = null;
    w.player.phase = 'free';
    w.step({ ...idle, pressed: new Set(['interact']) });
    assert.equal(w.ended, 'next');
    w.enterFloor(stage.nextFloor(run, w.floor, 'next'));
  };
  travel(w.props.some(p => p.kind === 'hatch') ? 'hatch' : 'servicedoor');
  return { stage, run, w, travel };
}

test('seed 4242: 사다리 왕복은 계단 반대편 고정 좌표 대신 실제 사다리로 복귀', () => {
  const { w, travel } = setup(4242);
  travel('left');
  const ladder = w.props.find(p => p.kind === 'ladder_down');
  assert.equal(ladder.x, 1160, 'terrain clearance relocated the original x720 ladder');
  const floor = w.floor.id;
  travel('ladder_down');
  travel('ladder_up');
  assert.equal(w.floor.id, floor);
  assert.equal(w.player.x, ladder.x);
  assert.ok(!w.floor.stage.terrain.some(t => ['pit', 'block'].includes(t.kind) && w.player.x > t.x0 && w.player.x < t.x1));
});

test('생성된 위·아래 사다리 좌표를 신규 방문과 재방문 진입점에 모두 사용', () => {
  let up = 0, movedDown = 0;
  for (const seed of [1, 2, 7, 42, 77, 4242]) {
    const { stage, run, w } = setup(seed);
    for (const cell of stage.outing().service.cells) {
      for (const [kind, side, original] of [['ladder_up', 'u', 560], ['ladder_down', 'd', 720]]) {
        const ladder = cell.things.find(p => p.kind === kind);
        if (!ladder) continue;
        if (side === 'u') up++;
        if (side === 'd' && ladder.x !== original) movedDown++;
        for (let visit = 0; visit < 2; visit++) {
          stage.outing().pending = { to: 'service', col: cell.col, row: cell.row, side };
          w.enterFloor(stage.nextFloor(run, w.floor, 'next'));
          assert.equal(w.player.x, ladder.x, `${seed}:${cell.col},${cell.row}:${side}:visit${visit}`);
        }
      }
    }
  }
  assert.ok(up > 0 && movedDown > 0, 'both directions and terrain-relocated ladders were exercised');
});
