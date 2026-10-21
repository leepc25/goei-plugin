# 4차 기준표 비교 페이지: release/demo/jyaldi-v5-sheet7-review.html
import base64,io
from PIL import Image
D='../sheet7/'
C=[('pixen-a','Pixen A (1회)','옆모습 전투 자세, 외곽선 진하고 덩어리 또렷'),
   ('pixen-b','Pixen B (1회)','청색 테두리광, 머리카락 하이라이트'),
   ('pixen-c','Pixen C (1회)','머리카락 흩날림, 날렵한 인상'),
   ('pixen-d','Pixen D (1회)','상반신 위주로 잘림, 탈락'),
   ('flux-a','PixFlux A (1회)','정면 차렷, 갈색 벨트'),
   ('flux-b','PixFlux B (1회)','권총 든 정면'),
   ('flux-c','PixFlux C (1회)','66px로 작음'),
   ('flux-d','PixFlux D (1회)','정면 차렷')]
def b64(im):
    b=io.BytesIO(); im.save(b,'PNG',optimize=True); return base64.b64encode(b.getvalue()).decode()
def face(im):
    a=im.getchannel('A'); top=a.getbbox()[1]
    xs=[x for y in range(top,top+16) for x in range(im.width) if a.getpixel((x,y))>0]
    cx=max(xs)-12
    c=im.crop((cx-12,top,cx+16,top+28)); bg=Image.new('RGBA',c.size,(90,100,112,255)); bg.alpha_composite(c)
    return bg.resize((224,224),Image.NEAREST)
cards=''; faces=''
for k,t,n in C:
    im=Image.open(D+f'cand-{k}.png').convert('RGBA'); im=im.crop(im.getbbox())
    cards+=f'<div class="c"><b>{t} · {im.height}px</b><div class="p"><img style="width:{im.width*3}px;height:{im.height*3}px" src="data:image/png;base64,{b64(im)}"></div><p>{n}</p></div>'
    faces+=f'<figure class="f"><img src="data:image/png;base64,{b64(face(im))}"><figcaption>{t.split(" (")[0]}</figcaption></figure>'
html=f'''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>쟈알디 기준표 4차</title>
<style>body{{margin:0;background:#11161b;color:#e8e6e0;font:14px/1.5 system-ui}}.w{{max-width:1320px;margin:0 auto;padding:12px 16px 40px}}h1{{font-size:18px}}h2{{font-size:15px;margin:18px 0 8px}}
.g{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}.c{{background:#1b2228;border-radius:8px;padding:8px}}.c b{{display:block;font-size:13px;margin-bottom:6px}}.c p{{margin:6px 0 0;font-size:13px;color:#b8bcc0}}
.p{{height:330px;display:flex;align-items:flex-end;justify-content:center;background:#5a6470;border-radius:6px;padding-bottom:10px;box-sizing:border-box}}.p img{{image-rendering:pixelated;flex:none}}body.dark .p{{background:#1a1f26}}
@media(max-width:520px){{.p img{{zoom:.66}}.p{{height:320px}}}}
.faces{{display:flex;gap:10px;flex-wrap:wrap}}.f{{margin:0;width:224px;max-width:calc(50% - 5px)}}.f img{{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:6px}}.f figcaption{{font-size:12px}}
.ref img{{max-width:100%;border-radius:6px}}</style>
<div class="w"><h1>쟈알디 80px 시안 8장 · 장당 1회 생성기</h1>
<label>배경 <select onchange="document.body.className=this.value"><option value="">중간 회색</option><option value="dark">어두움</option></select></label> · 3배 표시(80px 기준이면 게임도 3배)
<h2>전신</h2><div class="g">{cards}</div>
<h2>얼굴 8배 확대</h2><div class="faces">{faces}</div>
</div>'''
open('../../../../release/demo/jyaldi-v5-sheet7-review.html','w',encoding='utf-8').write(html)
