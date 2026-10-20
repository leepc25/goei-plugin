// 회색 상자 시험판 순수 시뮬레이션 시험. npm run build 뒤 실행.
import test from 'node:test';
import assert from 'node:assert/strict';
const sim = await import('../dist-test/graybox-sim.mjs');
const gen = sim;
const { newMeta, newRun, deploy, step, enterFloor, settle, serialize, restore } = sim;
const idle = { x: 0, y: 0 };
const tick = (run, meta, input = idle, n = 1) => {
  for (let i = 0; i < n; i++) step(run, input, meta);
};
test('조각 생성: 100 씨앗 × 유형 전부가 검증을 통과하고 끝까지 길이 있다', async () => {
  const g = await import('../dist-test/graybox-sim.mjs');
  const types = ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle'];
  let fallbacks = 0;
  for (let seed = 1; seed <= 100; seed++)
    for (const [i, t] of types.entries()) {
      const meta = newMeta();
      const run = newRun(meta, 'jyaldi', 'm1', seed);
      const depth = t === 'lobby' ? 1 + (seed % 3) : 4 + i + (seed % 5);
      enterFloor(run, depth, t);
      const f = run.floor;
      assert.equal(f.chunks[0].kind, 'hall_start');
      assert.equal(f.chunks.at(-1).kind, 'hall_end');
      assert.ok(f.props.some((p) => p.kind === 'servicedoor' || p.kind === 'hatch'), '정비 구역 입구');
      assert.ok(f.width >= 640 * 3);
      if (depth >= 3) assert.ok(run.ents.some((e) => e.guardian), `수호자 ${t} ${depth}`);
      if (t !== 'lobby') assert.ok(f.props.some((p) => p.kind === 'sign' && !p.data.startsWith('map')), '규칙 장치');
      assert.ok(run.ents.filter((e) => e.wave === 0 && !e.guardian).length <= 8 * f.chunks.length, '화면 상한');
      if (f.fallback) fallbacks++;
    }
  assert.ok(fallbacks < 20, `고정 배치 폴백이 너무 많음: ${fallbacks}`);
  void g;
});
test('예산: 깊이가 깊을수록 적 총 가격이 오른다', () => {
  const total = (depth) => {
    const meta = newMeta();
    const run = newRun(meta, 'jyaldi', 'm1', 7);
    enterFloor(run, depth, 'trial');
    return run.ents.filter((e) => !e.guardian).reduce((s, e) => s + e.max + (e.elite ? 100 : 0), 0) / run.floor.chunks.length;
  };
  assert.ok(total(12) > total(6), '깊이 12가 6보다 세다');
  assert.ok(total(6) > total(4), '깊이 6이 4보다 세다');
});
test('같은 씨앗이면 같은 층', () => {
  const a = newRun(newMeta(), 'jyaldi', 'm1', 99);
  const b = newRun(newMeta(), 'jyaldi', 'm1', 99);
  enterFloor(a, 5, 'replica');
  enterFloor(b, 5, 'replica');
  assert.deepEqual(a.floor.chunks.map((c) => c.kind), b.floor.chunks.map((c) => c.kind));
  assert.deepEqual(a.floor.spawns, b.floor.spawns);
});
test('본부 → 브리핑 → 출동 → 걷기·근접·표지 읽기 → 정비 구역 → 로프 귀환 → 정산', () => {
  const meta = newMeta();
  const run = newRun(meta, 'jyaldi', 'm1', 3);
  tick(run, meta, { x: 0, y: 0, interact: true });
  assert.equal(run.phase, 'brief');
  tick(run, meta, { x: 0, y: 0, choice: 0 });
  assert.equal(run.phase, 'floor');
  assert.equal(run.depth, 1);
  const x0 = run.player.x;
  tick(run, meta, { x: 1, y: 0 }, 30);
  assert.ok(run.player.x > x0 + 150, '걷기');
  tick(run, meta, { x: 1, y: 0, run: true }, 30);
  assert.ok(run.player.x > x0 + 500, '달리기');
  // 적을 하나 끌어와서 때린다
  const e = run.ents.find((x) => x.alive && !x.guardian);
  if (e) {
    e.x = run.player.x + 70;
    e.y = run.player.y;
    e.hostile = true;
    e.state = 'approach';
    const hp = e.hp;
    tick(run, meta, { x: 0, y: 0, attack: true });
    tick(run, meta, idle, 12);
    assert.ok(e.hp < hp, '근접 피해');
  }
  // 표지 읽기
  const sign = run.floor.props.find((p) => p.kind === 'sign');
  run.player.x = sign.x + 20;
  run.player.y = 580;
  tick(run, meta, { x: 0, y: 0, interact: true });
  assert.ok(run.found.length >= 1 || sign.used, '규칙 발견');
  // 정비 구역
  const door = run.floor.props.find((p) => p.kind === 'servicedoor') ?? run.floor.props.find((p) => p.kind === 'hatch');
  run.player.x = door.x + 30;
  run.player.z = door.kind === 'hatch' ? 150 : 0;
  run.player.down = run.player.stun = run.player.t = 0;
  tick(run, meta, { x: 0, y: 0, interact: true });
  assert.equal(run.phase, 'service');
  const rope = run.service.props.find((p) => p.kind === 'rope');
  run.player.x = rope.x + 20;
  run.player.y = 600;
  tick(run, meta, idle, 2);
  assert.ok(run.atticHealed, '다락방 회복');
  tick(run, meta, { x: 0, y: 0, interact: true });
  assert.ok(run.dialog && run.dialog.tag === 'rope');
  tick(run, meta, { x: 0, y: 0, choice: 0 });
  assert.equal(run.phase, 'settle');
  assert.equal(run.ended, 'return');
  const lines = settle(run, meta);
  assert.ok(lines.length >= 4);
  assert.ok(meta.runs === 1);
  const text = serialize(run, meta);
  assert.ok(restore(text), '저장 복원');
});
test('승강기: 인사하면 총애가 오를 수 있고, 연타하면 내린다. 버튼으로 다음 층', () => {
  const meta = newMeta();
  const run = newRun(meta, 'eileen', 'm1', 11);
  deploy(run, meta);
  for (const e of run.ents) (e.alive = false), (e.state = 'dead');
  const panel = run.floor.props.find((p) => p.kind === 'panel' && p.data === 'end');
  run.player.x = panel.x + 20;
  tick(run, meta, { x: 0, y: 0, interact: true });
  assert.ok(run.elevator, '패널');
  const fav = run.favor;
  tick(run, meta, { x: 0, y: 0, choice: 0 }); // 인사
  assert.ok(run.favor >= fav);
  assert.ok(run.found.includes('greet'));
  tick(run, meta, { x: 0, y: 0, choice: 0 }); // 닫힘 연타 (인사 뒤 첫 항목)
  assert.ok(run.favor <= fav, '연타 -1');
  if (run.elevator) {
    const n = run.elevator.buttons.length;
    tick(run, meta, { x: 0, y: 0, choice: 1 });
    assert.ok(run.depth === 2 || n === 0, '다음 층');
  }
});
test('후송: 체력 0이면 정산이 후송이고 현금은 0, 미송신 규칙은 절반', () => {
  const meta = newMeta();
  const run = newRun(meta, 'jyaldi', 'm1', 5);
  deploy(run, meta);
  run.found.push('greet', 'close', 'mirror', 'lobby');
  run.loot.cash = 100;
  run.player.hp = 1;
  const e = run.ents.find((x) => x.alive);
  e.x = run.player.x + 40;
  e.y = run.player.y;
  e.hostile = true;
  e.state = 'attack';
  e.timer = 0.1;
  e.dir = -1;
  tick(run, meta, idle, 5);
  assert.equal(run.ended, 'evac');
  const lines = settle(run, meta);
  assert.ok(lines[0].includes('후송'));
  assert.equal(meta.currencies.cash, 0);
  assert.equal(meta.rulebook.length, 2);
});
test('추격의 층: 뒤의 것이 다가오고 문을 닫으면 느려진다', () => {
  const meta = newMeta();
  const run = newRun(meta, 'jyaldi', 'm1', 21);
  deploy(run, meta);
  enterFloor(run, 4, 'chase');
  const c0 = run.chaserX;
  tick(run, meta, idle, 30);
  assert.ok(run.chaserX > c0 + 100);
  const d = run.floor.props.find((p) => p.kind === 'door' && p.data === 'chase');
  if (d) {
    run.player.x = d.x + 10;
    tick(run, meta, { x: 0, y: 0, interact: true });
    assert.ok(run.chaserSlow > 0);
  }
});
test('재현의 층: 인사 없이 다가가면 주민이 적대, 인사하면 지나간다', () => {
  const meta = newMeta();
  const run = newRun(meta, 'jyaldi', 'm1', 31);
  deploy(run, meta);
  enterFloor(run, 5, 'replica');
  const res = run.ents.filter((e) => e.special === 'rule');
  assert.ok(res.length >= 1);
  const r = res[0];
  run.player.x = r.x - 100;
  run.player.y = r.y;
  tick(run, meta, { x: 0, y: 0, interact: true });
  assert.equal(r.hostile, false);
  assert.ok(run.found.includes('r_greet'));
  if (res[1]) {
    const r2 = res[1];
    run.player.x = r2.x - 100;
    run.player.y = r2.y;
    tick(run, meta, idle, 45);
    assert.equal(r2.hostile, true, '1.2초 뒤 적대');
  }
});
