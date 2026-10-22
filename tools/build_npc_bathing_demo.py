#!/usr/bin/env python3
"""Pack delivered NPC bathing frames into an offline, explicit-gap review demo."""
import base64
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'game-src/action/npc/clips'
ACTORS = [('jaemtri', '잼트리'), ('gognija', '고그니쟈'), ('dejure', '데쥬레')]
CLIPS = [('undress', '탈의', 7, 5), ('showerturn', '돌아서기', 3, 4), ('shower', '머리 감기', 6, 6), ('bath', '앉아 쉬기', 4, 3)]
data, audit, missing = [], [], []
for actor, name in ACTORS:
    item = dict(id=actor, name=name, clips=[])
    for clip, label, count, fps in CLIPS:
        frames = []
        for n in range(count):
            p = SRC / actor / clip / f'{n:02}.png'
            relative = str(p.relative_to(ROOT))
            if not p.exists():
                frames.append(None)
                missing.append(relative)
                continue
            raw = p.read_bytes()
            im = Image.open(p).convert('RGBA')
            px = im.load()
            pixels = list(im.get_flattened_data())
            colors = len({v[:3] for v in pixels if v[3]})
            box = im.getbbox()
            edge = []
            for y in range(144):
                for x in range(192):
                    if px[x, y][3] and any(not (0 <= x+dx < 192 and 0 <= y+dy < 144) or not px[x+dx, y+dy][3] for dx, dy in [(0,1),(0,-1),(1,0),(-1,0)]):
                        edge.append(px[x, y][:3])
            assert im.size == (192,144), relative
            assert {v[3] for v in pixels} == {0,255}, relative
            assert box[3] == 136 and 50 <= colors <= 90, relative
            assert edge and set(edge) == {(13,18,19)}, relative
            audit.append(dict(path=relative, bbox=box, opaque_colors=colors, sole_y=135,
                              outline='#0D1213', sha256=hashlib.sha256(raw).hexdigest()))
            frames.append('data:image/png;base64,' + base64.b64encode(raw).decode())
        item['clips'].append(dict(key=clip, label=label, expected=count, fps=fps, frames=frames))
    data.append(item)

manifest = dict(version=1, requested=60, delivered=len(audit), missing=missing, frames=audit,
                generator='built-in ImageGen', pixel_lab_calls=0,
                status='partial; image-generation safety blocks remain',
                notes=[
                    'Jaemtri undress/05: output moderation blocked; oversized earlier draft excluded.',
                    'Dejure towel edit rejected at input moderation; 16 remaining towel frames not generated.',
                    'Dejure reference PNG is 87px high; request table says approximately 80px. Reference proportions retained.',
                    'Technical canvas/alpha/palette/sole/outline checks do not constitute final identity/anatomy approval.',
                    'Side-to-turn frame00 reuses the same newly generated undress/06 boundary pose.'
                ])
(ROOT / 'game-src/action/npc/bathing-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')

html = r'''<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>본부 NPC · 생활 클립 시연</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#171c22;color:#eeeae2;font:15px system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:24px}h1{font-size:25px;margin:0 0 10px}p{line-height:1.6;color:#bdc7d0}.notice{padding:13px 16px;background:#3b3130;border:1px solid #8a6c61;border-radius:8px;color:#f0d8cc}nav,.controls{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0;align-items:center}button,select,input{font:inherit}button,select{background:#293540;color:inherit;border:1px solid #687a88;border-radius:6px;padding:9px 13px;cursor:pointer}button[aria-pressed=true]{background:#c3d2b7;color:#1c291d;border-color:#d5e1cc}button:focus-visible{outline:3px solid #d0dfc7}label{display:flex;gap:7px;align-items:center}canvas{width:100%;height:auto;display:block;background:#35404b;border:1px solid #667988;image-rendering:pixelated}.frames{display:flex;gap:8px;overflow:auto;padding-bottom:10px}.frames button{min-width:122px;padding:4px;font-size:12px}.frames img{display:block;width:115px;image-rendering:pixelated}.missing{display:grid;place-items:center;height:86px;color:#f0c9b6;background:#463c3c}.frames [aria-current=true]{outline:2px solid #d6e4c9}output{font-variant-numeric:tabular-nums;color:#d3e4c5}footer{border-top:1px solid #44515d;padding-top:15px;margin-top:22px;color:#aab5bd;font-size:13px}details{color:#bdc7d0;margin-top:15px}code{font-size:12px}@media(max-width:600px){main{padding:14px}h1{font-size:21px}button{padding:8px 10px}}
</style>
<main><h1>본부 NPC · 생활 클립 시연</h1>
<p>이번 작업에서 반영한 43장의 PNG를 직접 재생합니다. 장면 선택 · 일시정지 · 한 장씩 확인 · 전체 순서 재생을 지원합니다.</p>
<div class="notice">43 / 60장 반영 · 잼트리 탈의 05와 데쥬레 수건 장면 16장은 생성 검사 차단으로 미완료입니다. 빈 장은 대체 그림 없이 표시합니다.</div>
<nav id="actors" aria-label="인물 선택"></nav><nav id="clips" aria-label="동작 선택"></nav>
<canvas id="stage" width="768" height="432" aria-label="NPC 클립 시연"></canvas>
<div class="controls"><button id="play">일시정지</button><button id="step">한 장 넘기기</button><button id="sequence">전체 순서</button>
<label>배율 <select id="scale"><option value="1">1×</option><option value="2">2×</option><option value="3" selected>3×</option></select></label>
<label>속도 <input id="speed" type="range" min="0.25" max="2" step="0.25" value="1"><span id="speedText">1×</span></label>
<label><input id="guide" type="checkbox" checked>기준선</label><output id="status"></output></div>
<div class="frames" id="frames" aria-label="프레임 선택"></div>
<p>키보드: J / K 인물 선택 · 1–4 동작 선택 · Space 재생/정지 · ← → 프레임 이동.</p>
<details><summary>납품 및 검수 범위</summary><p>잼트리 19장 · 고그니쟈 20장 · 데쥬레 4장. 캔버스 192×144, 이진 투명도, 색 수 50–90, 발바닥 y=135, 외곽선 #0D1213 검사를 통과한 파일을 포함합니다. 동일 인물·체격·팔꿈치 방향의 최종 시각 검수는 별도입니다.</p></details>
<footer>이번 PNG를 내장한 오프라인 클립 시연판입니다. 생성: 내장 ImageGen · PixelLab 사용 0회. 게임 본체에 연결하는 작업은 포함하지 않습니다.</footer></main>
<script>
const actors=__DATA__;
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d');
let actor=0,selected=0,frame=0,playing=true,sequence=false,last=0,elapsed=0;
const images=actors.map(a=>a.clips.map(c=>c.frames.map(src=>{if(!src)return null;const im=new Image();im.src=src;return im})));
function current(){return actors[actor].clips[selected]}
function choose(i){selected=i;frame=0;elapsed=0;refresh()}
function chooseActor(i){actor=(i+actors.length)%actors.length;selected=0;frame=0;elapsed=0;sequence=false;refresh()}
function refresh(){
 $('actors').replaceChildren(...actors.map((a,i)=>{const b=document.createElement('button');b.textContent=a.name+' · '+a.clips.reduce((n,c)=>n+c.frames.filter(Boolean).length,0)+'/20';b.setAttribute('aria-pressed',i===actor);b.onclick=()=>chooseActor(i);return b}));
 $('clips').replaceChildren(...actors[actor].clips.map((c,i)=>{const b=document.createElement('button');b.textContent=`${i+1} · ${c.label} (${c.frames.filter(Boolean).length}/${c.expected})`;b.setAttribute('aria-pressed',i===selected);b.onclick=()=>{sequence=false;choose(i)};return b}));
 $('frames').replaceChildren(...current().frames.map((src,i)=>{const b=document.createElement('button');if(src){const im=new Image();im.src=src;b.append(im)}else{const m=document.createElement('span');m.className='missing';m.textContent='미생성';b.append(m)}b.append(`${current().key}/${String(i).padStart(2,'0')}.png`);b.onclick=()=>{frame=i;playing=false;$('play').textContent='재생'};return b}));
}
function advance(direction=1){frame+=direction;if(frame>=current().expected){if(sequence&&selected<3){choose(selected+1);return}frame=0}else if(frame<0)frame=current().expected-1}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'일시정지':'재생'};
$('step').onclick=()=>{playing=false;$('play').textContent='재생';advance()};
$('sequence').onclick=()=>{sequence=true;playing=true;$('play').textContent='일시정지';choose(0)};
$('speed').oninput=()=>{$('speedText').textContent=$('speed').value+'×'};
addEventListener('keydown',e=>{if(/INPUT|SELECT/.test(e.target.tagName)||e.repeat)return;if(['ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key===' ')$('play').click();if(e.key==='ArrowLeft'||e.key==='ArrowRight'){playing=false;$('play').textContent='재생';advance(e.key==='ArrowLeft'?-1:1)}if('1234'.includes(e.key)&&e.key.length===1){sequence=false;choose(Number(e.key)-1)}if(e.key.toLowerCase()==='j')chooseActor(actor-1);if(e.key.toLowerCase()==='k')chooseActor(actor+1)});
function tick(now){const dt=Math.min(100,now-last||0);last=now;if(playing){elapsed+=dt*Number($('speed').value);const step=1000/current().fps;while(elapsed>=step){elapsed-=step;advance()}}
 ctx.clearRect(0,0,768,432);ctx.imageSmoothingEnabled=false;const scale=Number($('scale').value),x=210-57*scale,y=410-135*scale;
 if($('guide').checked){ctx.strokeStyle='#849b9980';ctx.lineWidth=1;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(0,410.5);ctx.lineTo(768,410.5);ctx.moveTo(210.5,0);ctx.lineTo(210.5,432);ctx.stroke();ctx.setLineDash([])}
 const im=images[actor][selected][frame];if(im&&im.complete&&im.naturalWidth){ctx.drawImage(im,x,y,192*scale,144*scale)}else if(!im){ctx.fillStyle='#ecd4c7';ctx.font='22px system-ui';ctx.fillText('미생성 · '+current().key+'/'+String(frame).padStart(2,'0'),50,190);ctx.font='15px system-ui';ctx.fillText('이 프레임은 납품되지 않았습니다.',50,222)}
 ctx.fillStyle='#d6e1e5';ctx.font='16px system-ui';ctx.fillText(actors[actor].name+' / '+current().label,470,52);
 ctx.font='13px system-ui';ctx.fillText('192 × 144 · '+scale+'×',470,77);ctx.fillText(im?'반영된 PNG':'누락 프레임',470,101);
 $('status').textContent=`${String(frame).padStart(2,'0')} / ${String(current().expected-1).padStart(2,'0')} · ${current().frames.filter(Boolean).length}/${current().expected}장`;
 [...$('frames').children].forEach((b,i)=>b.setAttribute('aria-current',i===frame));requestAnimationFrame(tick)}
refresh();requestAnimationFrame(tick);
</script></html>'''
out = ROOT / 'release/demo/npc-bathing.html'
out.write_text(html.replace('__DATA__', json.dumps(data, ensure_ascii=False)))
print(json.dumps(dict(delivered=len(audit), missing=len(missing), colors=[min(a['opaque_colors'] for a in audit),max(a['opaque_colors'] for a in audit)], html_bytes=out.stat().st_size)))
