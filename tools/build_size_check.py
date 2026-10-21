#!/usr/bin/env python3
"""쟈알디 새 기준표 화면 크기 확인판 (생성 없음).

기준표 1장을 관리국 복도 배경 위 벨트스크롤 바닥에 그려 화면 크기·카메라 줌(자동 2·3·4배)·원근 크기를 비교한다.
동작은 없고 좌우·앞뒤 이동만 된다(확인 전용).
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
h1{font-size:16px;margin:4px 0 8px}canvas{width:100%;max-width:1280px;aspect-ratio:16/9;display:block;background:#222;border-radius:6px}
.bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:8px 0}.bar b{font-weight:600;margin-right:2px}button{background:#2c383e;color:#e8e6e0;border:0;border-radius:8px;padding:8px 12px;font-size:14px}button.on{background:#c9d4dc;color:#11161b}
.pad{display:grid;grid-template-columns:repeat(3,56px);gap:6px;margin-top:8px}.pad button{height:48px;padding:0;font-size:20px;touch-action:none;user-select:none}p{color:#b8bcc0;margin:6px 0}#info{color:#b8bcc0}</style>
<div class="w"><h1>쟈알디 새 기준표(Pixen A) · 화면 크기·줌·원근 확인 · 동작 없음</h1>
<canvas id="c" width="1280" height="720"></canvas>
<div class="bar"><b>배율</b><button data-s="auto" class="on">자동</button><button data-s="2">2배</button><button data-s="3">3배</button><button data-s="4">4배</button><span id="info"></span></div>
<div class="bar"><b>자동 줌 시험</b><button id="add">적 +1</button><button id="del">적 −1</button><button id="cine">연출(4배 2초)</button></div>
<div class="bar"><b>거리감</b><button id="persp">원근 크기 끔</button><button id="fog" class="on">안쪽 어둡게 켬</button></div>
<div class="pad"><span></span><button data-k="ArrowUp">↑</button><span></span><button data-k="ArrowLeft">←</button><button data-k="ArrowDown">↓</button><button data-k="ArrowRight">→</button></div>
<p>PC는 방향키, 폰은 아래 버튼. ↑↓는 화면 안쪽·앞쪽 이동. 회색 상자는 같은 키의 적 자리표시입니다.</p>
<p>자동: 적 4명 이상이면 2배로 멀어지고, 연출 버튼은 4배로 다가갑니다. 바뀌는 0.3초만 부드럽고 도착하면 정수배로 맞춥니다. 원근 크기를 켜면 안쪽으로 갈수록 최대 20% 작아지는데, 위아래로 움직일 때 도트가 떨리는지 보세요. 배경은 크기 확인용 임시 그림이라 2배일 때 위아래를 이어 붙여 채웠습니다.</p></div>
<script>
const spr=new Image(); spr.src='data:image/png;base64,__SPR__'; const bg=new Image(); bg.src='data:image/png;base64,__BG__';
const c=document.getElementById('c'), ctx=c.getContext('2d');
const FAR_Y=390, NEAR_Y=690, BASE=3; let mode='auto', cur=3, from=3, to=3, tt=1, cineT=0, persp=false, fog=true, x=420, z=0.6, dir=1; const keys=new Set();
const foes=[{x:900,z:0.35}]; const spots=[[1050,0.7],[760,0.15],[1150,0.3],[640,0.9],[1250,0.55],[300,0.2],[180,0.8]];
addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){keys.add(e.key);e.preventDefault();}}); addEventListener('keyup',e=>keys.delete(e.key));
document.querySelectorAll('.pad button').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{keys.add(k);e.preventDefault();};b.onpointerup=b.onpointerleave=b.onpointercancel=()=>keys.delete(k);});
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{mode=b.dataset.s;document.querySelectorAll('[data-s]').forEach(o=>o.classList.toggle('on',o===b));});
add.onclick=()=>{if(foes.length<8){const s=spots[(foes.length-1)%spots.length];foes.push({x:s[0],z:s[1]});}}; del.onclick=()=>{if(foes.length>1)foes.pop();};
cine.onclick=()=>{cineT=2;};
document.getElementById('persp').onclick=e=>{persp=!persp;e.target.classList.toggle('on',persp);e.target.textContent='원근 크기 '+(persp?'켬':'끔');};
document.getElementById('fog').onclick=e=>{fog=!fog;e.target.classList.toggle('on',fog);e.target.textContent='안쪽 어둡게 '+(fog?'켬':'끔');};
let bb=null;
function box(){const t=document.createElement('canvas');t.width=spr.width;t.height=spr.height;const g=t.getContext('2d');g.drawImage(spr,0,0);const d=g.getImageData(0,0,t.width,t.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;for(let y=0;y<t.height;y++)for(let x=0;x<t.width;x++)if(d[(y*t.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return{x0,y0,x1,y1};}
let last=performance.now();
function frame(now){const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(!bb&&spr.complete&&spr.width)bb=box();
  const mx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0), mz=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);
  x=Math.max(-300,Math.min(1600,x+mx*300*dt)); z=Math.max(0,Math.min(1,z+mz*0.7*dt)); if(mx)dir=mx;
  cineT=Math.max(0,cineT-dt);
  const want=mode!=='auto'?+mode:(cineT>0?4:foes.length>=4?2:3);
  if(want!==to){from=cur;to=want;tt=0;} tt=Math.min(1,tt+dt/0.3); const e=tt<1?(1-Math.cos(Math.PI*tt))/2:1; cur=tt<1?from+(to-from)*e:to;
  const k=cur/BASE, camX=x, camY=360;
  ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled=false; ctx.fillStyle='#0c1014'; ctx.fillRect(0,0,1280,720);
  ctx.setTransform(k,0,0,k,640-camX*k,360-camY*k);
  if(bg.complete){const x0=Math.floor((camX-640/k)/1280)*1280; for(let bx=x0;bx<camX+640/k;bx+=1280){ctx.drawImage(bg,bx,-10,1280,740);
    for(let by=720;by<camY+360/k;by+=200)ctx.drawImage(bg,0,bg.height-200*bg.height/740,bg.width,200*bg.height/740,bx,by,1280,200);
    for(let by=-10;by>camY-360/k;by-=80)ctx.drawImage(bg,0,0,bg.width,80*bg.height/740,bx,by-80,1280,80);}}
  const ents=foes.map(f=>({...f,e:1})).concat([{x,z,e:0}]).sort((a,b)=>a.z-b.z);
  for(const o of ents){const gy=FAR_Y+(NEAR_Y-FAR_Y)*o.z, ps=persp?0.8+0.2*o.z:1, S=BASE*ps;
    ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(o.x,gy,14*S,4*S,0,0,7);ctx.fill();
    if(!bb)continue; const h=(bb.y1-bb.y0+1)*S; const dark=fog?(1-o.z)*0.35:0;
    if(o.e){ctx.fillStyle='#7a8088';ctx.fillRect(o.x-12*S,gy-h,24*S,h);ctx.strokeStyle='#cfd3d8';ctx.lineWidth=2/k;ctx.strokeRect(o.x-12*S,gy-h,24*S,h);
      if(dark){ctx.fillStyle=`rgba(8,12,18,${dark})`;ctx.fillRect(o.x-12*S,gy-h,24*S,h);} continue;}
    const cx=(bb.x0+bb.x1)/2, dx=o.x-cx*S, dy=gy-(bb.y1+1)*S;
    ctx.save(); if(dir<0){ctx.translate(o.x*2,0);ctx.scale(-1,1);} ctx.drawImage(spr,dx,dy,spr.width*S,spr.height*S);
    if(dark){ctx.globalCompositeOperation='source-atop';} ctx.restore();
    if(dark){ctx.save(); if(dir<0){ctx.translate(o.x*2,0);ctx.scale(-1,1);} ctx.filter='none'; ctx.globalAlpha=dark; ctx.drawImage(tint(),dx,dy,spr.width*S,spr.height*S); ctx.restore();}}
  if(bb){const h=bb.y1-bb.y0+1, ps=persp?0.8+0.2*z:1, eff=cur*ps;
    info.textContent=`지금 ${Number.isInteger(+eff.toFixed(3))?eff.toFixed(0):eff.toFixed(2)}배 → 화면 키 ${Math.round(h*eff)}px (화면의 ${Math.round(h*eff/7.2)}%)${mode==='auto'?' · 적 '+foes.length+'명':''}`;}
  requestAnimationFrame(frame);}
let tc=null; function tint(){if(tc)return tc; tc=document.createElement('canvas'); tc.width=spr.width; tc.height=spr.height; const g=tc.getContext('2d'); g.drawImage(spr,0,0); g.globalCompositeOperation='source-in'; g.fillStyle='#080c12'; g.fillRect(0,0,tc.width,tc.height); return tc;}
requestAnimationFrame(frame);
</script>'''
open(OUT, 'w', encoding='utf-8').write(HTML.replace('__SPR__', b64(SPR)).replace('__BG__', b64(BG)))
print('wrote', OUT, os.path.getsize(OUT) // 1024, 'KB')
