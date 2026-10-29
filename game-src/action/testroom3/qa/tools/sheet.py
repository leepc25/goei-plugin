import sys,json,os; sys.path.insert(0,'qa'); view=sys.argv[1]; keys=sys.argv[2].split(','); out=sys.argv[3]; sys.argv=sys.argv[:1]
import fit_chair as F
from PIL import Image, ImageDraw
TW,TH=170,240; cols=6
rows=(len(keys)+cols-1)//cols
S=Image.new('RGB',(TW*cols,(TH+14)*rows),(40,40,44)); dr=ImageDraw.Draw(S)
for i,k in enumerate(keys):
    cfg,_=F.load(k); ims,vals=F.values(cfg); im=ims[view]; p=vals[view]
    T=Image.new('RGBA',(TW,TH),(92,86,78,255)); base=TH-6
    if im is not None:
        c=Image.open(F.chair_png(p['img'])).convert('RGBA')
        ox,oy=TW//2-im.size[0]//2,base-(im.size[1]-4); cx,cy=round(TW/2+p['dx']-100),round(base+p['dy']-171)
        if view!='back': T.alpha_composite(c,(cx,cy)); T.alpha_composite(im,(ox,oy))
        else: T.alpha_composite(im,(ox,oy)); T.alpha_composite(c,(cx,cy))
    X,Y=(i%cols)*TW,(i//cols)*(TH+14)
    S.paste(T.convert('RGB'),(X,Y+14)); dr.text((X+3,Y+1),f"{k.split('_')[0]} {p['img'][:5]} {p['dx']:g},{p['dy']:g}",fill=(255,255,255))
S.save(out)
