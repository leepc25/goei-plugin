#!/usr/bin/env python3
"""Build a native-pixel, embedded review and actual API-usage ledger; no generation calls."""
import base64,json,html
from urllib.parse import quote
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'game-src/art/field/production'
s=json.loads((p/'state.json').read_text());manifest=json.loads((p/'manifest.json').read_text())

rows=[]
def uri(f):return 'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode()
for a in manifest:
 folder=p/a['slug'];ref=folder/'reference.png'
 if not ref.exists():continue
 im=Image.open(ref).convert('RGBA');box=im.getbbox()
 clips=[]
 for receipt in sorted((folder/'motions').glob('*/receipt.json')):
  files=sorted(receipt.parent.glob('*.png'),key=lambda f:int(f.stem))
  clips.append({'name':receipt.parent.name,'frames':[uri(f)for f in files],'receipt':json.loads(receipt.read_text())})
 rows.append({'slug':a['slug'],'name':a['name'],'appearance':a['appearance'],'image':uri(ref),'bottom':box[3],'height':box[3]-box[1],'scale':1,'source':'https://raw.githubusercontent.com/leepc25/goei-plugin/main/'+quote(a['original_art']),'visual':s['characters'][a['slug']].get('image_visually_reviewed',False),'target':a.get('stature_rendering',{}).get('target_body_pixels'),'clips':clips})
data=json.dumps(rows,ensure_ascii=False).replace('<','\\u003c')
page='''<!doctype html><meta charset="utf-8"><title>캐릭터 제작 검수</title><style>body{background:#24272c;color:#eee;font:15px sans-serif;margin:24px}button,select{font:inherit;padding:6px}#lineup{display:flex;align-items:flex-end;overflow:auto;background:#888;padding:10px}figure{margin:0 6px;text-align:center;flex:none}.stage{width:128px;height:256px;position:relative}.stage img{position:absolute;left:0;image-rendering:pixelated;width:128px;height:256px}canvas{image-rendering:pixelated;background:#888}article{display:inline-block;margin:12px;vertical-align:top}p{max-width:1000px}small{display:block}</style><h1>캐릭터 비교·동작 검수</h1><p>기술 완료는 시각 승인과 다릅니다. 동일 정수 확대율·동일 바닥선으로 키와 체형을 비교합니다. 캐릭터별 크기 보정은 적용하지 않습니다. 머리 포함 영역 높이와 해부학적 키 목표는 구별합니다. 현재 파일을 보여 주며 게임에 적용된 결과가 아닙니다. 재생 FPS는 검수용 선택값이며 게임 타이밍 확정값이 아닙니다.</p><label>확대 <select id="zoom"><option>1</option><option selected>2</option><option>3</option></select></label> <button id="play">일시정지</button> <label>검수 FPS <input id="fps" type="number" min="1" max="30" value="8"></label><div id="lineup"></div><div id="motions"></div><script>const rows=__DATA__;let playing=true;const clips=[];function build(){lineup.innerHTML='';const z=Number(zoom.value);for(const r of rows){const f=document.createElement('figure');const rz=z*r.scale;f.innerHTML=`<div class="stage" style="width:${128*rz}px;height:${280*z}px"><img style="width:${128*rz}px;height:${256*rz}px;top:${270*z-r.bottom*rz}px" src="${r.image}"></div><figcaption>${r.name} · 머리 포함 ${r.height}px<small>본체 목표 ${r.target?r.target.join("–"):"미지정"}px · 정면 검수 ${r.visual?"통과":"미완료/기존본"}</small><a href="${r.source}" target="_blank">원작 AVIF</a><small><a href="${r.slug}/review.html">8방향·프레임 개별 검수</a></small></figcaption>`;lineup.append(f)}for(const c of clips){c.canvas.style.width=c.canvas.width*z+'px';c.canvas.style.height=c.canvas.height*z+'px'}}for(const r of rows)for(const c of r.clips){if(!c.frames.length)continue;const a=document.createElement('article');const title=document.createElement('p');title.textContent=r.name+' / '+c.name+' · '+c.frames.length+'장 · 미승인';a.append(title);const canvas=document.createElement('canvas');a.append(canvas);motions.append(a);const images=c.frames.map(src=>{const i=new Image();i.src=src;return i});images[0].onload=()=>{canvas.width=images[0].width;canvas.height=images[0].height;build()};clips.push({canvas,images})}zoom.onchange=build;play.onclick=()=>{playing=!playing;play.textContent=playing?'일시정지':'재생'};let tick=0,last=0;function animate(t){if(t-last>=1000/Math.max(1,Number(fps.value))){if(playing)tick++;for(const c of clips){const im=c.images[tick%c.images.length];if(im.complete){const ctx=c.canvas.getContext('2d');ctx.clearRect(0,0,c.canvas.width,c.canvas.height);ctx.drawImage(im,0,0)}}last=t}requestAnimationFrame(animate)}build();requestAnimationFrame(animate)</script>'''.replace('__DATA__',data)
(p/'review.html').write_text(page)
lines=['# API가 반환한 실제 사용량 — 견적과 구분; 과거 작업은 history/ 및 개별 spend.log 참조','job_id\tslug\tkind\ttemplate\tstatus\tactual_usage_json']
for jid,j in s['jobs'].items():lines.append('\t'.join([jid,j['slug'],j['kind'],str(j.get('template')or''),j['status'],json.dumps(j.get('usage'),ensure_ascii=False)]))
(p/'spend.log').write_text('\n'.join(lines)+'\n')
print(f'Review: {len(rows)} characters, {sum(len(r["clips"])for r in rows)} clips. Actual usage ledger refreshed.')
