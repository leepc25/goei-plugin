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
