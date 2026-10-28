// 실제 생성자와 World 판정/아이템 연결을 함께 실행한다. ID나 피격 이벤트를 바꿔 넣지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const out=await build({stdin:{contents:`export {World} from './src/game/action/engine/world';export {createEnemy,ALL_DEFS} from './src/game/action/enemy';export {bumpIds} from './src/game/action/enemy/enemy';export {Dummy,Bullet} from './src/game/action/engine/bodies';export {linkItems} from './src/game/action/engine/itemsLink';export * from './src/game/action/items';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const url=`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`;
const clips=JSON.parse(readFileSync('game-pack/jyaldi/frames.json','utf8')).clips;
async function setup(name){
 const M=await import(`${url}#${name}`),run={seed:42,agent:'jyaldi'},w=new M.World(run,clips,null,(s,w)=>M.createEnemy(s.kind,s.x,s.y,w.rand));
 w.enterFloor({id:name,type:'lobby',title:'ID 회귀',length:1800,startX:400,exitX:Infinity,encounters:[],props:[]});
 const enemy=x=>{const e=w.spawn({kind:'dd_member',x,y:w.player.y});e.set('idle');return e};
 return {M,w,run,enemy};
}
test('실제 잽 뒤 첫 권총탄: Enemy.hitBy가 다른 공격을 동일 타격으로 버리지 않는다',async()=>{
 const {M,w,enemy}=await setup('melee-bullet'),e=enemy(470);
 w.player.play('jab',w);w.player.mf=2;w.resolveHits();
 assert.ok(e.hp<e.hpMax,'실제 잽 명중');const hp=e.hp;
 w.player.move=null;e.inv=0;e.set('idle');
 const bullet=new M.Bullet(e.x+10,e.y,120,1);w.add(bullet);w.resolveHits();
 assert.ok(e.hp<hp,'잽과 같은 번호로 버려진 권총탄');
});
test('실제 임시적과 적 모듈 적: 하나의 공격이 각각 한 번씩 명중한다',async()=>{
 const {M,w,enemy}=await setup('hit-memo');
 const dummy=new M.Dummy(500,w.player.y);w.add(dummy);enemy(1400);const e=enemy(500);
 w.player.play('blast',w);w.player.mf=w.player.move.hits[0].at[0];w.resolveHits();
 assert.ok(dummy.hp<dummy.hpMax,'임시적 명중');assert.ok(e.hp<e.hpMax,'같은 몸 번호로 hitMemo에서 버려진 실제 적');
 const hp=[dummy.hp,e.hp];w.resolveHits();assert.deepEqual([dummy.hp,e.hp],hp,'한 공격은 대상마다 한 번만');
});
test('실제 아이템 근접: 앞서 생성된 총알과 혼동하지 않고 목표 적에게 피해를 준다',async()=>{
 const {M,w,run,enemy}=await setup('item-target'),items=M.linkItems(w,run);
 const bullet=new M.Bullet(1300,w.player.y,120,1);w.add(bullet);enemy(1400);const e=enemy(460);
 M.equip(items.run,'pipe');w.player.itemAct('attack');
 assert.ok(e.hp<e.hpMax,'itemsLink가 총알을 대상 적으로 잘못 찾음');
 const ids=[w.player,...w.bodies].map(b=>b.id);assert.equal(new Set(ids).size,ids.length,'모든 Body ID는 고유');
});

test('다단 공격·아군 지원·아이템: 동시에 발급해도 서로 다른 공격 키, 같은 투척물은 키 유지',async()=>{
 const {M,w,run}=await setup('attack-reservation');
 const def=M.ALL_DEFS.find(d=>d.attacks.some(a=>a.move.specs.length>1));
 const e=M.createEnemy(def.kind,900,w.player.y,w.rand);w.add(e);
 const move=def.attacks.find(a=>a.move.specs.length>1).move;e.start(move,w);
 const ids=Array.from({length:move.specs.length},(_,i)=>e.atk+i);
 // 이후 새 공격을 발급해도 이 동작의 두 번째 타격 번호를 가져가지 않는다.
 const bullet=new M.Bullet(1100,w.player.y,120,1);ids.push(bullet.frame().hit[0].attackId);
 w.player.play('super',w);ids.push(w.player.attackId,w.player.attackId+1);
 w.player.gauge=100;w.player.callAlly(w);ids.push(w.player.ally.id);
 const event={t:'hit',target:e.id,damage:1,knockback:0,knockdown:false,x:e.x,y:e.y};
 ids.push(M.itemHit(event,w.player.x).attackId);
 for(const depth of [1,2]){
  const f=M.createField(42,depth),r=M.createItemRun('jyaldi'),actor={x:400,y:600,z:0,dir:1};
  M.placeProp(f,'tv',430,600);
  M.stepField(f,r,actor,{interact:true},[],1/30);
  M.stepField(f,r,actor,{attack:true},[],1/30);
  const a=M.projectileHits(f),b=M.projectileHits(f);assert.equal(a.length,1);
  assert.equal(a[0].attackId,b[0].attackId,'동일 투척물은 프레임마다 새 번호를 받지 않음');
  ids.push(a[0].attackId);
 }
 assert.equal(new Set(ids).size,ids.length,'적 연타/총알/필살2타/지원/아이템/각방 투척물 간 키 중복');
 for(const d of M.ALL_DEFS)for(const a of d.attacks)for(const f of a.move.frames)
  if(f.hit.length)assert.ok((f.spec??0)<a.move.specs.length,`${d.kind}/${a.move.id}: 예약한 specs 범위`);
});
test('World 새로 만들기·안전 저장 복원·기존 몸 번호 예약이 다른 생성자의 ID를 되돌리지 않음',async()=>{
 const {M,w,run}=await setup('restore-ids');
 w.player.x=w.player.px=725;w.player.hp-=9;
 const saved=w.snapshot(),expectedRandom=w.rand();
 const restored=new M.World(run,clips,null,(s,w)=>M.createEnemy(s.kind,s.x,s.y,w.rand));
 restored.enterFloor(w.floor);restored.restore(saved);
 assert.equal(restored.player.x,725);assert.equal(restored.player.hp,w.player.hp);assert.equal(restored.rand(),expectedRandom);
 M.bumpIds(restored.player.id+1000);M.bumpIds(1);
 const enemy=M.createEnemy('dd_member',900,600,w.rand),bullet=new M.Bullet(1100,600,120,1),dummy=new M.Dummy(1200,600);
 assert.ok(enemy.id>restored.player.id+1000);
 const bodies=[w.player,restored.player,enemy,bullet,dummy];
 assert.equal(new Set(bodies.map(b=>b.id)).size,bodies.length);
 restored.add(enemy);enemy.fire('bullet',restored);
 assert.equal(new Set([restored.player,...restored.bodies].map(b=>b.id)).size,1+restored.bodies.length,'적 발사체도 공통 발급');
});
