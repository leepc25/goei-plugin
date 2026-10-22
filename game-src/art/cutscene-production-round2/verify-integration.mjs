import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),root=new URL('./',import.meta.url),repo=new URL('../../../',root);
const {chromium}=require('C:/Users/leepc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const video=await readFile(new URL('src/game/action/story/video.ts',repo),'utf8');
const requests=[],errors=[];
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');return res.end('<body><script type="module">import {VideoPlayer} from "/src/game/action/story/video.ts";window.draws=[];const original=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(im,...a){window.draws.push({name:im.src.split("/").pop(),at:performance.now()});return original.call(this,im,...a)};window.player=new VideoPlayer(document.body);window.finished=0;window.start=()=>{window.at=performance.now();window.player.play("/clip/",[2.4],[],()=>{window.finished++;window.end=performance.now()})};</script>');}
 if(['/src/game/action/story/video.ts','/src/game/action/ui/kit','/src/game/action/ui/kit.gen'].includes(path)){
 const name=path.endsWith('.ts')?path.slice(1):path.slice(1)+'.ts';
 res.setHeader('Content-Type','text/javascript');return res.end(stripTypeScriptTypes(await readFile(new URL(name,repo),'utf8'),{mode:'transform'}));}
 if(/^\/clip\/c1\/(\d{4}\.png|timing\.json)$/.test(path)){requests.push(path);res.setHeader('Content-Type',path.endsWith('.png')?'image/png':'application/json');return res.end(await readFile(new URL('integration/environment/'+path.slice(6),root)));}
 res.writeHead(404).end();
}catch(e){errors.push(String(e));res.writeHead(500).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await b.newPage();page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+server.address().port);
await page.waitForFunction(()=>window.start);await page.evaluate(()=>window.start());await page.waitForFunction(()=>window.finished===1,{}, {timeout:6000});
const result=await page.evaluate(()=>({draws:window.draws,durationMs:window.end-window.at,finished:window.finished,open:window.player.open}));
assert.deepEqual(result.draws.map(d=>d.name),Array.from({length:17},(_,i)=>String(i+1).padStart(4,'0')+'.png'));
assert.equal(result.open,false);assert.ok(result.durationMs>=2400&&result.durationMs<3200);assert.deepEqual(errors,[]);
const report={status:'passed',playerSource:'src/game/action/story/video.ts',playerSourceSha256:createHash('sha256').update(video).digest('hex'),transformation:'TypeScript type erasure only; imports and player logic unchanged',...result,requests,errors};
await writeFile(new URL('integration/runtime-validation.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'passed',frames:result.draws.length,durationMs:result.durationMs,errors}));
}finally{await b.close();await new Promise(r=>server.close(r))}
