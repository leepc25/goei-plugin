#!/usr/bin/env python3
"""쟈알디 새 기준표 화면 크기 확인판 (생성 없음).

기준표 1장을 관리국 복도 배경(1280×720) 위 벨트스크롤 바닥에 정수배(2·3·4배)로 그려,
화면에서 캐릭터가 차지하는 크기를 본다. 동작은 없고 좌우·앞뒤 이동만 된다(크기 확인 전용).
사용: python3 tools/build_size_check.py
"""
import base64, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, 'game-src/action/jyaldi-v5/sheet7/jyaldi-base-pixen-a.png')
BG = os.path.join(ROOT, 'game-src/action/bureau-corridor.png')
OUT = os.path.join(ROOT, 'release/demo/jyaldi-size-check.html')
b64 = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
HTML = r'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쟈알디 화면 크기 확인</title>
<style>body{margin:0;background:#0d1114;color:#e8e6e0;font:14px/1.5 system-ui}.w{max-width:1300px;margin:0 auto;padding:10px 12px 30px}
h1{font-size:16px;margin:4px 0 8px}canvas{width:100%;max-width:1280px;aspect-ratio:16/9;display:block;background:#222;image-rendering:pixelated;border-radius:6px}
.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}button{background:#2c383e;color:#e8e6e0;border:0;border-radius:8px;padding:8px 14px;font-size:15px}button.on{background:#c9d4dc;color:#11161b}
.pad{display:grid;grid-template-columns:repeat(3,56px);gap:6px;margin-top:8px}.pad button{height:48px;padding:0;font-size:20px;touch-action:none;user-select:none}p{color:#b8bcc0;margin:6px 0}</style>
<div class="w"><h1>쟈알디 새 기준표(Pixen A) · 화면 크기 확인 · 동작 없음</h1>
<canvas id="c" width="1280" height="720"></canvas>
<div class="bar">배율 <button data-s="2">2배</button><button data-s="3" class="on">3배</button><button data-s="4">4배</button> <span id="info"></span></div>
<div class="pad"><span></span><button data-k="ArrowUp">↑</button><span></span><button data-k="ArrowLeft">←</button><button data-k="ArrowDown">↓</button><button data-k="ArrowRight">→</button></div>
<p>PC는 방향키, 폰은 아래 버튼. ↑↓는 화면 안쪽·앞쪽 이동. 회색 상자는 같은 키의 적 자리표시입니다.</p></div>
<script>
const spr=new Image(); spr.src='data:image/png;base64,__SPR__'; const bg=new Image(); bg.src='data:image/png;base64,__BG__';
const c=document.getElementById('c'), ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false;
const FAR_Y=390, NEAR_Y=690; let S=3, x=420, z=0.6, dir=1; const keys=new Set();
addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){keys.add(e.key);e.preventDefault();}}); addEventListener('keyup',e=>keys.delete(e.key));
document.querySelectorAll('.pad button').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{keys.add(k);e.preventDefault();};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>keys.delete(k);});
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{S=+b.dataset.s;document.querySelectorAll('[data-s]').forEach(o=>o.classList.toggle('on',o===b));});
let bb=null;
function box(){const t=document.createElement('canvas');t.width=spr.width;t.height=spr.height;const g=t.getContext('2d');g.drawImage(spr,0,0);const d=g.getImageData(0,0,t.width,t.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)if(d[(y*t.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return{x0,y0,x1,y1};}
function frame(){
  if(!bb&&spr.complete&&spr.width)bb=box();
  const mx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0), mz=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);
  x=Math.max(60,Math.min(1220,x+mx*5)); z=Math.max(0,Math.min(1,z+mz*0.012)); if(mx)dir=mx;
  ctx.clearRect(0,0,1280,720); if(bg.complete)ctx.drawImage(bg,0,-10,1280,740);
  ctx.fillStyle='rgba(20,24,28,.35)';ctx.fillRect(0,FAR_Y,1280,720-FAR_Y);
  const ents=[{x:900,z:0.35,e:1},{x,z,e:0}].sort((a,b)=>a.z-b.z);
  for(const o of ents){const gy=FAR_Y+(NEAR_Y-FAR_Y)*o.z; ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(o.x,gy,14*S,4*S,0,0,7);ctx.fill();
    if(!bb)continue; const h=(bb.y1-bb.y0+1)*S;
    if(o.e){ctx.fillStyle='#7a8088';ctx.fillRect(o.x-12*S,gy-h,24*S,h);ctx.strokeStyle='#cfd3d8';ctx.lineWidth=2;ctx.strokeRect(o.x-12*S,gy-h,24*S,h);continue;}
    const cx=(bb.x0+bb.x1)/2, dx=Math.round(o.x-cx*S), dy=Math.round(gy-(bb.y1+1)*S);
    ctx.save(); if(dir<0){ctx.translate(o.x*2,0);ctx.scale(-1,1);} ctx.drawImage(spr,dx,dy,spr.width*S,spr.height*S); ctx.restore();}
  if(bb){const h=(bb.y1-bb.y0+1);document.getElementById('info').textContent=`도트 키 ${h}px × ${S}배 = 화면 ${h*S}px (화면 높이 720의 ${Math.round(h*S/7.2)}%)`;}
  requestAnimationFrame(frame);}
requestAnimationFrame(frame);
</script>'''
open(OUT, 'w', encoding='utf-8').write(HTML.replace('__SPR__', b64(SPR)).replace('__BG__', b64(BG)))
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
