import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-fieldworld-'));
const names = ['rng', 'clock', 'places', 'actors', 'observer'];
await build({ entryPoints: names.map((n) => `src/game/world/${n}.ts`), outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `game/world/${n}.mjs`)));
const R = await imp('rng'), C = await imp('clock'), P = await imp('places'), A = await imp('actors'), O = await imp('observer');

// 본부 지도 축소판: 거리 ─ 로비 ─(계단)─ 3층 복도 ─ 사무실·휴게실, 엘리베이터
const scenes = [
  { id: 'street', name: '거리', length: 1920, legacy: true, doors: [{ id: 'main', x: 640, kind: 'main', to: 'lobby', toDoor: 'main' }, { id: 'east', x: 1860, kind: 'door', to: 'jongno', toDoor: 'west' }] },
  { id: 'jongno', name: '종로', length: 4000, legacy: true, doors: [{ id: 'west', x: 60, kind: 'door', to: 'street', toDoor: 'east' }] },
  { id: 'lobby', name: '로비', length: 2000, lane: [420, 669], doors: [{ id: 'main', x: 300, kind: 'glass', to: 'street', toDoor: 'main' }, { id: 'elev', x: 900, kind: 'elevator' }, { id: 'stairs', x: 1500, kind: 'stairs', up: 'f3' }] },
  { id: 'f3', name: '3층', length: 2400, lane: [420, 669], doors: [{ id: 'office', x: 400, kind: 'glass', to: 'office', toDoor: 'out' }, { id: 'lounge', x: 800, kind: 'door', to: 'lounge', toDoor: 'out' }, { id: 'elev', x: 1200, kind: 'elevator' }, { id: 'stairs', x: 2000, kind: 'stairs', down: 'lobby' }, { id: 'meet', x: 1600, kind: 'door', locked: true }] },
  { id: 'office', name: '사무실', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'office' }] },
  { id: 'lounge', name: '휴게실', length: 1280, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'lounge' }] },
];
const elevator = [{ scene: 'f3', door: 'elev' }, { scene: 'lobby', door: 'elev' }];
const graph = () => new P.PlaceGraph(scenes, elevator);

test('씨앗: 같은 씨앗 = 같은 수열, 다른 씨앗 = 다름', () => {
  const a = R.mulberry32(42), b = R.mulberry32(42), c = R.mulberry32(43);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  assert.equal(R.hashSeed('종로'), R.hashSeed('종로'));
});

test('시계: 장면 10·지역 30·대화 10·싸움은 장면당 한 번·시간 보내기', () => {
  const k = new C.FieldClock(9 * 60);
  assert.equal(k.advance({ kind: 'scene', to: 'f3' }), 10);
  assert.equal(k.advance({ kind: 'talk' }), 10);
  assert.equal(k.advance({ kind: 'fight' }), 10);
  assert.equal(k.advance({ kind: 'fight' }), 0, '같은 장면에서 두 번째 싸움은 0');
  assert.equal(k.advance({ kind: 'scene', to: 'office' }), 10);
  assert.equal(k.advance({ kind: 'fight' }), 10, '다음 장면에서 다시 10');
  assert.equal(k.advance({ kind: 'region', to: 'gangnam' }), 30);
  assert.equal(k.advance({ kind: 'wait', minutes: 60 }), 60);
  assert.equal(k.text(), '11:20');
  const none = new C.FieldClock(null);
  assert.equal(none.advance({ kind: 'scene', to: 'x' }), 0);
  assert.equal(none.text(), '--:--');
  assert.deepEqual(C.clockRules({ scene: '15', talk: -3, fight: 'x' }), { scene: 15, region: 30, talk: 10, fight: 10 });
});

test('장소: 문·계단·엘리베이터로 길 찾기, 잠긴 문은 길 아님', () => {
  const g = graph();
  const r = g.route('office', 'street');
  assert.ok(r);
  assert.deepEqual(r.map((h) => h.to), ['f3', 'lobby', 'street']);
  assert.equal(g.route('office', 'office'), null);
  assert.ok(g.neighbors('f3').every((h) => h.exit !== 'meet'));
  assert.deepEqual(g.doorSpot('office', 'out'), { x: 200, y: 680 - 14 });
  assert.deepEqual(g.doorSpot('f3', 'office'), { x: 400, y: 420 + 16 });
  assert.ok(g.route('jongno', 'lounge'));
});

test('행위자: 서성이다 다른 장면에 다녀오고, 같은 씨앗이면 같은 하루', () => {
  const run = (seed) => {
    const sim = new A.WorldSim(graph(), R.mulberry32(seed));
    sim.add({ id: 'a', name: '잼트리', kind: 'named', brain: 'roam', home: 'office', roam: ['office', 'f3', 'lounge'] });
    const visited = new Set();
    for (let t = 0; t < 30 * 600; t++) { sim.step(1 / 30); visited.add(sim.actors[0].scene); }
    return { visited, at: [sim.actors[0].scene, Math.round(sim.actors[0].x), Math.round(sim.actors[0].y)] };
  };
  const a = run(7), b = run(7);
  assert.deepEqual(a.at, b.at, '같은 씨앗 = 같은 결과');
  assert.ok(a.visited.has('office'));
  assert.ok(a.visited.size >= 2, `10분 동안 다른 장면에도 감: ${[...a.visited]}`);
  for (const s of a.visited) assert.ok(['office', 'f3', 'lounge'].includes(s), `오가는 범위 밖: ${s}`);
});

test('행위자: 걷는 띠 밖으로 나가지 않는다', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(3));
  sim.add({ id: 'a', name: '큐라스', kind: 'named', brain: 'roam', home: 'office', roam: ['office', 'f3', 'lounge'] });
  for (let t = 0; t < 30 * 300; t++) {
    sim.step(1 / 30);
    const a = sim.actors[0];
    if (a.act === 'door') continue;
    const [top, bot] = graph().lane(a.scene);
    assert.ok(a.y >= top - 1 && a.y <= bot + 1, `y ${a.y} 장면 ${a.scene}`);
    assert.ok(a.x >= 0 && a.x <= graph().scene(a.scene).length, `x ${a.x}`);
  }
});

test('몹 보충: 목표 인원까지 채우고, 지나가면 사라지고, 다시 채운다', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(11), [{ scene: 'jongno', target: { day: 5, night: 1 }, refill: [1, 2], mix: ['행인'] }]);
  for (let t = 0; t < 30 * 2; t++) sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
  assert.equal(sim.inScene('jongno').length, 5);
  let gone = 0;
  const ids = new Set(sim.actors.map((a) => a.def.id));
  for (let t = 0; t < 30 * 120; t++) sim.step(1 / 30, { scene: 'jongno', x: 2000, hour: 12 });
  for (const id of ids) if (!sim.actors.some((a) => a.def.id === id)) gone++;
  assert.ok(gone > 0, '지나간 몹은 사라진다');
  assert.ok(sim.inScene('jongno').length >= 3, '계속 보충된다');
  // 밤에는 적게
  for (let t = 0; t < 30 * 200; t++) sim.step(1 / 30, { scene: 'office', x: 0, hour: 23 });
  assert.ok(sim.inScene('jongno').length <= 2, `밤 인원 ${sim.inScene('jongno').length}`);
});

test('몹 보충: 보이는 장면에선 주인공에서 먼 출입구로 들어온다', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(5), [{ scene: 'street', target: { day: 1, night: 1 }, refill: [1, 1], gates: [30, 1890], mix: ['행인'] }]);
  sim.step(1 / 30, { scene: 'street', x: 100, hour: 12 });
  assert.equal(sim.actors[0].x, 1890);
});

test('관찰 창: 시각·씨앗·이 장면 인물·다른 장면 이름 인물', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(1));
  sim.add({ id: 'a', name: '잼트리', kind: 'named', brain: 'roam', home: 'office' });
  sim.add({ id: 'b', name: '에일린', kind: 'named', brain: 'roam', home: 'lounge' });
  const lines = O.observerLines(sim, new C.FieldClock(600), 'office', 99);
  assert.match(lines[0], /10:00.*99/);
  assert.ok(lines.some((l) => l.includes('잼트리')));
  assert.ok(lines.some((l) => l.includes('에일린') && l.includes('휴게실')));
});
