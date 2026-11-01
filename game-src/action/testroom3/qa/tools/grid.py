import sys; sys.path.insert(0,'qa'); key,view,img=sys.argv[1:4]; opts=[tuple(map(float,o.split(','))) for o in sys.argv[4:]]; sys.argv=sys.argv[:1]
import fit_chair as F
from PIL import Image, ImageDraw
cfg,_=F.load(key); ims,vals=F.values(cfg); im=ims[view]
TW,TH,Z=200,250,3
S=Image.new('RGB',(TW*Z*len(opts),TH*Z+24),(40,40,44)); dr=ImageDraw.Draw(S)
for i,(dx,dy) in enumerate(opts):
    T=Image.new('RGBA',(TW,TH),(92,86,78,255)); c=Image.open(F.chair_png(img)).convert('RGBA'); base=TH-10
    ox,oy=TW//2-im.size[0]//2,base-(im.size[1]-4); cx,cy=round(TW/2+dx-100),round(base+dy-171)
    if view!='back': T.alpha_composite(c,(cx,cy)); T.alpha_composite(im,(ox,oy))
    else: T.alpha_composite(im,(ox,oy)); T.alpha_composite(c,(cx,cy))
    S.paste(T.convert('RGB').resize((TW*Z,TH*Z),Image.NEAREST),(i*TW*Z,24)); dr.text((i*TW*Z+6,6),f'{img} {dx},{dy}',fill=(255,255,255))
S.resize((S.width//2,S.height//2)).save(f'/tmp/claude-0/-home-user-goei-plugin/234256d0-88fa-5096-94fe-82db51fc01a2/scratchpad/fit/grid_{key}_{view}_{img}.png')
