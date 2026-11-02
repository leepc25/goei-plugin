"""휴게실 p12s: 배경 2배 고정, 의자·인물은 같은 배율(깊이 y마다, PERSP로 원근 세기). 쟈알디 앉히기 4방향 + 서기 2곳.
python3 lounge_p12_people.py <out.png>  (env PERSP=0.5 기본)"""
import sys, os, json
from pathlib import Path
R=Path(__file__).resolve().parents[2]
os.environ['CHAIR_DIR']=str(R/'game-src/art/objects/chairs_shell/fit')
A_=sys.argv[1:]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(R/'game-src/action/testroom3')); sys.path.insert(0,str(R/'game-src/action/testroom3/qa'))
import fit_chair as fc
from PIL import Image
K=2; P=float(os.environ.get('PERSP','0.5'))
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_lounge_p12s.png').convert('RGBA')
BG=bg.resize((bg.width*K,bg.height*K),Image.NEAREST)
ADULT,FOOTV=113,289; HZ=FOOTV-round(ADULT*0.93); A=ADULT/(FOOTV-HZ)
def scale(y):
    b=K*A*(FOOTV-HZ)/247; f=K*A*(y-HZ)/247; return b+(f-b)*P
def S(im,s): return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.NEAREST)
KEY='1.1_쟈알디'; cfg,_=fc.load(KEY); FIT=json.loads((R/'game-src/art/objects/chairs_shell/fit_all.json').read_text())[KEY]
def chair_img(name): return Image.open(fc.chair_png(name)).convert('RGBA')
layers=[]   # (정렬 y, 순서, img, x, y)
def seat(view,fx,fy,flip=False):
    """fx,fy = 의자 발 기준점(1배 배경 좌표). 인물·의자 상대 위치는 fit 값 × 배율."""
    s=scale(fy); p=FIT[view]; lid={'front':'60','side':'96','back':'61'}[view]
    pim=fc.last(cfg,lid); cim=chair_img(p['img'])
    dx,dy=p['dx'],p['dy']
    if flip: pim=pim.transpose(Image.FLIP_LEFT_RIGHT); cim=cim.transpose(Image.FLIP_LEFT_RIGHT); dx=-dx
    # 사람 발 F, 의자 기준 = F+(dx,dy) = (fx,fy)
    X,Y=fx*K,fy*K; Fx,Fy=X-dx*s,Y-dy*s
    ps=S(pim,s); cs=S(cim,s)
    px,py=round(Fx-ps.width/2),round(Fy-(pim.height-4)*s)
    cx=round(X-(100 if not flip else 100)*s); cy=round(Y-171*s)
    if view=='back': layers.append((fy,0,ps,px,py)); layers.append((fy,1,cs,cx,cy))
    else: layers.append((fy,0,cs,cx,cy)); layers.append((fy,1,ps,px,py))
def stand(fx,fy,flip=False):
    s=scale(fy); im=fc.last(cfg,'1')
    if flip: im=im.transpose(Image.FLIP_LEFT_RIGHT)
    ps=S(im,s); layers.append((fy,1,ps,round(fx*K-ps.width/2),round(fy*K-(im.height-4)*s)))
TABLES=[(39,159),(260,370),(472,592)]
x0,x1=TABLES[1]; cx=(x0+x1)/2
seat('front',cx,350)            # 테이블 뒤, 정면
seat('back',cx,404)             # 테이블 앞, 등
seat('side',x0-22,380)          # 왼쪽, 오른쪽(테이블)을 봄
seat('side',x1+22,380,flip=True)  # 오른쪽, 왼쪽을 봄
stand(230,300)                  # 자판기 앞
stand(440,420)                  # 화면 맨 앞
out=BG.copy()
for fy,o,im,x,y in sorted(layers,key=lambda t:(t[0],t[1])):
    out.alpha_composite(im,(x,y)) if x>=0 and y>=0 else out.paste(im,(x,y),im)
    if fy==350 and o==1:   # 뒤에 앉은 사람·의자는 테이블 상판 뒤로
        box=((x0-2)*K,296*K,(x1+3)*K,322*K); out.paste(BG.crop(box),box[:2])
out.convert('RGB').save(A_[0])
print({y:round(scale(y),2) for y in (300,350,380,404,420)})
