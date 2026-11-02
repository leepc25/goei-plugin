"""옆모습 손 맞춤용 확대: 인물마다 엉덩이·좌판·등받이 부분만 3배, 4명씩. python3 shell_side_zoom.py <out> 키,키,..."""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
A=sys.argv[1:]; sys.argv=sys.argv[:1]; sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',16)
J=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text()); K=list(J)
out=A[0]; keys=A[1].split(','); cells=[]
for k in keys:
    V=os.environ.get('VIEW','side'); c,_=fc.load(k); im=fc.last(c,{'front':'60','side':'96','back':'61'}[V]); p=J[k][V]
    W,H=190,280; T=Image.new('RGBA',(W,H),(92,86,78,255)); base=H-15
    ox,oy=W//2-im.size[0]//2, base-(im.size[1]-4); ch=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2+p['dx']-100),round(base+p['dy']-171)
    if V=='back': T.alpha_composite(im,(ox,oy)); T.alpha_composite(ch,(cx,cy))
    else: T.alpha_composite(ch,(cx,cy)); T.alpha_composite(im,(ox,oy))
    T=T.crop((20,max(0,oy+50),170,H-5)); Z=3
    S=T.convert('RGB').resize((T.width*Z,T.height*Z),Image.NEAREST); d=ImageDraw.Draw(S)
    d.rectangle([0,0,S.width,20],fill=(20,20,20)); d.text((4,1),f'{K.index(k)} {k.split("_",1)[1]} dx{p["dx"]} dy{p["dy"]}',fill=(255,255,255),font=F)
    cells.append(S)
w=max(c.width for c in cells); h=max(c.height for c in cells); cols=4
Sh=Image.new('RGB',(w*cols,h*((len(cells)+cols-1)//cols)),(30,30,30))
for i,c in enumerate(cells): Sh.paste(c,((i%cols)*w,(i//cols)*h))
Sh.save(out)
