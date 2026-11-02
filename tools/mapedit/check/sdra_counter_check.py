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
# 지금 게임 에일린: 인물 팩 char-1.4 줄 1(평상 대기) 첫 칸 (11-02 실수목록 29)
_sh=Image.open(R+'game-pack/char-1.4/1.webp').convert('RGBA').crop((0,0,62,234)); ei=_sh.crop(_sh.getbbox())
# 원근 크기: 창구(높이 약 1.05m) 앞 밑선 y316에서 키 ≈ 창구 높이 69px×1.62=113px, 뒤 책상(약 0.75m, 37px) 밑 y227에서 ≈84px (1배)
def scale(y2):
    y=y2/2; h=113+(y-316)*(113-84)/(316-227); return h/117
out=bg2.copy()
mask=Image.new('L',bg2.size,0); d=ImageDraw.Draw(mask); d.polygon([tuple(p) for p in m['floor']],fill=255)
for b in m['blocks']: d.polygon([tuple(p) for p in b['poly']],fill=0)
# 보이는 바닥 = 초록 칠, 창구·물건 뒤에 가려진 바닥(창구 안쪽) = 초록 빗금
hid=Image.new('L',bg2.size,0)
for _,cm in covers: hid=Image.fromarray(__import__('numpy').maximum(__import__('numpy').array(hid),__import__('numpy').array(cm)))
import numpy as np
M=np.array(mask)>0; Hd=np.array(hid)>0
yy,xx=np.mgrid[0:bg2.height,0:bg2.width]; stripe=((xx+yy)//6)%3==0
vis=Image.fromarray(((M&~Hd)*255).astype('uint8')); hat=Image.fromarray(((M&Hd&stripe)*255).astype('uint8'))
out.paste(Image.alpha_composite(bg2,Image.new('RGBA',bg2.size,(0,255,80,80))),(0,0),vis)
out.paste(Image.alpha_composite(bg2,Image.new('RGBA',bg2.size,(0,255,80,150))),(0,0),hat)
for o in m['objects']:
    if o.get('file'): out.alpha_composite(Image.open(D+o['file']).convert('RGBA'),(o['x'],o['y']))
base=out.copy()
P=[(500,620),(538,520),(800,500),(1300,480),(1600,570),(1035,700)]
for x,y in sorted(P,key=lambda p:p[1]):
    s=scale(y); e=ei.resize((round(ei.width*s),round(ei.height*s)),Image.NEAREST)
    L=Image.new('RGBA',out.size,(0,0,0,0)); L.alpha_composite(e,(round(x-e.width/2),round(y-e.height))); out.alpha_composite(L)
    for sy,cm in covers:
        if y<sy: out.paste(base,(0,0),cm)
dd=ImageDraw.Draw(out)
path=[(470,700),(510,630),(538,560),(538,476),(620,476),(900,476)]
dd.line(path,fill=(255,0,0),width=3); dd.polygon([(900,468),(900,484),(914,476)],fill=(255,0,0))
for x,y in P: dd.ellipse((x-4,y-4,x+4,y+4),fill=(255,255,0))
out.convert('RGB').save('/mnt/project-files/sdra/sdra_counter_map_check_v7_x2.png')
z=out.crop((380,300,1000,720)); z.resize((z.width*2,z.height*2),Image.NEAREST).convert('RGB').save('/mnt/project-files/sdra/sdra_counter_map_check_v7_zoom_x4.png')
