const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
global.JyaldiEngine=require('../src/engine.js');const Renderer=require('../src/renderer.js');
(async()=>{const r=path.join(__dirname,'..'),meta=JSON.parse(fs.readFileSync(path.join(r,'assets/jyaldi.json'))),atlas=await loadImage(path.join(r,'assets/jyaldi.png'));
const c=createCanvas(960,540),render=new Renderer(c,atlas,meta,createCanvas),w=new JyaldiEngine.World(1);w.dummyMode=true;w.spawnWave();
const checks=[];
for(const [name,action,time] of [['idle','idle',0],['walk','walk',.3],['palm','palm',.28],['jump','jump',.1],['sit','sit',0],['defeat','defeat',1]]){w.player.action=action;w.player.t=time;if(action==='palm')w.effect('burst',w.player.x+80,w.player.y-90,.4);if(action==='jump')w.player.z=70;else w.player.z=0;render.draw(w);fs.writeFileSync(path.join(r,'output',`check-${name}.png`),c.toBuffer('image/png'));checks.push(action);}
const sheet=createCanvas(1600,Math.ceil(meta.frames.length/8)*210+20),g=sheet.getContext('2d');g.fillStyle='#1c222d';g.fillRect(0,0,sheet.width,sheet.height);g.imageSmoothingEnabled=false;
for(let i=0;i<meta.frames.length;i++){const f=meta.frames[i];const x=(i%8)*200+100,y=Math.floor(i/8)*210+205;g.drawImage(atlas,f.x,f.y,f.w,f.h,x+f.ox,y+f.oy,f.w,f.h);}
fs.writeFileSync(path.join(r,'output','Jyaldi_poses.png'),sheet.toBuffer('image/png'));
for(const x of [100,600,1100,1600,2200]){w.camera=x;render.draw(w);}assert(render.chunks.size<=4);
for(const f of meta.frames){assert(f.x>=0&&f.y>=0&&f.x+f.w<=atlas.width&&f.y+f.h<=atlas.height);assert(f.w>5&&f.h>5);}
assert.equal(meta.frames[0].h,160);assert.equal(meta.sex,'female');
const report={method:'Native Canvas2D in Node; not browser UI automation',poses:meta.frames.length,standingHeight:meta.frames[0].h,scenes:checks,cacheLimit:4,cacheObserved:render.chunks.size,imageAndCanvasBackingBytes:render.memoryEstimate(),atlasBytes:atlas.width*atlas.height*4,allAtlasRectsInBounds:true};
fs.writeFileSync(path.join(r,'output','render-validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));})();
