"""Make one self-contained review page per character; no generation calls."""
import base64,io,json,zipfile
from pathlib import Path
from field_character_production import OUT,TEMPLATES

PAGE='''<!doctype html><html lang="ko"><meta charset="utf-8"><title>캐릭터 개별 검수</title>
<style>body{background:#20252b;color:#eee;font:16px sans-serif;margin:24px}button,select,input{font:inherit;margin:4px;padding:6px}canvas{image-rendering:pixelated;background:#9baea6}#stage{overflow:auto;max-height:75vh}p{max-width:900px}.bad{color:#ffb2ad}</style>
<h1 id="name"></h1><p>현재 제작본의 개별 검수 화면입니다. 사용자 최종 승인이나 게임 반영을 뜻하지 않습니다. 원본 픽셀을 정수 배율로 표시합니다.</p>
<label>방향·동작 <select id="clip"></select></label><label>확대 <select id="zoom"><option>1</option><option selected>2</option><option>3</option></select></label>
<button id="play">일시정지</button><button id="prev">이전 장</button><button id="next">다음 장</button>
<label>FPS <input id="fps" type="number" min="1" max="30" value="8"></label>
<label>외곽 확인 배경 <select id="bg"><option value="#9baea6">회녹색</option><option value="#ffffff">흰색</option><option value="#000000">검은색</option><option value="#b0589b">자주색</option></select></label>
<p id="status"></p><div id="stage"><canvas id="canvas"></canvas></div><p id="frame"></p>
<script>const data=__DATA__;const by=id=>document.getElementById(id);const canvas=by('canvas'),ctx=canvas.getContext('2d');let images=[],index=0,playing=true,last=0,version=0;
by('name').textContent=data.name;for(const [i,c]of data.clips.entries()){const o=document.createElement('option');o.value=i;o.textContent=c.name;by('clip').append(o)}
function draw(){const im=images[index];if(!im||!im.complete||!im.naturalWidth)return;canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;const z=Number(by('zoom').value);canvas.style.width=canvas.width*z+'px';canvas.style.height=canvas.height*z+'px';ctx.imageSmoothingEnabled=false;ctx.drawImage(im,0,0);by('frame').textContent=`${index+1} / ${images.length}장 · 원본 ${canvas.width}×${canvas.height}`}
function select(){const v=++version;const c=data.clips[Number(by('clip').value)];index=0;images=c.frames.map(src=>{const im=new Image();im.onload=()=>{if(v===version)draw()};im.src=src;return im});by('status').textContent=c.status;by('status').className=/반려/.test(c.status)?'bad':'';draw()}
function step(d){playing=false;by('play').textContent='재생';index=(index+d+images.length)%images.length;draw()}
by('clip').onchange=select;by('zoom').onchange=draw;by('prev').onclick=()=>step(-1);by('next').onclick=()=>step(1);by('bg').onchange=()=>canvas.style.background=by('bg').value;by('play').onclick=()=>{playing=!playing;by('play').textContent=playing?'일시정지':'재생'};
function animate(t){if(t-last>=1000/Math.max(1,Math.min(30,Number(by('fps').value)||8))){if(playing&&images.length)index=(index+1)%images.length;draw();last=t}requestAnimationFrame(animate)}select();requestAnimationFrame(animate);</script></html>'''

def uri(data):return 'data:image/png;base64,'+base64.b64encode(data).decode()
def main():
 s=json.loads((OUT/'state.json').read_text());count=0
 for slug,c in s['characters'].items():
  folder=OUT/slug;clips=[]
  if (folder/'reference.png').exists():clips.append({'name':'정면 기준','status':'정면 검수 통과' if c.get('image_visually_reviewed') else '기존 유지본 또는 정면 검수 대기','frames':[uri((folder/'reference.png').read_bytes())]})
  if (folder/'character.zip').exists():
   with zipfile.ZipFile(folder/'character.zip') as z:
    for name in z.namelist():
     if name.startswith('Idle/rotations/') and name.endswith('.png'):clips.append({'name':Path(name).stem,'status':'8방향 검수 통과' if c.get('eight_way_visual_reviewed') else '8방향 검수 대기','frames':[uri(z.read(name))]})
  for directory in sorted((folder/'motions').glob('*')):
   if not directory.is_dir():continue
   files=sorted(directory.glob('*.png'),key=lambda f:int(f.stem))
   if not files:continue
   review=json.loads((directory/'visual-review.json').read_text()) if (directory/'visual-review.json').exists() else {}
   result=review.get('result');status='프레임 검수 통과' if result=='pass' else ('반려 · 재작업 대상' if result and result!='pass' else '프레임 검수 대기')
   label=dict(TEMPLATES).get(directory.name,directory.name)
   clips.append({'name':label+' · '+str(len(files))+'장','status':status+' · '+review.get('findings',''),'frames':[uri(f.read_bytes())for f in files]})
  if not clips:continue
  data=json.dumps({'name':c['name'],'clips':clips},ensure_ascii=False).replace('<','\\u003c')
  (folder/'review.html').write_text(PAGE.replace('__DATA__',data));count+=1
 print('Standalone character reviews:',count)

if __name__=='__main__':main()
