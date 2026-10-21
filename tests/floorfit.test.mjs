// 층 하나에서 소품·문·적 생성 자리가 서로 겹치지 않는다 (통합 검수 12·15·16·17: 원탁 안의 적, 문 앞 상자)
// 여러 시드 × 층 유형으로 엔진(itemsLink)과 같은 순서를 밟는다: 층 계획 → 바닥 물건 놓기 → 적 생성 자리 고치기
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, readdirSync } from 'node:fs';

// 벽 그림 이름만 있는 가짜 배경 꾸러미: 벽 그림 속 문 구간(keepOut)을 노드에서도 계산하게
const pack = {};
for (const place of readdirSync('game-src/art/bg/dot')) {
  pack[place] = {};
  for (const f of readdirSync(`game-src/art/bg/dot/${place}`)) if (f.includes('_wall') && f.endsWith('.png')) pack[place][f.slice(0, -4)] = 'x';
}
globalThis.window = { __GOEI_BG_ART__: pack };

mkdirSync('dist-test', { recursive: true });
await build({
  stdin: { contents: "export { makeFloor, floorPlan } from './src/game/action/stage/index.ts'; export { createField, furnishFloor, PROPS } from './src/game/action/items/index.ts'; export * from './src/game/action/engine/propBlock.ts';", resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/floorfit.mjs', loader: { '.css': 'text', '.png': 'empty' }, logLevel: 'error',
});
const M = await import('../dist-test/floorfit.mjs');

const TYPES = ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'deep'];
const lane = [440, 690];
let seedR = 1;
const rnd = () => ((seedR = (seedR * 16807) % 2147483647) / 2147483647);

test('바닥 물건은 문 앞·적 생성 자리에 놓이지 않고, 적은 물건 밖에 생겨난다', () => {
  let floors = 0, doorsChecked = 0, spawns = 0;
  for (let seed = 1; seed <= 40; seed++)
    for (const type of TYPES) {
      const depth = type === 'lobby' ? 1 + (seed % 3) : type === 'deep' ? 15 : 4 + (seed % 20);
      const f = M.makeFloor({ seed, depth, type, sub: type === 'replica' ? ['vacant', 'pretending', 'red'][seed % 3] : null, danger: seed % 3, growth: seed % 5, flags: [], epoch: 0 });
      const plan = M.floorPlan(f, `t${seed}`);
      floors++;
      doorsChecked += (plan.keepOut ?? []).length;
      const field = M.createField(seed, depth, { x0: 20, x1: plan.length - 20, y0: lane[0], y1: lane[1] });
      seedR = seed;
      M.furnishFloor(field, { ...plan, props: M.furnishAvoid(plan) }, lane, rnd);
      const items = field.ents.filter((e) => e.type === 'prop');
      // 문·벽 가구 앞이 비었다
      for (const it of items) {
        const w = M.PROPS[it.prop].w;
        for (const [a, b] of plan.keepOut ?? []) assert.ok(it.x + w / 2 <= a || it.x - w / 2 >= b, `${type} ${depth} ${seed}: ${it.prop}@${Math.round(it.x)} 문 앞 [${Math.round(a)}, ${Math.round(b)}]`);
      }
      // 적은 바닥 물건(들·부술 물건 + 층 상자 더미) 밖에 생겨난다
      const solids = [
        ...items.map((e) => ({ x: e.x, y: e.y, w: M.PROPS[e.prop].w })),
        ...plan.props.filter((q) => (q.kind === 'prop' || q.kind === 'table' || q.kind === 'clutter') && q.y > lane[0] + 20).map((q) => ({ x: q.x, y: q.y, w: Math.max(q.w, 100) })),
      ];
      for (const s of plan.encounters.flatMap((en) => en.waves.flat())) {
        spawns++;
        const q = M.clearSpot(s.x, s.y, solids, lane);
        const bad = solids.find((p) => Math.abs(p.x - q.x) < p.w / 2 && Math.abs(p.y - q.y) < M.PROP_DEPTH);
        assert.ok(!bad, `${type} ${depth} ${seed}: ${s.kind}@${q.x},${q.y} 물건 안 (${bad?.x},${bad?.y})`);
      }
    }
  assert.ok(floors === 320 && doorsChecked > 300 && spawns > 500, `층 ${floors}, 문 ${doorsChecked}, 적 ${spawns}`);
});
