/* 통합 회귀 (실제 공용 World 소스 검증)
 * 실행: node --test tests/guardian-rules-round2.test.mjs
 * 산출물: dist-test/guardian-rules-round2.mjs (다른 검사 번들과 분리)
 *
 * 실제 개체 이벤트 계약:
 * - 노부부 평화: ruleKept(r_meal) + enemyDrop(기존 규칙 보상) 각 1회,
 *   소멸 때 guardianCleared {kind:'elder', how:'rule'} 1회. HP 유지, enemyDie 없음.
 * - 노부부 처치: enemyDie elder_f / elder_m 각각 1회. guardianCleared(kill)
 *   집계는 stage 담당이며 한 명만 죽었을 때 진압 완료로 처리하면 안 된다.
 * - 208호: enemyDie family_f / family_m 각각 1회. childDoor는 ruleKept(r_child)
 *   1회와 150틱 약점만 연다. guardianCleared나 처치 이벤트를 내지 않는다.
 * - 감독관: 실제 종류 proctor (계획 별칭 conductor). 처치는 enemyDie proctor.
 * - 만지는 것들: 성공은 guardianCleared {kind:'touchers', how:'endure'}, 실패는
 *   evac {reason:'touchers'}. 둘 다 screen(dark,0), HP 유지, enemyDie/드랍 없음.
 *
 * 공용 World 프레임 맵은 Body 참조를 사용한다. 별도 패치 주입이나
 * ID 카운터 보정 없이 아래 모든 회귀를 기본 실행한다.
 * stage의 실제 수호자 쌍 집계/복원은 progression-real-enemies.test.mjs에서 검증한다.
 * 아이 방의 실제 규칙 발견/열쇠/문 E 연결은 progression-real-child-door.test.mjs에서
 * 검증한다. 이 파일은 신호를 받은 수호자의 반응을 검증한다.
 *
 * Chromium fixture는 실제 World/Input과 키보드를 쓰지만 stage/HQ는 붙이지 않는다.
 * 아이 방 성공 신호만 명시 주입한다. 전체 출동/잠금/정산 연결 검증으로 해석하지 않는다.
 */
// 실제 엔진 World + 같은 번들의 Enemy/신호. 이벤트를 합성해 성공시키지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
await build({ stdin: { contents: `
export { World } from './src/game/action/engine/world';
export { createEnemy, signalEnemies, Enemy, isThreat } from './src/game/action/enemy';
`, resolveDir: process.cwd() }, bundle: true, format: 'esm', platform: 'node', outfile: 'dist-test/guardian-rules-round2.mjs', logLevel: 'error' });
const { World, createEnemy, signalEnemies, Enemy } = await import('../dist-test/guardian-rules-round2.mjs');
const pad = () => ({ mx:0, my:0, evade:false, run:false, downDouble:false, held:new Set(), pressed:new Set(), released:new Set() });
function scene(kinds, { reverse = false, x = 700, px = 100 } = {}) {
  const w = new World({ seed:42, agent:'jyaldi' }, {});
  w.enterFloor({ id:'guardian-round2', title:'수호자 회귀', type:'replica', depth:5, length:2400, lane:[440,690], startX:px, exitX:Infinity, encounters:[], props:[] });
  const events = []; w.on(e => events.push(structuredClone(e)));
  const foes = kinds.map((kind,i) => createEnemy(kind,x+i*140,560,()=>.9));
  (reverse ? [...foes].reverse() : foes).forEach(e => w.add(e));
  const tick = (n = 1) => { for(let i=0;i<n;i++) { w.step(pad()); } };
  const custom = name => events.filter(e => e.type==='custom' && e.name===name);
  return { w, foes, events, tick, custom };
}
let attackId = 100;
function hit(c,e,extra={}) {
  // 엔진의 실제 피격/처치 경로 (TS private은 런타임에서 호출 가능).
  c.w.applyHit(c.w.player,e,{ x0:e.x-40,x1:e.x+40,z0:0,z1:300,y:e.y,dy:40,attackId:attackId++,dmg:10,react:'none',dir:1,stop:0,...extra });
}
function settle(c) { c.tick(12); return c; }

for (const reverse of [false,true]) test(`노부부 규칙 통과: 순서 ${reverse}, 보상·소멸 1회, 처치 없음`,()=>{
  const c=settle(scene(['elder_f','elder_m'],{reverse}));
  signalEnemies(c.w,{kind:'mealThanks'}); signalEnemies(c.w,{kind:'mealThanks'});
  c.tick(80);
  assert.equal(c.custom('ruleKept').length,1);
  assert.equal(c.custom('enemyDrop').length,1);
  assert.deepEqual(c.custom('guardianCleared').map(e=>e.data),[{kind:'elder',how:'rule'}]);
  assert.equal(c.events.filter(e=>e.type==='enemyDie').length,0);
  assert.ok(c.foes.every(e=>!e.alive && e.hp===e.hpMax));
});
test('노부부: 작별 중 공격으로 처치 보상을 중복 획득하지 않음',()=>{
  const c=settle(scene(['elder']));
  signalEnemies(c.w,{kind:'mealThanks'});
  hit(c,c.foes[0],{dmg:9999}); c.tick(80);
  assert.equal(c.events.filter(e=>e.type==='enemyDie').length,0);
  assert.equal(c.custom('enemyDrop').length,1);
  assert.equal(c.custom('guardianCleared').length,1);
});
test('노부부: 소환된 짝 초기화 전에 거절해도 둘 다 적대, 미라 두 마리만',()=>{
  const c=scene(['elder']);
  c.w.on(e=>{ if(e.type==='enemySpawn' && e.kind==='elder_m') signalEnemies(c.w,{kind:'turnAway'}); });
  c.tick(2);
  assert.ok(c.w.bodies.filter(e=>e.kind.startsWith('elder_')).every(e=>e.hostile && e.mem.mode==='fight'));
  signalEnemies(c.w,{kind:'turnAway'});
  assert.equal(c.events.filter(e=>e.type==='enemySpawn' && e.kind==='mummy').length,2);
});
for (const kind of ['elder','family208']) test(`${kind}: 대기 중 한 명을 치명타로 처치하면 살아남은 짝 적대`,()=>{
  const c=settle(scene([kind])); hit(c,c.foes[0],{dmg:9999}); c.tick(2);
  const mate=c.w.bodies.find(e=>e instanceof Enemy && e.kind.endsWith('_m'));
  assert.equal(mate.mem.mode,'fight'); assert.equal(mate.hostile,true);
  assert.equal(c.events.filter(e=>e.type==='enemyDie').length,1);
});
test('노부부: 먹기 피해·규칙 위반·미라 소환은 한 번, 하단 약점 2배',()=>{
  const c=settle(scene(['elder']));
  signalEnemies(c.w,{kind:'mealEat'}); signalEnemies(c.w,{kind:'mealEat'});
  assert.equal(c.custom('hurtPlayer').length,1); assert.equal(c.custom('ruleBroken').length,1);
  assert.equal(c.events.filter(e=>e.type==='enemySpawn' && e.kind==='mummy').length,2);
  const hp=c.foes[0].hp; hit(c,c.foes[0],{low:true}); assert.equal(hp-c.foes[0].hp,20);
});
test('208호: 질문 세 번 후 둘 다 전투, 총 피해 0, 근접 유효',()=>{
  const c=scene(['family208'],{px:450}); c.tick(225);
  const f=c.foes[0], m=c.w.bodies.find(e=>e.kind==='family_m');
  assert.equal(f.mem.mode,'fight'); assert.equal(m.mem.mode,'fight');
  const hp=m.hp; hit(c,m,{noise:1,strength:1}); assert.equal(m.hp,hp);
  hit(c,m); assert.equal(m.hp,hp-10);
  assert.equal(c.custom('guardianCleared').length,0);
});
test('208호: 보통 E/문 신호는 아이 방 규칙을 풀지 않는다',()=>{
  const c=settle(scene(['family208'])); hit(c,c.foes[0]); c.tick(2);
  signalEnemies(c.w,{kind:'door',x:c.w.player.x,y:c.w.player.y});
  assert.equal(c.custom('ruleKept').length,0);
});
test('208호: 아이 방 신호는 150틱 약점, 그 뒤 전투 재개, 처치/통과 아님',()=>{
  const c=settle(scene(['family208'])); hit(c,c.foes[0]); c.tick(2);
  signalEnemies(c.w,{kind:'childDoor'}); signalEnemies(c.w,{kind:'childDoor'});
  const f=c.foes[0]; c.tick(149); assert.equal(f.state,'stunned'); assert.ok(f.weakOpen>0);
  c.tick(2); assert.notEqual(f.state,'stunned');
  assert.equal(c.custom('ruleKept').length,1); assert.equal(c.custom('guardianCleared').length,0);
});
test('경비원: 경로 밖 순찰·후방 기습 2배·정면 피격 적대·시간 경과 순찰 복귀',()=>{
  const c=settle(scene(['guard'])); const e=c.foes[0];
  assert.equal(e.mem.mode,'patrol'); const hp=e.hp; hit(c,e); assert.equal(hp-e.hp,20);
  c.tick(3); assert.equal(e.mem.mode,'patrol');
  c.w.player.x=e.x+150; hit(c,e,{react:'flinch'}); c.tick(2); assert.equal(e.mem.mode,'fight');
  c.w.player.x=2200; c.w.player.y=690; c.tick(220); assert.equal(e.mem.mode,'patrol');
});
test('감독관: 300틱 호루라기 뒤 초시계 빈틈 60틱 보장',()=>{
  const c=scene(['proctor']); const e=c.foes[0]; c.tick(300);
  assert.equal(e.move?.id,'whistle');
  while(e.state==='attack') c.tick();
  let weak=0; for(let i=0;i<60;i++){ c.tick(); if(e.weakOpen>0) weak++; }
  assert.equal(weak,60);
});
test('만지는 것들: 조용히 이동해 60초 생존, 통과 1회·처치/드랍 없음',()=>{
  const c=scene(['touchers']); c.w.rand=()=>.99;
  for(let i=0;i<1850;i++){ c.w.player.x=100+i%1000; c.tick(); }
  assert.deepEqual(c.custom('guardianCleared').map(e=>e.data),[{kind:'touchers',how:'endure'}]);
  assert.equal(c.foes[0].hp,1); assert.equal(c.foes[0].alive,false);
  assert.equal(c.events.filter(e=>e.type==='enemyDie').length,0); assert.equal(c.custom('enemyDrop').length,0);
});
test('만지는 것들: 3개 동시 접촉 후송 뒤 성공 이벤트 금지',()=>{
  const c=scene(['touchers']); const e=c.foes[0]; c.w.rand=()=>.5;
  // 초기 0.02 확률만 강제로 통과시키고, 손 위치 난수는 가운데로 고정.
  let n=0; c.w.rand=()=> (++n%3===1 ? 0 : .5);
  c.tick(40); assert.equal(c.custom('evac').length,1);
  c.w.rand=()=>.99; c.tick(1800);
  assert.equal(c.custom('guardianCleared').length,0);
  assert.equal(c.events.filter(e=>e.type==='enemyDie').length,0);
});

for (const [alias,male] of [['elder','elder_m'],['family208','family_m']]) test(`${alias}: 기존 짝을 중복 소환하지 않음, 둘의 처치 이벤트는 각각 1회`,()=>{
  const c=settle(scene([alias,male]));
  assert.equal(c.w.bodies.filter(e=>e.kind===male).length,1);
  for(const e of c.foes) hit(c,e,{dmg:9999});
  signalEnemies(c.w,{kind:alias==='elder'?'mealThanks':'childDoor'});
  c.tick(40);
  assert.deepEqual(c.events.filter(e=>e.type==='enemyDie').map(e=>e.kind),c.foes.map(e=>e.kind));
  assert.equal(c.custom('ruleKept').length,0); assert.equal(c.custom('guardianCleared').length,0);
});
test('감독관: 실제 점프 입력으로 호루라기 파동을 피함, 지상에서는 피격',()=>{
  function whistle(jump) {
    const c=scene(['proctor']); const e=c.foes[0]; c.tick(300);
    // 이미 시작된 호루라기의 충돌 거리에서 점프 입력만 달리한다.
    c.w.player.x=e.x+130; c.w.player.y=e.y;
    const hp=c.w.player.hp;
    for(let i=0;i<50;i++) { const p=pad(); if(jump && i===22) p.pressed.add('jump'); c.w.step(p); }
    return {lost:hp-c.w.player.hp, events:c.events};
  }
  assert.ok(whistle(false).lost>0);
  assert.equal(whistle(true).lost,0);
});

test('공용 연결: 새 World/Enemy는 고유 번호를 유지하고 범위 밖 플레이어를 때리지 않음', async()=>{
  // 번들 재평가로 카운터 초기화. 첫 플레이어와 첫 적도 번호가 달라야 한다.
  const S=await import('../dist-test/guardian-rules-round2.mjs?fresh-world');
  const w=new S.World({seed:42,agent:'jyaldi'},{});
  w.enterFloor({id:'id-collision',title:'ID 충돌',type:'trial',depth:6,length:2400,lane:[440,690],startX:100,exitX:Infinity,encounters:[],props:[]});
  const e=S.createEnemy('proctor',700,560,()=>.9); w.add(e);
  assert.notEqual(w.player.id,e.id);
  const hp=w.player.hp;
  // 실제 플레이어는 파동 범위 밖. 두 개체 ID가 같으면 적 자신의 피격 상자로 맞는다.
  for(let i=0;i<350;i++) w.step(pad());
  assert.equal(w.player.hp,hp);
});
