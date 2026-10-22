import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { auditAssets, loadCatalog, packScene } from '../scripts/audit-cutscene-assets.mjs';
const root=resolve('game-src/art/cutscene/frames');
const catalog=await loadCatalog();

test('런타임 컷씬 목록의 컷·PNG·번호·해상도·타이밍·음성 참조가 모두 존재한다',async()=>{
 const report=await auditAssets(root,catalog);
 assert.deepEqual(report.errors,[]);
 assert.equal(report.scenes.length,Object.keys(catalog).length);
 assert.ok(report.totals.frames>0);
 for(const s of report.scenes) assert.equal(s.cuts.length,catalog[s.id].cuts.length);
});

test('원본 byte pack을 풀면 중복 프레임과 timing/loop/subtitle까지 그대로 복원된다',async()=>{
 const out=await mkdtemp(join(tmpdir(),'goei-cut-pack-'));
 try {
  const id='first_call',manifest=await packScene(root,id,catalog[id],out);
  const disk=JSON.parse(await readFile(join(out,id,'manifest.json'),'utf8'));
  assert.deepEqual(disk,manifest);
  const binary=await readFile(join(out,id,'frames.bin'));
  assert.equal(binary.length,manifest.byteLength);
  assert.deepEqual(manifest.subs,catalog[id].subs);
  for(let c=0;c<manifest.cuts.length;c++) {
   const cut=manifest.cuts[c],timing=JSON.parse(await readFile(join(root,id,`c${c+1}`,'timing.json'),'utf8'));
   assert.deepEqual(cut.ms,timing.ms);assert.deepEqual(cut.loop,timing.loop);
   for(let k=0;k<cut.frames.length;k++) {
    const im=manifest.images[cut.frames[k]];
    const original=await readFile(join(root,id,`c${c+1}`,`${String(k+1).padStart(4,'0')}.png`));
    assert.deepEqual(binary.subarray(im.offset,im.offset+im.length),original);
   }
  }
  assert.ok(manifest.images.length<manifest.cuts.reduce((n,c)=>n+c.frames.length,0),'현재 first_call의 동일 PNG를 중복 저장하지 않음');
  await assert.rejects(()=>packScene(root,id,catalog[id],join(root,'generated')),/outside/);
 } finally {await rm(out,{recursive:true,force:true});}
});

test('실패를 출력만 하고 통과시키지 않는다: 목록·누락·번호·재생 길이·오디오 검증',async()=>{
 const root=await mkdtemp(join(tmpdir(),'goei-cut-broken-'));
 try {
  await mkdir(join(root,'demo','c1'),{recursive:true});
  await writeFile(join(root,'index.json'),JSON.stringify(['demo','demo','unknown']));
  await writeFile(join(root,'demo','c1','timing.json'),JSON.stringify({ms:[100,100]}));
  await writeFile(join(root,'demo','c1','0099.png'),Buffer.alloc(5));
  const result=await auditAssets(root,{demo:{cuts:[1],subs:[],sound:true},unlisted:{cuts:[1],subs:[]}});
  assert.equal(result.valid,false);
  for(const message of ['duplicate scene','absent from runtime catalog','missing from index','missing referenced frame','unreferenced','differs from runtime','missing audio']) {
   assert.ok(result.errors.some(e=>e.message.includes(message)),message);
  }
 } finally {await rm(root,{recursive:true,force:true});}
});

test('잘못된 PNG와 프레임 시간/루프 범위를 오류로 반환한다',async()=>{
 const root=await mkdtemp(join(tmpdir(),'goei-cut-invalid-'));
 try {
  await mkdir(join(root,'demo','c1'),{recursive:true});
  await writeFile(join(root,'index.json'),'["demo"]');
  const meta=join(root,'demo','c1','timing.json');
  await writeFile(meta,JSON.stringify({ms:[1000],loop:[1,2]}));
  await writeFile(join(root,'demo','c1','0001.png'),Buffer.alloc(40));
  let r=await auditAssets(root,{demo:{cuts:[1]}});
  assert.ok(r.errors.some(e=>e.message.includes('loop outside')));
  assert.ok(r.errors.some(e=>e.message.includes('PNG header')));
  await writeFile(meta,JSON.stringify({ms:[0]}));r=await auditAssets(root,{demo:{cuts:[1]}});
  assert.ok(r.errors.some(e=>e.message.includes('finite durations')));
 } finally {await rm(root,{recursive:true,force:true});}
});
