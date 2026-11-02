import json, sys
from pathlib import Path
from PIL import Image
ROOT=Path('/home/user/goei-plugin')
sys.path.insert(0,str(ROOT/'game-src/action/testroom3')); sys.path.insert(0,str(ROOT/'game-src/action/testroom3/qa'))
a=sys.argv; sys.argv=a[:1]; import fit_chair as fc; sys.argv=a
sys.path.insert(0,str(ROOT/'tools/mapedit')); from preview_jr_chairs import persp, render
FX,FY=int(a[1]),int(a[2]); who=a[3].split(',') if len(a)>3 and a[3] else []; out=a[4]
g=json.loads((ROOT/'game-src/mapedit/jr_songil/game.json').read_text())['scene']
render('jr_songil',[(int(a[5]),int(a[6]))] if len(a)>6 else [],out)
img=Image.open(out).convert('RGBA')
kp=persp(g,FY)*g['dotK']; kc=kp/1.07
ch=Image.open(a[7] if len(a)>7 else 'x').convert('RGBA')
cw,chh=round(ch.width*kc),round(ch.height*kc); chs=ch.resize((cw,chh),Image.NEAREST)
ox,oy=round(FX-110.5*kc),round(FY-124*kc)
seats=[(40,61),(111.5,61),(183.5,61)]
for (sx,sy),key in zip(seats,who):
    if not key: continue
    cfg,_=fc.load(key); ims,vals=fc.values(cfg); fit=vals['back']
    P=(ox+sx*kc, oy+sy*kc); cx,cy=P[0]+9*kp, P[1]+70*kp
    bx,by=cx-fit['dx']*kp, cy-fit['dy']*kp
    im=fc.last(cfg,'61'); sb=fc.line_base(cfg,'61')
    s=im.resize((round(im.width*kp),round(im.height*kp)),Image.NEAREST)
    img.alpha_composite(s,(round(bx-s.width/2),round(by-sb*kp)))
img.alpha_composite(chs,(ox,oy))
for o in g['objects']:
    if o.get('file') and o['sortY']>FY: img.alpha_composite(Image.open(ROOT/f"game-pack/jr-field/{o['file']}.webp").convert('RGBA'),(o['x'],o['y']))
img.convert('RGB').save(out); print('kp',round(kp,3),'kc',round(kc,3),'chair',cw,chh,'at',ox,oy)
