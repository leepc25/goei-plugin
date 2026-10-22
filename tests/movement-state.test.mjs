import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const out=await build({stdin:{contents:`export {World} from './src/game/action/engine/world';export {blockByProps} from './src/game/action/engine/propBlock';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const M=await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const clips=JSON.parse(readFileSync('game-pack/jyaldi/frames.json','utf8')).clips;
const idle={mx:0,my:0,run:false,evade:false,downDouble:false,held:new Set(),pressed:new Set(),released:new Set()};
const walk={...idle,mx:1};
function setup(){
 const w=new M.World({seed:1,agent:'jyaldi'},clips,null);
 w.enterFloor({id:'movement',title:'이동 검사',length:4000,startX:500,lane:[470,690],encounters:[],props:[],exitX:Infinity});
 return w;
}
function step(w,p=idle,n=1){for(let i=0;i<n;i++)w.step(p)}
test('걷기·달리기 속도 유지, 놓으면 정지, 다시 출발/방향 전환은 첫 보행 자세',()=>{
 const a=setup(),b=setup();step(b,idle,17);
 step(a,walk);step(b,walk);assert.deepEqual(a.player.anim(),b.player.anim());assert.equal(a.player.anim().frame,0);
 const x=a.player.x;step(a,walk,24);assert.equal(a.player.x-x,216);assert.equal(a.player.anim().clip,'walk');assert.equal(a.player.anim().frame,0);
 step(a,idle);const stop=a.player.x;assert.equal(a.player.anim().clip,'idle');step(a,idle,20);assert.equal(a.player.x,stop);
 step(a,{...walk,run:true},16);assert.equal(a.player.x-stop,288);assert.equal(a.player.anim().clip,'run');
 step(a,{...walk,mx:-1});assert.equal(a.player.dir,-1);assert.equal(a.player.anim().frame,0);
});
test('경계에서 이동 키를 계속 눌러도 제자리 걷기/달리기 없음',()=>{
 const w=setup();w.player.x=w.player.px=w.floor.length-30;
 step(w,walk,40);assert.equal(w.player.x,w.floor.length-30);assert.equal(w.player.anim().clip,'idle');
 step(w,{...walk,run:true},40);assert.equal(w.player.anim().clip,'idle');
 step(w,{...walk,mx:-1});assert.equal(w.player.anim().clip,'walk');
});
test('가구에 막힌 틱은 보행 정지, 옆으로 빠져나가면 다시 걷는다',()=>{
 const w=setup(),wall={x:600,y:700,w:80,back:240,front:0};
 w.hooks.push(()=>M.blockByProps([w.player],[wall],w.lane));
 step(w,walk,15);const x=w.player.x;step(w,walk,30);assert.equal(w.player.x,x);assert.equal(w.player.anim().clip,'idle');
 step(w,{...walk,mx:-1},5);assert.ok(w.player.x<x);assert.equal(w.player.anim().clip,'walk');
});
test('휴대 무기·앉기에도 실제로 멈춘 상태의 자세를 쓴다',()=>{
 const w=setup();w.player.carry={kind:'weapon',id:'pipe',hold:'hand',cls:'melee'};
 step(w,walk,5);assert.equal(w.player.anim().clip,'walk_pipe');
 w.player.x=w.player.px=w.floor.length-30;step(w,{...walk,run:true},5);assert.equal(w.player.anim().clip,'idle_pipe');
 w.player.carry=null;w.player.crouching=true;step(w,walk,5);assert.equal(w.player.anim().clip,'crouch');
});
