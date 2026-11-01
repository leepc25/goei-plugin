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
  // 관계 계기 표시 (11-01): [[관계 도움]] 을 떼어 계기로, 모르는 계기·살해 급은 그대로 둔다
  const c1 = VP.takeCueTag('고마워.\n[[관계 도움]]');
  assert.equal(c1.cue, '도움'); assert.equal(c1.raw.trim(), '고마워.');
  assert.equal(VP.takeCueTag('[[관계: 실망]]').cue, '실망');
  assert.equal(VP.takeCueTag('x [[관계 중대위반]]').cue, null);
  assert.match(VP.takeCueTag('x [[관계 중대위반]]').raw, /\[\[관계/);
  assert.match(VP.cueTagRules(), /\[\[관계 작은친절\]\]/);
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

test('동행: 인원 제한 없음(11-01), 쓰러지면 풀림', () => {
  const w = sim();
  const ps = ['가', '나', '다', '라', '마'].map((n, i) => named(w, n, 'office', 500 + i * 60));
  run(w, 0.5, { scene: 'office', x: 600, y: 560 });
  const ok = ps.map((p) => w.setFollow(p.def.name, 'follow'));
  assert.deepEqual(ok, [true, true, true, true, true]);
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

const mobAt = (w, scene, x, hp = 30) => { const m = w.add({ id: `m${x}`, name: '행정 직원', kind: 'mob', brain: 'transit', home: scene, archetype: '행정 직원', look: '행정 직원' }, { scene, x, y: 560 }); m.hp = hp; m.act = 'idle'; m.wait = 999; return m; };

test('경보: 때리기만 해선 안 울리고, 기절시키는 걸 본 사람이 있으면 거점 전체 경보 → 전투원 모임·비전투원 피함·떠나면 꺼짐 (11-01)', () => {
  const w = sim();
  w.noAssist = (n) => n === '콘쥬스';
  const fighter = named(w, '에일린', 'f3', 1800);
  const civ = named(w, '콘쥬스', 'office', 900);
  const victim = mobAt(w, 'office', 700, 25);
  const P = { scene: 'office', x: 650, y: 560 };
  run(w, 0.5, P);
  assert.ok(w.hitActor(victim.def.id, 1, 1, 10));
  assert.ok(!w.alarmIn('office'), '한 대로는 경보 아님');
  run(w, 0.5, P);
  assert.ok(w.hitActor(victim.def.id, 1, 2, 30));
  assert.ok((victim.hp ?? 1) <= 0, '기절');
  assert.ok(w.alarmIn('office') && w.alarmIn('f3'), '본 사람(콘쥬스) 있음 → 거점 전체');
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

test('경보: 아무도 못 본 기절은 경보가 아니다', () => {
  const w = sim();
  const victim = mobAt(w, 'office', 300, 5);
  run(w, 0.5, { scene: 'office', x: 250, y: 560 });
  assert.ok(w.hitActor(victim.def.id, 1, 1, 30));
  assert.ok(!w.alarmIn('office'));
});

test('쫓아냄: 경비가 목격 거리 안에서 봐야 따라붙음, 제자리는 시간 안 잼, 안쪽 방·층으로 가면 경비가 덤빔, 출구로 나가면 쫓겨남 (11-01)', () => {
  const w = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g = guardAt(w, 'lobby', 1900);
  run(w, 3, { scene: 'lobby', x: 1000, y: 560 });
  assert.ok(!g.escort, '멀리 있으면 못 봄');
  run(w, 3, { scene: 'lobby', x: 1600, y: 560 });
  assert.equal(g.escort, 'player');
  assert.ok(w.guardingPlayer(g.def.id));
  assert.ok(w.events.some((e) => e.kind === 'warn'));
  run(w, 60, { scene: 'lobby', x: 1600, y: 560 });
  assert.ok(!w.alarmIn('lobby') && g.plan !== 'chase', '제자리로는 아무 일 없음');
  // 경고 무시하고 위층(안쪽)으로
  run(w, 0.5, { scene: 'f3', x: 2000, y: 560 });
  assert.ok(w.events.some((e) => e.kind === 'guardAttack'));
  assert.equal(g.plan, 'chase');
  assert.ok(!w.alarmIn('lobby'), '덤비는 건 경보가 아님');

  const w2 = sim({ stance: (f) => (f === 'A00' ? 'hostile' : null) });
  guardAt(w2, 'f3', 1900);
  run(w2, 3, { scene: 'f3', x: 1800, y: 560 });
  assert.ok(w2.events.some((e) => e.kind === 'warn'), '적대도 경고부터');
  assert.ok(!w2.alarmIn('f3'));
  // 출구 쪽(로비)으로는 괜찮다 → 거리로 나가면 쫓겨남
  run(w2, 0.5, { scene: 'lobby', x: 1500, y: 560 });
  assert.ok(!w2.events.some((e) => e.kind === 'guardAttack'));
  run(w2, 1, { scene: 'street', x: 640, y: 560 });
  assert.ok(w2.events.some((e) => e.kind === 'expel' && e.who === '{user}'));
});

test('쫓아냄: 그 거점 인물과 동행 중이면 경비가 보내 줌 (11-01)', () => {
  const w = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g = guardAt(w, 'lobby', 1200);
  const e = named(w, '에일린', 'lobby', 900);
  e.def.faction = 'A00';
  run(w, 0.5, { scene: 'lobby', x: 950, y: 560 });
  assert.ok(w.setFollow('에일린', 'follow'));
  run(w, 5, { scene: 'lobby', x: 1100, y: 560 });
  assert.ok(!g.escort, '경고 안 함');
  run(w, 0.5, { scene: 'f3', x: 2000, y: 560 });
  assert.ok(!w.events.some((x) => x.kind === 'guardAttack'));
});

test('쫓아냄: [[허가]]면 이번 방문 출입증, [[경보]]·무기면 경비가 덤빔 (11-01)', () => {
  const w = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g = guardAt(w, 'lobby', 1200);
  run(w, 3, { scene: 'lobby', x: 1000, y: 560 });
  w.permitPlayer();
  run(w, 0.5, { scene: 'f3', x: 2000, y: 560 });
  assert.ok(!w.events.some((e) => e.kind === 'guardAttack'), '허가 뒤엔 안쪽으로 가도 됨');
  const w2 = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g2 = guardAt(w2, 'lobby', 1200);
  run(w2, 3, { scene: 'lobby', x: 1000, y: 560 });
  w2.threatAlarm(g2.def.id);
  assert.ok(!w2.alarmIn('lobby'), '대화 위협은 경보가 아니라');
  assert.ok(w2.events.some((e) => e.kind === 'guardAttack'), '그 경비가 덤빔');
  // 무기를 꺼내도 덤빔
  const w3 = sim({ stance: (f) => (f === 'A00' ? 'wary' : null) });
  const g3 = guardAt(w3, 'lobby', 1200);
  run(w3, 3, { scene: 'lobby', x: 1000, y: 560 });
  run(w3, 0.2, { scene: 'lobby', x: 1000, y: 560, armed: true, face: 1 });
  assert.equal(g3.plan, 'chase');
  // 그 거점 캐릭터도 허락할 수 있다 → 출입증, 다른 경비도 안 막음, 나가면 사라짐
  const w4 = sim({ stance: (f) => (f === 'A00' ? 'hostile' : null) });
  const c = named(w4, '에일린', 'lobby', 600);
  c.def.faction = 'A00';
  guardAt(w4, 'f3', 1900);
  run(w4, 0.5, { scene: 'lobby', x: 650, y: 560 });
  assert.ok(w4.canPermit(c.def.id));
  w4.permitPlayer();
  assert.equal(w4.hasPass(), 'A00');
  run(w4, 3, { scene: 'f3', x: 1800, y: 560 });
  assert.ok(!w4.events.some((e) => e.kind === 'warn'), '출입증 있으면 경고 없음');
  run(w4, 0.5, { scene: 'street', x: 640, y: 560 });
  assert.equal(w4.hasPass(), null, '나가면 사라짐');
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
  // 11-01: 무기를 든 동안은 계속 맞서 버팀(다시 하기 간격 없음), 넣으면 그만
  run(w, 20, { scene: 'office', x: 700, y: 560, armed: true, face: 1 });
  assert.equal(e.doing, '맞서 버팀', '든 동안 계속');
  assert.equal(e.act, 'watch');
  run(w, 3, { scene: 'office', x: 700, y: 560, armed: false, face: 1 });
  assert.notEqual(e.doing, '맞서 버팀', '넣으면 그만');
  run(w, 0.2, { scene: 'office', x: e.x - 200, y: e.y, armed: true, face: 1 });
  assert.equal(e.doing, '맞서 버팀', `다시 꺼내면 다시 (x=${e.x})`);
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

test('퇴근·출근: 근무가 끝나면 거점 밖으로 나가 없어지고, 근무 시작에 그 입구로 들어온다. 동행 중엔 안 나간다', () => {
  const w = sim();
  const a = named(w, '에일린', 'office', 800);
  const f = named(w, '쟈알디', 'office', 900);
  run(w, 0.3, { scene: 'street', x: 100, y: 560, hour: 12 });
  run(w, 0.1, { scene: 'office', x: 950, y: 560, hour: 12 });
  w.setFollow('쟈알디', 'follow');
  run(w, 90, { scene: 'office', x: 950, y: 560, hour: 20 });
  assert.equal(a.commute?.state, 'off', `퇴근 ${a.scene} ${a.doing}`);
  assert.ok(!w.inScene('office').includes(a) && !w.inScene('street').includes(a));
  assert.ok(!f.commute && f.scene === 'office', '동행 중엔 안 나감');
  assert.ok(w.events.some((e) => e.kind === 'shift' && e.who === '에일린' && !e.on));
  run(w, 1, { scene: 'office', x: 950, y: 560, hour: 9 });
  assert.ok(!a.commute && a.scene !== '', '출근');
  assert.ok(w.events.some((e) => e.kind === 'shift' && e.who === '에일린' && e.on));
});


test('맨몸(11-01): nude 켜면 클립이 맨몸으로 바뀌고, 맞으면 배·가슴 → 쓰러지면 H3 → 누운 채 H4 → 깨면 H5', () => {
  const nudeOk = ['idle', 'walk', 'run', 'down', 'getup', 'angry', 'nude_idle', 'nude_walk', 'nude_run', 'nude_hit', 'nude_hit2', 'nude_down', 'nude_lie_hit', 'nude_getup', 'nude_flee'];
  const w = sim({ has: (_l, c) => nudeOk.includes(c) });
  const a = named(w, '에일린');
  run(w, 0.5, { scene: 'street', x: 100, y: 560 });
  assert.ok(!a.clip.startsWith('nude_'), '옷 입은 채');
  assert.ok(w.setNude('npc:에일린', true));
  assert.equal(a.clip, 'nude_idle');
  // 걸으면 맨몸 걷기
  run(w, 8, { scene: 'street', x: 100, y: 560 });
  assert.ok(['nude_idle', 'nude_walk', 'nude_run'].includes(a.clip), `걷기 ${a.clip}`);
  // 서서 맞기: 배(H1) → 다음은 가슴(H2)
  a.hp = 100; a.hpMax = 100;
  assert.ok(w.hitActor('npc:에일린', 1, 1));
  assert.equal(a.clip, 'nude_hit');
  run(w, 4, { scene: 'street', x: 100, y: 560 });
  assert.ok(w.hitActor('npc:에일린', 1, 2));
  assert.equal(a.clip, 'nude_hit2');
  // 쓰러짐(체력 0) → nude_down, 누운 채 또 맞으면 nude_lie_hit
  run(w, 4, { scene: 'street', x: 100, y: 560 });
  a.hp = 0;
  assert.ok(w.hitActor('npc:에일린', 1, 3));
  assert.equal(a.clip, 'nude_down');
  assert.equal(a.act, 'down');
  assert.ok(w.hitActor('npc:에일린', 1, 4));
  assert.equal(a.clip, 'nude_lie_hit');
  // 깰 때 일어나기(H5) 한 번 → 그 뒤 맨몸 자세
  run(w, 6.5, { scene: 'street', x: 100, y: 560 });
  assert.equal(a.clip, 'nude_getup');
  run(w, 2, { scene: 'street', x: 100, y: 560 });
  assert.ok(a.clip.startsWith('nude_') && a.clip !== 'nude_getup', `깬 뒤 ${a.clip}`);
  // 옷 입으면 다시 보통 클립
  assert.ok(w.setNude('npc:에일린', false));
  assert.ok(!a.clip.startsWith('nude_'));
});

test('이어하기(1-8): 욕구·동행·맨몸을 적어 두고 다음 세계에 되살린다 (지난 시간만큼 욕구가 더 줄어듦, 없는 인물은 건너뜀)', () => {
  const w = sim();
  const a = named(w, '에일린'), b = named(w, '잼트리', 'office', 900);
  run(w, 1, { scene: 'office', x: 600, y: 560, hour: 10 });
  a.needs.hunger = 40; b.needs.fun = 25;
  assert.ok(w.setFollow('에일린', 'follow'));
  w.setNude('npc:잼트리', true);
  const s = w.snapshot();
  assert.equal(s.needs['에일린'].hunger, 40);
  assert.deepEqual(s.follow, ['에일린']);
  assert.deepEqual(s.nude, ['잼트리']);
  const txt = JSON.stringify({ ...s, clock: 36000, player: { scene: 'f3', x: 500 } });
  const w2 = sim();
  const a2 = named(w2, '에일린'), b2 = named(w2, '잼트리', 'office', 900);
  run(w2, 0.1, { scene: 'office', x: 600, y: 560, hour: 12 });
  w2.restore({ ...JSON.parse(txt), needs: { ...s.needs, '없는사람': { hunger: 1 } } }, 2);
  assert.ok(a2.needs.hunger < 40 && a2.needs.hunger >= 30, `2시간 지나 더 줄어듦(30 아래로는 안 감) ${a2.needs.hunger}`);
  assert.equal(b2.needs.fun, 25, '이미 30 아래면 그대로');
  assert.ok(a2.following);
  assert.ok(b2.nude);
});

test('필드 피격(1-2): 18번 휘청 한 번 + 밀려남(넉백), 쓰러지면 더 멀리', () => {
  const w = sim({ has: (_l, c) => ['idle', 'walk', 'run', 'hit', 'down', 'angry'].includes(c) });
  const a = w.add({ id: 'mob1', name: '취객', kind: 'mob', brain: 'roam', home: 'street', roam: ['street'], archetype: '취객' }, { scene: 'street', x: 800, y: 560 });
  a.hp = 100; a.hpMax = 100;
  run(w, 0.3, { scene: 'street', x: 700, y: 560 });
  const x0 = a.x;
  assert.ok(w.hitActor('mob1', 1, 1, 12));
  assert.equal(a.clip, 'hit');
  assert.ok(Math.abs(a.x - x0) < 5, '한 번에 튀지 않고');
  run(w, 0.6, { scene: 'street', x: 700, y: 560 });
  const d1 = a.x - x0;
  assert.ok(d1 > 25 && d1 < 50, `밀려남 ${d1}`);
  const x1 = a.x;
  assert.ok(w.hitActor('mob1', 1, 2, 100));
  assert.equal(a.clip, 'down');
  run(w, 0.6, { scene: 'street', x: 700, y: 560 });
  assert.ok(a.x - x1 > d1, `쓰러질 땐 더 멀리 ${a.x - x1}`);
});

// ── 이성 화장실 침입 감지 (11-01 사용자: 문 진입만으로 반응 없음, 정면 700 / 등 뒤 300 / 벽 보고 200, 칸 안 없음) ──
const wcScenes = [
  { id: 'f3', name: '3층', length: 2400, lane: [420, 669], doors: [{ id: 'wc', x: 400, kind: 'glass', to: 'wc3', toDoor: 'out' }] },
  { id: 'wc3', name: '화장실(여)', length: 1600, lane: [470, 680], sex: '여', toilets: [{ id: 'sink0', kind: 'sink', x: 1200, y: 560 }, { id: 'stall0', kind: 'stall', x: 300, y: 560 }], doors: [{ id: 'out', x: 200, kind: 'exit', side: 'S', to: 'f3', toDoor: 'wc' }] },
];
// 여자 인물: 102(앉아 볼일)·poo 만 있고 100(남 소변)은 없음
const wcSim = () => new A.WorldSim(new P.PlaceGraph(wcScenes, [], { f3: 'corridor', wc3: 'restroom' }), R.mulberry32(11), { sceneFaction: () => 'A00', has: (_l, c) => ['idle', 'walk', 'run', 'line:102', 'poo'].includes(c) });
// 여자: 102(앉아 볼일)만 있고 100(남 소변)은 없음
const woman = (w, name, x, face = 1) => { const a = w.add({ id: `npc:${name}`, name, kind: 'named', brain: 'needs', home: 'wc3', roam: ['wc3'], look: name }, { scene: 'wc3', x, y: 560 }); a.face = face; a.plan = 'stay'; a.act = 'idle'; return a; };
const intrudes = (w) => w.events.filter((e) => e.kind === 'intrude');
const male = (x) => ({ scene: 'wc3', x, y: 560, sex: '남', face: 1 });

test('이성 화장실: 문에 들어온 것만으로는 아무도 반응하지 않는다 (등 뒤 300px 밖)', () => {
  const w = wcSim();
  woman(w, '쟈알디', 1000, 1); // 동쪽을 봄, 주인공은 서쪽(등 뒤) 600px
  run(w, 2, male(400));
  assert.equal(intrudes(w).length, 0);
});

test('이성 화장실: 정면 700px 안이면 알아채고 들어옴 → 머묾1 → 머묾2 대사', () => {
  const w = wcSim();
  woman(w, '쟈알디', 400, 1); // 동쪽을 봄, 주인공은 동쪽 600px 앞
  run(w, 0.5, male(1000));
  const ev = intrudes(w);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].stage, 0);
  assert.ok(w.events.some((e) => e.kind === 'cue' && e.cell === 'toilet.intrude' && e.ctx?.target === '{user}'));
  run(w, 18, male(1000));
  assert.deepEqual(intrudes(w).map((e) => e.stage), [0, 1, 2]);
  assert.ok(w.events.some((e) => e.kind === 'cue' && e.cell === 'toilet.stay2'));
});

test('이성 화장실: 등 뒤는 300px 안에서만, 같은 성별 주인공은 아무 일 없음', () => {
  const w = wcSim();
  woman(w, '쟈알디', 1000, 1); // 동쪽을 봄
  run(w, 1, male(750)); // 등 뒤 250px
  assert.equal(intrudes(w).length, 1);
  const w2 = wcSim();
  woman(w2, '쟈알디', 400, 1);
  run(w2, 1, { scene: 'wc3', x: 1000, y: 560, sex: '여', face: 1 });
  assert.equal(intrudes(w2).length, 0);
});

test('이성 화장실: 한 사람이 소리치면 700px 안의 같은 성별이 1~3초 뒤 따라 알아챈다, 장면을 나가면 처음으로', () => {
  const w3 = wcSim();
  woman(w3, '쟈알디', 700, 1); // 동쪽을 봄, 주인공(1000)은 정면 300px → 바로 감지
  const b = woman(w3, '에일린', 1350, 1); // 동쪽을 봄, 주인공은 등 뒤 350px → 직접 감지 안 됨. 쟈알디와 650px → 소리 듣고 따라 감지
  run(w3, 0.2, male(1000));
  assert.deepEqual(intrudes(w3).map((e) => e.who), ['쟈알디']);
  assert.equal(b.intrude?.stage, 'wait');
  run(w3, 3.5, male(1000));
  assert.deepEqual(intrudes(w3).map((e) => e.who).slice(0, 2), ['쟈알디', '에일린']);
  run(w3, 1, { scene: 'f3', x: 400, y: 560, sex: '남', face: 1 });
  assert.equal(b.intrude, undefined);
});
