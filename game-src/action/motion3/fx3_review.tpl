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
<div class="bar" id="bar"></div><div id="list" class="grid"></div>
<script>
const D=__D__;const SP={},FX={};
function img(s){const i=new Image();i.src=s;return i}
for(const k in D.sp)SP[k]=img('sp/'+k+'.png');
const groups={};for(const it of D.items){const g=it.kind=='common'?'공용':it.kind=='obj'?'물건':it.key;(groups[g]=groups[g]||[]).push(it)}
const bad=D.items.filter(i=>i.bad.length).length;
document.getElementById('sum').textContent=`뽑힌 것 ${D.items.length}개 · 기계 검사 걸림 ${bad}개 · 인물 그림은 1배 크기 비교용, 이펙트도 1배`;
const bar=document.getElementById('bar'),list=document.getElementById('list');let cur=null;const cv=[];
function show(g){cur=g;list.innerHTML='';cv.length=0;for(const b of bar.children)b.setAttribute('aria-pressed',b.dataset.g==g);
 for(const it of groups[g]){const c=document.createElement('div');c.className='card';
  c.innerHTML=`<p class="t">${it.row}</p><p class="s">${it.n}</p>`+(it.bad.length?`<p class="b">기계 검사: ${it.bad.join(', ')}</p>`:'');
  const k=document.createElement('canvas');k.width=640;k.height=360;c.appendChild(k);list.appendChild(c);
  if(!FX[it.n])FX[it.n]=img('fx/'+it.n+'.png');cv.push({k,it,x:k.getContext('2d')})}}
for(const g of Object.keys(groups)){const b=document.createElement('button');b.textContent=g+' '+groups[g].length;b.dataset.g=g;b.onclick=()=>show(g);bar.appendChild(b)}
show(Object.keys(groups)[0]);
const t0=performance.now();
const GY=340,FX0=110;
function loop(t){for(const o of cv){const {k,it,x}=o;x.clearRect(0,0,k.width,k.height);x.imageSmoothingEnabled=false;
  x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,GY,k.width,1);
  const s=SP[it.key],w=D.sp[it.key];if(it.kind!='obj'&&s&&s.complete){x.globalAlpha=it.kind=='common'?.35:1;x.drawImage(s,FX0-w[0]/2,GY-w[1]);x.globalAlpha=1}
  const n=it.fr.length,i=Math.floor((t-t0)/it.dur)%(n+6);const im=FX[it.n];if(!(i<n&&im.complete))continue;const r=it.fr[i];
  let ox,oy;const b=it.box||[0,0,r.w,r.h],bw=b[2]-b[0],bh=b[3]-b[1];
  if(it.kind=='obj'){ox=320-(b[0]+bw/2);oy=180-(b[1]+bh/2)}
  else if(it.feet){ox=FX0-it.ax;oy=GY-it.ay}
  else{const cx=it.kind=='common'?320:Math.min(640-bw/2,FX0+w[0]/2+bw/2);ox=cx-(b[0]+bw/2);oy=it.mode=='center'?GY-w[1]*0.55-(b[1]+bh/2):GY-b[3]}
  x.drawImage(im,r.x,r.y,r.w,r.h,ox,oy,r.w,r.h)}
 requestAnimationFrame(loop)}
requestAnimationFrame(loop);
</script>
