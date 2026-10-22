import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {build}=require(process.env.ESBUILD_MODULE||'esbuild');
const root=path.dirname(fileURLToPath(import.meta.url));
const bundle=await build({entryPoints:[path.join(root,'integration/hqDoorRound2.ts')],bundle:true,write:false,format:'iife',globalName:'DoorArt'});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});
try{
 const page=await browser.newPage();
 await page.setContent('<canvas id="out" width="1280" height="720"></canvas><canvas id="expected" width="1280" height="720"></canvas>');
 await page.addScriptTag({content:(await readFile(path.join(root,'integration/pack-inline.js'))).toString()});
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const states={};for(const s of ['closed','half','open'])states[s]='data:image/png;base64,'+(await readFile(path.join(root,'states',s+'.png'))).toString('base64');
 const result=await page.evaluate(async states=>{
   const errors=[];window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
   const c=document.getElementById('out').getContext('2d'),e=document.getElementById('expected').getContext('2d');
   const cleanup=DoorArt.prepareHqDoorRound2();
   const load=async src=>{const i=new Image();i.src=src;await i.decode();return i};
   const m=await load(window.__GOEI_HQ_DOOR_ROUND2__['entry-marker']);
   const expect={};for(const [s,src]of Object.entries(states))expect[s]=await load(src);
   // Decode completion yields to the preparation promise.
   await new Promise(r=>setTimeout(r,20));
   const matches=[];
   for(const [state,p]of [['closed',0],['half',.5],['open',1]]){
     c.clearRect(0,0,1280,720);e.clearRect(0,0,1280,720);c.save();c.translate(-1043,0);
     const drew=DoorArt.drawHqDoorRound2(c,1364,p,true);c.restore();
     e.imageSmoothingEnabled=false;e.drawImage(expect[state],225,168,192,288);e.drawImage(m,273,448,96,32);
     const actual=c.getImageData(0,0,1280,720).data,want=e.getImageData(0,0,1280,720).data;
     matches.push({state,drew,exact:actual.every((n,i)=>n===want[i])});
   }
   cleanup();const disposedFallback=DoorArt.drawHqDoorRound2(c,1364,0,true)===false;
   delete window.__GOEI_HQ_DOOR_ROUND2__;
   const release=DoorArt.prepareHqDoorRound2(async()=> '');await new Promise(r=>setTimeout(r,20));
   const missingFallback=DoorArt.drawHqDoorRound2(c,1364,0,true)===false;release();
   return {matches,disposedFallback,missingFallback,errors};
 },states);
 assert.ok(result.matches.every(r=>r.drew&&r.exact));
 assert.ok(result.disposedFallback&&result.missingFallback);assert.deepEqual(result.errors,[]);
 await writeFile(path.join(root,'evidence/integration-check.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
}finally{await browser.close()}
