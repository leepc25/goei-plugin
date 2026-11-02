"""후면 앉기(61) 맨몸 확대 3배: 하늘색 가로선 = 엉덩이 밑 후보(바닥 위 h), 초록 세로선 = 등 중앙 후보, 오른쪽 눈금 5px. 눈으로 보고 고칠 값 찾기용."""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
A=sys.argv[1:]; sys.argv=sys.argv[:1]; sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa')); sys.path.insert(0,str(ROOT/'tools/objects'))
import fit_chair as fc, back_spine as bs, front_crotch as fcr
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',16)
J=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text()); K=list(J)
out=A[0]; keys=A[1].split(','); cells=[]
for k in keys:
    c,_=fc.load(k); im=fc.last(c,'61'); W,H=im.size; base=H-4
    h,_=fcr.crotch(k,'61'); sx,_=bs.spine(k)
    T=Image.new('RGBA',(W,H),(92,86,78,255)); T.alpha_composite(im); top=max(0,int(__import__('numpy').where(__import__('numpy').array(im)[:,:,3].any(axis=1)>0)[0].min())-2); T=T.crop((0,top,W,H)); Z=3; y0=top
    S=T.convert('RGB').resize((T.width*Z,T.height*Z),Image.NEAREST); d=ImageDraw.Draw(S)
    for t in range(0,121,5):
        y=(base-t-y0)*Z; d.line([(S.width-(16 if t%10==0 else 8),y),(S.width,y)],fill=(255,255,0)); 
        if t%20==0: d.text((S.width-44,y-9),str(t),fill=(255,255,0),font=F)
    if h: y=(base-h-y0)*Z; d.line([(0,y),(S.width-50,y)],fill=(0,220,255))
    gx=(W/2+sx)*Z; d.line([(gx,0),(gx,S.height)],fill=(0,255,0))
    for t in range(-20,21,2):
        x=gx+t*Z; L=14 if t%10==0 else (9 if t%4==0 else 5); d.line([(x,22),(x,22+L)],fill=(255,80,255))
    d.rectangle([0,0,S.width,20],fill=(20,20,20)); d.text((4,1),f'{K.index(k)} {k.split("_",1)[1]} h{h}',fill=(255,255,255),font=F)
    cells.append(S)
w=max(c.width for c in cells); hh=max(c.height for c in cells); cols=int(os.environ.get('COLS',6))
Sh=Image.new('RGB',(w*cols,hh*((len(cells)+cols-1)//cols)),(30,30,30))
for i,c in enumerate(cells): Sh.paste(c,((i%cols)*w,(i//cols)*hh))
Sh.save(out)
