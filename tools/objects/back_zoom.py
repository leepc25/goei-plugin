"""후면 확대(3배): 빨강 = 의자 중앙, 초록 = 등 중앙선 후보. VIEW 고정 back. python3 back_zoom.py <out> 키,키,..."""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
A=sys.argv[1:]; sys.argv=sys.argv[:1]; sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa')); sys.path.insert(0,str(ROOT/'tools/objects'))
import fit_chair as fc, back_spine as bs
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',16)
J=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text()); K=list(J)
out=A[0]; keys=A[1].split(','); cells=[]
for k in keys:
    c,_=fc.load(k); im=fc.last(c,'61'); p=J[k]['back']
    W,H=190,280; T=Image.new('RGBA',(W,H),(92,86,78,255)); base=H-15
    ox,oy=W//2-im.size[0]//2, base-(im.size[1]-4); ch=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2+p['dx']-100),round(base+p['dy']-171)
    T.alpha_composite(im,(ox,oy)); T.alpha_composite(ch,(cx,cy))
    sx,_=bs.spine(k); top=max(0,oy+30); T=T.crop((20,top,170,H-5)); Z=3
    S=T.convert('RGB').resize((T.width*Z,T.height*Z),Image.NEAREST); d=ImageDraw.Draw(S)
    rx=(cx+100.5-20)*Z; gx=(W/2+sx-20)*Z
    d.line([(gx,0),(gx,S.height)],fill=(0,255,0),width=1); d.line([(rx,0),(rx,S.height)],fill=(255,0,0),width=1)
    d.rectangle([0,0,S.width,20],fill=(20,20,20)); d.text((4,1),f'{K.index(k)} {k.split("_",1)[1]} dx{p["dx"]} dy{p["dy"]} 등{sx:+.1f}',fill=(255,255,255),font=F)
    cells.append(S)
w=max(c.width for c in cells); h=max(c.height for c in cells); cols=int(os.environ.get('COLS',6))
Sh=Image.new('RGB',(w*cols,h*((len(cells)+cols-1)//cols)),(30,30,30))
for i,c in enumerate(cells): Sh.paste(c,((i%cols)*w,(i//cols)*h))
Sh.save(out)
