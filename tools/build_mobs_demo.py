#!/usr/bin/env python3
"""잡몹 도트 시연판: release/demo/goei-mobs.html (그림을 한 파일에 담음).
몹 고르기 → 클립 버튼 → 재생(장당 100ms, 4배 확대, 발바닥 줄 표시). 쟈알디 대기 장을 옆에 세워 크기 비교."""
import os,sys,glob,base64,json
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
E=os.path.join(ROOT,'game-src/art/enemy'); sys.path.insert(0,os.path.join(E,'scripts'))
from defs import M
NAMES={'lurker':'해롭지 않아 보이는 것','hollow':'더는 사람이 아닌 것','shooter':'사격하는 것','charger':'돌진하는 것','thief':'보급 승객','crawler':'다리 많은 새끼',
 'predator':'포식자','edge':'모서리 조각','shade':'얼룩','hum':'발소리','resident':'사는 척하는 주민','doorframe':'문틀이 된 등','dusty_table':'먼지 밥상',
 'dusty_chair':'먼지 의자','doorhand':'문틈 손','wallface':'벽에 묻힌 얼굴','floorhand':'납작한 손 바닥','tv402':'402호의 것','thump':'쿵쿵쿵 귀신',
 'mannequin':'인체 모형','hanged':'목매단 여자','specimen_jar':'과학실 표본 · 병','specimen_frog':'과학실 표본 · 개구리','specimen_snake':'과학실 표본 · 뱀','grinner':'모퉁이에서 웃는 것'}
GROUP={'승강기':['lurker','hollow','shooter','charger','thief','crawler','predator','edge','shade','hum'],
 '아파트':['resident','doorframe','dusty_table','dusty_chair','doorhand','wallface','floorhand','tv402'],
 '학교':['thump','mannequin','hanged','specimen_jar','specimen_frog','specimen_snake','grinner']}
def u(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
data={}
for k in M:
    d=os.path.join(E,k)
    if not os.path.exists(f'{d}/base.png'): continue
    clips={}
    for c in sorted(os.listdir(f'{d}/clips')) if os.path.isdir(f'{d}/clips') else []:
        fs=sorted(glob.glob(f'{d}/clips/{c}/[0-9][0-9].png'))
        if fs: clips[c]=[u(f) for f in fs]
    data[k]=dict(name=NAMES.get(k,k),w=M[k]['canvas'][0],h=M[k]['canvas'][1],foot=M[k]['foot'],base=u(f'{d}/base.png'),clips=clips)
jy=u(os.path.join(ROOT,'game-src/action/jyaldi-v5/full/clips/idle/00.png'))
html='''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>잡몹 도트 시연</title><style>
:root{--bg:#1A2226;--panel:#232D32;--p2:#2C383E;--tx:#e8e4da;--mu:#9aa6ab;--ac:#d9a441}
body{margin:0;background:var(--bg);color:var(--tx);font:14px/1.4 system-ui,sans-serif}
header{padding:12px 16px;background:var(--panel);position:sticky;top:0;z-index:2}
h1{margin:0 0 8px;font-size:17px}.grp{margin:4px 0}.grp b{color:var(--mu);font-weight:500;margin-right:6px}
button{background:var(--p2);color:var(--tx);border:0;border-radius:6px;padding:6px 10px;margin:2px;cursor:pointer;font:inherit}
button.on{background:var(--ac);color:#1A2226}main{padding:16px}
#stage{background:#3a4248;border-radius:8px;overflow:auto;padding:12px;display:flex;align-items:flex-end;gap:24px}
canvas{image-rendering:pixelated}#clips{margin:10px 0}#info{color:var(--mu);margin-top:6px}
#sheet{display:flex;flex-wrap:wrap;gap:4px;margin-top:12px}#sheet img{image-rendering:pixelated;background:#3a4248;border-radius:4px}
</style></head><body><header><h1>잡몹 도트 시연</h1><div id="groups"></div></header><main>
<div id="stage"><canvas id="jy"></canvas><canvas id="cv"></canvas></div><div id="clips"></div><div id="info"></div><div id="sheet"></div></main>
<script>
const D=__DATA__,G=__GROUP__,JY="__JY__";const SC=Math.min(4,Math.max(2,Math.floor((innerWidth-80)/450)));
let cur=null,clip=null,frames=[],fi=0,imgs={};
function img(s){if(!imgs[s]){const i=new Image();i.src=s;imgs[s]=i}return imgs[s]}
const gd=document.getElementById('groups');
for(const g in G){const r=document.createElement('div');r.className='grp';r.innerHTML='<b>'+g+'</b>';
 for(const k of G[g]){if(!D[k])continue;const b=document.createElement('button');b.textContent=D[k].name;b.onclick=()=>pick(k,b);b.dataset.k=k;r.appendChild(b)}gd.appendChild(r)}
const jy=document.getElementById('jy');jy.width=192*SC;jy.height=144*SC;const jx=jy.getContext('2d');jx.imageSmoothingEnabled=false;
img(JY).onload=()=>{jx.drawImage(img(JY),0,0,192*SC,144*SC)};
function pick(k,b){cur=D[k];document.querySelectorAll('#groups button').forEach(x=>x.classList.toggle('on',x===b));
 const cd=document.getElementById('clips');cd.innerHTML='';const names=Object.keys(cur.clips);
 for(const c of names){const bb=document.createElement('button');bb.textContent=c+' ('+cur.clips[c].length+')';bb.onclick=()=>play(c,bb);cd.appendChild(bb)}
 const cv=document.getElementById('cv');cv.width=cur.w*SC;cv.height=cur.h*SC;
 if(names.length)play(names[0],cd.firstChild);else{clip=null;frames=[cur.base];sheet()}}
function play(c,b){clip=c;frames=cur.clips[c];fi=0;document.querySelectorAll('#clips button').forEach(x=>x.classList.toggle('on',x===b));sheet()}
function sheet(){const s=document.getElementById('sheet');s.innerHTML='';for(const f of frames){const i=document.createElement('img');i.src=f;i.width=cur.w*2;i.height=cur.h*2;s.appendChild(i)}
 document.getElementById('info').textContent=cur.name+' · '+(clip||'기준 그림')+' · '+frames.length+'장 · 캔버스 '+cur.w+'×'+cur.h+' · 왼쪽은 쟈알디(크기 비교)'}
setInterval(()=>{if(!cur)return;const cv=document.getElementById('cv'),x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,cv.width,cv.height);
 const i=img(frames[fi%frames.length]);if(i.complete)x.drawImage(i,0,0,cur.w*SC,cur.h*SC);x.fillStyle='rgba(220,70,70,.7)';x.fillRect(0,(cur.foot+1)*SC,cv.width,1);fi++},110);
const first=document.querySelector('#groups button');if(first)first.click();
</script></body></html>'''
html=html.replace('__DATA__',json.dumps(data,ensure_ascii=False)).replace('__GROUP__',json.dumps(GROUP,ensure_ascii=False)).replace('__JY__',jy)
out=os.path.join(ROOT,'release/demo/goei-mobs.html'); open(out,'w').write(html); print(out,round(len(html)/1e6,2),'MB',len(data),'종')
