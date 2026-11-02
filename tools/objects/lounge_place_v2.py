"""휴게실 p8s 의자만 배치 시안(테이블 폐기 후). 1배 그대로, 저장은 2배 확대.
  python3 lounge_place_v2.py <A|B> <out.png>
  A = 옆모습 두 쌍 마주 보기, B = 정면 4개 나란히. 맞춤값 = chairs_shell/fit_all.json"""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
A=sys.argv[1:]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc
from PIL import Image
J=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text())
bg=Image.open(ROOT/'game-src/art/pixellab-hq-20261031/hq_lounge_p8s.png').convert('RGBA')
CH=ROOT/'game-src/art/objects/chairs_shell/fit'
items=[]
def chair(img,x,y,flip=False):
    c=Image.open(CH/f'{img}.png').convert('RGBA')
    if flip: c=c.transpose(Image.FLIP_LEFT_RIGHT); items.append((y,0,c,x-(200-100),y-171))
    else: items.append((y,0,c,x-100,y-171))
def person(k,v,cx,foot,flip=False,chair_front=False):
    cfg,_=fc.load(k); im=fc.last(cfg,{'front':'60','side':'96','back':'61'}[v])
    if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    items.append((foot,1 if not chair_front else -1,im,round(cx-im.width/2),foot-(im.height-4)))
def seat(k,v,cx,foot,face=1):
    p=J[k][v]; img=p['img']
    if v=='side':
        img='east' if face==1 else 'west'
        chair('east',cx+p['dx'],foot+p['dy'],flip=(face==-1)) if False else None
        c=Image.open(CH/'east.png').convert('RGBA')
        if face==-1: c=c.transpose(Image.FLIP_LEFT_RIGHT); items.append((foot,0,c,round(cx-p['dx']-(200-100)),foot+p['dy']-171))
        else: items.append((foot,0,c,round(cx+p['dx']-100),foot+p['dy']-171))
        person(k,v,cx,foot,flip=(face==-1))
    else:
        chair(img,cx+p['dx'],foot+p['dy']); person(k,v,cx,foot)
mode=A[0]; out=A[1]
if mode=='A':
    seat('1.1_쟈알디','side',190,392,1); seat('1.4_에일린','side',300,392,-1)
    seat('1.2_스팡달','side',400,392,1); seat('1.9_데드폴','side',510,392,-1)
else:
    for i,k in enumerate(['1.1_쟈알디','1.4_에일린','1.2_스팡달','1.9_데드폴']): seat(k,'front',230+i*85,392)
items.sort(key=lambda t:(t[0],t[1]))
for _,_,im,x,y in items: bg.alpha_composite(im,(x,y))
bg=bg.convert('RGB'); bg.resize((bg.width*2,bg.height*2),Image.NEAREST).save(out); print(out)
