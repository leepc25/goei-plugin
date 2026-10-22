import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const out = await build({stdin:{contents:`
export {World} from './src/game/action/engine/world';
export {Dummy} from './src/game/action/engine/bodies';
export {MOVES} from './src/game/action/engine/moves';
export {newSave} from './src/game/action/hq/state';
export {launch} from './src/game/action/hq/logic';
export * from './src/game/action/engine/progression';
`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const M=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const clips=JSON.parse(readFileSync('game-pack/jyaldi/frames.json','utf8')).clips;
const idle={mx:0,my:0,evade:false,run:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
const floor={id:'effects',title:'effects',type:'lobby',length:5000,lane:[440,690],startX:300,exitX:Infinity,encounters:[],props:[]};
function start({coffee=null,relics=[],xp=0,stats={}}={}){
 const hq=M.newSave();hq.coffee=coffee;hq.relics=relics;hq.agents.jyaldi.xp=xp;
 const l=M.launch(hq,'m1',42);assert.equal(typeof l,'object');Object.assign(l.stats,stats);
 const run={agent:'jyaldi',seed:42,stageId:'elevator',hpMax:l.stats.hp,launch:l};
 const w=new M.World(run,clips,null);w.enterFloor({...floor});return {w,l,run};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function target(w,x){const d=new M.Dummy(x,w.player.y,false);d.hp=d.hpMax=1000;w.add(d);return d}
const hit={x0:0,x1:0,z0:0,z1:0,y:565,attackId:1,dmg:20,react:'none',dir:-1};

test('본부 능력치: 실제 근접·총알 피해에 힘/사격 적용, 출동 강화와 함께 곱함',()=>{
 const {w}=start();w.player.dmgMul=1.5;const d=target(w,w.player.x+90);
 w.player.play('jab',w);for(let n=0;n<30;n++)w.step(idle);
 near(1000-d.hp,8*1.2*1.5);
 const shot=start({stats:{aim:1.3}}).w,sd=target(shot,shot.player.x+200);
 shot.addBullet({x:shot.player.x,y:shot.player.y,z:100,dir:1});
 for(let n=0;n<10;n++)shot.step(idle);
 near(1000-sd.hp,7*1.3);
});

test('아메리카노 실제 보행 +10%, 블랙+초시계는 명중 게이지에 중복 적용하지 않음',()=>{
 const base=start().w,fast=start({coffee:'americano'}).w;
 for(let n=0;n<10;n++){base.step({...idle,mx:1,held:new Set(['right'])});fast.step({...idle,mx:1,held:new Set(['right'])})}
 near(fast.player.x-300,(base.player.x-300)*1.1);
 const {w,l}=start({coffee:'black',relics:['gauge']});near(l.stats.charge,1.5);
 w.player.onConnect(w,true);near(w.player.gauge,6.5*1.5);
 const before=w.player.hp;w.player.applyHit(hit,w);near(before-w.player.hp,18);near(w.player.gauge,10.5*1.5);
});

test('첫 피격 유물: 보호 → 방 이동/복원 이후 재충전 없음, 방어는 실제 피해에만 적용',()=>{
 const {w,run}=start({relics:['first_guard']});const hp=w.player.hp;
 assert.equal(w.player.applyHit(hit,w).kind,'immune');assert.equal(w.player.hp,hp);assert.equal(w.player.ward,0);
 w.enterFloor({...floor,id:'next'});assert.equal(w.player.ward,0);
 const saved=w.snapshot(),restored=new M.World(run,clips,null);restored.enterFloor({...floor});restored.restore(saved);
 assert.equal(restored.player.ward,0);restored.player.invuln=0;restored.player.applyHit(hit,restored);near(hp-restored.player.hp,18);
 const guarded=start().w;guarded.player.guarding=true;guarded.player.dir=1;
 assert.equal(guarded.player.applyHit(hit,guarded).kind,'guard');near(guarded.player.guardMeter,100-20*2.4);
});

test('전용 유물은 폭파 판정 크기만 +20%, 기본 공격과 원본 동작표는 그대로',()=>{
 const basic=start().w,owned=start({relics:['own_jyaldi']}).w;
 for(const w of [basic,owned]){w.player.play('blast',w);w.player.mf=3}
 const a=basic.player.frame().hit[0],b=owned.player.frame().hit[0];
 near(b.x1-b.x0,(a.x1-a.x0)*1.2);near(b.z1-b.z0,(a.z1-a.z0)*1.2);near(b.dy,a.dy*1.2);near(b.dmg,a.dmg);
 near((b.x0+b.x1)/2,(a.x0+a.x1)/2);
 for(const w of [basic,owned]){w.player.play('jab',w);w.player.mf=2}
 assert.deepEqual(owned.player.frame().hit,basic.player.frame().hit);
});

test('숙련3/6 실제 입력 해금, 연습 모드는 기존 기술 사용 가능',()=>{
 const locked=start().w;locked.step({...idle,pressed:new Set(['chain'])});assert.notEqual(locked.player.moveKey,'chain');
 for(const key of ['chain','wall']){
  const w=start().w;w.step({...idle,mx:1});const x=w.player.x;
  w.step({...idle,mx:-1,pressed:new Set([key])});
  assert.equal(w.player.move,null);assert.equal(w.player.dir,-1);near(w.player.x,x-9);
  w.step({...idle,held:new Set(['guard']),pressed:new Set([key])});
  assert.equal(w.player.guarding,true);near(w.player.x,x-9);
 }
 const a=start({xp:200}).w;a.step({...idle,pressed:new Set(['chain'])});assert.equal(a.player.moveKey,'chain');
 const b=start({xp:800}).w;b.step({...idle,pressed:new Set(['wall'])});assert.equal(b.player.moveKey,'wall');
 const demo=new M.World({agent:'jyaldi',seed:1},clips,null);demo.enterFloor({...floor});demo.step({...idle,pressed:new Set(['wall'])});assert.equal(demo.player.moveKey,'wall');
});

test('숙련5 필살 두 번 명중: 실제 World 중복 타격 방지와 공존, 다음 출동 기본값 복귀',()=>{
 function blast(xp){const {w}=start({xp});const d=target(w,w.player.x+170);let booms=0;const fx=w.fx.bind(w);w.fx=(kind,...args)=>{if(kind==='boom')booms++;return fx(kind,...args)};w.player.play('super',w);for(let n=0;n<100;n++)w.step(idle);assert.equal(booms,xp>=560?2:1);return 1000-d.hp}
 near(blast(0),60);near(blast(560),120);
 assert.deepEqual(M.MOVES.super.hits[0].at,[7]);
 const fresh=start().w;fresh.player.play('super',fresh);assert.deepEqual(fresh.player.move.hits[0].at,[7]);
});
