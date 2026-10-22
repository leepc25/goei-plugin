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

test('세상 생성: 씨앗 × 깊이마다 방 격자가 풀리고(열쇠→잠금→출구), 깊을수록 커지고 잠금이 는다', () => {
  let leaves = 0,
    secrets = 0,
    n = 0;
  const lk = {};
  for (let seed = 1; seed <= 60; seed++)
    for (const depth of [1, 2, 3, 4, 6, 9, 12, 16, 20]) {
      const type = depth <= 3 ? 'lobby' : TYPES[(seed + depth) % TYPES.length];
      const w = S.makeWorld({ seed, depth, type, sub: type === 'replica' ? 'red' : null, epoch: 0 });
      assert.deepEqual(S.validateWorld(w), [], `seed ${seed} 깊이 ${depth} ${type}`);
      assert.ok(w.locks <= S.lockCount(depth, type));
      (lk[depth] ??= []).push(w.locks);
      assert.ok(w.rooms.some((q) => q.panel), '패널 방');
      leaves += w.rooms.filter((q) => S.DIRS.filter((d) => q.open[d]).length === 1).length;
      secrets += w.rooms.some((q) => q.role === 'secret') ? 1 : 0;
      n++;
    }
  assert.ok(leaves / n >= 2, `막다른 방 평균 ${leaves / n}`);
  assert.ok(secrets / n >= 0.4, `숨은 방 비율 ${secrets / n}`);
  const avg = (d) => lk[d].reduce((a, b) => a + b, 0) / lk[d].length;
  assert.equal(avg(1), 0);
  assert.ok(avg(2) >= 0.7 && avg(20) > avg(4) + 0.5, `잠금 평균 ${[1, 2, 4, 20].map(avg)}`);
  const [c1, r1] = S.worldSize(1, 'lobby'),
    [c9, r9] = S.worldSize(12, 'dark');
  assert.ok(c9 * r9 > c1 * r1);
  // 같은 씨앗 = 같은 세상
  const a = S.makeWorld({ seed: 7, depth: 5, type: 'dark', sub: null, epoch: 0 }),
    b = S.makeWorld({ seed: 7, depth: 5, type: 'dark', sub: null, epoch: 0 });
  assert.deepEqual(a, b);
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

// 방 격자 길찾기: 지금 지나갈 수 있는 연결만 (숨은 연결은 부순 것, 잠금은 연 것이나 열쇠 든 것)
function route(stage, w, from, isGoal, ignoreLocks = false) {
  const out = stage.outing();
  const pass = (rm, d) => {
    if (!rm.open[d]) return false;
    const eid = S.edgeId(w, rm, d);
    if (rm.hidden[d] && !out.broken.includes(eid)) return false;
    const k = rm.lock[d];
    return ignoreLocks || !k || out.unlocked.includes(eid) || out.wkeys.includes(`${w.depth}:${k}`);
  };
  const id = (rm) => `${rm.col},${rm.row}`;
  const first = new Map([[id(from), null]]);
  const q = [from];
  while (q.length) {
    const rm = q.shift();
    if (rm !== from && isGoal(rm)) return { room: rm, dir: first.get(id(rm)) };
    for (const d of S.DIRS) {
      if (!pass(rm, d)) continue;
      const b = S.across(w, rm, d);
      if (!b || first.has(id(b))) continue;
      first.set(id(b), rm === from ? d : first.get(id(rm)));
      q.push(b);
    }
  }
  return null;
}

// ── 걸어서 끝까지: 대역 엔진 + 자동 조작으로 로비 → 층마다 모든 방 정리 → 승강기 → … → 정비 구역 → 다락방 로프 귀환
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
    k.x = Math.abs(dx) < 8 ? 0 : Math.sign(dx);
  } else k.x = 1;
  // 지형
  const ahead = p.x + k.x * 70;
  let lo = 0,
    hi = 160;
  const cs = [];
  for (const t of st.terrain) {
    // 좁은 길은 사물함·차단대 그림 폭만큼(±120) 앞에서부터 막힌다
    let m = 0;
    if (t.kind === 'narrow') {
      m = 130;
      for (const o of st.terrain) if (o !== t && o.kind === 'narrow') m = Math.min(m, Math.max(0, (o.x0 >= t.x1 ? o.x0 - t.x1 : t.x0 - o.x1) / 2 - 30));
    }
    const hit = Math.min(p.x, ahead) < t.x1 + m && Math.max(p.x, ahead) > t.x0 - m;
    // 뒷줄 사물함은 그림 폭 전체가 막힌다
    const bs = t.kind === 'narrow' ? S.narrowBackSpan(t, st.terrain) : null;
    if (bs && Math.min(p.x, ahead) < bs[1] + 44 && Math.max(p.x, ahead) > bs[0] - 44) (lo = Math.max(lo, t.lane0)), cs.push(t);
    if (!hit) continue;
    if (t.kind === 'pit') k.run = true;
    if ((t.kind === 'pit' || t.kind === 'block') && !p.airborne) k.jump = true;
    if (t.kind === 'low') k.crouch = true;
    if (t.kind === 'narrow') (lo = Math.max(lo, t.lane0)), (hi = Math.min(hi, t.lane1)), cs.push(t);
    if (t.kind === 'redfloor') k.y = p.y > 565 ? -1 : 1;
  }
  // 지그재그 미로에서 두 좁은 길이 겹쳐 보이면 앞으로 갈 길의 줄에 먼저 맞춘다
  if (lo > hi && cs.length) {
    const next = cs.reduce((a, b) => ((b.x0 - a.x0) * (k.x || 1) > 0 ? b : a));
    (lo = next.lane0), (hi = next.lane1);
  }
  if (lo > 0 || hi < 160) {
    const ty = 440 + ((lo + hi) / 2 / 160) * 250;
    if (Math.abs(ty - p.y) > 4) k.y = Math.sign(ty - p.y);
  }
  if (k.crouch) k.jump = false;
  return k;
}

/** 방 안: 목표 x까지 가는 길의 셔터·주민·밥상·표지 */
function inTheWay(e, f, tx) {
  const props = e.props;
  const px = e.p.x;
  const lo = Math.min(px, tx) - 30,
    hi = Math.max(px, tx) + 30;
  const tag = (p) => p.id + e.plan.id + e.run.seed;
  for (const sh of f.placed.filter((x) => x.kind === 'shutter').sort((a, b) => Math.abs(a.x - px) - Math.abs(b.x - px))) {
    const pr = props.find((p) => p.id === `p${sh.id}`);
    if (!pr?.solid || sh.x < lo || sh.x > hi) continue;
    if (px > sh.x) return pr; // 뒤편: 손잡이로 올린다
    if (sh.data.fork !== undefined) {
      const d = f.placed.find((x) => x.kind === 'door' && x.data.fork === sh.data.fork && x.data.correct);
      return props.find((p) => p.id === `p${d.id}`);
    }
    const order = String(sh.data.order).split('-').map(Number);
    const done = (bot.seq ??= {});
    const key = e.run.seed + e.plan.id + sh.id;
    const n = (done[key] ??= 0);
    const sw = f.placed.find((x) => x.kind === 'switch' && x.data.group === sh.data.group && x.data.n === order[n]);
    if (!sw) throw new Error(`스위치 ${order} n=${n}`);
    const pr2 = props.find((p) => p.id === `p${sw.id}`);
    if (pr2 && Math.abs(pr2.x - px) < 40 && e.tick % 2 === 0 && e.nearestProp()?.id === pr2.id) done[key] = n + 1;
    return pr2;
  }
  const between = (p) => p.x > lo && p.x < hi;
  const npc = props.find((p) => p.kind === 'npc' && f.type === 'replica' && between(p) && !(bot.greeted ??= new Set()).has(tag(p)));
  if (npc) {
    if (Math.abs(npc.x - px) < 40) bot.greeted.add(tag(npc));
    return npc;
  }
  for (const [kind, set] of [['table', 'ate'], ['sign', 'read']]) {
    const it = props.find((p) => p.kind === kind && between(p) && !(bot[set] ??= new Set()).has(tag(p)));
    if (it) {
      if (Math.abs(it.x - px) < 40) bot[set].add(tag(it));
      return it;
    }
  }
  return null;
}

test('걸어서 확인: 로비 L1부터 층마다 모든 방을 정리하고 승강기로 내려가, 정비 구역 다락방 로프로 귀환', () => {
  const metaStore = { m: null, load() { return this.m; }, save(m) { this.m = JSON.parse(JSON.stringify(m)); } };
  const stage = S.createElevatorStage(metaStore);
  const tally = { unlocked: 0, keys: 0, rewards: 0, ups: 0, rooms: 0, broken: 0 };
  for (const seed of Array.from({ length: 10 }, (_, i) => 11 + i * 37)) {
    const eng = new DemoEngine(stage, { seed, agent: 'jyaldi' });
    eng.start();
    const seenTypes = new Set();
    let mode = 'down'; // 깊이 5까지 내려간 뒤 정비 구역으로
    let presses = 0;
    bot.want = (e) => {
      const st = e.plan.stage;
      const out = stage.outing();
      const props = e.props;
      const f = st.floor;
      const upPick = props.find((p) => p.id.startsWith('up:'));
      if (upPick) return upPick;
      if (st.where === 'car') return props.find((p) => p.id === (presses++ % 5 === 0 ? 'greet' : 'btn0')) ?? props.find((p) => p.id === 'btn0');
      if (st.where === 'service') {
        const z = out.service;
        const target = z.atticCell;
        const [c, r] = out.cell;
        if (c === target[0] && r === target[1]) return props.find((p) => p.kind === 'rope');
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
      const w = stage.worldAt(f.depth);
      const rm = S.roomAt(w, f.room.col, f.room.row);
      const wv = stage.mapView().worlds.find((x) => x.depth === f.depth);
      const clearOf = (q) => !!wv.rooms.find((v) => v.col === q.col && v.row === q.row)?.clear;
      const go = (x) => inTheWay(e, f, x) ?? { id: '__walk', x };
      // 방 안: 열쇠 줍기 → 싸움(방을 끝까지 쓸어 본다) → 보상 배낭
      const key = props.find((p) => p.kind === 'key');
      if (key) return go(key.x).id === '__walk' ? key : go(key.x);
      if (!clearOf(rm)) {
        const sw = (bot.sweep ??= {});
        const k = e.plan.id + seed;
        if (sw[k] === undefined) sw[k] = e.p.x < f.width / 2 ? 1 : -1;
        const tx = sw[k] > 0 ? f.width - 140 : 140;
        if (Math.abs(e.p.x - tx) < 50) sw[k] = -sw[k];
        return go(tx);
      }
      const pack = props.find((p) => p.kind === 'pack' && p.label !== '빈 배낭');
      if (pack) return go(pack.x).id === '__walk' ? pack : go(pack.x);
      // 다음 방: 층을 다 정리하기 전에는 안 정리된 방·안 주운 열쇠로, 끝나면 패널(또는 정비 구역 입구)로
      const done = out.clearedFloors.includes(f.depth);
      const svc = props.find((p) => p.kind === 'servicedoor' || p.kind === 'hatch');
      if (done && mode === 'service' && svc) return go(svc.x).id === '__walk' ? svc : go(svc.x);
      const panel = props.find((p) => p.kind === 'panel');
      if (done && panel && (mode === 'down' || (rm.col === w.arrival[0] && rm.row === w.arrival[1]))) return go(panel.x).id === '__walk' ? panel : go(panel.x);
      const isGoal = !done
        ? (q) => (q.role !== 'secret' && !clearOf(q)) || (q.key && !out.wkeys.includes(`${f.depth}:${q.key}`))
        : mode === 'service'
          ? (q) => q.col === w.arrival[0] && q.row === w.arrival[1]
          : (q) => q.panel;
      const r = route(stage, w, rm, isGoal);
      if (!r) throw new Error(`seed ${seed}: 갈 방이 없다 (${f.label}) done=${done} keys=${out.wkeys} unlocked=${out.unlocked} rooms=${wv.rooms.map(q => `${q.col},${q.row}:${q.role}:${q.clear}`).join(";")}`);
      const d = r.dir;
      const gate = f.placed.find((x) => x.kind === 'locked' && x.data.dir === d && props.some((p) => p.id === `p${x.id}`));
      const door = gate ?? f.placed.find((x) => x.data.dir === d && ['wdoor', 'wup', 'wdown', 'crack', 'vent'].includes(x.kind));
      if (!door) throw new Error(`seed ${seed}: ${d} 문 없음 (${f.label})`);
      const pr = props.find((p) => p.id === `p${door.id}`);
      return go(pr.x).id === '__walk' ? pr : go(pr.x);
    };
    let guard = 0;
    while (!eng.ended && guard++ < 30 * 60 * 120) {
      const out = stage.outing();
      if (out.depth >= 5 && mode === 'down') mode = 'service';
      const kk = bot(eng);
      bot.lastK = kk;
      eng.step(kk);
      // 사물함 뒤 깊이에 숨지 않는다 (검수 16-1·18-1)
      if (eng.plan.stage.where === 'floor')
        for (const t of eng.plan.stage.terrain) {
          const bs = t.kind === 'narrow' ? S.narrowBackSpan(t, eng.plan.stage.terrain) : null;
          const lane = ((eng.p.y - 440) / 250) * 160;
          if (bs) assert.ok(!(eng.p.x > bs[0] + 20 && eng.p.x < bs[1] - 20 && lane < t.lane0 - 4), `seed ${seed}: 사물함 뒤 x=${Math.round(eng.p.x)} lane=${Math.round(lane)} ${JSON.stringify(t)} span=${bs.map(Math.round)}`);
        }
    }
    const out = stage.outing();
    tally.unlocked += out.unlocked.length;
    tally.keys += out.wkeys.length;
    tally.rewards += out.rewards.length;
    tally.ups += out.upgrades.length;
    tally.broken += out.broken.length;
    tally.rooms += Object.values(out.seenRooms).reduce((a, b) => a + b.length, 0);
    assert.equal(eng.ended, 'return', `seed ${seed}: 로프로 귀환 (깊이 ${out.depth}, ${eng.plan.title}) x=${Math.round(eng.p.x)} goal=${bot.want(eng)?.id} near=${eng.nearestProp()?.id} cleared=${out.clearedFloors} where=${out.where} says=${eng.says.slice(-4).map((s) => s.text).join('|')} props=${eng.props.filter((q) => Math.abs(q.x - eng.p.x) < 300).map((q) => q.kind + '@' + q.x + (q.solid ? 'S' : ''))}`);
    assert.deepEqual(out.clearedFloors.slice(0, 4), [1, 2, 3, 4], `seed ${seed}: 층마다 다 정리하고 내려갔다 ${out.clearedFloors}`);
    assert.ok(seenTypes.size >= 2, `유형 ${[...seenTypes]}`);
  }
  assert.ok(metaStore.m.deepest >= 5);
  assert.ok(Object.keys(metaStore.m.known).length >= 4, `송신된 규칙 ${Object.keys(metaStore.m.known)}`);
  console.log('world', JSON.stringify(tally));
  assert.ok(tally.unlocked >= 10 && tally.keys >= tally.unlocked, `잠금·열쇠 ${JSON.stringify(tally)}`);
  assert.ok(tally.rewards >= 20 && tally.ups >= 20, `보상·강화 ${JSON.stringify(tally)}`);
  assert.ok(tally.rooms >= 150, `방 ${JSON.stringify(tally)}`);
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
  // 패널 있는 방까지 문으로 (클리어했다고 치고)
  stage.outing().clearedFloors.push(1);
  for (let n = 0; n < 30 && !eng.props.some((p) => p.kind === 'panel'); n++) {
    const w = stage.worldAt(1);
    const f = eng.plan.stage.floor;
    const r = route(stage, w, S.roomAt(w, f.room.col, f.room.row), (q) => q.panel, true);
    const door = f.placed.find((x) => x.data.dir === r.dir && ['wdoor', 'wup', 'wdown'].includes(x.kind));
    eng.plan.encounters.forEach((_, index) => eng.emit({ type: 'combat:clear', index }));
    eng.encDone = new Set(eng.plan.encounters.map((_, i) => i));
    eng.bounds = [0, eng.plan.length];
    eng.p.x = door.x;
    eng.enemies = [];
    eng.encActive = -1;
    eng.step({ ...k, interact: true });
    for (let i = 0; i < 3; i++) eng.step(k);
  }
  const panel = eng.props.find((p) => p.kind === 'panel');
  eng.plan.encounters.forEach((_, index) => eng.emit({ type: 'combat:clear', index }));
  eng.encDone = new Set(eng.plan.encounters.map((_, i) => i));
  eng.bounds = [0, eng.plan.length];
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

test('방 격자: 문으로 옆·위아래 방, 돌아오면 같은 방, 잠금은 열쇠로, 클리어 전 패널·아래 점검문은 꺼짐, 정비 구역 다녀오기', () => {
  const metaStore = { m: null, load() { return this.m; }, save(m) { this.m = JSON.parse(JSON.stringify(m)); } };
  const stage = S.createElevatorStage(metaStore);
  const eng = new DemoEngine(stage, { seed: 4242, agent: 'jyaldi' });
  eng.start();
  const idle = { x: 0, y: 0, run: false, jump: false, attack: false, interact: false, crouch: false };
  const out = () => stage.outing();
  const use = (pred) => {
    const pr = eng.props.find(pred);
    assert.ok(pr, `소품 없음 (${eng.plan.title}) ${eng.props.map((q) => q.kind + ':' + q.id).join(' ')}`);
    eng.plan.encounters.forEach((_, index) => eng.emit({ type: 'combat:clear', index }));
    eng.encDone = new Set(eng.plan.encounters.map((_, i) => i));
    eng.bounds = [0, eng.plan.length];
    eng.p.x = pr.x;
    eng.encActive = -1;
    eng.enemies = [];
    eng.step({ ...idle, interact: true, crouch: true });
    for (let i = 0; i < 3; i++) eng.step(idle);
    return pr;
  };
  const here = () => eng.plan.stage.floor.room;
  const doorTo = (d) => {
    const f = eng.plan.stage.floor;
    const gate = f.placed.find((x) => x.kind === 'locked' && x.data.dir === d && eng.props.some((p) => p.id === `p${x.id}`));
    const door = gate ?? f.placed.find((x) => x.data.dir === d && ['wdoor', 'wup', 'wdown'].includes(x.kind));
    return use((q) => q.id === `p${door.id}`);
  };
  /** 문을 E로 열며 목표 방까지 (지금 지나갈 수 있는 길만) */
  const travel = (isGoal) => {
    for (let n = 0; n < 40; n++) {
      const w = stage.worldAt(out().depth);
      const rm = S.roomAt(w, here().col, here().row);
      if (isGoal(rm)) return rm;
      const r = route(stage, w, rm, isGoal);
      assert.ok(r, `길 없음 ${here().col},${here().row}`);
      doorTo(r.dir);
    }
    throw new Error('방을 못 찾음');
  };
  const w1 = stage.worldAt(1);
  assert.deepEqual(S.validateWorld(w1), []);
  assert.deepEqual([here().col, here().row], w1.arrival);
  const a1 = eng.plan;
  // 옆 방으로 갔다가 돌아오면 같은 방(다시 만들지 않음), 들어온 문 옆에 선다
  const arr = S.roomAt(w1, ...w1.arrival);
  const d0 = S.DIRS.find((d) => arr.open[d] && !arr.hidden[d] && !arr.lock[d]);
  doorTo(d0);
  const nb = S.across(w1, arr, d0);
  assert.deepEqual([here().col, here().row], [nb.col, nb.row]);
  doorTo(S.OPP[d0]);
  assert.equal(eng.plan, a1, '같은 방');
  // 클리어 전: 패널은 꺼져 있다
  travel((q) => q.panel);
  use((q) => q.kind === 'panel');
  assert.equal(eng.plan.stage.where, 'floor', '클리어 전에는 승강기를 못 탄다');
  // 정비 구역: 도착 방 점검문 → 아래 점검문은 잠김 → 위로 나오면 같은 방
  travel((q) => q.col === w1.arrival[0] && q.row === w1.arrival[1]);
  use((q) => q.kind === 'servicedoor' || q.kind === 'hatch');
  assert.equal(out().where, 'service');
  const walk = (target, thing) => {
    for (let n = 0; n < 30; n++) {
      const z = out().service;
      const [c, r] = out().cell;
      if (c === target[0] && r === target[1]) return use((q) => q.kind === thing);
      const prev = new Map([[`${c},${r}`, null]]);
      const q = [[c, r]];
      while (q.length) {
        const [x, y] = q.shift();
        const cell = z.cells[y * z.cols + x];
        for (const [dx, dy, o] of [[1, 0, 'r'], [-1, 0, 'l'], [0, 1, 'd'], [0, -1, 'u']]) if (cell.open[o] && !prev.has(`${x + dx},${y + dy}`)) prev.set(`${x + dx},${y + dy}`, `${x},${y}`), q.push([x + dx, y + dy]);
      }
      let cur = `${target[0]},${target[1]}`;
      while (prev.get(cur) !== `${c},${r}`) cur = prev.get(cur);
      const [nx, ny] = cur.split(',').map(Number);
      const kind = nx > c ? 'right' : nx < c ? 'left' : ny > r ? 'ladder_down' : 'ladder_up';
      use((p) => p.kind === kind);
    }
    throw new Error('정비 구역 길 못 찾음');
  };
  walk(out().service.downCell, 'down');
  assert.equal(out().where, 'service', '클리어 전에는 아래 점검문도 잠김');
  walk(out().service.entryCell, 'up');
  assert.equal(out().where, 'floor');
  assert.equal(eng.plan, a1, '들어간 방으로 돌아온다');
  // 클리어했다고 치고 아래로: L2는 잠금이 하나
  out().clearedFloors.push(1);
  use((q) => q.kind === 'servicedoor' || q.kind === 'hatch');
  walk(out().service.downCell, 'down');
  assert.equal(out().depth, 2);
  const w2 = stage.worldAt(2);
  assert.equal(w2.locks, 1);
  assert.deepEqual(S.validateWorld(w2), []);
  // 잠긴 연결 앞까지 → 열쇠 없이는 안 열린다
  const lockRoom = w2.rooms.find((q) => S.DIRS.some((d) => q.lock[d] && q.region === 0));
  const ld = S.DIRS.find((d) => lockRoom.lock[d]);
  travel((q) => q === lockRoom);
  doorTo(ld);
  assert.deepEqual([here().col, here().row], [lockRoom.col, lockRoom.row], '열쇠 없이 잠금 통과');
  // 열쇠 방 → 줍기 → 돌아와 열기
  const keyRoom = w2.rooms.find((q) => q.key === 1);
  travel((q) => q === keyRoom);
  use((q) => q.kind === 'key');
  assert.ok(out().wkeys.includes('2:1'));
  travel((q) => q === lockRoom);
  doorTo(ld);
  if (ld === 'l' || ld === 'r') doorTo(ld); // 방화셔터를 연 뒤 문
  const past = S.across(w2, lockRoom, ld);
  assert.deepEqual([here().col, here().row], [past.col, past.row], '열쇠로 열고 지나감');
  assert.ok(out().unlocked.includes(S.edgeId(w2, lockRoom, ld)));
  // 지도: 두 층, 연 잠금은 초록
  const m = stage.mapView();
  assert.deepEqual(m.worlds.map((x) => x.depth), [1, 2]);
  const mv = m.worlds[1].rooms.find((q) => q.col === lockRoom.col && q.row === lockRoom.row);
  assert.equal(mv.lock[ld].state, 'open');
  assert.ok(m.services.some((x) => x.depth === 1 && x.cells.some((c) => c.seen)));
});
