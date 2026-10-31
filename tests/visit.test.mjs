import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-visit-'));
await build({ entryPoints: ['src/core/visit.ts', 'src/core/visitPrompt.ts', 'src/core/interlude.ts', 'src/host/game/visit.ts'], outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, define: { __PLUGIN_VERSION__: '"test"', __UPDATE_BASE__: '""' }, logLevel: 'silent' });
const { visitRoom, visitRecord, withVisitTurn, VISIT_LORE } = await import(pathToFileURL(join(dir, 'core/visit.mjs')));
const { createVisit } = await import(pathToFileURL(join(dir, 'host/game/visit.mjs')));
const { parseVisitLine, parseVisitGroup, clipLine } = await import(pathToFileURL(join(dir, 'core/visitPrompt.mjs')));
const { withInterludes, orphanTurns, INTERLUDE_HEAD } = await import(pathToFileURL(join(dir, 'core/interlude.mjs')));
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
  // 옛 로어북 기록 항목은 쓰지 않고, 있던 것은 지운다
  assert.deepEqual(chat.localLore,[{comment:'other',content:'keep'}]);
  const old={...chat,localLore:[...chat.localLore,{comment:VISIT_LORE,content:'x'}]};
  assert.deepEqual(withVisitTurn(old,{id:'new',at:0,agentId:'P1',name:'요원',user:'a',reply:'b'}).localLore,[{comment:'other',content:'keep'}]);
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

test('interlude goes right after its anchor message in the main request, and drops when the anchor is rerolled away', () => {
  const t=(id,anchor,name,user,reply)=>({id,at:0,agentId:name,name,user,reply,anchor,room:'office',visitor:'쟈알디'});
  const chat={message:[{role:'user',data:'출근했다.',chatId:'u1'},{role:'char',data:'에일린이 서류를 정리하고 있다. 사무실은 조용하다.',chatId:'c1'},{role:'user',data:'회의실로 간다.',chatId:'u2'}],
    goeiHqVisitV1:{turns:[t('1','c1','에일린','서류 다 됐어?','거의 다 됐어요.'),t('2','c1','데드폴','장비는?','점검 끝났습니다.'),t('3','gone','에일린','옛날 얘기','사라진 답')]}};
  const req=[{role:'system',content:'main prompt'},{role:'user',content:'출근했다.'},{role:'assistant',content:'에일린이 서류를 정리하고 있다. 사무실은 조용하다.'},{role:'system',content:'post'},{role:'user',content:'회의실로 간다.'}];
  const out=withInterludes(req,chat,'RULES','주인공');
  assert.equal(out.length,6);
  assert.equal(out[3].role,'system');
  assert.ok(out[3].content.startsWith(INTERLUDE_HEAD));
  assert.match(out[3].content,/RULES/);
  assert.match(out[3].content,/쟈알디: 서류 다 됐어\?\n에일린: 거의 다 됐어요\./);
  assert.match(out[3].content,/— with 데드폴 \(office\) —/);
  assert.ok(!out[3].content.includes('사라진 답'));
  assert.deepEqual(orphanTurns(chat).map(x=>x.id),['3']);
  // 두 번 넣지 않는다
  assert.equal(withInterludes(out,chat,'RULES','주인공').length,6);
  // 기준 메시지 글이 요청에서 바뀌어 못 찾아도, 새 입력 바로 앞이면 마지막 사용자 메시지 앞에
  const req2=[{role:'system',content:'main'},{role:'assistant',content:'(다르게 가공된 글)'},{role:'user',content:'회의실로 간다.'}];
  const out2=withInterludes(req2,chat,null,'주인공');
  assert.equal(out2[2].role,'system');
  assert.equal(out2[3].content,'회의실로 간다.');
});

test('interlude finds the right one of two identical replies', () => {
  const chat={message:[{role:'char',data:'같은 답',chatId:'a'},{role:'user',data:'다음',chatId:'b'},{role:'char',data:'같은 답',chatId:'c'},{role:'user',data:'또',chatId:'d'}],
    goeiHqVisitV1:{turns:[{id:'1',at:0,agentId:'x',name:'에일린',user:'u',reply:'r',anchor:'a'}]}};
  const req=[{role:'assistant',content:'같은 답'},{role:'user',content:'다음'},{role:'assistant',content:'같은 답'},{role:'user',content:'또'}];
  const out=withInterludes(req,chat,null,'주인공');
  assert.equal(out[1].role,'system');
  assert.equal(out[2].content,'다음');
});

test('nearby agents may chime in: one call, addressed agent first, at most two bystanders, saved and carried into the interlude', async () => {
  const ag=(id,name)=>({id,name,english:name,lore:name,affiliation:'A00',rank:'요원',aliases:[],roster_for:['A00'],phone_tabs:[]});
  const roster={version:2,characters:[ag('P001','에일린'),ag('P002','데드폴'),ag('P003','큐라스')]};
  const char={chaId:'card-1',name:'괴이',globalLore:[{comment:'Agent roster',content:JSON.stringify(roster)},{comment:'에일린',content:'에일린 설정'},{comment:'데드폴',content:'데드폴 설정'},{comment:'큐라스',content:'큐라스 설정'},{comment:'Visit',content:GUIDE}]};
  const temp=await mkdtemp(join(tmpdir(),'goei-world-'));
  await build({entryPoints:['src/core/world/index.ts'],outfile:join(temp,'world.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
  const { WORLD_KEY, emptyWorld }=await import(pathToFileURL(join(temp,'world.mjs')));
  await rm(temp,{recursive:true,force:true});
  const w=emptyWorld();
  w.agents.P001={st:'내근',situation:'서류',tagged:true}; w.agents.P002={st:'내근',situation:'장비',tagged:true}; w.agents.P003={st:'휴게',situation:'커피',tagged:true};
  const chats=[{id:'one',message:[{role:'char',data:'사무실',chatId:'c1'}],scriptstate:{[WORLD_KEY]:JSON.stringify(w)}}];
  let request, result='{"lines":[{"speaker":"에일린","line":"거의 다 됐어요."},{"speaker":"데드폴","line":"*끼어들며* 장비도 끝났어."},{"speaker":"큐라스","line":"다른 방이라 못 들음"},{"speaker":"데드폴","line":"두 번째"}]}';
  globalThis.risuai={
    getCurrentCharacterIndex:async()=>0,getCurrentChatIndex:async()=>0,
    getCharacterFromIndex:async()=>structuredClone(char),getChatFromIndex:async(_,i)=>structuredClone(chats[i]),
    setChatToIndex:async(_,i,c)=>{chats[i]=c;},parseRisuChat:async s=>s==='{{user}}'?'방문자':'',
    runLLMModel:async r=>{request=r;return {type:'success',result};},
  };
  const api=createVisit();
  await api.state();
  const st=await api.send('P001','서류 다 됐어?','aux',['P002','P003','P001']);
  assert.match(request.messages[0].content,/bystanders/);
  assert.match(request.messages[0].content,/"lines"/);
  const body=JSON.parse(request.messages[1].content);
  assert.deepEqual(body.bystanders.map(b=>b.name),['데드폴']); // 휴게실 큐라스와 자기 자신은 빠진다
  assert.equal(body.bystanders[0].lore,'데드폴 설정');
  const turn=st.turns.at(-1);
  assert.equal(turn.reply,'거의 다 됐어요.');
  assert.deepEqual(turn.extra,[{agentId:'P002',name:'데드폴',line:'장비도 끝났어.'}]);
  // 데드폴에게 말을 걸면 끼어든 말도 데드폴과의 대화로 들어간다
  result='{"lines":[{"speaker":"데드폴","line":"응?"}]}';
  await api.send('P002','그래?','aux',[]);
  const body2=JSON.parse(request.messages[1].content);
  assert.ok(!body2.bystanders);
  assert.match(request.messages[0].content,/OUTPUT|line/);
  assert.ok(body2.conversation.some(l=>l.speaker==='데드폴'&&l.text==='장비도 끝났어.'));
  const out=withInterludes([{role:'assistant',content:'사무실'}],chats[0],null,'주인공');
  assert.match(out[1].content,/에일린: 거의 다 됐어요\.\n데드폴 \(cut in\): 장비도 끝났어\./);
  // 끼어들기를 끄면 혼자 답하는 형식
  chats[0].scriptstate.$hq_adv_interject='0';
  result='{"line":"네."}';
  await api.send('P001','고마워','aux',['P002']);
  assert.ok(!JSON.parse(request.messages[1].content).bystanders);
  assert.ok(!request.messages[0].content.includes('bystanders'));
});

test('group reply parsing', () => {
  assert.deepEqual(parseVisitGroup('{"line":"네."}','에일린',['데드폴'],80),{line:'네.',extra:[]});
  assert.deepEqual(parseVisitGroup('{"lines":[{"line":"이름 없는 첫 줄"}]}','에일린',[],80),{line:'이름 없는 첫 줄',extra:[]});
  assert.deepEqual(parseVisitGroup('{"lines":[{"speaker":"데드폴","line":"먼저 말함"},{"speaker":"에일린","line":"제 답이에요."}]}','에일린',['데드폴'],80),{line:'제 답이에요.',extra:[{speaker:'데드폴',line:'먼저 말함'}]});
  assert.equal(parseVisitGroup('에일린: 산문 답이에요.','에일린',['데드폴'],80).line,'산문 답이에요.');
  assert.throws(()=>parseVisitGroup('{"lines":[{"speaker":"데드폴","line":"나만"}]}','에일린',['데드폴'],80),/대사/);
});

test('interlude keeps the real order across agents and marks actions', () => {
  const t=(id,at,name,user,reply,extra)=>({id,at,agentId:name,name,user,reply,anchor:'c1',room:'office',...extra});
  const chat={message:[{role:'char',data:'사무실',chatId:'c1'}],goeiHqVisitV1:{turns:[
    t('1',1,'잼트리','안녕','어머.'),t('2',2,'로제몬','치마를 내린다','미쳤어?!',{act:true,extra:[{agentId:'J',name:'잼트리',line:'어머나...'}]}),t('3',3,'잼트리','미안','흥.')]}};
  const text=withInterludes([{role:'assistant',content:'사무실'}],chat,null,'데드폴')[1].content;
  const a=text.indexOf('with 잼트리'), b=text.indexOf('with 로제몬'), c=text.lastIndexOf('with 잼트리');
  assert.ok(a<b && b<c && a!==c, text);
  assert.match(text,/데드폴 \(action\): 치마를 내린다\n로제몬: 미쳤어\?!\n잼트리 \(cut in\): 어머나\.\.\./);
});
