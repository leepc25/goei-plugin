// 층 하나에서 소품·문·적 생성 자리가 서로 겹치지 않는다 (통합 검수 12·15·16·17: 원탁 안의 적, 문 앞 상자)
// 여러 시드 × 층 유형으로 엔진(itemsLink)과 같은 순서를 밟는다: 층 계획 → 바닥 물건 놓기 → 적 생성 자리 고치기
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

// 벽 그림 이름만 있는 가짜 배경 꾸러미: 벽 그림 속 문 구간(keepOut)을 노드에서도 계산하게
const pack = {};
for (const place of readdirSync('game-src/art/bg/dot')) {
  pack[place] = {};
  for (const f of readdirSync(`game-src/art/bg/dot/${place}`)) if (f.includes('_wall') && f.endsWith('.png')) pack[place][f.slice(0, -4)] = 'x';
  // 물건 그림은 진짜 PNG 머리를 넣어 그림 폭을 재게 한다
  if (existsSync(`game-src/art/bg/dot/${place}/objects`))
    for (const f of readdirSync(`game-src/art/bg/dot/${place}/objects`)) if (f.endsWith('.png')) pack[place][`objects/${f.slice(0, -4)}`] = `data:image/png;base64,${readFileSync(`game-src/art/bg/dot/${place}/objects/${f}`).subarray(0, 33).toString('base64')}`;
}
globalThis.window = { __GOEI_BG_ART__: pack };
globalThis.Image ??= class { complete = false; naturalWidth = 0; src = ''; };

mkdirSync('dist-test', { recursive: true });
await build({
  stdin: { contents: "export { makeFloor, floorPlan, narrowBack } from './src/game/action/stage/index.ts'; export { propArtSize } from './src/game/action/art/bg.ts'; export { createField, furnishFloor, PROPS } from './src/game/action/items/index.ts'; export * from './src/game/action/engine/propBlock.ts';", resolveDir: '.', loader: 'ts' },
  bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/floorfit.mjs', loader: { '.css': 'text', '.png': 'empty' }, logLevel: 'error',
});
const M = await import('../dist-test/floorfit.mjs');

const TYPES = ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'deep'];
const lane = [440, 690];
let seedR = 1;
const rnd = () => ((seedR = (seedR * 16807) % 2147483647) / 2147483647);

test('바닥 물건은 문 앞·적 생성 자리에 놓이지 않고, 적은 물건 밖에 생겨난다', () => {
  let floors = 0, doorsChecked = 0, spawns = 0, wallProps = 0, lockers = 0;
  const moved = [];
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
      // 벽에 붙은 큰 소품(자판기·소파·정수기…)은 그림 폭 전체가 문·명패·벽 장식 앞을 피한다 (검수 22)
      for (const q of plan.props.filter((q) => q.y <= lane[0] + 40 && ['prop', 'clutter', 'table'].includes(q.kind))) {
        const aw = M.propArtSize(q.kind, q.label, type)?.w;
        if (!aw) continue;
        wallProps++;
        const hit = (plan.keepOut ?? []).find(([a, b]) => q.x + aw / 2 > a && q.x - aw / 2 < b);
        if (hit) moved.push(`${type} ${depth} ${seed}: ${q.label}@${q.x} 폭 ${aw} ↔ [${Math.round(hit[0])}, ${Math.round(hit[1])}]`);
      }
      // 점검문(철문)도 벽 그림의 문·게시판 앞에 서지 않는다 (검수 22)
      for (const q of plan.props.filter((q) => q.kind === 'servicedoor')) {
        const aw = M.propArtSize(q.kind, q.label, type)?.w ?? 170;
        // 벽 그림의 문 하나를 통째로 덮는 것(그 문이 철문이 된다)은 괜찮다
        const hit = (plan.keepOut ?? []).find(([a, b]) => q.x + aw / 2 > a && q.x - aw / 2 < b && !(a >= q.x - aw / 2 && b <= q.x + aw / 2 && b - a >= 100));
        if (hit) moved.push(`${type} ${depth} ${seed}: 점검문@${q.x} 폭 ${aw} ↔ [${Math.round(hit[0])}, ${Math.round(hit[1])}]`);
      }
      // 좁은 길 뒷줄 사물함(키 큰 그림)도 벽 그림의 문·명패·게시판·액자·창 앞에 서지 않는다 (검수 23)
      const allTerr = f.segments.flatMap((sg) => sg.terrain);
      const lh = (M.propArtSize('clutter', '사물함')?.w ?? 150) / 2;
      for (const t of allTerr.filter((t) => t.kind === 'narrow')) {
        for (const x of M.narrowBack(t, allTerr)?.xs ?? []) {
          lockers++;
          const hit = (plan.keepOut ?? []).find(([a, b]) => x + lh > a && x - lh < b);
          assert.ok(!hit, `${type} ${depth} ${seed}: 사물함@${x} ↔ 벽 [${hit?.map(Math.round)}]`);
        }
      }
      // 사다리(천장 해치)는 벽선에, 문·벽 장식 앞이 아니고, 한 화면에 하나 (검수 21)
      const hatches = plan.props.filter((q) => q.kind === 'hatch').sort((a, b) => a.x - b.x);
      const gateX = f.placed.find(q => q.kind === 'locked')?.x;
      if (gateX && f.placed.some(q => q.kind === 'hatch' && q.x < gateX)) {
        assert.ok(hatches.some(q => q.x < gateX), `${type} ${depth} ${seed}: 셔터 앞 열쇠 길 보존`);
      }
      hatches.forEach((h, i) => {
        assert.equal(h.y, lane[0], `${type} ${depth} ${seed}: 사다리 벽선`);
        if (i) assert.ok(h.x - hatches[i - 1].x > 1280, `${type} ${depth} ${seed}: 사다리 둘이 한 화면 ${hatches.map((q) => q.x)}`);
        for (const [a, b] of plan.keepOut ?? []) assert.ok(h.x + 30 <= a || h.x - 30 >= b, `${type} ${depth} ${seed}: 사다리@${h.x} 문 앞 [${Math.round(a)}, ${Math.round(b)}]`);
      });
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
  // 자리가 정말 없을 때(480px 안) 원래 자리에 남는 경우만 조금 허용
  assert.ok(moved.length <= floors * 0.03, `벽 소품 ${wallProps}개 중 ${moved.length}개가 문·장식 앞:\n${moved.slice(0, 8).join('\n')}`);
  assert.ok(floors === 320 && doorsChecked > 300 && spawns > 500 && lockers > 50, `층 ${floors}, 문 ${doorsChecked}, 적 ${spawns}, 사물함 ${lockers}`);
});
