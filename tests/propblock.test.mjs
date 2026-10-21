// 바닥 물건(밥상 등)을 몸이 뚫고 지나가지 않는다 (통합 검수 12·15 재발 방지)
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/game/action/engine/propBlock.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/propblock.mjs', logLevel: 'error' });
const { blockByProps, PROP_DEPTH } = await import('../dist-test/propblock.mjs');

const lane = [440, 690];
const table = { x: 1000, y: 560, w: 146 };

test('같은 깊이로 걸어오는 적은 밥상 앞이나 뒤로 비켜 지나간다', () => {
  for (const y0 of [560, 552, 575]) {
    const e = { x: 800, y: y0, z: 0 };
    for (let t = 0; t < 120; t++) {
      e.x += 4; // 적 걸음
      blockByProps([e], [table], lane);
      if (Math.abs(e.x - table.x) < table.w / 2) assert.ok(Math.abs(e.y - table.y) >= PROP_DEPTH - 9, `x=${e.x} y=${e.y}: 밥상 한가운데`);
    }
    assert.ok(e.x > 1200, '지나가긴 한다');
  }
});

test('뛰어넘는 몸은 건드리지 않는다', () => {
  const b = { x: 1000, y: 560, z: 40 };
  blockByProps([b], [table], lane);
  assert.equal(b.y, 560);
});

test('길 끝에 붙은 물건은 반대쪽으로 비켜 선다', () => {
  const t2 = { x: 500, y: 450, w: 100 };
  const b = { x: 500, y: 452, z: 0 };
  for (let i = 0; i < 10; i++) blockByProps([b], [t2], lane);
  assert.ok(b.y >= 450 + PROP_DEPTH && b.y <= lane[1]);
});

test('제자리에 묶인 적과 겹친 물건은 물건 쪽이 옆으로 비킨다', async () => {
  const { nudgeProp } = await import('../dist-test/propblock.mjs');
  const t = { x: 1000, y: 560, w: 146 };
  const still = { x: 990, y: 562, z: 0 };
  const stuck = blockByProps([{ ...still }], [t], lane);
  nudgeProp(t, [still], [t], 40, 4000);
  assert.ok(Math.abs(t.x - still.x) >= t.w / 2 + 60, `x=${t.x}`);
  assert.ok(stuck instanceof Set);
});

test('요원(지난 x가 있는 몸)은 옆에서 걸어 들어오면 물건 안으로 못 들어가고 앞·뒤로 돌아간다', async () => {
  const { insideProp } = await import('../dist-test/propblock.mjs');
  const pile = { x: 1000, y: 600, w: 240, back: 110 };
  for (const y0 of [560, 600, 630]) {
    const p = { x: 820, y: y0, z: 0, px: 820 }; // 상자 더미 깊이로 걸어감
    for (let t = 0; t < 200; t++) {
      p.px = p.x;
      p.x += 6;
      blockByProps([p], [pile], lane);
      assert.ok(!insideProp(pile, p.x, p.y), `y0=${y0} t=${t} (${p.x}, ${p.y}): 상자 더미 안`);
    }
    assert.ok(p.x > 1200, `y0=${y0}: 돌아서 지나간다 (x=${p.x})`);
  }
});

test('순간 이동·밀려남으로 물건 안에 놓인 몸은 앞이나 뒤로 빠져나온다 (뒤쪽은 물건 키만큼)', async () => {
  const { insideProp } = await import('../dist-test/propblock.mjs');
  const pile = { x: 1000, y: 600, w: 240, back: 110 };
  for (const y0 of [520, 560, 600, 630]) {
    const p = { x: 1000, y: y0, z: 0, px: 1000 };
    for (let t = 0; t < 30; t++) blockByProps([p], [pile], lane);
    assert.ok(!insideProp(pile, p.x, p.y), `y0=${y0} → y=${p.y}`);
  }
});
