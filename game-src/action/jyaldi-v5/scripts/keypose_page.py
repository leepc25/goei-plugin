# 대표 자세 검토 페이지: 클립마다 3배 반복 재생 + 장 목록 + 메모. 사용: python3 keypose_page.py
import base64,json,os
D='../keypose'; OUT='../../../../release/demo/jyaldi-v5-keypose-review.html'
N=json.load(open(f'{D}/notes.json',encoding='utf-8'))
def b(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
clips=[]
for k,v in N.items():
    fr=[b(f'{D}/{k}-{i}.png') for i in range(9) if os.path.exists(f'{D}/{k}-{i}.png')]
    clips.append({'k':k,'t':v['t'],'n':v['n'],'key':v.get('key'),'f':fr})
html='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>쟈알디 대표 자세</title><style>
:root{--bg:#1A2226;--p:#232D32;--t:#e6ecef;--m:#9fb0b8;--a:#e0a040}
body{margin:0;background:var(--bg);color:var(--t);font:15px/1.5 system-ui,sans-serif;padding:16px}
h1{font-size:19px;margin:0 0 6px}.lead{color:var(--m);margin:0 0 14px}
.c{background:var(--p);border-radius:10px;padding:12px;margin:0 0 14px}
.c h2{font-size:16px;margin:0 0 6px}.n{color:var(--m);margin:6px 0 0}
.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end}
canvas{image-rendering:pixelated;background:#2C383E;border-radius:6px;max-width:100%}
.strip{display:flex;gap:2px;overflow-x:auto;margin-top:8px}
.strip img{image-rendering:pixelated;width:80px;background:#151C1F;border-radius:4px;border:2px solid transparent}
.strip img.k{border-color:var(--a)}
.ctl{margin:0 0 12px}button{background:#2C383E;color:var(--t);border:1px solid #445;border-radius:6px;padding:6px 12px;margin-right:6px}
button.on{background:var(--a);color:#111}
</style><h1>쟈알디 대표 자세 시안</h1><p class="lead">기준표 A에서 뽑은 7가지 동작. 3배 크기 반복 재생. 노란 테두리 장 = 핵심 자세 후보.</p>
<div class="ctl">속도 <button data-f="6">느리게</button><button data-f="12" class="on">보통</button><button data-f="20">빠르게</button></div>
<div id="L"></div><script>
const C=__C__;let fps=12;const L=document.getElementById('L');const all=[];
for(const c of C){const d=document.createElement('div');d.className='c';d.innerHTML=`<h2>${c.t}</h2>`;
const cv=document.createElement('canvas');cv.width=480;cv.height=336;d.appendChild(cv);
const s=document.createElement('div');s.className='strip';c.f.forEach((u,i)=>{const im=new Image();im.src=u;if(c.key&&c.key.includes(i))im.className='k';s.appendChild(im)});d.appendChild(s);
const p=document.createElement('p');p.className='n';p.textContent=c.n;d.appendChild(p);L.appendChild(d);
const ims=c.f.map(u=>{const i=new Image();i.src=u;return i});all.push({cv,ims,i:0})}
document.querySelectorAll('button').forEach(b=>b.onclick=()=>{fps=+b.dataset.f;document.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x==b))});
let last=0;function tick(t){if(t-last>1000/fps){last=t;for(const a of all){const g=a.cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,480,336);const im=a.ims[a.i];if(im.complete)g.drawImage(im,0,0,480,336);a.i=(a.i+1)%a.ims.length}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>'''
open(OUT,'w',encoding='utf-8').write(html.replace('__C__',json.dumps(clips)))
print(OUT,os.path.getsize(OUT))
