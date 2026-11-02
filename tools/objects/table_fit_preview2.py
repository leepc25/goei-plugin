import sys, json, os
ARGV=list(sys.argv)
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); sys.path.insert(0,str(ROOT/'game-src/action/testroom3'))
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
sys.path.insert(0,str(ROOT/'game-src/action/testroom3/qa'))
import fit_chair as fc
from PIL import Image, ImageDraw
import numpy as np
key='1.1_쟈알디'; cfg,_=fc.load(key); ims,vals=fc.values(cfg)
FRONT=int(ARGV[1]); WIDTH=int(ARGV[2]); CH=json.loads(ARGV[3]); OUT=ARGV[4]
tab=Image.open(ROOT/'game-src/action/objects/T02_기둥테이블_1배/unknown.png').convert('RGBA'); tab=tab.crop(tab.getbbox())
sc=WIDTH/tab.width; tab=tab.resize((WIDTH,round(tab.height*sc)),Image.LANCZOS)
a=np.array(tab); a[:,:,3]=np.where(a[:,:,3]>128,255,0)
# band depth: rows where wood (light) spans wide; find last row of top (front edge) = first row below which width drops a lot
alpha=a[:,:,3]>0; widths=alpha.sum(1); top_rows=[y for y in range(len(widths)) if widths[y]>WIDTH*0.6]
front=max(top_rows)+1   # row index below top slab
extra=FRONT-(tab.height-front)  # column rows to add so front edge sits FRONT px above floor
col=a[front:front+1]
if extra>0: a=np.concatenate([a[:front], np.repeat(col,extra,0), a[front:]],0)
tab=Image.fromarray(a); print('table',tab.size,'band',front,'front edge above floor',tab.height-front)
tab.save(ROOT/f'game-src/art/objects/table_t02_w{WIDTH}_f{FRONT}.png')
out=[]
for lid,v in [('63','front'),('60','front'),('105','side'),('61','back')]:
    im=fc.last(cfg,lid)
    p={**vals[v],**CH.get(v,{})}
    W,H=300,430; T=Image.new('RGBA',(W,H),(92,86,78,255)); g=ImageDraw.Draw(T)
    for y in range(0,H,10): g.line([(0,y),(W,y)],fill=(100,94,86,255))
    base=H-50; ox,oy=W//2-im.size[0]//2, base-(im.size[1]-4)
    c=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2+p['dx']-100),round(base+p['dy']-171)
    TD={'front':29,'side':15,'back':-15}[v]; ty=base+TD-tab.height; tx=W//2-tab.width//2 if v!='side' else W//2+25
    if v=='front': T.alpha_composite(c,(cx,cy)); T.alpha_composite(im,(ox,oy)); T.alpha_composite(tab,(tx,ty))
    elif v=='side': T.alpha_composite(c,(cx,cy)); T.alpha_composite(im,(ox,oy)); T.alpha_composite(tab,(tx,ty))
    else: T.alpha_composite(tab,(tx,ty)); T.alpha_composite(im,(ox,oy)); T.alpha_composite(c,(cx,cy))
    for x in range(0,W,6): g.point((x,base),fill=(255,60,60,255))
    g.text((4,4),f'{lid} {v} chair dx={p["dx"]} dy={p["dy"]} {p["img"]}',fill=(255,255,255,255))
    out.append(T)
Z=2; Sh=Image.new('RGB',(sum(o.width for o in out)*Z,out[0].height*Z),(40,40,44)); x=0
for o in out: Sh.paste(o.convert('RGB').resize((o.width*Z,o.height*Z),Image.NEAREST),(x,0)); x+=o.width*Z
Sh.save(OUT)
