import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-fieldworld-'));
const names = ['rng', 'clock', 'places', 'actors', 'observer', 'needs', 'mobs', 'lines', 'speech', 'districts', 'hq', 'npcperks', 'factions'];
await build({ entryPoints: names.map((n) => `src/game/world/${n}.ts`), outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `game/world/${n}.mjs`)));
const R = await imp('rng'), C = await imp('clock'), P = await imp('places'), A = await imp('actors'), O = await imp('observer'), N = await imp('needs'), M = await imp('mobs'), L = await imp('lines'), SP = await imp('speech'), D = await imp('districts'), H = await imp('hq');

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
  assert.deepEqual(C.clockRules({ scene: '15', talk: -3, fight: 'x' }), { scene: 15, region: 30, talk: 10, fight: 10, waitShort: 30, waitLong: 60 });
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

// ── 5단계: 대사 ──
const dlg = {
  version: 1,
  characters: {
    잼트리: { faction: 'A00', level: 2, address: { up: '부장님', peer: '동기', down: '후배', outsider: '손님' },
      persona: { same: { up: { ally: ['{호칭}, 커피 드세요.'], enemy: ['{호칭}, 못 봐드려요.'] }, peer: { ally: ['동기 왔네.'], enemy: [] }, down: { ally: ['{호칭}이 왔구나.'], enemy: [] } }, B00: { ally: ['가짜 쪽 사람이네.'], enemy: ['{호칭}은 나가요.'] }, etc: { ally: ['어서 와요.'], enemy: [] } },
      time: { morning: ['출근~'], day: ['점심 뭐 먹지'], evening: ['퇴근!'], night: ['야근이다'] }, situation: {}, eco: { work: ['서류 정리 중~'], chat: ['{상대} 씨, 그거 알아요?'], eat: [] } },
  },
  npc: { 시민: { faction: null, persona: { A00: { ally: ['수고하세요.'], enemy: ['저리 가요!'] }, etc: { ally: ['…'], enemy: [] } }, time: { day: ['날씨 좋다.'] }, situation: {}, eco: { victim: ['내 지갑!'], pass: ['바쁘다 바빠.'] } } },
};

test('대사: {호칭} 채우기와 조사 받침 맞추기', () => {
  assert.equal(L.fillAddress('{호칭}이 왔구나', '후배'), '후배가 왔구나');
  assert.equal(L.fillAddress('{호칭}이 왔구나', '손님'), '손님이 왔구나');
  assert.equal(L.fillAddress('{호칭}은 나가요', '손님'), '손님은 나가요');
  assert.equal(L.fillAddress('{호칭}를 믿어', '선배님'), '선배님을 믿어');
  assert.equal(L.fillAddress('{호칭}으로 가요', '서울'), '서울로 가요');
  assert.equal(L.fillAddress('{호칭}, 안녕', '동기'), '동기, 안녕');
});

test('대사: 같은 조직은 직급 비교 칸, 다른 조직은 소속 칸, 적이면 enemy', () => {
  const lines = new L.Lines(dlg, () => 0.1);
  const up = lines.bark('named', '잼트리', 'idle', { hour: 12, faction: 'A00', level: 3 });
  assert.equal(up, '부장님, 커피 드세요.');
  assert.equal(lines.bark('named', '잼트리', 'idle', { hour: 12, faction: 'A00', level: 1 }), '후배가 왔구나.');
  assert.equal(lines.bark('named', '잼트리', 'idle', { hour: 12, faction: 'B00', level: null, enemy: true }), '손님은 나가요.');
  assert.equal(lines.bark('named', '잼트리', 'idle', { hour: 12, faction: 'C00', level: null }), '어서 와요.', '표에 없는 소속은 etc');
  assert.equal(lines.bark('named', '잼트리', 'work', { hour: 12, faction: 'A00', level: 2 }), '서류 정리 중~');
  assert.equal(lines.bark('named', '잼트리', 'eat', { hour: 12, faction: 'A00', level: 2 }), null, '생태계 대사가 없으면 억지로 안 한다');
  assert.equal(lines.bark('named', '잼트리', 'chat', { hour: 12, faction: 'A00', level: 2 }, { partner: '큐라스' }), '큐라스 씨, 그거 알아요?');
  assert.equal(lines.bark('mob', '관광객', 'victim', { hour: 12, faction: 'A00', level: 1 }, { archetype: '관광객' }), '내 지갑!', '원형 → 대사 종류(시민)');
  assert.equal(L.timeKey(7), 'morning');
  assert.equal(L.timeKey(22), 'night');
});

test('대사 연출: 소매치기 사건이 나면 피해자가 말한다, 보이는 장면만', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(3));
  const v = sim.add({ id: 'v', name: '관광객', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '관광객' }, { x: 900, y: 560 });
  const ch = new SP.Chatter(sim, new L.Lines(dlg, sim.rng), () => ({ hour: 12, faction: 'A00', level: 1 }));
  ch.step(1 / 30, 'office', 0, [{ kind: 'steal', scene: 'jongno', thief: '불량배', victim: '관광객', x: 900 }]);
  assert.equal(v.say, undefined, '안 보이는 장면은 말 안 함');
  ch.step(1 / 30, 'jongno', 800, [{ kind: 'steal', scene: 'jongno', thief: '불량배', victim: '관광객', x: 900 }]);
  assert.equal(v.say, '내 지갑!');
});

test('시간 보내기 선택지: 짧게·길게·다음 시간대·근무 끝까지', () => {
  const r = C.clockRules({});
  const at10 = C.waitOptions(r, 10 * 60);
  assert.deepEqual(at10.map((o) => o.label), ['30분', '1시간', '낮까지', '근무 끝까지']);
  assert.equal(at10[2].minutes, 60);
  assert.equal(at10[3].minutes, 8 * 60);
  const night = C.waitOptions(r, 23 * 60);
  assert.deepEqual(night.map((o) => o.label), ['30분', '1시간', '아침까지']);
  assert.equal(night[2].minutes, 6 * 60);
  assert.deepEqual(C.waitOptions(C.clockRules({ waitShort: 0 }), null).map((o) => o.label), ['1시간']);
});

test('장소 꼬리표 → 인구 규칙, 지역 이동 판정', () => {
  const rules = D.areaSpawns({ a: 'market', b: 'nightlife' }, { a: [10, 20] });
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].gates, [10, 20]);
  assert.ok(rules[0].target.day > rules[0].target.night, '시장은 낮이 붐빈다');
  assert.ok(rules[1].target.night > rules[1].target.day, '유흥가는 밤이 붐빈다');
  for (const r of Object.values(D.POPULATION)) for (const n of [...r.mix, ...(r.nightMix ?? [])]) assert.ok(M.ARCHETYPES[n], `원형 ${n}`);
  for (const n of Object.keys(M.ARCHETYPES)) assert.ok(L.NPC_TYPE[n], `대사 연결 ${n}`);
  assert.equal(H.hqDistrict('office'), 'jongno');
  assert.equal(H.hqDistrict('metro'), null);
  assert.ok(D.isRegionMove('jongno', 'gangnam'));
  assert.ok(!D.isRegionMove('jongno', 'jongno'));
  assert.ok(!D.isRegionMove('jongno', null));
  assert.equal(H.hqSceneFaction('gangnam'), null);
  assert.equal(H.hqSceneFaction('office'), 'A00');
});

test('밤 원형: 유흥가 밤에는 nightMix에서만 나온다', () => {
  const g = new P.PlaceGraph([{ id: 'gn', name: '강남', length: 3000, legacy: true, doors: [] }], [], { gn: 'street' });
  const sim = new A.WorldSim(g, R.mulberry32(5), { spawns: D.areaSpawns({ gn: 'nightlife' }) });
  sim.step(0.1, { scene: 'elsewhere', x: 0, y: 0, hour: 23 });
  const mobs = sim.inScene('gn').filter((a) => a.def.kind === 'mob');
  assert.equal(mobs.length, D.POPULATION.nightlife.target.night);
  for (const m of mobs) assert.ok(D.POPULATION.nightlife.nightMix.includes(m.def.archetype), m.def.archetype);
});

test('필드 가게: 값·떨이·평판 거부·재고 회복·가방 칸·흥정', async () => {
  const { build: b2 } = await import('esbuild');
  const d2 = await mkdtemp(join(tmpdir(), 'goei-fshop-'));
  await b2({ entryPoints: ['src/game/world/fieldShop.ts'], outdir: d2, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  const F = await import(pathToFileURL(join(d2, 'game/world/fieldShop.mjs')));
  const it = F.FIELD_ITEMS.onigiri, cvs = F.SHOPS.cvs, mk = F.SHOPS.market;
  assert.equal(F.priceOf(it, cvs, { hour: 12 }), 1200);
  assert.equal(F.priceOf(it, mk, { hour: 12 }), 1000, '시장 0.85 (백 원 단위)');
  assert.equal(F.priceOf(it, mk, { hour: 18 }), 700, '저녁 떨이');
  assert.equal(F.priceOf(it, cvs, { hour: 12, rep: 'hostile' }), null, '적대면 거래 거부');
  assert.equal(F.sellPriceOf(it, cvs, { hour: 12 }), null, '편의점은 안 삼');
  assert.equal(F.sellPriceOf(it, mk, { hour: 12 }), 500);
  assert.ok(!F.isOpen(mk, 20) && F.isOpen(mk, 7) && F.isOpen(cvs, 3));
  const s = F.emptyState();
  const st = F.stockOf(s, cvs, 600);
  st.onigiri = 0;
  assert.equal(F.stockOf(s, cvs, 600 + 180).onigiri, 4, '반 시간이면 반만');
  assert.equal(F.stockOf(s, cvs, 600 + 180 + 400).onigiri, 8);
  for (const id of Object.keys(F.FIELD_ITEMS).slice(0, 8)) assert.ok(F.addBag(s, id));
  assert.equal(F.addBag(s, 'umbrella'), false, '가방 8칸');
  assert.ok(F.addBag(s, 'onigiri'), '같은 물건은 겹침');
  assert.equal(F.parseState(JSON.stringify(s)).bag.onigiri, 2);
  let fails = 0;
  for (let i = 0; i < 5; i++) if (!F.haggle(s, mk, 1, () => 0.99)) fails++;
  assert.equal(fails, 5);
  assert.equal(F.haggle(s, mk, 1, () => 0), 0, '하루 두 번 실패하면 그날은 안 깎음');
  assert.ok(F.haggle(s, mk, 2, () => 0) > 0, '다음 날은 다시');
});

test('몹 몸: 힘민체지정 체력만큼 맞아야 기절, 기절한 불량배는 주머니를 떨어뜨림, 행인은 안 떨굼', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(8));
  const thug = sim.add({ id: 't1', name: '불량배', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '불량배' }, { scene: 'jongno', x: 1000, y: 560 });
  const walker = sim.add({ id: 'w1', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: 1500, y: 560 });
  // 10-30 사용자: 등급 배수 없음. 한 명마다 힘민체지정 합 25를 무작위로 나누고(칸마다 1 이상) 체력 = 500 + 체 × 100
  for (const m of [thug, walker]) {
    const b = m.base;
    assert.equal(b.str + b.dex + b.con + b.int + b.wil, 25);
    assert.ok(Math.min(b.str, b.dex, b.con, b.int, b.wil) >= 1);
    assert.equal(m.hpMax, 500 + b.con * 100);
  }
  thug.pocket = 20000;
  let id = 1;
  while (thug.hp > 0) assert.ok(sim.hitActor('t1', 1, id++, 30));
  assert.equal(thug.doing, '기절');
  assert.equal(sim.hitActor('t1', 1, id++, 30), false, '기절한 몹은 더 안 맞음');
  const drop = sim.events.find((e) => e.kind === 'drop');
  assert.equal(drop?.amount, 20000);
  walker.pocket = 9000;
  while (walker.hp > 0) sim.hitActor('w1', 1, id++, 30);
  assert.equal(sim.events.filter((e) => e.kind === 'drop').length, 1, '행인은 안 떨굼');
});

test('소매치기: 피해자 주머니에서 실제로 옮기고, 잡아 기절시키면 훔친 돈이 떨어짐', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(21), { spawns: [{ scene: 'jongno', target: { day: 12, night: 2 }, refill: [1, 2], mix: ['불량배', '행인'] }] });
  const total = () => sim.actors.reduce((n, a) => n + (a.pocket ?? 0), 0);
  let stole = false;
  for (let t = 0; t < 30 * 400 && !stole; t++) { sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 }); stole = sim.events.some((e) => e.kind === 'steal'); }
  const thief = sim.actors.find((a) => (a.stolen ?? 0) > 0);
  assert.ok(thief, '훔친 돈을 가진 도둑');
  const sum = total();
  let id = 100;
  while (thief.hp > 0) sim.hitActor(thief.def.id, 1, id++, 50);
  const drop = sim.events.find((e) => e.kind === 'drop');
  assert.ok(drop && drop.stolen > 0 && drop.amount >= drop.stolen);
  assert.equal(total(), sum - drop.amount, '떨어뜨린 만큼 주머니에서 빠짐');
});

test('겁 반응: 무기를 들이밀면 용기에 따라 얼어붙기·주저앉아 기기·웅크려 기기·뒷걸음질·달아나기로 갈림, 경찰은 안 겁먹음', () => {
  const seen = new Set();
  for (let seed = 1; seed < 60; seed++) {
    const sim = new A.WorldSim(graph(), R.mulberry32(seed));
    const m = sim.add({ id: 'w1', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: 1100, y: 560 });
    m.temper.courage = (seed % 10) / 10;
    sim.step(1 / 30, { scene: 'jongno', x: 1000, y: 560, armed: true, face: 1 });
    if (m.temper.courage >= 0.7) { assert.notEqual(m.act, 'scared'); continue; }
    assert.equal(m.act, 'scared', `용기 ${m.temper.courage}`);
    seen.add(m.scare);
  }
  assert.ok(seen.size >= 4, `갈래 ${[...seen]}`);
  const sim = new A.WorldSim(graph(), R.mulberry32(3));
  const cop = sim.add({ id: 'c1', name: '경찰', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '경찰' }, { scene: 'jongno', x: 1100, y: 560 });
  sim.step(1 / 30, { scene: 'jongno', x: 1000, y: 560, armed: true, face: 1 });
  assert.notEqual(cop.act, 'scared');
  // 무기를 안 꺼냈거나 등을 보이면 반응 없음
  const s2 = new A.WorldSim(graph(), R.mulberry32(4));
  const m2 = s2.add({ id: 'w2', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: 1100, y: 560 });
  s2.step(1 / 30, { scene: 'jongno', x: 1000, y: 560, armed: true, face: -1 });
  assert.notEqual(m2.act, 'scared');
});

test('사망·시체: 체력 0은 항상 먼저 기절, 살해 허용이면 2초 뒤 무기로 확인 사살 → 누운 채 사망(45), 시체는 장면에 남고 경찰이 와서 라바콘 라인, 1시간 뒤 수습·사건 현장', () => {
  let kill = false;
  const sim = new A.WorldSim(graph(), R.mulberry32(8), { killOk: () => kill, has: (_l, c) => ['die', 'dieLie', 'walk', 'call', 'surprise', 'idle'].includes(c) });
  const at = (id, x) => sim.add({ id, name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x, y: 560 });
  const v1 = at('v1', 1000), v2 = at('v2', 1600);
  let id = 1;
  // 살해 끔: 기절, 무기로 쳐도 기절 그대로
  while (v1.hp > 0) sim.hitActor('v1', 1, id++, 60);
  assert.equal(v1.act, 'down');
  sim.time += 3;
  assert.equal(sim.hitActor('v1', 1, id++, 10, true), false);
  // 살해 켬: 체력 0은 그래도 먼저 기절 (연타 중 죽지 않음)
  kill = true;
  while (v2.hp > 0) sim.hitActor('v2', 1, id++, 80, true);
  assert.equal(v2.act, 'down', '체력 0 = 기절');
  assert.equal(sim.hitActor('v2', 1, id++, 80, true), false, '기절 직후 2초는 무기로도 안 죽음');
  // 맨손은 기절한 몸을 못 죽임, 2초 뒤 무기(lethal)면 누운 채 사망(45)
  sim.time += 2.1;
  assert.equal(sim.hitActor('v1', 1, id++, 10, false), false, '맨손');
  assert.ok(sim.hitActor('v1', 1, id++, 10, true));
  assert.equal(v1.act, 'dead');
  assert.equal(v1.clip, 'dieLie');
  assert.ok(sim.hitActor('v2', 1, id++, 10, true));
  assert.equal(sim.events.filter((e) => e.kind === 'kill').length, 2);
  assert.equal(sim.hitActor('v2', 1, id++, 80, true), false, '시체는 안 맞음');
  // 현장 경찰이 와서 라인을 친다 (시체 둘레, 멀리 떨어진 둘은 따로)
  const cop = sim.actors.find((a) => a.plan === 'cordon');
  assert.ok(cop, '현장 경찰 출동');
  for (let t = 0; t < 30 * 30 && cop.doing !== '현장 통제'; t++) sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
  assert.equal(cop.doing, '현장 통제');
  const lines = sim.obstacles('jongno').filter((o) => o.id.startsWith('cordon'));
  assert.equal(lines.length, 2);
  for (const b of [v1, v2]) assert.ok(lines.some((o) => o.x0 < b.x && o.x1 > b.x && o.y0 <= b.y && o.y1 >= b.y), `시체 ${b.x} 둘레`);
  assert.ok(!lines.some((o) => o.wall), '길을 통째로 막지 않음');
  // 시체를 본 행인: 겁먹거나 놀라 피하거나 신고 (태연히 지나가지 않음)
  const seen = new Set();
  for (let seed = 1; seed < 30; seed++) {
    const m = sim.add({ id: `s${seed}`, name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: v1.x - 180, y: 560 });
    m.temper.courage = (seed % 10) / 10;
    m.exitAt = { x: 3900, y: 560 };
    sim.walkTo(m, m.exitAt, '지나가는 중', 'exit');
    sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
    assert.equal(m.act, "scared", `용기 ${m.temper.courage}: ${m.act} ${m.x} 시체 ${sim.corpses("jongno").map((b) => Math.round(b.x))}`);
    seen.add(m.doing);
  }
  assert.ok(seen.has('신고 중') || seen.has('놀람'), [...seen].join(','));
  // 시체가 있는 동안은 사람이 덜 들어온다
  assert.ok(sim.uproarLevel('jongno') >= 3);
  // 게임 시간 1시간: 수습 → 라인 걷음, 현장 경찰 떠남, 사건 현장 표시
  sim.step(1 / 30, { scene: 'office', x: 0, hour: 13.1 });
  assert.equal(sim.corpses('jongno').length, 0);
  assert.equal(sim.obstacles('jongno').filter((o) => o.id.startsWith('cordon')).length, 0);
  assert.notEqual(cop.plan, 'cordon');
  assert.ok(sim.incident('jongno'));
  assert.ok(sim.events.some((e) => e.kind === 'cleared'));
});

test('시체 상한: 한 장면 5구, 넘치면 오래된 것부터 치움', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(9), { killOk: () => true });
  let id = 1;
  for (let i = 0; i < 7; i++) {
    const m = sim.add({ id: `k${i}`, name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: 300 + i * 400, y: 560 });
    while (m.hp > 0) sim.hitActor(m.def.id, 1, id++, 200, true);
    sim.time += 2.1;
    sim.hitActor(m.def.id, 1, id++, 200, true);
    sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
  }
  const left = sim.corpses('jongno');
  assert.equal(left.length, 5);
  assert.ok(!left.some((a) => a.def.id === 'k0' || a.def.id === 'k1'), '오래된 것부터');
});

test('기절에서 깨어날 때: 겁 많으면 엎드린 채 기어서(38) 달아나고, 아니면 일어나 떠난다', () => {
  const run = (courage) => {
    const sim = new A.WorldSim(graph(), R.mulberry32(4), { has: (_l, c) => ['crawl', 'walk', 'down'].includes(c) });
    const m = sim.add({ id: 'w', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: 1500, y: 560 });
    m.temper.courage = courage;
    let id = 1;
    while (m.hp > 0) sim.hitActor('w', 1, id++, 200);
    for (let t = 0; t < 30 * 7; t++) sim.step(1 / 30, { scene: 'jongno', x: 1300, y: 560, hour: 12 });
    return m;
  };
  const shy = run(0.1);
  assert.equal(shy.clip, 'crawl', `${shy.act} ${shy.doing} ${shy.fleeClip}`);
  assert.equal(shy.doing, '기어서 도망');
  const brave = run(0.6);
  assert.notEqual(brave.clip, 'crawl');
});

test('NPC 퍽: 경찰은 전부, 나머지는 무작위(겁쟁이·깡다구 같이 안 붙음), 성격에 얹힘', async () => {
  const NP = await imp('npcperks');
  const rng = R.mulberry32(3);
  assert.deepEqual(NP.rollNpcPerks(rng, 'police'), NP.NPC_PERKS.police.map((p) => p.name));
  for (let i = 0; i < 300; i++) {
    const c = NP.rollNpcPerks(rng, 'civilian', { courage: 0.5, social: 0.5, haste: 0.5, curious: 0.5, sly: 0 });
    assert.ok(c.length <= 1);
    const f = NP.rollNpcPerks(rng, 'fighter');
    assert.ok(f.length >= 2 && f.length <= 4 && new Set(f).size === f.length, f.join(','));
    const g = NP.rollNpcPerks(rng, 'guard');
    assert.ok(!(g.includes('겁쟁이') && g.includes('깡다구')));
  }
  const t = { courage: 0.5, social: 0.5, haste: 0.5, curious: 0.5, sly: 0 };
  NP.applyTemper(['겁쟁이', '손버릇'], t);
  assert.equal(t.courage, 0.2);
  assert.equal(t.sly, 0.3);
  // 필드 몹은 생겨날 때 퍽이 붙고, 경찰은 전부
  const sim = new A.WorldSim(graph(), R.mulberry32(5));
  const cop = sim.add({ id: 'c', name: '경찰', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '경찰' }, { scene: 'jongno', x: 500, y: 560 });
  assert.ok(cop.perks.includes('지원 요청') && cop.perks.includes('끈질긴 추적') && cop.perks.length === 6);
});

test('NPC 퍽 필드 효과: 패거리·뒤끝·신고 정신·날쌘 도망·지원 요청·끈질긴 추적·호출', () => {
  const mk = (sim, id, arch, x, perks) => { const m = sim.add({ id, name: arch, kind: 'mob', brain: 'transit', home: 'jongno', archetype: arch }, { scene: 'jongno', x, y: 560 }); m.perks = perks; return m; };
  // 패거리: 하나가 싸움에 들어가면 같은 장면 불량배 둘까지 맞섬
  let sim = new A.WorldSim(graph(), R.mulberry32(1));
  const t1 = mk(sim, 't1', '불량배', 1000, ['패거리']), t2 = mk(sim, 't2', '불량배', 1200, []), t3 = mk(sim, 't3', '불량배', 1400, []), w = mk(sim, 'w', '행인', 1300, []);
  sim.toFight('t1');
  assert.equal(t2.doing, '맞섬'); assert.equal(t3.doing, '맞섬'); assert.notEqual(w.doing, '맞섬');
  // 뒤끝: 기절에서 깨면 한 번 다시 맞섬
  sim = new A.WorldSim(graph(), R.mulberry32(2));
  const g = mk(sim, 'g', '불량배', 1000, ['뒤끝']);
  let id = 1; while (g.hp > 0) sim.hitActor('g', 1, id++, 300);
  for (let t = 0; t < 30 * 7; t++) sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
  assert.equal(g.doing, '맞섬');
  // 날쌘 도망: 도망 속도 ×1.3
  sim = new A.WorldSim(graph(), R.mulberry32(3));
  const q = mk(sim, 'q', '행인', 1000, ['날쌘 도망']);
  sim.flee(q, 900);
  assert.ok(Math.abs(q.run - 1.8 * 1.3) < 1e-9);
  // 지원 요청: 한 번만 경찰을 더 부름
  sim = new A.WorldSim(graph(), R.mulberry32(4));
  const cop = mk(sim, 'cop', '경찰', 1000, ['지원 요청']);
  const n0 = sim.actors.length;
  sim.backup('cop'); sim.backup('cop');
  assert.equal(sim.actors.length, n0 + 1);
  // 호출: 경비가 싸움에 들어가면 한 번 경비 1명
  sim = new A.WorldSim(graph(), R.mulberry32(5));
  mk(sim, 'gd', '경비', 1000, ['호출']);
  const n1 = sim.actors.length;
  sim.toFight('gd');
  assert.equal(sim.actors.filter((a) => a.def.archetype === '경비').length, 2);
  assert.equal(sim.actors.length, n1 + 1);
  // 끈질긴 추적: 쫓던 경찰이 주인공을 따라 다음 장면으로 (한 번)
  sim = new A.WorldSim(graph(), R.mulberry32(6));
  const ch = mk(sim, 'ch', '경찰', 1000, ['끈질긴 추적']);
  sim.step(1 / 30, { scene: 'jongno', x: 900, y: 560, hour: 12 });
  sim.walkTo(ch, { x: 900, y: 560 }, '쫓는 중', 'chase');
  sim.step(1 / 30, { scene: 'street', x: 1000, y: 560, hour: 12 });
  assert.equal(ch.scene, 'street');
  assert.equal(ch.plan, 'chase');
});

test('NPC 퍽: 신고 정신은 겁 많아도 시체를 보면 먼저 신고', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(8), { killOk: () => true, has: (_l, c) => ['call', 'walk'].includes(c) });
  const v = sim.add({ id: 'v', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: 1000, y: 560 });
  let id = 1; while (v.hp > 0) sim.hitActor('v', 1, id++, 300, true);
  sim.time += 3; sim.hitActor('v', 1, id++, 10, true);
  const r = sim.add({ id: 'r', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인' }, { scene: 'jongno', x: v.x - 150, y: 560 });
  r.temper.courage = 0.1; r.perks = ['신고 정신'];
  for (const a of sim.actors.filter((x) => x.plan === 'cordon')) a.act = 'gone';
  r.exitAt = { x: 3900, y: 560 }; sim.walkTo(r, r.exitAt, '지나가는 중', 'exit');
  sim.step(1 / 30, { scene: 'office', x: 0, hour: 12 });
  assert.equal(r.doing, '신고 중');
});

test('방 이름 → 장소 종류 (10-31: 층 배치가 바뀌어도 고칠 곳 없게)', () => {
  const k = (name, floor = '2F') => P.kindFromName({ name, floor });
  assert.equal(k('화장실'), 'restroom');
  assert.equal(k('휴게실'), 'lounge');
  assert.equal(k('종합대응팀'), 'office');
  assert.equal(k('의무실·연구실'), 'clinic');
  assert.equal(k('격리실'), 'cell');
  assert.equal(k('격리 구역'), 'corridor');
  assert.equal(k('지하 주차장'), 'garage');
  assert.equal(k('1층 로비', '1F'), 'lobby');
  assert.equal(k('면담실'), 'room');
  assert.equal(k('파스타집', 'out'), 'shop');
  assert.equal(k('종로 큰길', 'out'), 'street');
  // 종류를 따로 주지 않으면 이름으로
  const g = new P.PlaceGraph([{ id: 'x', name: '3층 휴게실', floor: '3F', length: 1000, doors: [] }]);
  assert.equal(g.kind('x'), 'lounge');
});

test('직원 쉬는 시간: 근무 중 배고프면 같은 소속 건물 안 휴게실로 가서 먹고 자리로 돌아온다', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(7), {
    posts: [{ id: 'desk', archetype: '안내 직원', scene: 'f3', how: 'fixed', spot: 600, shifts: [[0, 24]], count: 1, gate: 300 }],
    has: (_l, c) => ['walk', 'idle', 'eat', 'work'].includes(c),
    sceneFaction: (s) => (['f3', 'office', 'lounge', 'lobby'].includes(s) ? 'A00' : null),
  });
  sim.step(1 / 30, { scene: 'elsewhere', x: 0, hour: 12 });
  const a = sim.actors.find((q) => q.post);
  assert.ok(a && a.needs, '직원에게 욕구');
  a.needs.hunger = 5;
  let went = false, back = false;
  for (let t = 0; t < 30 * 400; t++) {
    sim.step(1 / 30, { scene: 'elsewhere', x: 0, hour: 12 });
    if (a.scene === 'lounge' && a.act === 'do') went = true;
    if (went && a.scene === 'f3' && a.act === 'post') { back = true; break; }
  }
  assert.ok(went, `휴게실에서 먹음 (${a.scene} ${a.doing})`);
  assert.ok(back, `자리로 돌아옴 (${a.scene} ${a.doing})`);
});

test('역할 표·인원 자동: 사무실 1곳당 사무 3(의자에서 책상 일), 훈련장 1곳당 전투원 4(훈련 동작 돌아가며)', () => {
  const sc = [
    { id: 'lobby', name: '1층 로비', floor: '1F', length: 2000, lane: [420, 669], doors: [{ id: 'up', x: 1500, kind: 'stairs', up: 'f3' }] },
    { id: 'f3', name: '3층', floor: '3F', length: 2400, lane: [420, 669], doors: [{ id: 'down', x: 1500, kind: 'stairs', down: 'lobby' }, { id: 'office', x: 400, kind: 'glass', to: 'office', toDoor: 'out' }, { id: 'tr', x: 900, kind: 'door', to: 'gym', toDoor: 'out' }] },
    { id: 'office', name: '종합대응팀', floor: '3F', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'office' }], seats: [{ x: 600, y: 560, box: 0 }, { x: 800, y: 560, box: 1 }, { x: 1000, y: 560, box: 2 }] },
    { id: 'gym', name: '훈련장', floor: '3F', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'tr' }] },
  ];
  let g = new P.PlaceGraph(sc, []);
  let posts = H.autoPosts(g);
  assert.deepEqual(posts.map((p) => [p.scene, p.archetype, p.how, p.count]), [['gym', '관리국 요원', 'train', 4]]);   // 종합대응팀 = 이름 요원 방: 이름 없는 직원 안 둠
  sc[2].name = '행정실';
  assert.deepEqual(H.autoPosts(new P.PlaceGraph(sc, [])).map((p) => [p.scene, p.archetype, p.how, p.count]), [['office', '행정 직원', 'desk', 3], ['gym', '관리국 요원', 'train', 4]]);
  sc[2].name = '진압팀';
  assert.deepEqual(H.autoPosts(new P.PlaceGraph(sc, [])).map((p) => [p.archetype, p.how]), [['관리국 요원', 'desk'], ['관리국 요원', 'train']]);
  sc[2].name = '행정실';
  g = new P.PlaceGraph(sc, []);
  posts = H.autoPosts(g);
  const sim = new A.WorldSim(g, R.mulberry32(3), { posts, has: (_l, c) => ['walk', 'idle', 'work', 'seat:type', 'pushup', 'limber'].includes(c), sceneFaction: () => 'A00' });
  for (let t = 0; t < 30 * 60; t++) sim.step(1 / 30, { scene: 'elsewhere', x: 0, hour: 10 });
  const desk = sim.actors.filter((a) => a.post?.how === 'desk'), gym = sim.actors.filter((a) => a.post?.how === 'train');
  assert.equal(desk.length, 3);
  assert.equal(gym.length, 4);
  assert.ok(desk.filter((a) => a.seat?.kind === 'type').length >= 2, desk.map((a) => `${a.scene} ${a.doing}`).join(' / '));
  assert.ok(gym.some((a) => /훈련|샌드백|허수아비|사격/.test(a.doing)), gym.map((a) => `${a.scene} ${a.doing}`).join(' / '));   // 장비가 있으면 장비에서
  // 퇴근 시간이면 나간다
  for (let t = 0; t < 30 * 5; t++) sim.step(1 / 30, { scene: 'elsewhere', x: 0, hour: 19 });
  assert.ok(sim.actors.filter((a) => a.post).length === 0);
});

test('훈련 욕구: 이름 요원·전투 NPC는 훈련장에 가서 훈련, 사무·안내·의료·청소 직원은 안 감', () => {
  const sc = [
    { id: 'f3', name: '3층', floor: '3F', length: 2400, lane: [420, 669], doors: [{ id: 'gym', x: 900, kind: 'door', to: 'gym', toDoor: 'out' }, { id: 'office', x: 400, kind: 'glass', to: 'office', toDoor: 'out' }] },
    { id: 'office', name: '종합대응팀', floor: '3F', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'office' }] },
    { id: 'gym', name: '훈련장', floor: '3F', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'gym' }] },
  ];
  const g = new P.PlaceGraph(sc, []);
  const sim = new A.WorldSim(g, R.mulberry32(2), {
    posts: [{ id: 'g', archetype: '경비', scene: 'f3', how: 'fixed', spot: 1200, shifts: [[0, 24]], count: 1, gate: 100 }, { id: 'd', archetype: '안내 직원', scene: 'f3', how: 'fixed', spot: 1400, shifts: [[0, 24]], count: 1, gate: 100 }],
    has: (_l, c) => ['walk', 'idle', 'train', 'work'].includes(c), sceneFaction: () => 'A00',
  });
  const agent = sim.add({ id: 'n', name: '쟈알디', kind: 'named', brain: 'needs', home: 'office', roam: ['office', 'f3', 'gym'], look: '쟈알디' });
  sim.step(1 / 30, { scene: 'elsewhere', x: 0, hour: 20 });
  const guard = sim.actors.find((a) => a.post?.id === 'g'), desk = sim.actors.find((a) => a.post?.id === 'd');
  for (const a of [agent, guard, desk]) { for (const k of Object.keys(a.needs)) a.needs[k] = 100; a.needs.train = 5; }
  const seen = new Set();
  for (let t = 0; t < 30 * 300; t++) {
    sim.step(1 / 30, { scene: 'elsewhere', x: 0, hour: 20 });
    for (const a of [agent, guard, desk]) if (a.scene === 'gym' && a.act === 'do' && a.task?.id === 'train') seen.add(a.def.id);
  }
  assert.ok(seen.has('n'), '이름 요원 훈련');
  assert.ok(seen.has(guard.def.id), '경비 훈련');
  assert.ok(!seen.has(desk.def.id), '안내 직원은 안 감');
});

test('상호작용: 동료끼리 지나가다 인사·한가하면 선 채 대화, 경비 무전 보고, 의사 진료, 직원도 주인공을 보면 응대', () => {
  const clips = ['walk', 'idle', 'greet', 'nod', 'talk', 'radio', 'exam', 'treat', 'angry'];
  const sc = [{ id: 'hall', name: '3층', floor: '3F', length: 2400, lane: [420, 669], doors: [] }, { id: 'med', name: '의무실', floor: 'B2', length: 1600, lane: [470, 680], doors: [] }];
  const g = new P.PlaceGraph(sc, []);
  // 인사·대화
  let sim = new A.WorldSim(g, R.mulberry32(1), { has: (_l, c) => clips.includes(c) });
  const x = sim.add({ id: 'x', name: '쟈알디', kind: 'named', brain: 'roam', home: 'hall' }, { scene: 'hall', x: 1000, y: 560 });
  const y = sim.add({ id: 'y', name: '에일린', kind: 'named', brain: 'roam', home: 'hall' }, { scene: 'hall', x: 1060, y: 560 });
  x.chatCd = 0; y.chatCd = 0; x.act = y.act = 'idle'; x.wait = y.wait = 99;
  sim.step(1 / 30, { scene: 'else', x: 0, hour: 12 });
  assert.ok(x.doing.startsWith('대화') && y.doing.startsWith('대화'), `${x.doing} / ${y.doing}`);
  assert.equal(x.clip, 'talk');
  // 무전 보고·의사 진료
  sim = new A.WorldSim(g, R.mulberry32(3), {
    posts: [{ id: 'gd', archetype: '경비', scene: 'hall', how: 'fixed', spot: 500, shifts: [[0, 24]], count: 1, gate: 100 }, { id: 'dr', archetype: '의사', scene: 'med', how: 'fixed', spot: 900, shifts: [[0, 24]], count: 1, gate: 100 }],
    has: (_l, c) => clips.includes(c),
  });
  const pt = sim.add({ id: 'pt', name: '데드폴', kind: 'named', brain: 'roam', home: 'med' }, { scene: 'med', x: 400, y: 560 });
  pt.act = 'idle'; pt.wait = 1e9;
  const seen = new Set();
  for (let t = 0; t < 30 * 200; t++) {
    sim.step(1 / 30, { scene: 'else', x: 0, hour: 12 });
    for (const a of sim.actors) seen.add(a.doing);
  }
  assert.ok(seen.has('무전 보고'), [...seen].join(','));
  assert.ok(seen.has('진료 중') && seen.has('치료받는 중'), [...seen].join(','));
  // 직원이 주인공을 보면 응대
  const gd = sim.actors.find((a) => a.post?.id === 'gd');
  gd.act = 'post'; gd.noticeCd = 0; gd.wait = 99;
  sim.step(1 / 30, { scene: 'hall', x: gd.x + 100, y: gd.y, hour: 12 });
  assert.equal(gd.act, 'notice');
});

test('훈련장 장비: 샌드백·허수아비·과녁이 방 길이에 비례해 놓이고, 훈련은 빈 장비 앞에서 연타·사격(한 장비에 한 명)', () => {
  const sc = [{ id: 'gym', name: '훈련장', floor: 'B1', length: 2000, lane: [470, 680], doors: [{ id: 'out', x: 100, kind: 'exit', side: 'S' }] }];
  const g = new P.PlaceGraph(sc, []);
  const sim = new A.WorldSim(g, R.mulberry32(4), {
    posts: [{ id: 'tr', archetype: '관리국 요원', scene: 'gym', how: 'train', shifts: [[0, 24]], count: 4, gate: 100 }],
    has: (_l, c) => ['walk', 'idle', 'train', 'strike', 'shoot'].includes(c), sceneFaction: () => 'A00',
  });
  const gs = sim.gear('gym');
  assert.deepEqual(gs.map((q) => q.kind), ['sandbag', 'sandbag', 'dummy', 'dummy', 'target', 'target', 'target']);
  assert.ok(gs[0].x < gs[2].x && gs[2].x < gs[4].x && gs[4].x <= 2000);
  assert.deepEqual(sim.gear('nope'), []);
  const doings = new Set();
  for (let t = 0; t < 30 * 90; t++) {
    sim.step(1 / 30, { scene: 'else', x: 0, hour: 12 });
    const users = sim.actors.filter((a) => a.act === 'do' && a.station);
    assert.equal(new Set(users.map((a) => a.station)).size, users.length, '한 장비에 한 명');
    for (const a of users) doings.add(a.doing);
  }
  assert.ok(doings.has('사격 훈련') && (doings.has('샌드백 치기') || doings.has('허수아비 치기')), [...doings].join(','));
  assert.ok(sim.gear('gym').some((q) => q.busy));
});

// C16 평소 거리 순찰 (10-31): 거리 장면에 가끔 경찰 1~2명이 천천히 지나가고, 범죄가 나면 먼저 달려오고, 시체를 보면 현장을 맡는다
test('순찰 경찰: 거리에만 가끔 들어와 지나가고, 실내엔 없음', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(5), [
    { scene: 'jongno', target: { day: 0, night: 0 }, refill: [1, 2], mix: ['행인'] },
    { scene: 'lobby', target: { day: 0, night: 0 }, refill: [1, 2], mix: ['방문객'] },
  ]);
  const seen = new Set();
  for (let i = 0; i < 20 * 60 * 10; i++) {
    sim.step(0.1, { scene: 'f3', x: 400, hour: 14 });
    for (const a of sim.actors) if (a.patrol) seen.add(`${a.scene}:${a.def.id}`);
  }
  const ids = [...seen];
  assert.ok(ids.length >= 2, `20분 동안 순찰 ${ids.length}`);
  assert.ok(ids.every((k) => k.startsWith('jongno:')), `거리에만 ${ids}`);
});

test('순찰 경찰: 범죄가 나면 그 장면 순찰이 먼저 달려오고, 있는 동안 소매치기·시비를 안 벌인다', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(8));
  const [p] = sim.spawnPatrol('jongno');
  assert.ok(p.patrol && p.plan === 'exit' && /순찰/.test(p.doing));
  const before = sim.actors.filter((a) => a.def.archetype === '경찰').length;
  sim.crime('jongno', 2000);
  assert.equal(p.plan, 'chase', '순찰이 달려옴');
  // 순찰(들)이 출동 인원(1 + 소란 단계)에 먼저 들어가고, 모자란 만큼만 새로 부른다
  const need = 1 + sim.uproarLevel('jongno');
  assert.equal(sim.actors.filter((a) => a.def.archetype === '경찰').length, Math.max(before, need), '모자란 만큼만 새로');
  // 손버릇 높은 불량배: 순찰이 있으면 소매치기 안 함
  const sim2 = new A.WorldSim(graph(), R.mulberry32(9));
  sim2.spawnPatrol('jongno');
  const t = sim2.add({ id: 't1', name: '불량배', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '불량배', look: '불량배' }, { scene: 'jongno', x: 1000, y: 550 });
  t.temper = { courage: 0.9, social: 0.5, haste: 0.5, curious: 0.1, sly: 1 };
  for (let i = 0; i < 6; i++) sim2.add({ id: `v${i}`, name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인', look: '행인' }, { scene: 'jongno', x: 900 + i * 60, y: 560 });
  for (const a of sim2.actors) if (a.def.id !== 't1' && !a.patrol) { a.exitAt = { x: 3900, y: a.y }; }
  let stole = false;
  for (let i = 0; i < 600; i++) { sim2.step(0.1, { scene: 'f3', x: 400, hour: 14 }); if (sim2.events.some((e) => e.kind === 'steal')) stole = true; if (!sim2.actors.some((a) => a.patrol)) break; }
  assert.equal(stole, false, '순찰이 있는 동안 소매치기 없음');
});

test('순찰 경찰: 지나가다 시체를 보면 현장 경찰이 된다 (라인)', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(12));
  const body = sim.add({ id: 'b1', name: '행인', kind: 'mob', brain: 'transit', home: 'jongno', archetype: '행인', look: '행인' }, { scene: 'jongno', x: 600, y: 560 });
  body.act = 'dead';
  body.goal = null;
  const team = sim.spawnPatrol('jongno', [30, 3970]);
  // 한 조(1~2명) 중 한 명이 맡는다
  const cop = () => team.find((q) => q.plan === 'cordon');
  for (let i = 0; i < 1200 && !cop(); i++) sim.step(0.1, { scene: 'f3', x: 400, hour: 14 });
  const p = cop();
  assert.ok(p, `순찰 → 현장 (${team.map((q) => q.doing)})`);
  assert.equal(p.patrol, false);
  assert.equal(team.filter((q) => q.plan === 'cordon').length, 1, '한 명만');
  for (let i = 0; i < 600 && p.doing !== '현장 통제'; i++) sim.step(0.1, { scene: 'f3', x: 400, hour: 14 });
  assert.equal(p.doing, '현장 통제');
  assert.ok(sim.obstacles('jongno').length > 0, '라바콘 라인');
});

// 방문 대응 (10-31 사용자): 다른 세력 사람이 세력 거점에 들어오면 세력 관계대로. 기본값 = 큰 세력 셋 서로 적대, 나머지 중립
test('세력 관계 기본값: 관리국·가짜 관리국·백일몽은 서로 적대, 협회·중림 등은 중립. 플러그인 표가 있으면 그것', async () => {
  const F = await imp('factions');
  assert.equal(F.defaultRelation('A00', 'B00'), 'hostile');
  assert.equal(F.defaultRelation('C00', 'A00'), 'hostile');
  assert.equal(F.defaultRelation('A00', 'E00'), 'neutral');
  assert.equal(F.defaultRelation('A00', 'A00'), 'friendly');
  const rel = F.relationFrom({ 'A00>C00': 'wary' });
  assert.equal(rel('A00', 'C00'), 'wary');
  assert.equal(rel('A00', 'B00'), 'neutral', '표에 없으면 중립');
  assert.equal(F.relationFrom(null)('A00', 'B00'), 'hostile', '기능 꺼짐 = 기본값');
});

const hqSim = (seed, relation) => new A.WorldSim(graph(), R.mulberry32(seed), { sceneFaction: (s) => (['lobby', 'f3', 'office', 'lounge'].includes(s) ? 'A00' : null), ...(relation ? { relation } : {}) });
const guardAt = (sim, x) => sim.add({ id: `g${x}`, name: '경비', kind: 'mob', brain: 'transit', home: 'lobby', archetype: '경비', look: '경비' }, { scene: 'lobby', x, y: 540 });

test('방문 대응 적대: 경비가 막아서 싸우고, 한쪽이 쓰러지면 끝 (장부 사건)', () => {
  const sim = hqSim(21);
  const g = guardAt(sim, 900);
  const v = sim.spawnVisitor('lobby', '불량배', 'B00', 300);
  for (let i = 0; i < 20 && !g.brawl; i++) sim.step(0.1, { scene: 'street', x: 100, hour: 14 });
  assert.ok(g.brawl && g.brawl.foe === v.def.id, '경비가 붙음');
  assert.ok(sim.events.some((e) => e.kind === 'brawl' && e.bf === 'B00'));
  let end;
  for (let i = 0; i < 1200 && !end; i++) { sim.step(0.1, { scene: 'street', x: 100, hour: 14 }); end = sim.events.find((e) => e.kind === 'brawlEnd'); }
  assert.ok(end, '싸움이 끝남');
  const loser = [g, v].find((q) => q.def.name === end.loser && (q.act === 'down' || q.act === 'walk' || q.act === 'gone'));
  assert.ok(loser, JSON.stringify(end));
  assert.ok(!g.brawl && !v.brawl, '둘 다 싸움에서 빠짐');
});

test('방문 대응 경계: 경비가 따라붙어 경고하고 내보냄, 우호는 인사, 중립은 무시', () => {
  const sim = hqSim(22, (a, b) => ({ 'A00>E00': 'wary', 'A00>C00': 'favorable' })[`${a}>${b}`] ?? 'neutral');
  const g = guardAt(sim, 1200);
  const v = sim.spawnVisitor('lobby', '행인', 'E00', 300);
  v.goal = null; v.act = 'idle'; v.wait = 1e9; v.plan = 'none';   // 머무는 방문자
  for (let i = 0; i < 300 && !sim.events.some((e) => e.kind === 'expel'); i++) sim.step(0.1, { scene: 'street', x: 100, hour: 14 });
  assert.ok(sim.events.some((e) => e.kind === 'expel' && e.by === '경비'), '내보냄');
  assert.equal(v.doing, '쫓겨남');
  assert.ok(!g.brawl, '경계는 싸우지 않음');
  const sim2 = hqSim(23, (a, b) => (b === 'C00' ? 'favorable' : 'neutral'));
  const g2 = guardAt(sim2, 400);
  sim2.spawnVisitor('lobby', '행인', 'C00', 300);
  for (let i = 0; i < 20 && !g2.greeted; i++) sim2.step(0.1, { scene: 'street', x: 100, hour: 14 });
  assert.ok(g2.greeted?.length, '호의 = 인사');
  const sim3 = hqSim(24, () => 'neutral');
  const g3 = guardAt(sim3, 400);
  sim3.spawnVisitor('lobby', '행인', 'D00', 300);
  for (let i = 0; i < 100; i++) sim3.step(0.1, { scene: 'street', x: 100, hour: 14 });
  assert.ok(!g3.greeted && !g3.escort && !g3.brawl, '중립 = 무시');
});

// C4 (10-31 사용자 가안): 이름 인물은 첫 대에 화내고, 6초 안에 또 맞으면 맞서 싸운다 (전투 AI 몸으로 넘김). 싸움에서 지면 기절
test('이름 인물: 한 대 = 화냄, 6초 안에 또 = 맞섬(전투로), 지면 기절 뒤 깨어남', () => {
  const sim = new A.WorldSim(graph(), R.mulberry32(31));
  const n = sim.add({ id: 'npc:잼트리', name: '잼트리', kind: 'named', brain: 'needs', home: 'office', look: '잼트리' }, { scene: 'office', x: 600, y: 560 });
  sim.step(0.1, { scene: 'office', x: 500, hour: 14 });
  assert.ok(sim.hitActor(n.def.id, 1, 1));
  assert.equal(n.doing, '맞고 화남');
  assert.equal(sim.challengers('office').length, 0, '한 대로는 안 싸움');
  for (let i = 0; i < 70; i++) sim.step(0.1, { scene: 'office', x: 500, hour: 14 });   // 7초 지남
  sim.hitActor(n.def.id, 1, 2);
  assert.equal(n.doing, '맞고 화남', '6초가 지나면 다시 처음부터');
  for (let i = 0; i < 20; i++) sim.step(0.1, { scene: 'office', x: 500, hour: 14 });
  sim.hitActor(n.def.id, 1, 3);
  assert.equal(n.doing, '맞섬');
  assert.deepEqual(n.perks, ['스탯 뻥튀기', '체력 뻥튀기'], '이름 인물 퍽 (×1.5)');
  assert.deepEqual(sim.challengers('office').map((a) => a.def.id), [n.def.id], '전투 AI로 넘길 몸');
  assert.ok(sim.toFight(n.def.id));
  sim.fromFight(n.def.id, 620, 560, true);
  assert.equal(n.act, 'down');
  assert.equal(n.doing, '기절');
  for (let i = 0; i < 200 && n.act === 'down'; i++) sim.step(0.1, { scene: 'office', x: 500, hour: 14 });
  assert.notEqual(n.act, 'down', '깨어남');
  assert.ok(n.hp > 0);
});

test('몹 그림 신상: 성별·나이대는 그림 설계 문서대로, 직업은 적힌 것만 (안 적힌 시민 = 직업 없음)', () => {
  assert.deepEqual([M.profileOf('시민여2').sex, M.profileOf('시민여2').age, M.profileOf('시민여2').job], ['여', '60대 후반', undefined]);
  assert.equal(M.profileOf('시민여9').job, '회사원');
  assert.equal(M.profileOf('청소부여1').sex, '여');
  assert.equal(M.profileOf('학생남1').age, '10대(고등학생)');
  assert.equal(M.profileOf('없는그림'), null);
  for (const a of Object.values(M.ARCHETYPES)) for (const l of a.looks ?? []) assert.ok(M.profileOf(l), `원형 ${a.name}의 그림 ${l} 신상 없음`);
});
