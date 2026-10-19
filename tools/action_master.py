"""기준 원화의 동일 비율 런타임 샘플과 비교 HTML 생성. 체형 변형은 하지 않는다."""
from pathlib import Path
from PIL import Image
import base64,json
ROOT=Path(__file__).resolve().parents[1]
def build():
    source=ROOT/'game-src/action/jyaldi-master.png'
    image=Image.open(source).convert('RGBA')
    bounds=image.getchannel('A').point(lambda a:255 if a>40 else 0).getbbox()
    if not bounds:raise ValueError('Empty master')
    cropped=image.crop(bounds)
    ratio=160/cropped.height
    small=cropped.resize((round(cropped.width*ratio),160),Image.Resampling.NEAREST)
    out=ROOT/'game-pack/action';out.mkdir(exist_ok=True,parents=True)
    small.quantize(colors=128,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(out/'jyaldi-master.png',optimize=True)
    manifest={'sourceSize':list(image.size),'trim':list(bounds),'trimmedSize':list(cropped.size),'runtimeSize':list(small.size),'uniformScale':ratio,'geometryChanged':False}
    (out/'master.json').write_text(json.dumps(manifest,separators=(',',':')))
    # 비교 페이지에만 원본을 포함한다. 게임은 160px 파일만 사용한다.
    src='data:image/png;base64,'+base64.b64encode(source.read_bytes()).decode()
    runtime='data:image/png;base64,'+base64.b64encode((out/'jyaldi-master.png').read_bytes()).decode()
    bg='data:image/png;base64,'+base64.b64encode((out/'bg-bureau-action.png').read_bytes()).decode()
    html='''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쟈알디 원화·구현 비율 비교</title><style>
body{margin:0;padding:20px;background:#0a131c;color:#e6dcc6;font:14px monospace}h1{font-size:20px}section{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;padding:16px;background:#14212c;border:1px solid #58707a}figcaption{margin-bottom:15px}.figure{height:340px;display:flex;align-items:flex-end;justify-content:center;min-width:170px;background:repeating-linear-gradient(0deg,transparent 0 19px,#53687533 19px 20px);border-bottom:2px solid #cfa46d}img{image-rendering:pixelated;object-fit:contain}#scene{max-width:100%;height:auto;image-rendering:pixelated;background:#071019}p{line-height:1.8;max-width:1000px}</style><h1>원화와 실제 160px의 비율 비교</h1><p>같은 기준 이미지에서 가로·세로에 동일 배율만 적용했습니다. 몸통·다리 길이를 코드에서 변형하지 않습니다. 동작 시트는 체형 확정 후 이 기준을 따릅니다.</p><section><figure><figcaption>원화: 320px 비율 표시</figcaption><div class="figure"><img id="source" style="height:320px"></div></figure><figure><figcaption>게임 실제 크기: 160px</figcaption><div class="figure"><img id="runtime" style="height:160px"></div></figure><figure><figcaption>게임 도트: 정확히 2배</figcaption><div class="figure"><img id="double" style="height:320px"></div></figure></section><h2>같은 원본을 배경 위에 표시</h2><p>배경 640×360 → 2배, 인물 160px. 아래 장면은 비율·소품 크기·접지 확인용이며 애니메이션 완료본이 아닙니다.</p><canvas id="scene" width="1280" height="720"></canvas><p id="sizes"></p><script>
const src=SOURCE,runtime=RUNTIME,bg=BACKGROUND;
const master=new Image(),actor=new Image(),back=new Image();
Promise.all([new Promise(r=>{master.onload=r;master.src=src}),new Promise(r=>{actor.onload=r;actor.src=runtime}),new Promise(r=>{back.onload=r;back.src=bg})]).then(()=>{
 const box=TRIM;const crop=document.createElement('canvas');crop.width=box[2]-box[0];crop.height=box[3]-box[1];crop.getContext('2d').drawImage(master,-box[0],-box[1]);document.getElementById('source').src=crop.toDataURL();document.getElementById('runtime').src=runtime;document.getElementById('double').src=runtime;
 const c=document.getElementById('scene').getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(back,0,0,1280,720);c.fillStyle='#0008';c.fillRect(620,528,40,4);c.drawImage(actor,640-actor.width/2,530-160,actor.width,160);
 document.getElementById('sizes').textContent='기준 원본 '+crop.width+'×'+crop.height+' → 실제 '+actor.width+'×160 · 가로/세로 동일 배율';
});</script></html>'''.replace('SOURCE',json.dumps(src)).replace('RUNTIME',json.dumps(runtime)).replace('BACKGROUND',json.dumps(bg)).replace('TRIM',json.dumps(bounds))
    (ROOT/'dist').mkdir(exist_ok=True)
    (ROOT/'dist/goei-jyaldi-proportions.html').write_text(html)
    print(manifest,'runtime bytes', (out/'jyaldi-master.png').stat().st_size)
if __name__=='__main__':build()
