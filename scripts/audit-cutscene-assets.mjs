// Read-only by default. Optional packing preserves every PNG byte and authored timing.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const median = values => { const a = [...values].sort((x,y)=>x-y); return a[Math.floor(a.length/2)] ?? 0; };
export function pngSize(bytes) {
  if (bytes.length < 33 || !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.toString('ascii',12,16) !== 'IHDR') throw new Error('invalid PNG header');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
export async function loadCatalog(repo = REPO) {
  const { build } = await import('esbuild');
  const result = await build({ entryPoints:[join(repo,'src/game/action/story/scripts/videos.ts')], bundle:true, format:'esm', write:false, logLevel:'error' });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).VIDEOS;
}
/** Validate delivery, not visual approval. No image rewrite, remote fetch or paid generation. */
export async function auditAssets(framesRoot, catalog) {
  const errors=[], scenes=[];
  const fail=(path,message)=>errors.push({path,message});
  let index=[];
  try { index=JSON.parse(await readFile(join(framesRoot,'index.json'),'utf8')); if(!Array.isArray(index)||index.some(x=>typeof x!=='string')) throw new Error('expected string array'); }
  catch(e) { fail('index.json',e.message); index=[]; }
  if(new Set(index).size!==index.length) fail('index.json','duplicate scene');
  for(const id of index) if(!catalog[id]) fail(id,'indexed scene absent from runtime catalog');
  for(const [id,def] of Object.entries(catalog)) {
    if(!/^[a-z0-9_]+$/.test(id)) { fail(id,'invalid scene id'); continue; }
    if(!index.includes(id)) fail(id,'runtime scene missing from index');
    const scene={id,cuts:[],frames:0,pngBytes:0,decodedRgbaBytes:0,uniquePngBytes:0,uniqueImages:0,sourceRequests:1+def.cuts.length,durationMs:def.cuts.reduce((a,b)=>a+b,0)*1000};
    const unique=new Map();
    for(let i=0;i<def.cuts.length;i++) {
      const key=`${id}/c${i+1}`, dir=join(framesRoot,key); let timing;
      try { timing=JSON.parse(await readFile(join(dir,'timing.json'),'utf8')); } catch(e) { fail(key,`timing unreadable: ${e.message}`); continue; }
      if(!Array.isArray(timing.ms)||!timing.ms.length||timing.ms.some(ms=>!Number.isFinite(ms)||ms<16)) { fail(key,'ms must contain finite durations >=16ms'); continue; }
      if(timing.loop!==undefined && (!Array.isArray(timing.loop)||timing.loop.length!==2||timing.loop.some(x=>!Number.isInteger(x))||timing.loop[0]<1||timing.loop[1]<timing.loop[0]||timing.loop[1]>timing.ms.length)) fail(key,'loop outside 1-based frame range');
      const durationMs=timing.ms.reduce((a,b)=>a+b,0), expectedMs=def.cuts[i]*1000;
      if(!timing.loop && Math.abs(durationMs-expectedMs)>1) fail(key,`timing ${durationMs}ms differs from runtime ${expectedMs}ms`);
      const expected=new Set(timing.ms.map((_,k)=>`${String(k+1).padStart(4,'0')}.png`));
      const names=await readdir(dir);
      for(const name of names.filter(n=>n.endsWith('.png'))) if(!expected.has(name)) fail(`${key}/${name}`,'unreferenced or misnumbered PNG');
      const cut={id:`c${i+1}`,frames:timing.ms.length,durationMs,expectedMs,medianFrameMs:median(timing.ms),longestHoldMs:Math.max(...timing.ms),holdsOver500ms:timing.ms.filter(n=>n>=500).length,pngBytes:0,decodedRgbaBytes:0};
      for(const name of expected) {
        try {
          const bytes=await readFile(join(dir,name)); const [width,height]=pngSize(bytes);
          if(width!==640||height!==360) fail(`${key}/${name}`,`expected 640x360, got ${width}x${height}`);
          cut.pngBytes+=bytes.length; cut.decodedRgbaBytes+=width*height*4;
          unique.set(sha(bytes),bytes.length);
        } catch(e) { fail(`${key}/${name}`,e.code==='ENOENT'?'missing referenced frame':e.message); }
      }
      scene.cuts.push(cut); scene.frames+=cut.frames;scene.pngBytes+=cut.pngBytes;scene.decodedRgbaBytes+=cut.decodedRgbaBytes;
    }
    if(def.sound) { try { await readFile(join(framesRoot,id,'sound.ogg')); scene.sourceRequests++; } catch { fail(`${id}/sound.ogg`,'runtime enables missing audio'); } }
    scene.uniqueImages=unique.size;scene.uniquePngBytes=[...unique.values()].reduce((a,b)=>a+b,0);scene.sourceRequests+=scene.frames;
    scenes.push(scene);
  }
  return {schema:'goei-cutscene-audit/1',valid:errors.length===0,errors,scenes,totals:{scenes:scenes.length,cuts:scenes.reduce((n,s)=>n+s.cuts.length,0),frames:scenes.reduce((n,s)=>n+s.frames,0),pngBytes:scenes.reduce((n,s)=>n+s.pngBytes,0),decodedRgbaBytes:scenes.reduce((n,s)=>n+s.decodedRgbaBytes,0)}};
}
/** Two static HTTP responses per scene: manifest + concatenated original PNG bytes.
 * No crop/recolor/interpolation. Runtime adoption is a separate change. */
export async function packScene(framesRoot,id,def,outputRoot) {
  const rel=relative(resolve(framesRoot),resolve(outputRoot));
  if(rel===''||(!rel.startsWith('..')&&!isAbsolute(rel))) throw new Error('output must be outside the source frames tree');
  const images=[],cuts=[],chunks=[],known=new Map(); let offset=0;
  for(let i=0;i<def.cuts.length;i++) {
    const cutDir=join(framesRoot,id,`c${i+1}`), timing=JSON.parse(await readFile(join(cutDir,'timing.json'),'utf8'));
    const frames=[];
    for(let k=0;k<timing.ms.length;k++) {
      const bytes=await readFile(join(cutDir,`${String(k+1).padStart(4,'0')}.png`)), hash=sha(bytes);
      let at=known.get(hash);
      if(at===undefined) {
        const [width,height]=pngSize(bytes);at=images.length;known.set(hash,at);
        images.push({offset,length:bytes.length,sha256:hash,width,height});chunks.push(bytes);offset+=bytes.length;
      }
      frames.push(at);
    }
    cuts.push({durationMs:def.cuts[i]*1000,ms:timing.ms,...(timing.loop?{loop:timing.loop}:{}),frames});
  }
  const manifest={schema:'goei-cutscene-pack/1',id,binary:'frames.bin',byteLength:offset,images,cuts,subs:def.subs??[],...(def.sound?{audio:'sound.ogg'}:{})};
  const dir=join(outputRoot,id); await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'frames.bin'),Buffer.concat(chunks));
  await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest)+'\n');
  if(def.sound) await writeFile(join(dir,'sound.ogg'),await readFile(join(framesRoot,id,'sound.ogg')));
  return manifest;
}
async function main() {
  const args=process.argv.slice(2), get=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
  const repo=resolve(get('--repo')??REPO),framesRoot=join(repo,'game-src/art/cutscene/frames'),catalog=await loadCatalog(repo);
  const report=await auditAssets(framesRoot,catalog);
  if(get('--json')) await writeFile(resolve(get('--json')),JSON.stringify(report,null,2)+'\n');
  console.log(`scenes=${report.totals.scenes} cuts=${report.totals.cuts} frames=${report.totals.frames} PNG=${report.totals.pngBytes} bytes valid=${report.valid}`);
  for(const s of report.scenes) console.log(`${s.id}: ${s.sourceRequests} requests, ${(s.pngBytes/1048576).toFixed(2)} MiB PNG, ${(s.decodedRgbaBytes/1048576).toFixed(2)} MiB RGBA, max hold ${Math.max(...s.cuts.map(c=>c.longestHoldMs))}ms`);
  if(!report.valid) {console.error(JSON.stringify(report.errors,null,2));process.exitCode=1;return;}
  if(get('--pack-dir')) for(const id of get('--scene')?[get('--scene')]:Object.keys(catalog)) {
    if(!catalog[id]) throw new Error(`unknown scene ${id}`);
    const p=await packScene(framesRoot,id,catalog[id],resolve(get('--pack-dir')));console.log(`packed ${id}: ${p.images.length} images, ${p.byteLength} bytes (runtime integration not applied)`);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
