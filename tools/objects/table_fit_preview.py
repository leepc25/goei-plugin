import sys, json, os
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); sys.path.insert(0,str(ROOT/'game-src/action/testroom3'))
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
sys.path.insert(0,str(ROOT/'game-src/action/testroom3/qa'))
import fit_chair as fc
from PIL import Image, ImageDraw
import numpy as np
key='1.1_쟈알디'; cfg,_=fc.load(key); ims,vals=fc.values(cfg)
TW=int(sys.argv[1]) if len(sys.argv)>1 else 120
tab=Image.open(ROOT/'game-src/action/objects/T02_기둥테이블_1배/unknown.png').convert('RGBA'); tab=tab.crop(tab.getbbox())
sc=TW/tab.width; tab=tab.resize((TW,round(tab.height*sc)),Image.LANCZOS)
a=np.array(tab); a[:,:,3]=np.where(a[:,:,3]>128,255,0); tab=Image.fromarray(a)
tab=tab.crop(tab.getbbox()); print('table',tab.size)
out=[]
for lid,v in [('63','front'),('60','front'),('64','front'),('105','side'),('98','side')]:
    im=fc.last(cfg,lid)
    if im is None: print('no',lid); continue
    p={**vals[v],**((cfg.get('chair') or {}).get(lid) or {})}
    W,H=260,300; T=Image.new('RGBA',(W,H),(92,86,78,255)); g=ImageDraw.Draw(T)
    for y in range(0,H,10): g.line([(0,y),(W,y)],fill=(100,94,86,255))
    base=H-10; ox,oy=W//2-im.size[0]//2, base-(im.size[1]-4)
    c=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2+p['dx']-100),round(base+p['dy']-171)
    T.alpha_composite(c,(cx,cy)); T.alpha_composite(im,(ox,oy))
    # hands bottom: lowest skin-ish? just report bbox of frame rows; table placed so its top edge = base - 92
    ty=base-tab.height; tx=W//2-tab.width//2 if v=='front' else W//2+20
    T.alpha_composite(tab,(tx,ty))
    for x in range(0,W,6): g.point((x,base),fill=(255,60,60,255))
    g.text((4,4),f'{lid} {v} table top {tab.height}px',fill=(255,255,255,255))
    out.append(T)
Z=2; Sh=Image.new('RGB',(sum(o.width for o in out)*Z,out[0].height*Z),(40,40,44)); x=0
for o in out: Sh.paste(o.convert('RGB').resize((o.width*Z,o.height*Z),Image.NEAREST),(x,0)); x+=o.width*Z
Sh.save(sys.argv[2] if len(sys.argv)>2 else '/mnt/project-files/hq-f3/now/table_t02_fit_x2.png')
tab.save(ROOT/'game-src/art/objects/table_t02_120.png')
