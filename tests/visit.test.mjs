import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-visit-'));
await build({ entryPoints: ['src/core/visit.ts', 'src/core/visitPrompt.ts', 'src/host/game/visit.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, define: { __PLUGIN_VERSION__: '"test"', __UPDATE_BASE__: '""' }, logLevel: 'silent' });
const { visitRoom, visitRecord, withVisitTurn, VISIT_LORE } = await import(pathToFileURL(join(dir, 'core/visit.mjs')));
const { createVisit } = await import(pathToFileURL(join(dir, 'host/game/visit.mjs')));
const { parseVisitLine, clipLine } = await import(pathToFileURL(join(dir, 'core/visitPrompt.mjs')));
const GUIDE = (await import('node:fs')).readFileSync('card/visit-guide.txt', 'utf8');
await rm(dir, { recursive: true, force: true });

test('presence follows tags; unavailable and unknown agents are never invented', () => {
  for (const state of ['외근','비번','작전투입','실종','사망','격리','미정','unknown']) assert.equal(visitRoom({ state, locked: false }), null);
  assert.equal(visitRoom({state:'내근', locked:false}), 'office');
  assert.equal(visitRoom({state:'휴게', locked:false}), 'lounge');
  assert.equal(visitRoom({state:'부상', locked:false}), 'infirmary');
});
test('visit record deduplicates, bounds context and preserves other chat data', () => {
  let chat = { message: [{role:'user',data:'본편'}], scriptstate:{state:'same'}, localLore:[{comment:'other',content:'keep'}] };
  for (let i=0;i<105;i++) chat=withVisitTurn(chat,{id:String(i),at:0,agentId:'P1',name:'요원',user:'{{setvar::x::1}}',reply:'답'});
  const twice = withVisitTurn(chat,visitRecord(chat).turns.at(-1));
  assert.equal(twice,chat);
  assert.equal(visitRecord(chat).turns.length,100);
  assert.equal(chat.localLore.length,2);
  assert.equal(chat.localLore.find(l=>l.comment===VISIT_LORE).content.match(/유저:/g).length,8);
  assert.ok(!chat.localLore[1].content.includes('{{'));
  assert.equal(chat.message[0].data,'본편');
  assert.deepEqual(chat.scriptstate,{state:'same'});
});

test('host calls selected model once, pins origin, records success, rejects concurrent and unavailable requests', async () => {
  const roster={version:2,characters:[{id:'P001',name:'테스트요원',english:'Test',lore:'테스트요원',affiliation:'A00',rank:'요원',aliases:[],roster_for:['A00'],phone_tabs:[]}]};
  const char={chaId:'card-1',name:'괴이',globalLore:[{comment:'Agent roster',content:JSON.stringify(roster)},{comment:'테스트요원',content:'조용하고 신중한 요원이다.'},{comment:'Visit',content:GUIDE}]};
  // Read the project's actual world-state key rather than hard-code its storage format.
  const temp=await mkdtemp(join(tmpdir(),'goei-world-'));
  await build({entryPoints:['src/core/world/index.ts'],outfile:join(temp,'world.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const { WORLD_KEY, emptyWorld }=await import(pathToFileURL(join(temp,'world.mjs')));
  await rm(temp,{recursive:true,force:true});
  const w=emptyWorld(); w.agents.P001={st:'내근',situation:'서류 정리',tagged:true};
  const chats=[{id:'one',message:[],scriptstate:{[WORLD_KEY]:JSON.stringify(w)}},{id:'two',message:[],scriptstate:{}}];
  let active=0,calls=0,finish,request;
  globalThis.risuai={
    getCurrentCharacterIndex:async()=>0,getCurrentChatIndex:async()=>active,
    getCharacterFromIndex:async()=>structuredClone(char),getChatFromIndex:async(_,i)=>structuredClone(chats[i]),
    setChatToIndex:async(_,i,c)=>{chats[i]=c;},parseRisuChat:async s=>s==='{{user}}'?'방문자':'유저 페르소나',
    runLLMModel:async r=>{calls++;request=r;return await new Promise(resolve=>finish=resolve);},
  };
  const api=createVisit();
  assert.equal((await api.state()).agents[0].room,'office');
  const pending=api.send('P001','안녕','aux');
  while (!finish) await new Promise(r=>setTimeout(r,1));
  await assert.rejects(api.send('P001','중복','main'),/응답/);
  assert.equal(request.mode,'submodel');
  assert.match(request.messages[0].content,/Bureau HQ visit/);
  const body=JSON.parse(request.messages[1].content);
  assert.equal(body.protagonist.lore,'유저 페르소나');
  assert.equal(body.agent.lore,'조용하고 신중한 요원이다.');
  assert.equal(body.said,'안녕');
  active=1; finish({type:'success',result:'{"line":"안녕하세요."}'});
  await pending;
  assert.equal(calls,1);
  assert.equal(visitRecord(chats[0]).turns[0].reply,'안녕하세요.');
  assert.equal(visitRecord(chats[1]).turns.length,0);
  await assert.rejects(api.state(),/채팅이 변경/);
  active=0;
  await assert.rejects(api.send('missing','안녕','main'),/만날 수 없는/);
  risuai.runLLMModel=async()=>{throw new Error('offline');};
  await assert.rejects(api.send('P001','다시','main'),/offline/);
  assert.equal(visitRecord(chats[0]).turns.length,1);
});

test('reply keeps only spoken words within the limit', () => {
  assert.equal(parseVisitLine('{"line":"그래, 보고서는 내일까지야."}','에일린',80),'그래, 보고서는 내일까지야.');
  assert.equal(parseVisitLine('```json\n{"line":"*한숨을 쉰다* 알겠어요. (서류를 넘기며)"}\n```','에일린',80),'알겠어요.');
  assert.equal(parseVisitLine('에일린: 오늘은 조용하네요. [AG|에일린|내근|서류]','에일린',80),'오늘은 조용하네요.');
  assert.equal(parseVisitLine('에일린은 고개를 들었다.\n"왔어요? 커피 마실래요?"\n그녀가 웃었다.','에일린',80),'왔어요? 커피 마실래요?');
  assert.equal(parseVisitLine('{"line":"그 사람이 \\"괜찮다\\"고 했어요."}','에일린',80),'그 사람이 "괜찮다"고 했어요.');
  assert.equal(clipLine('첫 문장입니다. 두 번째 문장은 아주 길어서 넘칩니다.',12),'첫 문장입니다.');
  assert.equal([...clipLine('가'.repeat(100),80)].length,80);
  assert.throws(()=>parseVisitLine('{"line":"*고개만 끄덕인다*"}','에일린',80),/대사/);
});
