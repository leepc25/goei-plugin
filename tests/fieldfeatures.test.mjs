// 필드 기능 (10-31 사용자 결정 docs/필드기능_결정_1031.md): 동행·쫓아냄·반응·말다툼·수다·퇴근·경보
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-fieldfeat-'));
const names = ['rng', 'places', 'actors', 'namedReact'];
await build({ entryPoints: [...names.map((n) => `src/game/world/${n}.ts`), 'src/core/visitPrompt.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const imp = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const R = await imp('game/world/rng'), P = await imp('game/world/places'), A = await imp('game/world/actors'), NR = await imp('game/world/namedReact'), VP = await imp('core/visitPrompt');

const scenes = [
  { id: 'lobby', name: '로비', length: 2000, lane: [420, 669], doors: [{ id: 'main', x: 300, kind: 'glass', to: 'street', toDoor: 'main' }, { id: 'stairs', x: 1500, kind: 'stairs', up: 'f3' }] },
  { id: 'street', name: '거리', length: 1920, legacy: true, doors: [{ id: 'main', x: 640, kind: 'main', to: 'lobby', toDoor: 'main' }] },
  { id: 'f3', name: '3층', length: 2400, lane: [420, 669], doors: [{ id: 'office', x: 400, kind: 'glass', to: 'office', toDoor: 'out' }, { id: 'stairs', x: 2000, kind: 'stairs', down: 'lobby' }] },
  { id: 'office', name: '사무실', length: 1600, lane: [470, 680], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'office' }] },
];
const kinds = { office: 'office', f3: 'corridor', lobby: 'lobby', street: 'street' };
const HQ = new Set(['lobby', 'f3', 'office']);
const sim = (o = {}) => new A.WorldSim(new P.PlaceGraph(scenes, [], kinds), R.mulberry32(7), { sceneFaction: (s) => (HQ.has(s) ? 'A00' : null), ...o });
const named = (w, name, scene = 'office', x = 800) => w.add({ id: `npc:${name}`, name, kind: 'named', brain: 'needs', home: scene, roam: [scene], look: name }, { scene, x, y: 560 });
const run = (w, sec, player) => { for (let t = 0; t < sec; t += 1 / 30) w.step(1 / 30, typeof player === 'function' ? player(t) : player); };

test('표시: 답 끝 [[동행]] 등을 떼고 종류만 남긴다 (모르는 [[…]]는 그대로)', () => {
  const r = VP.takeFieldTags('좋아, 가자.\n[[동행]]');
  assert.deepEqual(r.tags, ['follow']);
  assert.equal(r.raw.trim(), '좋아, 가자.');
  assert.deepEqual(VP.takeFieldTags('싫어.').tags, []);
  assert.deepEqual(VP.takeFieldTags('a [[기다림]] [[복귀]] [[허가]] [[경보]] [[호감 +1]]').tags, ['wait', 'return', 'permit', 'alarm']);
  assert.match(VP.takeFieldTags('x [[호감 +1]]').raw, /\[\[호감/);
  assert.equal(VP.fieldTagRules([]), '');
  assert.match(VP.fieldTagRules(['follow']), /\[\[동행\]\]/);
});

test('동행: 따라 걷고, 장면을 같이 넘고, 기다려·돌아가', () => {
  const w = sim();
  const a = named(w, '에일린');
  run(w, 1, { scene: 'office', x: 600, y: 560 });
  assert.ok(w.setFollow('에일린', 'follow'));
  assert.ok(a.following);
  // 주인공이 오른쪽으로 걸어감 → 뒤따라 옴
  run(w, 6, (t) => ({ scene: 'office', x: 600 + Math.min(t, 4) * 200, y: 560 }));
  assert.ok(Math.abs(a.x - 1400) < 260, `따라옴 x=${a.x}`);
  assert.ok(a.x < 1400, '주인공 뒤');
  // 장면 이동
  run(w, 0.2, { scene: 'f3', x: 420, y: 560 });
  assert.equal(a.scene, 'f3');
  assert.equal(w.events.filter((e) => e.kind === 'follow').length, 1);
  // 기다려: 동행이 풀리고 그 자리
  assert.ok(w.setFollow('에일린', 'wait'));
  const x0 = a.x;
  run(w, 10, { scene: 'f3', x: 2000, y: 560 });
  assert.ok(!a.following && a.hold);
  assert.ok(Math.abs(a.x - x0) < 5, '기다림');
  // 돌아가: 일과로
  assert.ok(w.setFollow('에일린', 'return'));
  assert.ok(!a.hold && !a.following);
});

test('동행: 최대 4명, 쓰러지면 풀림', () => {
  const w = sim();
  const ps = ['가', '나', '다', '라', '마'].map((n, i) => named(w, n, 'office', 500 + i * 60));
  run(w, 0.5, { scene: 'office', x: 600, y: 560 });
  const ok = ps.map((p) => w.setFollow(p.def.name, 'follow'));
  assert.deepEqual(ok, [true, true, true, true, false]);
  ps[0].act = 'down';
  run(w, 0.1, { scene: 'office', x: 600, y: 560 });
  assert.ok(!ps[0].following);
  assert.ok(w.events.some((e) => e.kind === 'follow' && e.mode === 'hit'));
});

test('반응표: 55명, 칸 값은 정해진 동작·행동만', () => {
  const acts = new Set(['ignore', 'watch', 'approach', 'confront', 'attack', 'protect', 'report', 'avoid', 'flee', 'cower']);
  let n = 0;
  for (const name of ['쟈알디', '에일린', '콘쥬스', '탐미주의']) assert.ok(NR.reactOf(name), name);
  for (const s of ['weapon', 'body', 'uproar', 'crime', 'allyHit', 'allyDown']) {
    const c = NR.reactCell('에일린', s);
    assert.ok(c && acts.has(c.act), s);
    n++;
  }
  assert.equal(n, 6);
  assert.equal(NR.reactOf('콘쥬스').combat, false);
});

test('경보: 거점 안에서 주인공이 때리면 켜지고, 다른 방 전투원까지 모이고, 비전투원은 피하고, 떠나면 꺼진다', () => {
  const w = sim();
  w.noAssist = (n) => n === '콘쥬스';
  const fighter = named(w, '에일린', 'f3', 1800);
  const civ = named(w, '콘쥬스', 'office', 900);
  const victim = named(w, '잼트리', 'office', 700);
  const P = { scene: 'office', x: 650, y: 560 };
  run(w, 0.5, P);
  assert.ok(w.hitActor(victim.def.id, 1, 1, 10));
  assert.ok(w.alarmIn('office') && w.alarmIn('f3'), '거점 전체');
  assert.ok(w.events.some((e) => e.kind === 'alarm' && e.on && e.threat === '{user}'));
  run(w, 8, P);
  assert.equal(fighter.alarm, 'A00');
  assert.ok(fighter.scene === 'office' || fighter.route.length || fighter.act === 'door', `현장으로: ${fighter.scene} ${fighter.doing}`);
  assert.equal(civ.alarm, 'A00');
  assert.ok(civ.x > 900, `반대쪽으로 피함 x=${civ.x}`);
  // 주인공이 거점 밖으로 → 15초 뒤 해제
  run(w, 20, { scene: 'street', x: 600, y: 560 });
  assert.ok(!w.alarmIn('office'));
  assert.ok(w.events.some((e) => e.kind === 'alarm' && !e.on));
});

test('경보: 적대 방문자는 들어오자마자 경보, 위협은 방문자', () => {
  const w = sim({ relation: (v, t) => (v === 'A00' && t === 'B00' ? 'hostile' : 'neutral') });
  named(w, '에일린', 'f3', 1800);
  const v = w.spawnVisitor('lobby', '불량배', 'B00', 400);
  run(w, 1, { scene: 'street', x: 600, y: 560 });
  assert.ok(w.alarmIn('lobby'));
  assert.deepEqual(w.alarmOf('A00').threats, [v.def.id]);
});

const guardAt = (w, scene, x) => { const g = w.add({ id: `g${x}`, name: '경비', kind: 'mob', brain: 'transit', home: scene, archetype: '경비', look: '경비' }, { scene, x, y: 560 }); g.exitAt = undefined; g.act = 'idle'; g.wait = 999; return g; };

test('쫓아냄: 경계 거점에서 버티면(제자리) 경보, 출구로 가면 시간이 멈추고 나가면 쫓겨남', () => {
  const w = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g = guardAt(w, 'lobby', 1200);
  run(w, 14.5, { scene: 'lobby', x: 1000, y: 560 });
  assert.equal(g.escort, 'player');
  assert.ok(w.guardingPlayer(g.def.id));
  run(w, 10, { scene: 'lobby', x: 1000, y: 560 });
  assert.ok(!w.alarmIn('lobby'), '아직');
  run(w, 12, { scene: 'lobby', x: 1000, y: 560 });
  assert.ok(w.alarmIn('lobby'), '버팀 → 경보');
  assert.ok(w.events.some((e) => e.kind === 'alarm' && e.why === 'trespass'));

  const w2 = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  guardAt(w2, 'lobby', 1200);
  run(w2, 15, { scene: 'lobby', x: 1600, y: 560 });
  // 출구(x=300 문) 쪽으로 천천히 걸음: 시간이 안 흐름
  run(w2, 40, (t) => ({ scene: 'lobby', x: 1600 - t * 30, y: 560 }));
  assert.ok(!w2.alarmIn('lobby'), '나가는 중엔 안 울림');
  run(w2, 1, { scene: 'street', x: 640, y: 560 });
  assert.ok(w2.events.some((e) => e.kind === 'expel' && e.who === '{user}'));
});

test('쫓아냄: 경비가 [[허가]]면 머물고, [[경보]]면 바로 경보', () => {
  const w = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g = guardAt(w, 'lobby', 1200);
  run(w, 15, { scene: 'lobby', x: 1000, y: 560 });
  w.permitPlayer();
  run(w, 40, { scene: 'lobby', x: 1000, y: 560 });
  assert.ok(!w.alarmIn('lobby'));
  const w2 = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g2 = guardAt(w2, 'lobby', 1200);
  run(w2, 7, { scene: 'lobby', x: 1000, y: 560 });
  w2.threatAlarm(g2.def.id);
  assert.ok(w2.alarmIn('lobby'));
  void g;
});

test('캐릭터 반응: 반응표대로 인물마다 다르게 (무기·동료가 맞음·시체)', () => {
  const w = sim();
  const e = named(w, '에일린', 'office', 900);
  const k = named(w, '콘쥬스', 'office', 960);
  const z = named(w, '쟈알디', 'office', 1300);
  run(w, 0.3, { scene: 'office', x: 700, y: 560 });
  // 무기를 꺼내 오른쪽(에일린·콘쥬스 쪽)을 봄
  run(w, 0.2, { scene: 'office', x: 700, y: 560, armed: true, face: 1 });
  assert.equal(e.doing, '맞서 버팀');   // 에일린: confront
  assert.equal(e.icon, '…');
  assert.equal(k.doing, '자리를 피함'); // 콘쥬스: avoid
  // 주인공이 콘쥬스를 때림 → 에일린(동료가 맞음 = attack) 주인공에게 덤빔
  const w2 = sim();
  const e2 = named(w2, '에일린', 'office', 900);
  const k2 = named(w2, '콘쥬스', 'office', 1000);
  run(w2, 0.3, { scene: 'office', x: 950, y: 560 });
  w2.hitActor(k2.def.id, 1, 5, 10);
  assert.equal(e2.plan, 'chase');
  // 시체를 봄: 쟈알디 approach
  const w3 = sim();
  const z3 = named(w3, '쟈알디', 'office', 900);
  const body = w3.add({ id: 'm1', name: '행인', kind: 'mob', brain: 'transit', home: 'office', archetype: '시민', look: '시민' }, { scene: 'office', x: 1000, y: 560 });
  body.act = 'dead';
  run(w3, 0.3, { scene: 'street', x: 100, y: 560 });
  assert.ok(['살피러 감', '살핌'].includes(z3.doing), z3.doing);
  void z;
});

test('말다툼·수다: 캐릭터끼리도 말다툼(화난 포즈·#), 수다는 먼저 건 쪽 「…」', () => {
  let argue = 0, chat = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const w = new A.WorldSim(new P.PlaceGraph(scenes, [], kinds), R.mulberry32(seed), {});
    const a = named(w, '가', 'office', 800), b = named(w, '나', 'office', 860);
    a.needs.social = 10; b.needs.social = 10;
    for (let t = 0; t < 120; t += 1 / 30) {
      a.x = 800; b.x = 860; a.y = b.y = 560;   // 붙어 서 있게
      for (const q of [a, b]) if (q.act === 'walk' || q.act === 'idle') { q.act = 'idle'; q.wait = 99; q.goal = null; }
      w.step(1 / 30, { scene: 'street', x: 0, y: 560 });
      if (a.doing === '말다툼' && b.doing === '말다툼' && a.icon === '#') argue++;
      if (a.doing.includes('먼저 말 걺') && a.icon === '…') chat++;
    }
  }
  assert.ok(argue >= 1, '말다툼이 일어남');
  assert.ok(chat >= 1, '수다 「…」');
});
