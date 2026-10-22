// 임무 확인/최심 도달/수호자 선택 보상의 모듈 경계 회귀. 생성·브라우저·공용 빌드 산출물 없음.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  stdin: { contents: `export * as S from './src/game/action/stage/index.ts';
    export { judgeMission } from './src/game/action/hq/logic.ts';
    export { MISSION_BY_ID } from './src/game/action/hq/data.ts';
    export { emptyResult } from './src/game/action/hq/contract.ts';
    export { DemoEngine } from './src/game/action/stage/testing/harness.ts';
    export { World } from './src/game/action/engine/world.ts';
    export { createEnemy, isThreat } from './src/game/action/enemy/index.ts';`, resolveDir: root },
  bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', logLevel: 'error',
});
const { S, judgeMission, MISSION_BY_ID, emptyResult, DemoEngine, World, createEnemy, isThreat } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`,
);

function setup(seed = 1, meta = S.newMeta(), hooks = {}) {
  const stage = S.createElevatorStage({ load: () => meta, save() {} }, hooks);
  const run = { seed, agent: 'jyaldi' };
  let plan = stage.firstFloor(run);
  const engine = new DemoEngine({ ...stage, firstFloor: () => plan }, run);
  engine.start();
  return { stage, engine, get plan() { return plan; },
    go(depth, type = 'lobby', sub = null, room) {
      stage.outing().pending = { to: 'floor', depth, type, sub, room };
      plan = stage.nextFloor(run, plan, 'next');
      engine.load(plan);
    },
    interact(kind, label) {
      stage.onInteract(engine.api, plan, { id: `probe-${kind}`, kind, label, x: 300, y: 550, w: 40, h: 40 });
    },
    finish() {
      engine.emit({ type: 'run:end', how: 'return' });
      return { ...emptyResult('return'), depth: engine.notes.depth, notes: engine.notes };
    },
  };
}

function readTwoRules(t) {
  t.interact('mirror');
  t.interact('elevator', '타고 온 엘리베이터');
}

test('반복 m1: 이미 아는 두 규칙도 이번 출동에서 다시 확인하면 성공', () => {
  const first = setup();
  readTwoRules(first); first.go(2);
  assert.equal(judgeMission(MISSION_BY_ID.m1, first.finish()), true);
  const repeated = setup(2, first.stage.meta());
  readTwoRules(repeated); repeated.go(2);
  assert.equal(judgeMission(MISSION_BY_ID.m1, repeated.finish()), true);
  assert.equal(repeated.engine.events.filter(e => e.type === 'ruleFound').length, 0,
    '재확인을 신규 발견 이펙트/보상으로 중복 처리하지 않는다');
});

test('같은 규칙을 반복 읽거나 송신 뒤 다시 읽어도 출동 확인 실적은 한 줄', () => {
  const first = setup(); readTwoRules(first); first.finish();
  const t = setup(2, first.stage.meta());
  t.interact('mirror'); t.interact('mirror');
  assert.deepEqual(t.stage.outing().found, ['mirror']);
  S.sendFound(t.stage.meta(), t.stage.outing());
  t.interact('mirror');
  assert.deepEqual(t.stage.outing().found, []);
  assert.deepEqual(t.stage.outing().sent, ['mirror']);
  t.go(2);
  assert.equal(judgeMission(MISSION_BY_ID.m1, t.finish()), false);
});

test('규칙을 알고 있어도 이번 출동에서 확인하지 않으면 임무 실적이 아니다', () => {
  const first = setup(); readTwoRules(first); first.finish();
  const t = setup(2, first.stage.meta()); t.go(2);
  assert.equal(judgeMission(MISSION_BY_ID.m1, t.finish()), false);
});

test('B-5 도달 후 B-4로 되돌아가 귀환해도 이번 출동의 최심 기록은 B-5', () => {
  const t = setup(); t.go(8, 'replica', 'pretending'); t.go(7, 'replica', 'pretending');
  const r = t.finish();
  assert.equal(t.stage.outing().depth, 7, '현재 위치를 최심 깊이로 덮어쓰지 않는다');
  assert.equal(r.depth, 8);
  assert.equal(judgeMission(MISSION_BY_ID.m9, r), true);
});

test('이전 출동의 영구 최심 기록으로 새 출동 기록 임무를 성공시키지 않는다', () => {
  const meta = S.newMeta(); meta.deepest = 15;
  const t = setup(1, meta); t.go(2);
  const r = t.finish();
  assert.equal(r.depth, 2);
  assert.equal(judgeMission(MISSION_BY_ID.m9, r), false);
});

function elderRoom() {
  const offers = [];
  const t = setup(4, S.newMeta(), { pickUpgrade: (view, done) => { offers.push({ view, done }); return true; } });
  t.go(5, 'replica', 'pretending');
  const w = t.stage.worldAt(5);
  const rm = w.rooms.find(r => S.roomFloor(w, r, { seed: 4, danger: 0, growth: 0, flags: [], epoch: 0 })
    .spawns.some(s => s.role === 'guardian' && s.kind === 'elder'));
  assert.ok(rm, '노부부 동적 소환 방이 있는 고정 씨앗');
  t.go(5, 'replica', 'pretending', [rm.col, rm.row]);
  assert.equal(t.plan.encounters.flatMap(e => e.waves.flat()).some(s => s.boss), false);
  return { ...t, offers };
}

test('동적 노부부 두 명을 처치하면 기존 강화 선택을 한 번 제공', () => {
  const t = elderRoom();
  t.engine.emit({ type: 'enemyDie', kind: 'elder_f', x: 700 });
  assert.equal(t.offers.length, 0, '한 명만 죽이면 수호자 처치 완료가 아니다');
  t.engine.emit({ type: 'enemyDie', kind: 'elder_m', x: 700 });
  assert.equal(t.engine.notes['stage.elderDefeated'], true);
  assert.equal(t.offers.length, 1);
  assert.equal(t.offers[0].view.options.length, 3);
  t.engine.emit({ type: 'enemyDie', kind: 'elder_m', x: 700 });
  t.engine.emit({ type: 'custom', name: 'guardianCleared', data: { kind: 'elder', how: 'kill' } });
  assert.equal(t.offers.length, 1, '중복 처치/완료 이벤트로 보상을 복제하지 않는다');
  assert.equal(t.stage.outing().fightsWon, 0, '일반 전투 세 판 보상 횟수와 별개');
  const picked = t.offers[0].view.options[0].id;
  t.offers[0].done(0);
  t.stage.tick(t.engine.api, t.engine.plan);
  assert.deepEqual(t.stage.outing().upgrades, [picked], '기존 선택 콜백이 실제 출동 강화에 반영된다');
});

test('노부부 평화 통과/버티기는 처치 강화나 진압 실적을 지급하지 않는다', () => {
  const t = elderRoom();
  for (const how of ['rule', 'endure']) t.engine.emit({ type: 'custom', name: 'guardianCleared', data: { kind: 'elder', how } });
  assert.equal(t.offers.length, 0);
  assert.notEqual(t.engine.notes['stage.elderDefeated'], true);
});

test('노부부 처치 선택 보상은 같은 방 재방문에도 한 번만', () => {
  const t = elderRoom();
  const room = [...t.stage.outing().room];
  for (const kind of ['elder_f', 'elder_m']) t.engine.emit({ type: 'enemyDie', kind, x: 700 });
  t.go(4, 'lobby'); t.go(5, 'replica', 'pretending', room);
  for (const kind of ['elder_f', 'elder_m']) t.engine.emit({ type: 'enemyDie', kind, x: 700 });
  assert.equal(t.offers.length, 1);
});

test('기존 encounter 보스도 선택 보상은 한 번, 일반 세 판 보상은 별개', () => {
  const offers = [];
  const t = setup(1, S.newMeta(), { pickUpgrade: view => { offers.push(view); return true; } });
  t.go(3);
  const w = t.stage.worldAt(3);
  const rm = w.rooms.find(r => S.roomFloor(w, r, { seed: 1, danger: 0, growth: 0, flags: [], epoch: 0 })
    .spawns.some(s => s.role === 'guardian' && s.kind === 'guard'));
  assert.ok(rm);
  t.go(3, 'lobby', null, [rm.col, rm.row]);
  const bossIndex = t.plan.encounters.findIndex(e => e.waves.flat().some(s => s.boss));
  assert.notEqual(bossIndex, -1);
  t.engine.emit({ type: 'combat:clear', index: bossIndex });
  assert.equal(offers.length, 0, '전투 잠금 해제만으로 살아 있는 보스 처치 보상을 주지 않는다');
  t.engine.emit({ type: 'enemyDie', kind: 'guard', x: 700 });
  assert.equal(offers.length, 1);
  t.engine.emit({ type: 'combat:clear', index: bossIndex });
  assert.equal(offers.length, 1);
  assert.equal(t.stage.outing().fightsWon, 0);
  let ordinaryIndex = -1;
  for (const room of w.rooms) {
    if (room === rm) continue;
    t.go(3, 'lobby', null, [room.col, room.row]);
    ordinaryIndex = t.plan.encounters.findIndex(e => !e.waves.flat().some(s => s.boss));
    if (ordinaryIndex !== -1) break;
  }
  assert.notEqual(ordinaryIndex, -1);
  t.stage.outing().fightsWon = 2;
  t.engine.emit({ type: 'combat:clear', index: ordinaryIndex });
  assert.equal(offers.length, 2, '일반 전투 세 판째 강화는 수호자 보상과 별도로 남는다');
  assert.equal(t.stage.outing().fightsWon, 3);
});

test('실제 World 가족 ask 자동 combat:clear는 무보상, 양쪽 실제 처치 뒤 한 번 지급', () => {
  const offers = [], events = [];
  const stage = S.createElevatorStage({ load: () => null, save() {} }, {
    pickUpgrade: view => { offers.push(view); return true; },
  });
  const run = { agent: 'jyaldi', seed: 4, stageId: 'elevator' };
  const clips = JSON.parse(readFileSync(resolve(root, 'game-pack/jyaldi/frames.json'), 'utf8')).clips;
  const w = new World(run, clips, stage, (s, world) => createEnemy(s.kind, s.x, s.y, () => world.rand(), { elite: s.elite }));
  w.threat = isThreat;
  w.on(e => events.push(e));
  w.enterFloor(stage.firstFloor(run));
  stage.outing().pending = { to: 'floor', depth: 5, type: 'replica', sub: 'red' };
  w.enterFloor(stage.nextFloor(run, w.floor, 'next'));
  const room = stage.worldAt(5).rooms.find(r => r.guardian);
  assert.ok(room);
  stage.outing().pending = { to: 'floor', depth: 5, type: 'replica', sub: 'red', room: [room.col, room.row] };
  w.enterFloor(stage.nextFloor(run, w.floor, 'next'));
  const pad = { mx: 0, my: 0, run: false, evade: false, downDouble: false, held: new Set(), pressed: new Set(), released: new Set() };
  for (let i = 0; i < 100; i++) {
    w.player.invuln = 100; w.player.hp = w.player.hpMax;
    w.step(pad);
    for (const body of w.bodies) if (body.team === 'enemy' && !body.boss && body.hp > 0) body.die(w);
    if (w.encActive < 0 && w.encIndex >= w.floor.encounters.length) break;
  }
  const f = w.bodies.find(b => b.kind === 'family_f'), m = w.bodies.find(b => b.kind === 'family_m');
  assert.ok(f && m);
  assert.equal(f.mem.mode, 'ask'); assert.equal(m.mem.mode, 'ask');
  assert.ok(f.hp > 0 && m.hp > 0 && !isThreat(f) && !isThreat(m));
  assert.ok(events.some(e => e.type === 'combat:clear'), '실제 World가 자동 전투 완료 이벤트를 발생시킴');
  assert.equal(offers.length, 0);
  f.die(w); assert.equal(offers.length, 0);
  m.die(w); assert.equal(offers.length, 1);
  w.step(pad); assert.equal(offers.length, 1);
});

test('시험 감독관 conductor/proctor 별칭도 실제 개체 처치로 한 번 강화 지급', () => {
  const offers = [];
  const t = setup(4, S.newMeta(), { pickUpgrade: view => { offers.push(view); return true; } });
  t.go(6, 'trial');
  const w = t.stage.worldAt(6);
  const rm = w.rooms.find(r => S.roomFloor(w, r, { seed: 4, danger: 0, growth: 0, flags: [], epoch: 0 })
    .spawns.some(s => s.role === 'guardian' && s.kind === 'conductor'));
  assert.ok(rm);
  t.go(6, 'trial', null, [rm.col, rm.row]);
  t.engine.emit({ type: 'enemyDie', kind: 'resident', x: 700 });
  assert.equal(offers.length, 0);
  t.engine.emit({ type: 'enemyDie', kind: 'proctor', x: 700 });
  assert.equal(offers.length, 1);
  t.engine.emit({ type: 'enemyDie', kind: 'proctor', x: 700 });
  assert.equal(offers.length, 1);
});
