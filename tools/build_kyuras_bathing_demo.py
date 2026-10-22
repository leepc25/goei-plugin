"""Build a standalone viewer from the 20 delivered Kyuras PNG frames."""
from pathlib import Path
import base64
import json

ROOT = Path(__file__).resolve().parents[1]
CLIPS = [('undress', '탈의', 7, 7), ('showerturn', '돌아서기', 3, 10),
         ('shower', '샤워', 6, 10), ('bath', '목욕', 4, 4)]
data = []
for key, label, count, fps in CLIPS:
    frames = []
    for i in range(count):
        path = ROOT / f'game-src/action/kyuras/clips/{key}/{i:02}.png'
        frames.append('data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode())
    data.append(dict(key=key, label=label, fps=fps, frames=frames))

template = r'''<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>큐라스 · 탈의 / 샤워 / 목욕</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#171c22;color:#e9e6de;font:15px system-ui,sans-serif}
main{max-width:1024px;margin:auto;padding:24px}h1{font-size:24px;margin:0 0 8px}p{color:#b8bdc4;line-height:1.6}
nav,.controls{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}button,select,input{font:inherit}
button,select{border:1px solid #65717c;background:#2a333e;color:inherit;padding:10px 16px;border-radius:6px;cursor:pointer}
button[aria-pressed=true]{background:#b8c5a6;color:#192119;border-color:#d0debf}button:focus-visible{outline:3px solid #dce9ca}
canvas{display:block;width:100%;height:auto;image-rendering:pixelated;border:1px solid #54616e;background:#343d49}
.controls{align-items:center}.controls label{display:flex;align-items:center;gap:8px}.frames{display:flex;gap:8px;overflow:auto;padding-bottom:10px}
.frames button{min-width:124px;padding:5px;font-size:12px}.frames img{display:block;width:115px;image-rendering:pixelated;background:#444e5b}
output{font-variant-numeric:tabular-nums;color:#c9d7b7}footer{border-top:1px solid #3d4853;margin-top:24px;padding-top:16px;color:#9da7b1;font-size:13px}
@media(max-width:600px){main{padding:14px}h1{font-size:20px}button{padding:9px 12px}}
</style>
<main><h1>큐라스 · 생활 동작 20장</h1><p>탈의 7장 · 돌아서기 3장 · 샤워 6장 · 목욕 4장. 이번에 제작한 PNG를 직접 재생합니다.</p>
<nav id="clips" aria-label="동작 선택"></nav><canvas id="stage" width="768" height="432" aria-label="큐라스 동작 시연"></canvas>
<div class="controls"><button id="play">일시정지</button><button id="step">한 장 넘기기</button><button id="sequence">전체 순서</button>
<label>배율 <select id="scale"><option value="1">1×</option><option value="2">2×</option><option value="3" selected>3×</option></select></label>
<label>속도 <input id="speed" type="range" min="0.25" max="2" step="0.25" value="1"><span id="speedText">1×</span></label>
<label><input type="checkbox" id="guide" checked>발 위치선</label><output id="status"></output></div>
<div class="frames" id="frames" aria-label="프레임 선택"></div>
<p>키보드: 1–4 동작 선택 · Space 재생/정지 · ← → 위치 이동. 아래 장을 누르면 멈춰서 확인할 수 있습니다.</p>
<footer>192×144 투명 PNG · 기준 그림 A.png 참조 · 그림 생성: 내장 ImageGen. 확인용 동작 시연이며 게임 본체의 행동 연결은 포함하지 않습니다.</footer></main>
<script>
const clips=__DATA__;
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
let selected=0,frame=0,playing=true,sequence=false,last=0,elapsed=0,offset=0,keys=new Set();
const images=clips.map(c=>c.frames.map(src=>{const im=new Image();im.src=src;return im}));
function choose(i){selected=i;frame=0;elapsed=0;refresh()}
function refresh(){
 $('clips').replaceChildren(...clips.map((c,i)=>{const b=document.createElement('button');b.textContent=`${i+1} · ${c.label} (${c.frames.length})`;b.setAttribute('aria-pressed',i===selected);b.onclick=()=>{sequence=false;choose(i)};return b}));
 $('frames').replaceChildren(...clips[selected].frames.map((src,i)=>{const b=document.createElement('button');const im=new Image();im.src=src;b.append(im,`${clips[selected].key}/${String(i).padStart(2,'0')}.png`);b.onclick=()=>{frame=i;playing=false;$('play').textContent='재생'};return b}));
}
function advance(){frame++;if(frame>=clips[selected].frames.length){if(sequence&&selected<3){choose(selected+1);return}frame=0}}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'일시정지':'재생'};
$('step').onclick=()=>{playing=false;$('play').textContent='재생';advance()};
$('sequence').onclick=()=>{sequence=true;playing=true;$('play').textContent='일시정지';choose(0)};
$('speed').oninput=()=>{$('speedText').textContent=$('speed').value+'×'};
addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName))return;if(['ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.repeat)return;if(e.key===' ')$('play').click();if('1234'.includes(e.key)&&e.key.length===1){sequence=false;choose(Number(e.key)-1)}});
addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>keys.clear());
function tick(now){const dt=Math.min(100,now-last||0);last=now;const speed=Number($('speed').value),scale=Number($('scale').value);
 if(playing){elapsed+=dt*speed;const step=1000/clips[selected].fps;while(elapsed>=step){elapsed-=step;advance()}}
 offset=Math.max(-200,Math.min(240,offset+(keys.has('ArrowRight')-keys.has('ArrowLeft'))*dt*.12));
 ctx.clearRect(0,0,768,432);ctx.imageSmoothingEnabled=false;
 if($('guide').checked){ctx.strokeStyle='#789077';ctx.beginPath();ctx.moveTo(0,407);ctx.lineTo(768,407);ctx.stroke()}
 const im=images[selected][frame];if(im.complete&&im.naturalWidth)ctx.drawImage(im,Math.round(315-57*scale+offset),407-136*scale,192*scale,144*scale);
 $('status').textContent=`${clips[selected].key} · ${frame+1}/${clips[selected].frames.length}`;
 requestAnimationFrame(tick)
}refresh();requestAnimationFrame(tick);
</script></html>'''
out = ROOT / 'release/demo/kyuras-bathing.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(template.replace('__DATA__', json.dumps(data, ensure_ascii=False)), encoding='utf-8')
print(f'{out.relative_to(ROOT)}: {out.stat().st_size:,} bytes, 20 embedded frames')
