import sys
from pathlib import Path
W=Path('/tmp/claude-0/wt_dg'); HERE=W/'game-src/action/testroom3'
sys.path.insert(0,str(HERE)); sys.path.insert(0,str(HERE/'qa')); sys.argv=sys.argv[:1]
import fit_chair as fc
from PIL import Image, ImageDraw
DESK=Image.open('/home/user/goei-plugin/game-src/action/objects/D01v3_사무책상_1배/unknown.png').convert('RGBA')
KB_X=109; DESK_FOOT=195; BACKOFF=int(__import__('os').environ.get('BACKOFF','14'))
out=[]
for key in ['1.1_쟈알디','1.4_에일린']:
    cfg,_=fc.load(key); ims,vals=fc.values(cfg)
    im=ims['back']; p=vals['back']; p={**p,'sb':fc.line_base(cfg,'61')}
    TW,TH=320,300; T=Image.new('RGBA',(TW,TH),(92,86,78,255)); g=ImageDraw.Draw(T)
    base=TH-10
    ox,oy=TW//2-im.size[0]//2, base-(p['sb'] if p.get('sb') is not None else im.size[1]-4)
    cx,cy=round(TW/2+p['dx']-100), round(base+p['dy']-171)
    T.alpha_composite(DESK,(TW//2-KB_X, base-BACKOFF-DESK_FOOT))
    T.alpha_composite(im,(ox,oy))
    T.alpha_composite(Image.open(fc.chair_png(p['img'])).convert('RGBA'),(cx,cy))
    for x in range(0,TW,6): g.point((x,base),fill=(255,60,60,255))
    out.append(T)
S=Image.new('RGBA',(sum(t.width for t in out),out[0].height))
x=0
for t in out: S.paste(t,(x,0)); x+=t.width
S=S.resize((S.width*2,S.height*2),Image.NEAREST); S.save('/mnt/project-files/hq-office/desk_sit_back_x2.png'); print(S.size)
