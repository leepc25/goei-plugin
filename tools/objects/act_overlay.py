"""동작 장 위에 앉기 끝 장 윤곽(빨강)을 겹쳐 3배로: 줄 값 후보를 눈으로 고르기용.
  python3 tools/objects/act_overlay.py <out.png> key:line:frame:dx,dy[:dx,dy...] ...  (frame 1부터, 후보 여러 개면 칸 여러 개)
  후보를 안 주면 줄별 값(fit_all.json 의 lines["front:149"] 등, 없으면 기본값). 환경 SCALE=확대 배율(기본 3)."""
import sys,os,json
from pathlib import Path
ARGV=sys.argv[1:]
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit'); sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa')); sys.path.insert(0,str(ROOT/'tools/objects'))
import fit_chair as fc
from act_cmp import frames, ACTS, SIT
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np
FONT=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',14)
J=json.load(open(ROOT/'game-src/art/objects/chairs_shell/fit_all.json'))
VIEW={l:v for v,ls in ACTS.items() for l in ls}
SC=int(os.environ.get('SCALE',3))
def pos(im,p,W,base): return round(W/2-im.size[0]/2-p['dx']), round(base-p['dy']-min(im.size[1]-4,im.getbbox()[3]))
cells=[]
for it in ARGV[1:]:
    k,l,fi,*cands=it.split(':'); v=VIEW[l]; c,_=fc.load(k); pv=J[k][v]
    s=fc.last(c,SIT[v]); f=frames(c,l)[int(fi)-1]
    a=np.array(s)[:,:,3]>40; edge=a & ~(np.array(Image.fromarray(a.astype(np.uint8)*255).filter(ImageFilter.MinFilter(3)))>0)
    ol=np.zeros(a.shape+(4,),np.uint8); ol[edge]=(255,40,40,255); olim=Image.fromarray(ol)
    lp=J[k].get('lines',{}).get(f'{v}:{l}',pv)
    if lp.get('flip') or os.environ.get('FLIP')==k: f=f.transpose(Image.FLIP_LEFT_RIGHT)   # 줄 좌우 뒤집기(방향 반대로 뽑힌 줄)
    fdx=lp.get('frame_dx',[lp['dx']]*99)[int(fi)-1]   # 장마다 x 가 다르면(기대 쉬기 등) frame_dx
    fdy=lp.get('frame_dy',[lp['dy']]*99)[int(fi)-1]
    for cd in cands or [f"{fdx},{fdy}"]:
        dx,dy=map(int,cd.split(',')); pl=dict(pv,dx=dx,dy=dy)
        W,H=200,300; base=H-15
        T=Image.new('RGBA',(W,H),(92,86,78,255))
        ch=Image.open(fc.chair_png(pv['img'])).convert('RGBA'); cx,cy=round(W/2-100),base-171
        if v!='back': T.alpha_composite(ch,(cx,cy)); T.alpha_composite(f,pos(f,pl,W,base))
        else: T.alpha_composite(f,pos(f,pl,W,base)); T.alpha_composite(ch,(cx,cy))
        T.alpha_composite(olim,pos(s,pv,W,base))
        T=T.crop((20,50,180,H)).convert('RGB').resize((160*SC,(H-50)*SC),Image.NEAREST)
        d=ImageDraw.Draw(T); d.rectangle([0,0,160*SC,17],fill=(20,20,20)); d.text((3,1),f'{k.split("_",1)[1]} {l}-{fi} {dx},{dy}',fill=(255,255,255),font=FONT)
        cells.append(T)
cols=int(os.environ.get('COLS',4)); cw,chh=cells[0].size; rows=(len(cells)+cols-1)//cols
S=Image.new('RGB',(cw*cols,chh*rows),(30,30,30))
for j,cc in enumerate(cells): S.paste(cc,((j%cols)*cw,(j//cols)*chh))
S.save(ARGV[0]); print(ARGV[0],S.size)
