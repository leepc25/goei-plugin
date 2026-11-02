"""휴게실 p12s 게임 배율 미리보기: 배경 2배(bgScale 2), 의자는 인물 배율(깊이 y마다)로.
인물 키(1배 배경 px) h(y) = A*(y-HZ): 자판기 124px(발 y289) = 어른보다 조금 큼 → 어른 113px, 눈높이 0.93 → HZ 184.
의자 배율 = 2*h(y)/247 (247 = 인물 스프라이트 키 점, author_hq_bath_f.py SPR_DOTS). 1배 원본에서 바로 키움(NEAREST).
python3 lounge_p12_game.py <out.png>"""
import sys
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2]; K=2
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_lounge_p12s.png').convert('RGBA')
BG=bg.resize((bg.width*K,bg.height*K),Image.NEAREST)
CH=R/'game-src/art/objects/chairs_shell/fit'
ADULT, FOOTV = 113, 289; HZ=FOOTV-round(ADULT*0.93); A=ADULT/(FOOTV-HZ)
import os
P=float(os.environ.get('PERSP','1'))   # 원근 세기: 1 = 그대로, 0.5 = 뒤에서 앞으로 커지는 양 절반
def scale(y):
    b=K*A*(FOOTV-HZ)/247; f=K*A*(y-HZ)/247
    return b+(f-b)*P
def chair(d,y):
    im=Image.open(CH/f'{d}.png').convert('RGBA').crop((0,0,200,172))
    s=scale(y); return im.resize((round(200*s),round(172*s)),Image.NEAREST), s
TABLES=[(39,159),(260,370),(472,592)]          # 1배 상판 x
FB, FF, FS = 350, 404, 380                      # 의자 발 y(1배): 뒤·앞·옆
items=[]
for x0,x1 in TABLES:
    cx=(x0+x1)/2
    for d,y in (('south',FB),('north',FF)):
        im,s=chair(d,y); items.append((y,im,round(cx*K-100*s),round(y*K-172*s)))
    im,s=chair('east',FS); b=im.getbbox(); items.append((FS,im,round(x0*K+10-b[2]),round(FS*K-172*s)))
    im,s=chair('west',FS); b=im.getbbox(); items.append((FS,im,round(x1*K-10-b[0]),round(FS*K-172*s)))
out=BG.copy()
for y,im,x,yy in sorted(items,key=lambda t:t[0]):
    out.alpha_composite(im,(max(x,0),yy),(max(0,-x),0)) if x<0 else out.alpha_composite(im,(x,yy))
    if y==FB:   # 뒤 의자는 테이블 상판 뒤로
        for x0,x1 in TABLES:
            box=((x0-2)*K,296*K,(x1+3)*K,322*K); out.paste(BG.crop(box),box[:2])
out.save(sys.argv[1])
print('HZ',HZ,'A',round(A,3),{y:round(scale(y),2) for y in (FB,FS,FF)})
