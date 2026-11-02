import json, numpy as np
from PIL import Image, ImageDraw
R='/home/user/goei-plugin/'; D=R+'game-src/mapedit/sdra_counter/'
m=json.load(open(D+'map.json'))
bg=Image.open(D+'sdra_counter.png').convert('RGBA'); bg2=bg.resize((bg.width*2,bg.height*2),Image.NEAREST)
cm=Image.open(D+'counter_cover_mask_1x.png').resize(bg2.size,Image.NEAREST)
ei=Image.open(R+'tools/mapedit/eileen_stand.png').convert('RGBA')
out=bg2.copy()
# 의자
for o in m['objects']:
    if o.get('file'): out.alpha_composite(Image.open(D+o['file']).convert('RGBA'),(o['x'],o['y']))
P=[(490,600),(800,560),(1300,500),(1600,590),(1035,700)]
for x,y in sorted(P,key=lambda p:p[1]):
    s=1.2+(y-555)*0.4/280; e=ei.resize((round(ei.width*s),round(ei.height*s)),Image.NEAREST)
    L=Image.new('RGBA',out.size,(0,0,0,0)); L.alpha_composite(e,(round(x-e.width/2),round(y-e.height)))
    out.alpha_composite(L)
    if y<632: out.paste(bg2,(0,0),cm)
d=ImageDraw.Draw(out)
d.line([tuple(p) for p in m['floor']],fill=(0,255,0),width=2)
for b in m['blocks']: d.polygon([tuple(p) for p in b['poly']],outline=(255,40,40))
for x,y in P: d.ellipse((x-4,y-4,x+4,y+4),fill=(255,255,0))
out.convert('RGB').save('/mnt/project-files/sdra/sdra_counter_map_check_v2_x2.png')
z=out.crop((380,340,1100,700)); z.resize((z.width*2,z.height*2),Image.NEAREST).convert('RGB').save('/mnt/project-files/sdra/sdra_counter_map_check_v2_zoom_x4.png')
