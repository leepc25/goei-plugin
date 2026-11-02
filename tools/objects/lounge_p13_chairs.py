"""휴게실 p13s 잇기5(_fix) 의자 배치 미리보기. 게임처럼 배경 2배 고정, 의자는 배경과 따로 깊이 y마다 배율(PERSP 원근 세기).
배율 기준: 무지개 자판기 키 150px(1배, 발 y301) = 어른보다 조금 큼(p12s와 같은 비 113/124) → 어른 137, 눈높이 0.93.
테이블은 따 놓은 오브젝트(game-src/art/objects/lounge_tables)로 뒤 의자 위에 덮어 그림.
python3 lounge_p13_chairs.py <out.png>  (env PERSP=0.5)"""
import sys, os, json
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2]; K=2
P=float(os.environ.get('PERSP','0.5'))
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_lounge_p13s_extL5_fix.png').convert('RGBA')
BG=bg.resize((bg.width*K,bg.height*K),Image.NEAREST)
CH=R/'game-src/art/objects/chairs_shell/fit'
TD=R/'game-src/art/objects/lounge_tables'; TM=json.loads((TD/'tables.json').read_text())
VEND,FOOTV=150,301; ADULT=round(VEND*113/124); HZ=FOOTV-round(ADULT*0.93); A=ADULT/(FOOTV-HZ)
def scale(y):
    b=K*A*(FOOTV-HZ)/247; f=K*A*(y-HZ)/247; return b+(f-b)*P
def chair(d,y):
    im=Image.open(CH/f'{d}.png').convert('RGBA').crop((0,0,200,172))
    s=scale(y); return im.resize((round(200*s),round(172*s)),Image.NEAREST), s
# 테이블별(1배): 뒤 의자 x(뒤다리 가운데), 앞 의자 x(앞다리 가운데), 왼·오른 끝(깊이 가운데)
TAB={'table1':(162,134,102,193),'table2':(462,434,403,493),'table3':(713,740,681,772)}
FB,FF,FS=float(os.environ.get('FB',340)),float(os.environ.get('FF',395)),float(os.environ.get('FS',362))
layers=[]   # (그리는 순서 키, img, x, y)
for n,(xb,xf,xl,xr) in TAB.items():
    im,s=chair('south',FB); layers.append((0,im,round(xb*K-100*s),round(FB*K-172*s)))   # 테이블 뒤, 정면 보는 의자
    im,s=chair('east',FS); b=im.getbbox(); layers.append((1,im,round(xl*K+10-b[2]),round(FS*K-172*s)))
    im,s=chair('west',FS); b=im.getbbox(); layers.append((1,im,round(xr*K-10-b[0]),round(FS*K-172*s)))
    t=Image.open(TD/f'{n}.png').convert('RGBA'); t=t.resize((t.width*K,t.height*K),Image.NEAREST)
    layers.append((2,t,TM[n]['x']*K,TM[n]['y']*K))
    im,s=chair('north',FF); layers.append((3,im,round(xf*K-100*s),round(FF*K-172*s)))  # 테이블 앞, 등 보이는 의자
out=BG.copy()
for _,im,x,y in sorted(layers,key=lambda t:t[0]): out.alpha_composite(im,(x,y))
out.convert('RGB').save(sys.argv[1])
print('ADULT',ADULT,'HZ',HZ,{y:round(scale(y),2) for y in (FB,FS,FF)})
