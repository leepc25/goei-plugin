"""협회 창구 따기 확인: 걷는 바닥(초록 칠), 막힘(빨강), 들어가는 길(빨간 화살표), 원근 크기로 세운 에일린 + 가림."""
import json, io, base64
from PIL import Image, ImageDraw
R='/home/user/goei-plugin/'; D=R+'game-src/mapedit/sdra_counter/'
m=json.load(open(D+'map.json'))
bg=Image.open(D+'sdra_counter.png').convert('RGBA'); bg2=bg.resize((bg.width*2,bg.height*2),Image.NEAREST)
covers=[]
for o in m['objects']:
    if o.get('coverMask'):
        mk=Image.open(io.BytesIO(base64.b64decode(o['coverMask'].split(',')[1]))).convert('L')
        full=Image.new('L',bg2.size,0); full.paste(mk,(o['x'],o['y'])); covers.append((o['sortY'],full))
ei=Image.open(R+'tools/mapedit/eileen_stand.png').convert('RGBA')
# 원근 크기: 창구(높이 약 1.05m) 앞 밑선 y316에서 키 ≈ 창구 높이 69px×1.62=113px, 뒤 책상(약 0.75m, 37px) 밑 y227에서 ≈84px (1배)
def scale(y2):
    y=y2/2; h=113+(y-316)*(113-84)/(316-227); return h/117
out=bg2.copy()
mask=Image.new('L',bg2.size,0); d=ImageDraw.Draw(mask); d.polygon([tuple(p) for p in m['floor']],fill=255)
for b in m['blocks']: d.polygon([tuple(p) for p in b['poly']],fill=0)
out.paste(Image.alpha_composite(bg2,Image.new('RGBA',bg2.size,(0,255,80,70))),(0,0),mask)
for o in m['objects']:
    if o.get('file'): out.alpha_composite(Image.open(D+o['file']).convert('RGBA'),(o['x'],o['y']))
base=out.copy()
P=[(500,600),(538,500),(800,500),(1300,470),(1600,570),(1035,700)]
for x,y in sorted(P,key=lambda p:p[1]):
    s=scale(y); e=ei.resize((round(ei.width*s),round(ei.height*s)),Image.NEAREST)
    L=Image.new('RGBA',out.size,(0,0,0,0)); L.alpha_composite(e,(round(x-e.width/2),round(y-e.height))); out.alpha_composite(L)
    for sy,cm in covers:
        if y<sy: out.paste(base,(0,0),cm)
dd=ImageDraw.Draw(out)
path=[(470,690),(500,610),(536,530),(540,470),(620,470),(900,470)]
dd.line(path,fill=(255,0,0),width=3); dd.polygon([(900,462),(900,478),(914,470)],fill=(255,0,0))
for x,y in P: dd.ellipse((x-4,y-4,x+4,y+4),fill=(255,255,0))
out.convert('RGB').save('/mnt/project-files/sdra/sdra_counter_map_check_v6_x2.png')
z=out.crop((380,300,1000,720)); z.resize((z.width*2,z.height*2),Image.NEAREST).convert('RGB').save('/mnt/project-files/sdra/sdra_counter_map_check_v6_zoom_x4.png')
