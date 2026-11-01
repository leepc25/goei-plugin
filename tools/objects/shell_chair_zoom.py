import sys, json, os
ARGV=list(sys.argv)
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); sys.path.insert(0,str(ROOT/'game-src/action/testroom3'))
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
sys.path.insert(0,str(ROOT/'game-src/action/testroom3/qa'))
import fit_chair as fc
from PIL import Image, ImageDraw
key='1.1_쟈알디'; cfg,_=fc.load(key); ims,vals=fc.values(cfg)
CH=json.loads(ARGV[1]); OUT=ARGV[2]; Z=4
out=[]
for lid,v in [('60','front'),('96','side'),('61','back')]:
    im=fc.last(cfg,lid); p={**vals[v],**CH.get(v,{})}
    W,H=160,230; T=Image.new('RGBA',(W,H),(92,86,78,255)); g=ImageDraw.Draw(T)
    for y in range(0,H,10): g.line([(0,y),(W,y)],fill=(100,94,86,255))
    base=H-20; ox,oy=W//2-im.size[0]//2, base-(im.size[1]-4)
    c=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2+p['dx']-100),round(base+p['dy']-171)
    if v!='back': T.alpha_composite(c,(cx,cy)); T.alpha_composite(im,(ox,oy))
    else: T.alpha_composite(im,(ox,oy)); T.alpha_composite(c,(cx,cy))
    for x in range(0,W,4): g.point((x,base),fill=(255,60,60,255))
    g.text((2,2),f'{lid} dx={p["dx"]} dy={p["dy"]} {p["img"]}',fill=(255,255,255,255))
    out.append(T.crop((0,60,W,H)))
Sh=Image.new('RGB',(sum(o.width for o in out)*Z,out[0].height*Z),(40,40,44)); x=0
for o in out: Sh.paste(o.convert('RGB').resize((o.width*Z,o.height*Z),Image.NEAREST),(x,0)); x+=o.width*Z
Sh.save(OUT)
