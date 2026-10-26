import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-fieldworld-'));
const names = ['rng', 'clock', 'places', 'actors', 'observer', 'needs', 'mobs'];
await build({ entryPoints: names.map((n) => `src/game/world/${n}.ts`), outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `game/world/${n}.mjs`)));
const R = await imp('rng'), C = await imp('clock'), P = await imp('places'), A = await imp('actors'), O = await imp('observer'), N = await imp('needs'), M = await imp('mobs');

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
const kinds = { office: 'office', lounge: 'lounge', f3: 'corridor', lobby: 'lobby', street: 'street', jongno: 'street', wc: 'restroom' };
const graph = () => new P.PlaceGraph(scenes, elevator, kinds);

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

// ── 3단계: 욕구 AI ──
const all = () => true;

test('욕구: 클립이 없으면 그 활동은 후보가 아니다 (눈속임 금지)', () => {
  const needs = { work: 10, hunger: 10, energy: 10, bladder: 10, bowel: 10, social: 10, fun: 10 };
  const o = { name: '잼트리', needs, scene: 'office', roam: ['office', 'f3', 'lounge'], graph: graph(), duty: true, partnerIn: () => true, rand: () => 0.5 };
  assert.equal(N.choose({ ...o, has: () => false }), null);
  const only = N.choose({ ...o, has: (c) => c === 'eat' });
  assert.equal(only.act.id, 'eat');
  assert.equal(only.scene, 'lounge');
});

test('욕구: 근무 중엔 업무가 이기고, 근무 밖엔 업무가 0', () => {
  const needs = { work: 20, hunger: 70, energy: 90, bladder: 95, bowel: 95, social: 80, fun: 80 };
  const o = { name: '쟈알디', needs, scene: 'office', roam: ['office', 'f3', 'lounge'], graph: graph(), partnerIn: () => false, rand: () => 0.5, has: all };
  assert.equal(N.choose({ ...o, duty: true }).act.id, 'work');
  assert.notEqual(N.choose({ ...o, duty: false })?.act.id, 'work');
  assert.equal(N.onDuty(10), true);
  assert.equal(N.onDuty(20), false);
  assert.equal(N.onDuty(null), true);
});

test('욕구 AI: 클립이 있으면 활동을 하고 욕구가 찬다, 없으면 서성이기만', () => {
  const run = (has) => {
    const sim = new A.WorldSim(graph(), R.mulberry32(9), { has });
    const a = sim.add({ id: 'j', name: '잼트리', kind: 'named', brain: 'needs', home: 'office', roam: ['office', 'f3', 'lounge'], look: '잼트리' });
    const acts = new Set();
    for (let t = 0; t < 30 * 900; t++) { sim.step(1 / 30, { scene: 'street', x: 0, hour: 11 }); if (a.act === 'do') acts.add(a.task.id); }
    return acts;
  };
  assert.equal(run(() => false).size, 0, '클립 없으면 활동 없음');
  const acts = run((_look, clip) => ['work', 'eat', 'rest'].includes(clip));
  assert.ok(acts.has('work'), `활동: ${[...acts]}`);
});

test('욕구 AI: 수다는 상대와 둘이 같이', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(4), { has: (_l, c) => c === 'talk' });
  const a = sim.add({ id: 'a', name: '큐라스', kind: 'named', brain: 'needs', home: 'office', roam: ['office'] });
  const b = sim.add({ id: 'b', name: '잼트리', kind: 'named', brain: 'needs', home: 'office', roam: ['office'] });
  a.needs.social = 5;
  let together = false;
  for (let t = 0; t < 30 * 300 && !together; t++) { sim.step(1 / 30, { scene: 'street', x: 0, hour: 20 }); together = a.act === 'do' && b.act === 'do' && a.task?.id === 'chat'; }
  assert.ok(together, '둘 다 수다');
  assert.equal(a.face, b.x > a.x ? 1 : -1);
});

test('이름 인물: 주인공이 다가오면 멈춰 바라보고 ! 아이콘', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(2));
  const a = sim.add({ id: 'a', name: '에일린', kind: 'named', brain: 'needs', home: 'office', roam: ['office'] }, { x: 800, y: 560 });
  sim.step(1 / 30, { scene: 'office', x: 700, y: 560, hour: 10 });
  assert.equal(a.act, 'notice');
  assert.equal(a.face, -1);
  assert.equal(a.icon, '!');
  assert.ok(sim.events.some((e) => e.kind === 'notice'));
});

// ── 4단계: 몹 ──

test('몹 성향: 나올 때마다 새로 뽑고, 원형은 범위만 정한다', () => {
  const r = R.mulberry32(1);
  const ts = Array.from({ length: 50 }, () => M.rollTemper(r, M.ARCHETYPES['경찰']));
  assert.ok(ts.every((t) => t.courage >= 0.6 && t.courage <= 1));
  assert.ok(new Set(ts.map((t) => t.courage.toFixed(3))).size > 40, '개체마다 다름');
  const st = Array.from({ length: 50 }, () => M.rollTemper(r, M.ARCHETYPES['학생']));
  assert.ok(st.some((t) => t.courage > 0.5) && st.some((t) => t.courage < 0.1), '학생도 대담한 개체가 섞인다');
});

test('근무형: 근무 시간에 출근해 자리 지키고, 끝나면 퇴근', () => {
  const posts = [{ id: 'desk', archetype: '안내 직원', scene: 'lobby', how: 'fixed', spot: 1000, shifts: [[9, 18]], count: 1, gate: 300 }];
  const sim = new A.WorldSim(graph(), R.mulberry32(3), { posts });
  for (let t = 0; t < 30 * 20; t++) sim.step(1 / 30, { scene: 'street', x: 0, hour: 10 });
  const w = sim.actors.find((a) => a.post?.id === 'desk');
  assert.ok(w, '출근');
  assert.equal(w.act, 'post');
  assert.equal(Math.round(w.x), 1000);
  for (let t = 0; t < 30 * 20; t++) sim.step(1 / 30, { scene: 'street', x: 0, hour: 19 });
  assert.equal(sim.actors.filter((a) => a.def.brain === 'post').length, 0, '퇴근');
  for (let t = 0; t < 30 * 5; t++) sim.step(1 / 30, { scene: 'street', x: 0, hour: 3 });
  assert.equal(sim.actors.length, 0, '근무 밖엔 비어 있다');
});

test('근무형 순회: 여러 장면을 돈다', () => {
  const posts = [{ id: 'c', archetype: '청소부', scene: 'lobby', how: 'roam', route: ['lobby', 'f3', 'office'], stay: 3, shifts: [[0, 24]], count: 1, gate: 300 }];
  const sim = new A.WorldSim(graph(), R.mulberry32(3), { posts });
  const seen = new Set();
  for (let t = 0; t < 30 * 200; t++) { sim.step(1 / 30, { scene: 'street', x: 0, hour: 7 }); for (const a of sim.actors) seen.add(a.scene); }
  assert.ok(seen.has('f3') && seen.has('office'), [...seen].join());
});

test('소란도: 쌓이면 단계가 오르고 시간이 지나면 식는다, 겁 많은 몹은 도망', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(8), { spawns: [{ scene: 'jongno', target: { day: 10, night: 2 }, refill: [9, 9], mix: ['관광객'] }] });
  sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
  sim.disturb('jongno', 60, 2000);
  assert.equal(sim.uproarLevel('jongno'), 2);
  for (let t = 0; t < 30 * 3; t++) sim.step(1 / 30, { scene: 'jongno', x: 2000, hour: 12 });
  assert.ok(sim.actors.some((a) => a.doing === '도망') || sim.events.some((e) => e.kind === 'flee'), '도망친 몹이 있다');
  for (let t = 0; t < 30 * 60; t++) sim.step(1 / 30, { scene: 'jongno', x: 2000, hour: 12 });
  assert.equal(sim.uproarLevel('jongno'), 0);
});

test('사건: 손버릇 있는 몹이 소매치기를 하고 달아난다 (위에서 굴리지 않고 몹 판단)', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(21), { spawns: [{ scene: 'jongno', target: { day: 12, night: 2 }, refill: [1, 2], mix: ['불량배', '행인'] }] });
  let stole = false;
  for (let t = 0; t < 30 * 400 && !stole; t++) { sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 }); stole = sim.events.some((e) => e.kind === 'steal'); }
  assert.ok(stole, '소매치기가 일어난다');
  const ev = sim.events.find((e) => e.kind === 'steal');
  const thief = sim.actors.find((a) => a.doing === '훔치고 달아남');
  if (thief) assert.ok(thief.run > 1.5);
  assert.ok(ev.thief === '불량배', `도둑 원형 ${ev.thief}`);
});

test('경찰: 플레이어 범죄에만 나서 플레이어 쪽으로 간다', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(5));
  sim.step(1 / 30, { scene: 'jongno', x: 2000, y: 560, hour: 12 });
  assert.equal(sim.actors.filter((a) => a.def.name === '경찰').length, 0, '범죄 없으면 경찰 없음');
  sim.crime('jongno', 2000);
  const cop = sim.actors.find((a) => a.def.name === '경찰');
  assert.ok(cop);
  for (let t = 0; t < 30 * 20; t++) sim.step(1 / 30, { scene: 'jongno', x: 2000, y: 560, hour: 12 });
  assert.ok(Math.abs(cop.x - 2000) < 200, `경찰 x ${cop.x}`);
  const lobby = new A.WorldSim(graph(), R.mulberry32(5));
  lobby.crime('lobby', 900);
  assert.ok(lobby.actors.some((a) => a.def.name === '경비'), '거점 안은 경비');
});

test('주인공 공격이 몹에 닿으면: 쓰러지거나 휘청, 소란, 경찰 출동, 한 공격에 한 번', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(6));
  const m = sim.add({ id: 'm', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { x: 1000, y: 560 });
  sim.step(1 / 30, { scene: 'jongno', x: 940, y: 560, hour: 12 });
  const box = { x0: 960, x1: 1040, y: 560, z0: 60, z1: 160, attackId: 7 };
  assert.equal(sim.hitBoxes('jongno', [box], 1).length, 1);
  assert.equal(m.act, 'down');
  assert.equal(sim.hitBoxes('jongno', [box], 1).length, 0, '같은 공격은 한 번');
  assert.ok(sim.uproarValue('jongno') > 0);
  assert.ok(sim.actors.some((a) => a.def.name === '경찰'));
  assert.ok(sim.events.some((e) => e.kind === 'hurt' && e.who === '행인'));
});
