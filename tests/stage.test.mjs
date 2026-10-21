// 차원 승강기 층 생성 시험. 스스로 묶어서 돌린다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('dist-test', { recursive: true });
await build({ entryPoints: ['src/game/action/stage/index.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/stage.mjs', loader: { '.css': 'text' }, logLevel: 'error' });
await build({ entryPoints: ['src/game/action/stage/testing/harness.ts'], bundle: true, format: 'esm', target: 'es2022', outfile: 'dist-test/stage-engine.mjs', logLevel: 'error' });
const S = await import('../dist-test/stage.mjs');
const { DemoEngine } = await import('../dist-test/stage-engine.mjs');

const TYPES = ['lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'deep'];
const ctxFor = (seed, depth, type, extra = {}) => ({ seed, depth, type, sub: type === 'replica' ? ['vacant', 'pretending', 'red'][seed % 3] : null, danger: seed % 3, growth: seed % 5, flags: [], epoch: 0, ...extra });

test('층 생성: 300 씨앗 × 유형 전부 검증 통과, 고정 배치는 드물다', () => {
  let fallback = 0,
    n = 0;
  for (let seed = 1; seed <= 300; seed++)
    for (const type of TYPES) {
      const depth = type === 'lobby' ? 1 + (seed % 3) : type === 'deep' ? 15 : 4 + (seed % 20);
      const f = S.makeFloor(ctxFor(seed, depth, type));
      n++;
      assert.deepEqual(S.validateFloor(f), [], `${type} ${depth} ${seed}`);
      if (f.fallback) fallback++;
      assert.ok(f.segments.filter((s) => s.ref.startsWith('chunk:')).length >= 4, '조각 4개 이상');
      for (const s of f.segments.filter((s) => s.ref.startsWith('chunk:'))) assert.equal(s.w, 640, '조각 = 반 화면');
      if (type === 'lobby' && depth === 3) assert.ok(f.guardian, 'L3 수호자');
      if (type === 'trial') assert.ok(f.goal && f.placed.some((p) => p.kind === 'goalwall'));
      if (type === 'puzzle') assert.ok(f.placed.filter((p) => p.kind === 'shutter').length >= 2);
    }
  assert.ok(fallback / n < 0.03, `고정 배치 ${fallback}/${n}`);
});

test('같은 씨앗이면 같은 층, 다른 씨앗이면 다른 층', () => {
  const a = S.makeFloor(ctxFor(42, 6, 'chase'));
  const b = S.makeFloor(ctxFor(42, 6, 'chase'));
  const c = S.makeFloor(ctxFor(43, 6, 'chase'));
  assert.deepEqual(a.segments.map((s) => s.ref), b.segments.map((s) => s.ref));
  assert.deepEqual(a.spawns, b.spawns);
  assert.notDeepEqual(a.segments.map((s) => s.ref + s.flip), c.segments.map((s) => s.ref + s.flip));
});

test('끝없는 깊이: 깊을수록 위협 예산이 오르고 조각이 늘어난다', () => {
  const avg = (depth, key) => {
    let s = 0;
    for (let seed = 1; seed <= 40; seed++) s += key(S.makeFloor(ctxFor(seed, depth, 'trial')));
    return s / 40;
  };
  assert.ok(avg(30, (f) => f.budget) > avg(10, (f) => f.budget));
  assert.ok(avg(10, (f) => f.budget) > avg(5, (f) => f.budget));
  assert.ok(avg(40, (f) => f.segments.length) > avg(5, (f) => f.segments.length));
  const deep = S.makeFloor(ctxFor(1, 200, 'silent'));
  assert.deepEqual(S.validateFloor(deep), []);
  assert.equal(S.depthLabel(200), 'B-197');
});

test('유형 뽑기: 로비 L1~L3, B-12는 완전한 어둠, 직전 3층과 다른 유형', () => {
  assert.equal(S.pickType(2, [], 1, 0), 'lobby');
  assert.equal(S.pickType(15, [], 1, 0), 'deep');
  for (let seed = 1; seed < 200; seed++) {
    const last = ['chase', 'replica', 'dark'];
    const t = S.pickType(8, last, seed, seed % 3);
    assert.ok(!last.includes(t), t);
  }
  // 재편(epoch)이 바뀌면 배치가 섞인다
  const seq = (epoch) => Array.from({ length: 20 }, (_, i) => S.pickType(5 + i, [], 7, epoch)).join();
  assert.notEqual(seq(0), seq(1));
});

test('정비 구역: 다락방·로프 1개, 모든 칸 도달, 다시 짜여도 다락방·입구·아래 점검문은 그대로', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const depth = 1 + (seed % 20);
    const a = S.makeService({ seed, depth, reroll: 0, flags: [], epoch: 0 });
    assert.deepEqual(S.validateService(a), [], `seed ${seed}`);
    const b = S.makeService({ seed, depth, reroll: 3, flags: [], epoch: 0 });
    assert.deepEqual(S.validateService(b), []);
    assert.deepEqual(a.atticCell, b.atticCell);
    assert.deepEqual(a.entryCell, b.entryCell);
    assert.deepEqual(a.downCell, b.downCell);
    assert.equal(a.predatorAfter, 90);
  }
  const x = S.makeService({ seed: 5, depth: 6, reroll: 0, flags: [], epoch: 0 });
  const y = S.makeService({ seed: 5, depth: 6, reroll: 1, flags: [], epoch: 0 });
  assert.notDeepEqual(x.cells.map((c) => c.kind + JSON.stringify(c.open)), y.cells.map((c) => c.kind + JSON.stringify(c.open)), '다시 짜임');
  assert.equal(S.makeService({ seed: 5, depth: 6, reroll: 0, flags: ['attic_short'], epoch: 0 }).predatorAfter, 60);
});

test('승강기: 총애에 따라 버튼 1~3개, 2 이상이면 유형이 보이고 EXIT는 조건 충족 때만', () => {
  const base = { seed: 3, depth: 5, epoch: 0, last: [], reveal: false, deepest: 5, exitOpen: false };
  assert.equal(S.elevatorButtons({ ...base, favor: -3 }).length, 1);
  assert.equal(S.elevatorButtons({ ...base, favor: 0 }).length, 2);
  const hi = S.elevatorButtons({ ...base, favor: 3 });
  assert.equal(hi.length, 3);
  assert.ok(hi.every((b) => b.shown));
  assert.equal(new Set(hi.map((b) => b.type)).size, 3, '유형이 겹치지 않음');
  const lobby = S.elevatorButtons({ ...base, depth: 1, favor: 0, deepest: 9, exitOpen: true });
  assert.ok(lobby.some((b) => b.exit));
  assert.ok(lobby.some((b) => b.remembered && b.depth === 8), '승강기 버튼 기억');
});

test('EXIT → 재편: 규칙 3줄 문장이 바뀌어 취소선, 총애 0, epoch +1', () => {
  const m = S.newMeta();
  for (const r of S.RULES) m.known[r.id] = 0;
  m.favor = 3;
  m.deepest = 15;
  assert.ok(S.exitOpen(m));
  const changed = S.reshuffle(m);
  assert.equal(changed.length, 3);
  assert.equal(m.favor, 0);
  assert.equal(m.epoch, 1);
  const book = S.rulebook(m);
  assert.equal(book.filter((b) => b.stale).length, 3);
  assert.equal(S.currentKnown(m).length, S.RULES.length - 3);
});

test('출동마다 1~2줄이 뒤집힌다 (변형)', () => {
  const m = S.newMeta();
  const seen = new Set();
  for (let seed = 1; seed < 60; seed++) {
    const o = S.newOuting(m, { seed, agent: 'jyaldi' });
    assert.ok(o.variants.length >= 1 && o.variants.length <= 2);
    o.flags.forEach((f) => seen.add(f));
  }
  assert.ok(seen.size >= 8, `변형 종류 ${seen.size}`);
  // 변형이 실제 수치를 바꾼다
  const fast = S.makeFloor(ctxFor(9, 7, 'chase', { flags: ['chase_fast'] }));
  const slow = S.makeFloor(ctxFor(9, 7, 'chase'));
  assert.ok(fast.tuning.chaseSpeed > slow.tuning.chaseSpeed);
});

// ── 걸어서 끝까지: 대역 엔진 + 자동 조작으로 로비 → 지하 여러 층 → 정비 구역 → 다락방 로프 귀환
function bot(eng) {
  const p = eng.p;
  const plan = eng.plan;
  const st = plan.stage;
  const k = { x: 0, y: 0, run: false, jump: false, attack: false, interact: false, crouch: false };
  p.hp = p.hpMax; // 통과 시험이지 균형 시험이 아니다
  const near = eng.nearestProp();
  const enemies = eng.enemies.filter((e) => e.alive && e.max < 9000);
  const want = bot.want;
  if (enemies.some((e) => Math.abs(e.x - p.x) < 140)) {
    const e = enemies.find((e) => Math.abs(e.x - p.x) < 140);
    k.x = Math.sign(e.x - p.x) || 1;
    if (Math.abs(e.x - p.x) < 100) (k.x = 0), (p.dir = e.x > p.x ? 1 : -1);
    k.y = Math.sign(e.y - p.y);
    k.attack = eng.tick % 3 === 0;
    return k;
  }
  if (eng.encActive >= 0 && enemies.length) {
    const e = enemies[0];
    k.x = Math.sign(e.x - p.x);
    k.y = Math.sign(e.y - p.y);
    return k;
  }
  // 목표 소품
  const goal = want(eng);
  if (goal) {
    const dx = goal.x - p.x;
    if (Math.abs(dx) < 40 && near && near.id === goal.id) {
      k.interact = eng.tick % 2 === 0;
      k.crouch = true;
      return k;
    }
    k.x = Math.sign(dx);
  } else k.x = 1;
  // 지형
  const ahead = p.x + k.x * 70;
  let lo = 0,
    hi = 160;
  for (const t of st.terrain) {
    const hit = Math.min(p.x, ahead) < t.x1 && Math.max(p.x, ahead) > t.x0;
    if (!hit) continue;
    if ((t.kind === 'pit' || t.kind === 'block') && !p.airborne) k.jump = true;
    if (t.kind === 'low') k.crouch = true;
    if (t.kind === 'narrow') (lo = Math.max(lo, t.lane0)), (hi = Math.min(hi, t.lane1));
    if (t.kind === 'redfloor') k.y = p.y > 565 ? -1 : 1;
  }
  if (lo > 0 || hi < 160) {
    const ty = 440 + ((lo + hi) / 2 / 160) * 250;
    if (Math.abs(ty - p.y) > 4) k.y = Math.sign(ty - p.y);
  }
  if (k.crouch) k.jump = false;
  return k;
}

test('걸어서 확인: 로비 L1부터 승강기·지하 층·정비 구역·다락방 로프 귀환까지 막힘 없이', () => {
  const metaStore = { m: null, load() { return this.m; }, save(m) { this.m = JSON.parse(JSON.stringify(m)); } };
  const stage = S.createElevatorStage(metaStore);
  for (const seed of Array.from({ length: 25 }, (_, i) => 11 + i * 37)) {
    const eng = new DemoEngine(stage, { seed, agent: 'jyaldi' });
    eng.start();
    const seenTypes = new Set();
    let mode = 'down'; // 지하 6층까지 내려간 뒤 정비 구역으로
    let presses = 0;
    bot.want = (e) => {
      const plan = e.plan;
      const st = plan.stage;
      const out = stage.outing();
      const props = e.props;
      const f = st.floor;
      if (st.where === 'car') return props.find((p) => p.id === (presses++ % 5 === 0 ? 'greet' : 'btn0')) ?? props.find((p) => p.id === 'btn0');
      if (st.where === 'service') {
        const z = out.service;
        const target = z.atticCell;
        const [c, r] = out.cell;
        if (c === target[0] && r === target[1]) return props.find((p) => p.kind === 'rope');
        // 칸 길찾기
        const prev = new Map([[`${c},${r}`, null]]);
        const q = [[c, r]];
        while (q.length) {
          const [x, y] = q.shift();
          const cell = z.cells[y * z.cols + x];
          for (const [dx, dy, o] of [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']])
            if (cell.open[o] && !prev.has(`${x + dx},${y + dy}`)) prev.set(`${x + dx},${y + dy}`, `${x},${y}`), q.push([x + dx, y + dy]);
        }
        let cur = `${target[0]},${target[1]}`;
        while (prev.get(cur) !== `${c},${r}`) cur = prev.get(cur);
        const [nx, ny] = cur.split(',').map(Number);
        const kind = nx > c ? 'right' : nx < c ? 'left' : ny > r ? 'ladder_down' : 'ladder_up';
        return props.find((p) => p.kind === kind);
      }
      if (!f) return props.find((p) => p.kind === 'van');
      seenTypes.add(f.type);
      // 퍼즐: 정답 문 / 순서대로 스위치
      for (const sh of f.placed.filter((x) => x.kind === 'shutter')) {
        const open = !e.props.find((p) => p.id === `p${sh.id}`)?.solid;
        if (open || e.p.x > sh.x) continue;
        if (sh.data.fork !== undefined) {
          const d = f.placed.find((x) => x.kind === 'door' && x.data.fork === sh.data.fork && x.data.correct);
          return props.find((p) => p.id === `p${d.id}`);
        }
        const order = String(sh.data.order).split('-').map(Number);
        const done = (bot.seq ??= {});
        const key = e.run.seed + e.plan.id + sh.id;
        const n = (done[key] ??= 0);
        const sw = f.placed.find((x) => x.kind === 'switch' && x.data.group === sh.data.group && x.data.n === order[n]);
        if (!sw) throw new Error(`스위치 ${order} n=${n} says=${e.says.map((x) => x.text)} ev=${JSON.stringify(e.events.slice(-5))}`);
        const pr = props.find((p) => p.id === `p${sw.id}`);
        if (pr && Math.abs(pr.x - e.p.x) < 40 && e.tick % 2 === 0 && e.nearestProp()?.id === pr.id) done[key] = n + 1;
        return pr;
      }
      // 재현: 주민에게 인사, 밥상
      const npc = props.find((p) => p.kind === 'npc' && p.x > e.p.x - 30 && !(bot.greeted ??= new Set()).has(p.id + e.plan.id + e.run.seed) && f.type === 'replica');
      if (npc) {
        if (Math.abs(npc.x - e.p.x) < 40) bot.greeted.add(npc.id + e.plan.id + e.run.seed);
        return npc;
      }
      const sign = props.find((p) => p.kind === 'sign' && p.x > e.p.x - 30 && p.x < e.p.x + 400 && !(bot.read ??= new Set()).has(p.id + e.plan.id + e.run.seed));
      if (sign) {
        if (Math.abs(sign.x - e.p.x) < 40) bot.read.add(sign.id + e.plan.id + e.run.seed);
        return sign;
      }
      const table = props.find((p) => p.kind === 'table' && p.x > e.p.x - 30 && !(bot.ate ??= new Set()).has(p.id + e.plan.id + e.run.seed));
      if (table) {
        if (Math.abs(table.x - e.p.x) < 40) bot.ate.add(table.id + e.plan.id + e.run.seed);
        return table;
      }
      if (mode === 'service') return props.find((p) => p.kind === 'servicedoor' || p.kind === 'hatch');
      return props.find((p) => p.kind === 'panel');
    };
    let guard = 0;
    while (!eng.ended && guard++ < 30 * 60 * 25) {
      const out = stage.outing();
      if (out.depth >= 9 && mode === 'down') mode = 'service';
      const kk = bot(eng); bot.lastK = kk; eng.step(kk);
    }
    const out = stage.outing();
    assert.equal(eng.ended, 'return', `seed ${seed}: 로프로 귀환 (깊이 ${out.depth}, ${eng.plan.title}) x=${Math.round(eng.p.x)} y=${Math.round(eng.p.y)} enc=${eng.encActive} en=${eng.enemies.filter((e) => e.alive).map((e) => `${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`)} terr=${JSON.stringify(eng.plan.stage.terrain.filter((t) => Math.abs(t.x0 - eng.p.x) < 300))} k=${JSON.stringify(bot.lastK)} props=${eng.props.filter((q) => Math.abs(q.x - eng.p.x) < 300).map((q) => q.kind + '@' + q.x + (q.solid ? 'S' : ''))}`);
    assert.ok(out.visited.length >= 7, `seed ${seed} 층 ${out.visited.length}`);
    assert.ok(seenTypes.size >= 3, `유형 ${[...seenTypes]}`);
  }
  assert.ok(metaStore.m.deepest >= 9);
  assert.ok(Object.keys(metaStore.m.known).length >= 5, `송신된 규칙 ${Object.keys(metaStore.m.known)}`);
});

test('대사 모듈 연결: board 훅이 맡으면 인사·닫힘 소품을 치우고, 돌려준 결과로 총애를 바꾼다', () => {
  const metaStore = { m: null, load() { return this.m; }, save(m) { this.m = JSON.parse(JSON.stringify(m)); } };
  const calls = [];
  let finish = null;
  const stage = S.createElevatorStage(metaStore, {
    board(v, done) {
      calls.push(v);
      finish = done;
      return true;
    },
    announce(v) {
      calls.push({ announce: v.depth });
      return true;
    },
  });
  const eng = new DemoEngine(stage, { seed: 5, agent: 'rojemon' });
  eng.start();
  const k = { x: 0, y: 0, run: false, jump: false, attack: false, interact: false, crouch: false };
  eng.step(k);
  assert.deepEqual(calls[0], { announce: 1 });
  const panel = eng.props.find((p) => p.kind === 'panel');
  eng.p.x = panel.x;
  eng.step({ ...k, interact: true });
  for (let i = 0; i < 5 && eng.plan.stage.where !== 'car'; i++) eng.step(k);
  assert.equal(eng.plan.stage.where, 'car');
  eng.step(k);
  const board = calls.find((c) => c.ride);
  assert.ok(board, 'board 훅이 불리지 않음');
  assert.equal(board.agent, 'rojemon');
  assert.ok(!eng.props.some((p) => p.id === 'greet' || p.id === 'close'), '인사·닫힘 소품이 남음');
  const before = stage.meta().favor;
  finish({ act: 'greet', favor: before + 1 });
  eng.step(k);
  const flip = stage.outing().flags.includes('greet_flip');
  assert.equal(stage.meta().favor, before + (flip ? -1 : 1));
  assert.ok(stage.outing().found.includes('greet'), '인사 규칙을 찾은 것으로 남아야 함');
});
