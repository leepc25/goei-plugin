/* Mechanical verification only. These assertions do not judge natural motion. */
const fs=require('node:fs'),assert=require('node:assert/strict'),E=require('../src/engine.js'),meta=require('../assets/jyaldi.json');global.JyaldiEngine=E;
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]})),Renderer=require('../src/renderer.js');
(async()=>{
const checks=[],atlas=await loadImage('assets/jyaldi.png'),c=createCanvas(420,260),g=c.getContext('2d'),r=new Renderer(c,atlas,meta,createCanvas);
assert(!meta.armRig&&!meta.crouchRig&&!meta.finishBodies);assert(!fs.readFileSync('src/renderer.js','utf8').includes('drawArm('));checks.push('runtime contains no separated character limb rig');
const oldMeta=JSON.parse(fs.readFileSync('backup-v07/jyaldi.json','utf8')),oldAtlas=await loadImage('backup-v07/jyaldi.png');
const image=(atlas,f)=>{g.clearRect(0,0,420,260);g.drawImage(atlas,f.x,f.y,f.w,f.h,0,0,f.w,f.h);return g.getImageData(0,0,f.w,f.h).data;};
assert.deepEqual(image(atlas,meta.frames[0]),image(oldAtlas,oldMeta.frames[0]));checks.push('user-approved neutral standing sprite remains pixel-identical');
for(const action of ['combat','jab','cross','finish','walk','run','crouch','crouch_walk','low_attack']){
 for(const id of E.MOTIONS[action].poses){const f=meta.frames[id];assert(f.wholeBody,action+' uses old body '+id);const p={x:200,y:240,z:0,face:1,action,t:0,iframes:0};g.clearRect(0,0,420,260);r.drawSprite(p,id);const actual=g.getImageData(0,0,420,260).data;g.clearRect(0,0,420,260);g.drawImage(atlas,f.x,f.y,f.w,f.h,p.x+f.ox,p.y+f.oy,f.w,f.h);assert.deepEqual(actual,g.getImageData(0,0,420,260).data,action+' distorts full-body drawing');}
 checks.push(action+' renders complete unchanged whole-body drawings');}
for(const f of meta.frames.slice(72)){assert(f.headAxis,'missing annotated head '+f.sourceSheet);const h=f.headAxis;assert(Math.abs(Math.hypot(h[2]-h[0],h[3]-h[1])-meta.headAxisTarget)<1.5);assert.equal(f.pelvis[0],10);assert.equal(f.registration,'manually annotated pelvis / support sole');}
checks.push('annotated crown/chin axes match canonical size; explicit pelvis replaces guessed image band');
for(const action of ['walk','run','crouch_walk'])assert.equal(new Set(E.MOTIONS[action].poses).size,8);
checks.push('all three movement cycles use eight complete drawings');
assert(Math.abs(meta.frames[100].oy-meta.frames[99].oy)<=7);assert(Math.abs(meta.frames[96].oy-meta.frames[103].oy)<=7);checks.push('run row and loop boundaries stay below eight pixels of top-edge displacement');
assert.equal(meta.frames[111].sourceIndex,2);assert.equal(meta.frames[115].sourceIndex,3);checks.push('crouch cycle includes feet-together passing poses in both halves');
for(const [action,contact,id]of [['jab',.12,78],['cross',.12,82],['finish',.29,86],['low_attack',.22,117]])assert.equal(E.poseAt(action,contact+.0001),id);
checks.push('contact timings align with the complete contact pose');
fs.writeFileSync('output/wholebody-validation.json',JSON.stringify({method:'sprite identity, source-scale and raw Canvas2D comparison; not a judgment of animation quality',passed:checks.length,checks},null,2));console.log(checks.join('\n'));
})().catch(e=>{console.error(e);process.exitCode=1});
