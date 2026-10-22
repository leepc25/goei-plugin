import {createRequire} from 'node:module';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/leepc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const url='https://raw.githack.com/leepc25/goei-plugin/5487e49e36f5cd3c016213b47fe87bf3e48b37f9/game-src/art/cutscene-production-round2/round2-review.html';
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await b.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));let response=await page.goto(url);assert.equal(response.status(),200);let externalContentNotice=false;
if((await page.title()).includes('External Content Notice')){externalContentNotice=true;[response]=await Promise.all([page.waitForNavigation(),page.getByText('Open the page',{exact:true}).click()]);}
await page.waitForFunction(()=>window.reviewState?.().ready);
const body=await response.body(),local=await readFile(new URL('round2-review.html',import.meta.url));
const remotePayload=await page.locator('#payload').textContent(),localPayload=local.toString().match(/<script id="payload" type="application\/json">([\s\S]*?)<\/script>/)[1];assert.equal(remotePayload,localPayload);
await page.locator('#play').click();await page.waitForFunction(()=>window.reviewState().elapsed===2400,{}, {timeout:5000});const state=await page.evaluate(()=>window.reviewState());assert.equal(state.index,16);assert.deepEqual(errors,[]);
const report={url,status:response.status(),externalContentNotice,contentType:response.headers()['content-type'],payloadSha256:createHash('sha256').update(remotePayload).digest('hex'),payloadMatchesLocal:true,fullHtmlMatchesLocal:body.equals(local),hostAddsScript:body.includes(Buffer.from('getunicorn.org')),normalPlayback:state,errors};
await writeFile(new URL('review/remote-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await b.close()}
