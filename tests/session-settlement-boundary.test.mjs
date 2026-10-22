import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:`
export {Game} from './src/game/action/engine/game';
export {World} from './src/game/action/engine/world';
export {SessionStore} from './src/game/action/engine/sessionStore';
export {linkItems} from './src/game/action/engine/itemsLink';
export {createElevatorStage} from './src/game/action/stage';
export {newSave,parseSave,saveText} from './src/game/action/hq/state';
export {launch,settle} from './src/game/action/hq/logic';
export {emptyResult} from './src/game/action/hq/contract';
export {memorySaves} from './src/game/action/hq/store';
export {openShop,buy} from './src/game/action/items/shop';
`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false,loader:{'.css':'text'}});
const M=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const info={title:'자동 저장',summary:'',schema:'goei-hq/1'};
async function outing(){
 const writes=[],entries=new Map(),disk=M.memorySaves();
 const journal={getItem:k=>entries.get(k)??null,setItem:(k,v)=>{entries.set(k,v);writes.push(v)}};
 const session=new M.SessionStore(disk,0,journal);await session.ready;
 const hq=M.newSave(),launch=M.launch(hq,'m1',77),run={...launch,stageId:'elevator',launch};
 await session.hqSaves.write(0,M.saveText(hq),info);
 const stage=M.createElevatorStage({load:()=>session.meta,save:m=>session.setMeta(m)});
 const world=new M.World(run,{},stage);M.linkItems(world,run);world.enterFloor(stage.firstFloor(run));
 assert.equal(world.canCheckpoint(),true);
 session.setCheckpoint({version:1,run,stage:stage.snapshot(),world:world.snapshot(),savedAt:1});await session.flush();
 writes.length=0;
 // 실제 Game.endRun을 실행하고 모듈의 HQ 정산 계약과 저장 연결을 사용한다.
 const game=Object.create(M.Game.prototype);Object.assign(game,{world,run,inHub:false,showHq(){},mods:{
  hq:{onReturn(r,l){M.settle(hq,l.launch,r,()=>.9);void session.hqSaves.write(0,M.saveText(hq),info)}},
  toHqResult:r=>({...M.emptyResult(r.how),...r,runId:launch.runId,cash:world.notes.cash??0,itemsLeft:world.notes.itemsLeft??launch.items}),
  saveCheckpoint:cp=>session.setCheckpoint(cp),
 }});
 return {session,disk,journal,writes,hq,launch,world,game,stage,run};
}
test('실제 Game 종료: 정산/체크포인트 제거 중 모든 동기 저널은 재출동 가능한 HQ를 보존',async()=>{
 const c=await outing();c.game.endRun('withdraw');
 assert.ok(c.writes.length);
 for(const text of c.writes){const value=JSON.parse(text),hq=M.parseSave(value.hq);
  assert.equal(hq.active,null,'출동 체크포인트 제거 때 active만 남아서는 안 됨');
  assert.equal(value.checkpoint,null,'정산한 출동을 이전 안전 지점으로 다시 이어서는 안 됨');
  assert.equal(hq.last.runId,c.launch.runId);
 }
 await c.session.flush();
 const restored=new M.SessionStore(c.disk,0,c.journal);await restored.ready;
 const hq=M.parseSave(await restored.hqSaves.read(0));assert.equal(hq.runs,1);assert.equal(restored.checkpoint,null);
 const before=M.saveText(c.hq);c.game.endRun('withdraw');assert.equal(M.saveText(c.hq),before,'실제 Game 종료 재호출도 중복 정산 없음');
 assert.equal(typeof M.launch(hq,'m1',78),'object','복구 HQ에서 다음 임무 출동');
});

test('시작 직후 HQ 쓰기는 원격 저장 로딩을 기다리고 기존 출동 체크포인트를 보존',async()=>{
 const c=await outing();const persisted=await c.disk.read(0);let readReady;
 const remote={...M.memorySaves(),read:()=>new Promise(resolve=>{readReady=()=>resolve(persisted)})};
 const session=new M.SessionStore(remote,0);const save=session.hqSaves.write(0,M.saveText(c.hq),info);
 assert.equal(session.checkpoint,null);readReady();await save;
 assert.equal(session.checkpoint.run.launch.runId,c.launch.runId);
 assert.equal(M.parseSave(await session.hqSaves.read(0)).active.runId,c.launch.runId);
});

test('다른 출동의 정산 기록은 현재 체크포인트를 지우지 않는다',async()=>{
 const c=await outing();const other=M.newSave(),launch=M.launch(other,'m1',99);
 M.settle(other,launch,{...M.emptyResult('withdraw'),runId:launch.runId},()=>.9);
 await c.session.hqSaves.write(0,M.saveText(other),info);
 assert.equal(c.session.checkpoint.run.launch.runId,c.launch.runId);
});

test('상점 품절 상태: 실제 World → 수동 슬롯 → 새 World 복원 뒤 재구매와 중복 정산 차단',async()=>{
 const c=await outing(),inventory=c.world.itemRun;
 inventory.cash=500;inventory.loadout=[null,null,null,null];
 const shop=M.openShop('madeokhee',inventory,1,77);
 for(let i=0;i<3;i++)assert.equal(M.buy(shop,inventory,'i:medkit').ok,true);
 const snapshot=c.world.itemState.snapshot(),key=JSON.stringify([c.world.floor.id,'merchant','madeokhee']);
 snapshot.shops.push([key,shop]);c.world.itemState.restore(snapshot);
 const expectedCash=inventory.cash;
 c.session.setCheckpoint({version:1,run:c.run,stage:c.stage.snapshot(),world:c.world.snapshot(),savedAt:2});
 await c.session.hqSaves.write(1,M.saveText(c.hq),info);
 c.game.endRun('withdraw');await c.session.flush();
 const loaded=M.parseSave(await c.session.hqSaves.restore(1));
 assert.equal(loaded.active.runId,c.launch.runId);assert.equal(loaded.last,null);
 const cp=c.session.checkpoint,stage=M.createElevatorStage({load:()=>c.session.meta,save:m=>c.session.setMeta(m)});
 const world=new M.World(cp.run,{},stage);const items=M.linkItems(world,cp.run);
 world.enterFloor(stage.restore(cp.stage));world.restore(cp.world);
 const restoredShop=world.itemState.snapshot().shops.find(([k])=>k===key)[1];
 assert.equal(restoredShop.offers.find(o=>o.key==='i:medkit').stock,0);
 assert.equal(items.run.cash,expectedCash);assert.equal(items.run.loadout[0].n,3);
 assert.deepEqual(M.buy(restoredShop,items.run,'i:medkit'),{ok:false,why:'stock'});
 assert.equal(items.run.cash,expectedCash);
 world.emit({type:'run:end',how:'withdraw'});
 const result={...M.emptyResult('withdraw'),runId:c.launch.runId,cash:world.notes.cash,itemsLeft:world.notes.itemsLeft};
 M.settle(loaded,c.launch,result,()=>.9);const once=M.saveText(loaded);
 M.settle(loaded,c.launch,result,()=>.9);assert.equal(M.saveText(loaded),once);assert.equal(loaded.runs,1);
 // 상점 필드가 없던 기존 v1 World 저장도 복원되며 새 상점 재고만 초기화한다.
 const old=JSON.parse(cp.world);delete old.items.shops;
 const oldWorld=new M.World(cp.run,{},stage);M.linkItems(oldWorld,cp.run);oldWorld.enterFloor(stage.restore(cp.stage));oldWorld.restore(JSON.stringify(old));
 assert.deepEqual(oldWorld.itemState.snapshot().shops,[]);assert.equal(oldWorld.itemRun.cash,expectedCash);
});
