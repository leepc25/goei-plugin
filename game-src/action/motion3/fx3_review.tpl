<title>기술 이펙트 3판</title><meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 인물별 묶음, 카드마다 인물 그림 + 이펙트 반복 재생. 한 가지 어두운 화면 */
:root{--bg:#191b20;--fg:#e7e9ee;--muted:#9aa1ac;--card:#23262d;--stage:#5f6e60;--bad:#ff8a7a;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:system-ui,sans-serif;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:18px;margin:0 0 4px}.sum{color:var(--muted);font-size:13px;margin:0 0 12px}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}.bar button{background:var(--card);color:var(--fg);border:1px solid #3a3f48;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer}.bar button[aria-pressed=true]{background:#3b4a63}
h2{font-size:15px;margin:20px 0 8px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.card{background:var(--card);border-radius:6px;padding:8px;min-width:0}.card .t{font-size:13px;margin:0 0 2px}.card .s{font-size:11px;color:var(--muted);margin:0 0 6px;word-break:break-all}.card .b{color:var(--bad);font-size:12px;margin:0 0 4px}
canvas{display:block;width:100%;height:auto;background:var(--stage);image-rendering:pixelated;border-radius:4px}
</style>
<h1>기술 이펙트 3판</h1><p class="sum" id="sum"></p>
<div class="bar" id="bar"></div><div id="list"></div>
<script>
const D=__D__;const SP={},FX={};
function img(s){const i=new Image();i.src=s;return i}
for(const k in D.sp)SP[k]=img('sp/'+k+'.png');
const groups={};for(const it of D.items){const g=it.kind=='common'?'공용':it.kind=='obj'?'물건':it.key;(groups[g]=groups[g]||[]).push(it)}
const bad=D.items.filter(i=>i.bad.length).length;
document.getElementById('sum').textContent=`뽑힌 것 ${D.items.length}개 · 기계 검사 걸림 ${bad}개 · 인물 그림(회색 바닥선 위)은 크기 비교용`;
const bar=document.getElementById('bar'),list=document.getElementById('list');let cur=null;const cv=[];
function show(g){cur=g;list.innerHTML='';cv.length=0;for(const b of bar.children)b.setAttribute('aria-pressed',b.dataset.g==g);
 for(const it of groups[g]){const c=document.createElement('div');c.className='card';
  c.innerHTML=`<p class="t">${it.row}</p><p class="s">${it.n}</p>`+(it.bad.length?`<p class="b">기계 검사: ${it.bad.join(', ')}</p>`:'');
  const f=it.fr[0];const k=document.createElement('canvas');k.width=f.w;k.height=f.h;c.appendChild(k);list.appendChild(c);
  if(!FX[it.n])FX[it.n]=img('fx/'+it.n+'.png');cv.push({k,it,x:k.getContext('2d')})}}
for(const g of Object.keys(groups)){const b=document.createElement('button');b.textContent=g+' '+groups[g].length;b.dataset.g=g;b.onclick=()=>show(g);bar.appendChild(b)}
show(Object.keys(groups)[0]);
const t0=performance.now();
function loop(t){for(const o of cv){const {k,it,x}=o;x.clearRect(0,0,k.width,k.height);x.imageSmoothingEnabled=false;
  const s=SP[it.key];if(it.kind!='obj'&&s&&s.complete){const w=D.sp[it.key];x.globalAlpha=it.kind=='common'?.35:1;x.drawImage(s,it.ax-w[0]/2,it.ay-w[1]);x.globalAlpha=1}
  const n=it.fr.length,i=Math.floor((t-t0)/it.dur)%(n+6);const im=FX[it.n];
  if(i<n&&im.complete){const r=it.fr[i];x.drawImage(im,r.x,r.y,r.w,r.h,0,0,r.w,r.h)}}
 requestAnimationFrame(loop)}
requestAnimationFrame(loop);
</script>
