"""Independent, embedded comparison viewer. No shared engine/assets are written."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,base64,io,subprocess,hashlib

ROOT=Path(__file__).resolve().parents[4]
ART=ROOT/'game-src/action/eileen'
OUT=ART/'resume/live-20261022'

def png(im):
 b=io.BytesIO();im.save(b,'PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def frames(im):return [im.crop((i*192,0,(i+1)*192,144)) for i in range(im.width//192)]
def old(clip):return Image.open(io.BytesIO(subprocess.check_output(['git','show',f'3ffba089:game-src/action/eileen/final/{clip}.png'],cwd=ROOT))).convert('RGBA')
def sheet(rows,path,scale=2):
 width=max(len(ims) for _,ims in rows)*192
 c=Image.new('RGBA',(width,164*len(rows)),(65,68,76,255));d=ImageDraw.Draw(c)
 for row,(name,ims) in enumerate(rows):
  for i,im in enumerate(ims):
   x,y=i*192,row*164;d.text((x+2,y),f'{name} {i:02d}',fill='white');c.alpha_composite(im,(x,y+20));d.line((x,y+157,x+191,y+157),fill='#6bad74')
 c.resize((c.width*scale,c.height*scale),Image.Resampling.NEAREST).save(path)

def main():
 sections=[];records=[]
 for clip in ['precise','pushkick','step','limp']:
  before=frames(old(clip));after=frames(Image.open(ART/f'final/{clip}.png').convert('RGBA'))
  sections.append(dict(key=clip,title=clip+' · 적용한 수정 / 시각 승인 대기',status='changed',rows=[dict(label='이전',frames=[png(f) for f in before]),dict(label='현재',frames=[png(f) for f in after])]))
  sheet([('before '+clip,before),('after '+clip,after)],OUT/f'{clip}-delivery-review.png',1)
  for i,(a,b) in enumerate(zip(before,after)):
   import numpy as np
   changed=int(np.any(np.array(a)!=np.array(b),axis=2).sum())
   records.append(dict(clip=clip,frame=i,changed_pixels=changed,before_bbox=a.getbbox(),after_bbox=b.getbbox(),rgba_sha256=hashlib.sha256(b.tobytes()).hexdigest(),face='preserved',body='preserved',clothing='preserved',hands='preserved; contact anchors shifted with placement',grounding='support-only reviewed offsets' if clip!='precise' else 'unchanged',loop_boundary='first/last unchanged',visual_approval='pending'))
 transition_before=frames(old('transition'));transition_after=frames(Image.open(ART/'final/transition.png').convert('RGBA'))
 sections.append(dict(key='transition',title='무장 전환 11장 · 소총 경로 직접 보정 / 시각 승인 대기',status='changed',rows=[dict(label='이전: 6장',frames=[png(f) for f in transition_before]),dict(label='현재: 11장',frames=[png(f) for f in transition_after])]))
 sheet([('old transition',transition_before),('new transition',transition_after)],OUT/'transition-delivery-review.png',1)
 sheet([('current transition v2',transition_after)],OUT/'transition-exact/sequence.png',1)
 sheet([('original rifle02-05',[Image.open(OUT/f'transition-rig/{i:02d}.png').convert('RGBA') for i in range(2,6)]),('exact rifle v2',[Image.open(OUT/f'transition-exact/{i:02d}.png').convert('RGBA') for i in range(2,6)])],OUT/'transition-exact/comparison.png',2)
 for i,im in enumerate(transition_after):
  records.append(dict(clip='transition',frame=i,face='rig source unchanged; strict profile still needs review' if i<6 else 'existing pistol source unchanged',body='rig source unchanged' if i<6 else 'existing suffix unchanged',clothing='unchanged except rifle overlay',hands='original skin pixels protected',grounding='support foot bbox reviewed',loop_boundary='one shot; reverse sequence supported; suffix unchanged',rgba_sha256=hashlib.sha256(im.tobytes()).hexdigest(),visual_approval='pending'))
 rejected=Image.open(OUT/'precise-edit/result.png').convert('RGBA')
 sections.append(dict(key='pixen-rejected',title='Pixen 후보 · 불합격: 머리 높이 8px 변화 · 실제 1회',status='rejected',rows=[dict(label='원본 precise 01',frames=[png(frames(old('precise'))[1])]),dict(label='전체 재그림 후보 (미적용)',frames=[png(rejected)])]))
 for folder,label in [('transition-bridge','끝장 보간 · 불합격: 소총 중복 · 실제 4회'),('transition-rig','뼈대 후보 · 불합격: 무기 변형·끝장 복귀 · 실제 3회'),('transition-pro','상체 보정 · 불합격: 몸 위치 변화·다리 연결 틈 · 실제 10회')]:
  files=sorted((OUT/folder).glob('[0-9][0-9].png'))
  if files:
   sections.append(dict(key=folder,title=label,status='rejected',rows=[dict(label='기존 전환',frames=[png(f) for f in frames(old('transition'))]),dict(label='신규 후보 (미적용)',frames=[png(Image.open(p).convert('RGBA')) for p in files])]))
 mask_files=sorted((OUT/'transition-mask').glob('[0-9][0-9].png'))
 if mask_files:
  sections.append(dict(key='transition-mask',title='소총 마스크 보정 · 불합격: 형태 불명확·마스크 밖 1픽셀 변경 · 실제 10회',status='rejected',rows=[dict(label='뼈대 원본 02~05',frames=[png(Image.open(OUT/f'transition-rig/{p.name}').convert('RGBA')) for p in mask_files]),dict(label='마스크 후보 02~05 (미적용)',frames=[png(Image.open(p).convert('RGBA')) for p in mask_files])]))
 data=json.dumps(sections,ensure_ascii=False)
 template='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>에일린 제작 재개 · 프레임 검수</title><style>
body{margin:0;background:#141a20;color:#e8edf1;font:15px/1.55 system-ui}main{max-width:1200px;margin:auto;padding:20px}h1{font-size:24px}p{color:#bccbd4}section{margin:24px 0;padding:16px;background:#202b34;border-radius:12px}h2{font-size:18px}button,select,input{font:inherit}button,select{padding:8px;background:#334554;color:white;border:1px solid #607c8f;border-radius:6px}.rows{display:flex;gap:16px;flex-wrap:wrap}.row{flex:1;min-width:260px}canvas{width:100%;max-width:576px;image-rendering:pixelated;background:#41444c}input[type=range]{width:100%}.rejected{border-left:4px solid #e58e75}.changed{border-left:4px solid #77c5ae}.candidate{border-left:4px solid #d3bc71}small{color:#bccbd4}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap}</style><main><h1>에일린 · 제작 재개 검수판</h1><p>정밀 사격 2장의 경계 픽셀과 지지발 10장 위치를 수정했습니다. 생성 완료와 사용자 시각 승인은 별개입니다. 반려 후보는 게임에 적용하지 않았습니다. 씻기 20장은 기존 원본 그대로 유지합니다.</p><p><a style="color:#94d5f4" href="eileen-full.html">직접 조작하는 독립 시연판 열기</a></p><div id="sections"></div></main><script>
const sections=__DATA__; const loaded=[];
for(const item of sections){const section=document.createElement('section');section.className=item.status;section.innerHTML='<h2>'+item.title+'</h2><div class="controls"><button>재생</button><label>속도 <select><option value="1">보통</option><option value="0.35">느리게</option></select></label><span></span></div><input type="range" min="0" step="1" value="0"><div class="rows"></div>';document.querySelector('#sections').append(section);const max=Math.max(...item.rows.map(r=>r.frames.length));const range=section.querySelector('input');range.max=max-1;let running=false,at=0,elapsed=0,last=0;const speed=section.querySelector('select');const rows=item.rows.map(row=>{const el=document.createElement('div');el.className='row';el.innerHTML='<b>'+row.label+'</b><canvas width="384" height="288"></canvas><small></small>';section.querySelector('.rows').append(el);const images=row.frames.map(url=>{const im=new Image();im.src=url;loaded.push(im);return im});return {el,images,ctx:el.querySelector('canvas').getContext('2d')}});section.querySelector('button').onclick=()=>{running=!running;section.querySelector('button').textContent=running?'일시정지':'재생'};range.oninput=()=>{at=+range.value;elapsed=0};function draw(t){const dt=Math.min(100,t-last);last=t;if(running){elapsed+=dt*+speed.value;if(elapsed>=125){elapsed=0;at=(at+1)%max;range.value=at}}section.querySelector('span').textContent='프레임 '+at+' / '+(max-1);for(const r of rows){const i=Math.min(at,r.images.length-1),ctx=r.ctx;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#41444c';ctx.fillRect(0,0,384,288);ctx.strokeStyle='#70b786';ctx.beginPath();ctx.moveTo(0,274);ctx.lineTo(384,274);ctx.stroke();if(r.images[i].complete)ctx.drawImage(r.images[i],0,0,384,288);r.el.querySelector('small').textContent=i+' / '+(r.images.length-1)}requestAnimationFrame(draw)}requestAnimationFrame(draw)}window.reviewReady=()=>loaded.every(i=>i.complete&&i.naturalWidth>0);
</script></html>'''
 (ROOT/'release/demo/eileen-resume-review.html').write_text(template.replace('__DATA__',data),encoding='utf-8')
 (OUT/'delivery-frame-review.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Review HTML and',len(records),'frame records written')

if __name__=='__main__':main()
