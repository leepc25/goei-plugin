"""휴게실 p8s에 기둥 테이블 T02 + 쉘 의자 배치 시험(1차). 사용: python3 lounge_place_v1.py <scale> <out_x2.png>
의자 캔버스 200x200: 바닥 y171, 좌석 가운데 x100. 테이블 png 아래끝 = 받침 바닥.
옆자리 맞춤(table_fit_preview2 side): 테이블 받침 = 앉은 사람 발선 +15, 테이블 왼끝 = 사람 가운데 +25."""
import sys, os, json
from pathlib import Path
ARGV=list(sys.argv)
ROOT=Path('/home/user/goei-plugin')
sys.path.insert(0,str(ROOT/'game-src/action/testroom3')); sys.path.insert(0,str(ROOT/'game-src/action/testroom3/qa'))
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
import fit_chair as fc
from PIL import Image
S=float(ARGV[1]); OUT=ARGV[2]
bg=Image.open(ROOT/'game-src/art/pixellab-hq-20261031/hq_lounge_p8s.png').convert('RGBA')
tab=Image.open(os.environ.get('TABLE',str(ROOT/'game-src/art/objects/table_t02_w142_f100.png'))).convert('RGBA'); tab=tab.crop(tab.getbbox()).convert('RGBA')
CH=ROOT/'game-src/art/objects/chairs_shell/fit'
fit=json.load(open(ROOT/'game-src/art/objects/chairs_shell/jyaldi_fit_v4.json'))
cfg,_=fc.load('1.1_쟈알디')
def sc(im): return im.resize((round(im.width*S),round(im.height*S)),Image.NEAREST)
items=[]  # (base_y, img, x, y)
def put(im, ax, ay, px, py):   # 그림 안 기준점(ax,ay)을 배경 (px,py)에
    im=sc(im); items.append((py, im, round(px-ax*S), round(py-ay*S)))
tabs=json.loads(os.environ.get('TABS','[[200,398],[440,398]]'))
for i,(tcx,base) in enumerate(tabs):
    # 사람 발선 = 테이블 받침 -15, 사람 가운데 = 테이블 왼끝 -25
    foot=base-15*S; L=tcx-(tab.width//2)*S-25*S; R=tcx+(tab.width//2)*S+25*S
    put(tab, tab.width//2, tab.height, tcx, base)
    for x,d in ((L,'east'),(R,'west')):
        dx=fit['side']['dx']*(1 if d=='east' else -1); dy=fit['side']['dy']
        c=Image.open(CH/f'{d}.png').convert('RGBA')
        put(c, 100, 171, x+dx*S, foot+dy*S)
    if i==0:   # 크기 보기용: 왼쪽 의자에 쟈알디 옆모습
        im=fc.last(cfg,'105'); put(im, im.width/2, im.height-4, L, foot)
items.sort(key=lambda t:t[0])
for _,im,x,y in items: bg.alpha_composite(im,(x,y))
bg=bg.convert('RGB'); bg.resize((bg.width*2,bg.height*2),Image.NEAREST).save(OUT)
