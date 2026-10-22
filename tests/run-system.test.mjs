import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({ stdin: { contents: `
export * from './src/game/action/stage/index.ts';
export { World as EngineWorld } from './src/game/action/engine/world.ts';
export { linkItems } from './src/game/action/engine/itemsLink.ts';
export { SessionStore } from './src/game/action/engine/sessionStore.ts';
export { memorySaves } from './src/game/action/hq/store.ts';
export { createEnemy } from './src/game/action/enemy/index.ts';
export { judgeMission, launch, settle, appraise } from './src/game/action/hq/logic.ts';
export { newSave } from './src/game/action/hq/state.ts';
export { emptyResult } from './src/game/action/hq/contract.ts';
export { MISSIONS } from './src/game/action/hq/data.ts';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', outfile: 'dist-test/run-system.mjs', loader: { '.css': 'text' }, logLevel: 'error' });
const S = await import('../dist-test/run-system.mjs');
const store = () => ({ value: null, load() { return this.value; }, save(v) { this.value = structuredClone(v); } });
const pad = { mx: 0, my: 0, evade: false, run: false, downDouble: false, held: new Set(), pressed: new Set(), released: new Set() };
function setup(seed = 42) {
  const meta = store(), stage = S.createElevatorStage(meta), run = { seed, agent: 'jyaldi', stageId: 'elevator' };
  const world = new S.EngineWorld(run, {}, stage);
  const items = S.linkItems(world, run);
  world.enterFloor(stage.firstFloor(run));
  return { meta, stage, run, world, items };
}
function clear(world) {
  for (let i = 0; i < 100; i++) {
    world.player.hp = world.player.hpMax;
    world.step(pad);
    for (const body of world.bodies) { if (body.team === 'enemy') { body.hp = 0; body.alive = false; world.emit({ type: 'enemyDie', kind: body.kind, x: body.x }); } }
    if (world.encIndex >= world.floor.encounters.length && world.encActive < 0) return;
  }
  assert.fail('전투가 끝나지 않음');
}
function travel(ctx, direction) {
  const { world, stage, run } = ctx;
  clear(world);
  const pl = world.floor.stage.floor.placed.find(p => p.data.dir === direction && ['wdoor', 'wup', 'wdown'].includes(p.kind));
  assert.ok(pl, `문 ${direction}`);
  stage.onInteract(world.api, world.floor, world.props.find(p => p.id === `p${pl.id}`));
  assert.equal(world.ended, 'next');
  world.enterFloor(stage.nextFloor(run, world.floor, 'next'));
}

test('모든 유형의 짧은 방 생성과 네 방향 진입 발판', () => {
  for (let seed = 1; seed <= 100; seed++) for (const [depth, type] of [[1,'lobby'],[4,'replica'],[7,'trial'],[9,'puzzle'],[15,'deep']]) {
    const w = S.makeWorld({ seed, depth, type, sub: type === 'replica' ? 'pretending' : null, epoch: 0 });
    assert.deepEqual(S.validateWorld(w), []);
    for (const rm of w.rooms) {
      const f = S.roomFloor(w, rm, { seed, danger: 0, growth: 0, flags: [], epoch: 0 });
      assert.ok(f.width > 0);
      for (const p of f.placed.filter(p => p.data.dir && ['wdoor','wup','wdown'].includes(p.kind))) {
        const x = p.x + (p.data.dir === 'l' ? 120 : p.data.dir === 'r' ? -120 : 70);
        assert.ok(!f.segments.flatMap(s => s.terrain).some(t => x > t.x0 && x < t.x1), `${seed}:${depth}:${rm.col},${rm.row} 진입점`);
      }
    }
  }
});

test('오른쪽 진입도 방 안 전투 → 전투 완료 → 왕복, 아이템 재생성 없음', () => {
  const c = setup(4242), { stage, world } = c;
  const w = stage.worldAt(1), a = S.roomAt(w, ...w.arrival);
  const d = S.DIRS.find(d => a.open[d] && !a.hidden[d] && !a.lock[d]);
  clear(world);
  const first = world.floor.id;
  const field = world.itemField; field.ents.length = 0;
  travel(c, d);
  for (const e of world.floor.encounters) assert.deepEqual([e.triggerX, e.lockFrom, e.lockTo], [0, 0, world.floor.length]);
  travel(c, S.OPP[d]);
  assert.equal(world.floor.id, first);
  assert.equal(world.itemField, field);
  assert.equal(world.itemField.ents.length, 0);
  assert.equal(world.floor.encounters.length, 0, '이긴 전투를 다시 생성하지 않음');
});

test('출동 저장 왕복: 지도·열쇠·강화·HP·탄약·소모품·RNG, 새 출동은 초기화', () => {
  const c = setup(77), { stage, world, items, run } = c;
  clear(world);
  stage.outing().wkeys.push('1:1'); stage.outing().upgrades.push('blood');
  world.player.hp = 93; world.player.reserve = 17; world.player.ward = 2;
  items.run.loadout[0].n = 1; items.run.cash = 321;
  world.itemField.ents.length = 0;
  const saved = { stage: stage.snapshot(), world: world.snapshot() }, map = stage.mapView();
  const expectedRandom = world.rand();
  const restored = S.createElevatorStage(c.meta), w2 = new S.EngineWorld(run, {}, restored), i2 = S.linkItems(w2, run);
  w2.enterFloor(restored.restore(saved.stage)); w2.restore(saved.world);
  assert.deepEqual(restored.mapView(), map);
  assert.equal(w2.floor.exitX, Infinity);
  assert.equal(typeof w2.floor.drawBackground, 'function');
  assert.equal(w2.player.hp, 93); assert.equal(w2.player.reserve, 17); assert.equal(w2.player.ward, 2);
  assert.equal(i2.run.loadout[0].n, 1); assert.equal(i2.run.cash, 321);
  assert.equal(w2.itemField.ents.length, 0); assert.equal(w2.rand(), expectedRandom);
  const outings = restored.meta().outings;
  restored.firstFloor({ ...run, seed: 78 });
  assert.deepEqual(restored.outing().upgrades, []); assert.deepEqual(restored.outing().wkeys, []);
  assert.equal(restored.meta().outings, outings + 1);
});

test('전투 중에는 저장 불가, 잠긴 가로 문 직접 E로도 우회 불가', () => {
  const c = setup(11), { stage, world, run } = c;
  const out = stage.outing();
  out.pending = { to: 'floor', depth: 3, type: 'lobby', sub: null };
  world.enterFloor(stage.nextFloor(run, world.floor, 'next'));
  const w = stage.worldAt(3);
  const rm = w.rooms.find(r => r.lock.l || r.lock.r);
  assert.ok(rm);
  out.pending = { to: 'floor', depth: 3, type: 'lobby', sub: null, room: [rm.col, rm.row], from: 'r' };
  world.enterFloor(stage.nextFloor(run, world.floor, 'next'));
  const p = world.player.x;
  world.step(pad);
  assert.ok(world.encActive >= 0);
  assert.equal(world.canCheckpoint(), false);
  assert.ok(Math.abs(world.player.x - p) < 200, '오른쪽 진입 때 왼쪽 구간으로 강제 이동하지 않음');
  clear(world);
  const dir = rm.lock.r ? 'r' : 'l', pl = world.floor.stage.floor.placed.find(p => p.kind === 'wdoor' && p.data.dir === dir);
  stage.onInteract(world.api, world.floor, world.props.find(p => p.id === `p${pl.id}`));
  assert.equal(world.ended, null);
  out.wkeys.push(`3:${rm.lock[dir]}`);
  stage.onInteract(world.api, world.floor, world.props.find(p => p.id === `p${pl.id}`));
  assert.equal(world.ended, 'next');
  assert.ok(out.unlocked.includes(S.edgeId(w, rm, dir)));
});

test('슬롯 저장: 기존 본부 이관·순서 보장·저널 복구·슬롯 격리·출동 종료', async () => {
  const disk = S.memorySaves(), memory = new Map();
  const journal = { getItem: k => memory.get(k) ?? null, setItem: (k,v) => memory.set(k,v) };
  const hq = JSON.stringify({ schema: 'goei-hq/1', day: 3 });
  await disk.write(0, hq, { title:'기존',summary:'',schema:'goei-hq/1' });
  const s = new S.SessionStore(disk, 0, journal); await s.ready;
  assert.equal(await s.hqSaves.read(0), hq);
  s.setMeta({ deepest: 7 });
  s.setCheckpoint({ version:1, run:{ seed:99,agent:'jyaldi',stageId:'elevator' }, stage:'stage',world:'world',savedAt:1 });
  await s.flush();
  const s2 = new S.SessionStore(disk,0,journal); await s2.ready;
  assert.equal(s2.checkpoint.run.seed,99); assert.equal(s2.meta.deepest,7);
  const other = new S.SessionStore(disk,1,journal); await other.ready; assert.equal(other.checkpoint,null);
  await s2.hqSaves.write(0,'settled',{title:'정산',summary:'',schema:'goei-hq/1'});
  s2.setCheckpoint(null); await s2.flush();
  const done = new S.SessionStore(disk,0,journal); await done.ready;
  assert.equal(done.checkpoint,null); assert.equal(await done.hqSaves.read(0),'settled');
  // 브리지 쓰기가 실패해도 닫기 전 저널의 더 최신 기록으로 복구한다.
  const failing = { ...disk, write: async () => { throw new Error('offline'); } };
  const off = new S.SessionStore(failing,0,journal); await off.ready;
  off.setCheckpoint({version:1,run:{seed:101,agent:'jyaldi'},stage:'s',world:'w',savedAt:2}); await off.flush();
  const recovered = new S.SessionStore(disk,0,journal); await recovered.ready; await recovered.flush();
  assert.equal(recovered.checkpoint.run.seed,101);
});

test('점검표: 가방 용량·한 번 획득·복원·거래 소비·종료 직전 감정값 보존', () => {
  const { stage, world, items, run, meta } = setup(42);
  const prop = world.props.find(p => p.kind === 'checklist');
  assert.ok(prop);
  items.run.bag.fill({ id:'photo', name:'사진', value:40, research:8 });
  stage.onInteract(world.api, world.floor, prop);
  assert.ok(world.props.some(p => p.id === prop.id), '가득 차면 점검표가 남음');
  assert.equal(world.recovery.has('checklist'), false);
  items.run.bag.fill(null);
  stage.onInteract(world.api, world.floor, prop);
  assert.equal(world.props.some(p => p.id === prop.id), false);
  assert.equal(items.run.bag.filter(b => b?.id === 'checklist').length, 1);
  assert.equal(stage.outing().items.includes('checklist'), false, '별도 배낭에 복제하지 않음');
  const st = stage.snapshot(), wt = world.snapshot();
  const s2 = S.createElevatorStage(meta), w2 = new S.EngineWorld(run, {}, s2), i2 = S.linkItems(w2, run);
  w2.enterFloor(s2.restore(st)); w2.restore(wt);
  assert.equal(w2.recovery.has('checklist'), true);
  assert.equal(w2.props.some(p => p.id === prop.id), false, '복원 뒤 재생성 안 함');
  // 프레임 tick 없이 즉시 귀환해도 마지막 가방을 정산한다.
  s2.outing().depth = 3;
  w2.emit({ type:'run:end', how:'return' });
  const r = { ...S.emptyResult('return'), depth:3, bag:w2.notes.bag, notes:w2.notes };
  const mission = S.MISSIONS.find(m => m.id === 'm7');
  assert.equal(S.judgeMission(mission, r), true);
  const hq = S.newSave(), l = S.launch(hq, 'm1', 42);
  S.settle(hq, l, { ...r, how:'withdraw' }, () => .9);
  S.appraise(hq);
  assert.equal(hq.currencies.research, 8, '감정 연구값이 1로 축소되지 않음');
  // 실제 인터폰의 두 번째 상호작용 → 거래 선택을 통해 동일 가방을 소비한다.
  const intercom = { id:'fixture-intercom', kind:'intercom', x:500, y:440, w:60, h:80 };
  s2.onInteract(w2.api, w2.floor, intercom);
  s2.onInteract(w2.api, w2.floor, intercom);
  const choice = w2.props.find(p => p.id === 'deal:reveal');
  assert.ok(choice);
  s2.onInteract(w2.api, w2.floor, choice);
  assert.equal(i2.run.bag.some(b => b?.id === 'checklist'), false);
  w2.emit({ type:'run:end', how:'return' });
  assert.equal(S.judgeMission(mission, { ...r, bag:w2.notes.bag }), false);
  assert.equal(r.bag[0].id, 'checklist', '이전 결과는 가방과 참조를 공유하지 않음');
});

test('노부부: 실제 두 개체를 모두 처치해야 방 정리·진압, 규칙 통과는 별도', () => {
  function guardianRoom() {
    const c = setup(4), { stage, world, run } = c;
    stage.outing().pending = { to:'floor', depth:5, type:'replica', sub:'pretending' };
    world.enterFloor(stage.nextFloor(run, world.floor, 'next'));
    const room = stage.worldAt(5).rooms.find(r => r.guardian);
    assert.ok(room);
    stage.outing().pending = { to:'floor', depth:5, type:'replica', sub:'pretending', room:[room.col, room.row] };
    world.enterFloor(stage.nextFloor(run, world.floor, 'next'));
    assert.ok(world.floor.stage.floor.spawns.some(s => s.kind === 'elder'));
    // 일반 전투 완료 상태에서 수호자 조건만 검증한다.
    world.floor.encounters.forEach((_, index) => world.emit({ type:'combat:clear', index }));
    const cleared = () => stage.mapView().worlds.find(w => w.depth === 5).rooms.find(r => r.col === room.col && r.row === room.row).clear;
    return { ...c, cleared };
  }
  const { world, cleared } = guardianRoom();
  const mission = S.MISSIONS.find(m => m.id === 'm6');
  const result = () => ({ ...S.emptyResult('return'), depth:5, notes:world.notes });
  const a = S.createEnemy('elder', 600, 500, () => .9);
  const b = S.createEnemy('elder_m', 700, 500, () => .9);
  a.die(world);
  assert.equal(cleared(), false);
  assert.equal(S.judgeMission(mission, result()), false);
  b.die(world);
  assert.equal(cleared(), true);
  assert.equal(S.judgeMission(mission, result()), true);
  const peace = guardianRoom();
  peace.world.emit({ type:'custom', name:'guardianCleared', data:{kind:'elder', how:'rule'} });
  assert.equal(peace.cleared(), true);
  assert.equal(S.judgeMission(mission, { ...S.emptyResult('return'), depth:5, notes:peace.world.notes }), false);
});

test('시험 실패 후 실제 감독관(proctor) 처치로 방을 정리할 수 있다', () => {
  const { stage, world, run } = setup(4);
  stage.outing().pending = { to:'floor', depth:6, type:'trial', sub:null };
  world.enterFloor(stage.nextFloor(run, world.floor, 'next'));
  world.floor.encounters.forEach((_, index) => world.emit({ type:'combat:clear', index }));
  const goal = world.props.find(p => p.kind === 'goalwall');
  assert.ok(goal);
  stage.onInteract(world.api, world.floor, goal);
  world.enemyFactory = (spec, w) => S.createEnemy(spec.kind, spec.x, spec.y, () => w.rand());
  for (let i=0; i<20000 && world.notes['stage.trial'] !== 'fail'; i++) stage.tick(world.api, world.floor);
  assert.equal(world.notes['stage.trial'], 'fail');
  const proctor = world.bodies.find(b => b.kind === 'proctor');
  assert.ok(proctor, '계획 conductor가 실제 proctor로 생성됨');
  const clearNow = () => {
    const [col,row] = stage.outing().room;
    return stage.mapView().worlds.find(w => w.depth === 6).rooms.find(r => r.col === col && r.row === row).clear;
  };
  assert.equal(clearNow(), false);
  proctor.die(world);
  assert.equal(clearNow(), true);
  assert.equal(world.notes['stage.trial'], 'fail', '진행은 열려도 시험 성공 보상은 주지 않음');
});
