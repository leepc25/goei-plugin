"""훈련장 따기 확인: 걷는 바닥(초록), 막힘(빨강), 가림 윤곽(자홍), 장비 자리(노란 테), 지금 게임 에일린(char-1.4 줄1) 원근 크기."""
import json, numpy as np
from PIL import Image, ImageDraw
R='/home/user/goei-plugin/'; D=R+'game-src/mapedit/training/'
m=json.load(open(D+'map.json')); bg=Image.open(D+'training.png').convert('RGBA'); bg2=bg.resize((bg.width*2,bg.height*2),Image.NEAREST)
out=bg2.copy(); mask=Image.new('L',bg2.size,0); d=ImageDraw.Draw(mask); d.polygon([tuple(p) for p in m['floor']],fill=255)
for b in m['blocks']: d.polygon([tuple(p) for p in b['poly']],fill=0)
out.paste(Image.alpha_composite(bg2,Image.new('RGBA',bg2.size,(0,255,80,80))),(0,0),mask)
rm=Image.new('L',bg2.size,0); dr=ImageDraw.Draw(rm)
for b in m['blocks']: dr.polygon([tuple(p) for p in b['poly']],fill=255)
out.paste(Image.alpha_composite(bg2,Image.new('RGBA',bg2.size,(255,0,0,70))),(0,0),rm)
_sh=Image.open(R+'game-pack/char-1.4/1.webp').convert('RGBA').crop((0,0,62,234)); ei=_sh.crop(_sh.getbbox())
dotK=m.get('dotK') or 1.4292; CHK=234/247
def scale(y): t=(y-m['lane'][0])/(m['lane'][1]-m['lane'][0]); return (0.85+0.15*max(0,min(1,t)))*dotK/CHK*(247/256)
objs=[(o,Image.open(D+o['file']+'.png').convert('RGBA')) for o in m['objects']]
P=[(300,700),(560,830),(1300,720),(700,830),(1450,760),(1750,740),(2200,730),(2500,800),(1000,700)]
layers=[(y,'p',(x,y)) for x,y in P]+[(o['sortY'],'o',(o,im)) for o,im in objs]
for y,k,v in sorted(layers,key=lambda t:t[0]):
    if k=='p':
        x,yy=v; s=scale(yy); e=ei.resize((round(ei.width*s),round(ei.height*s)),Image.NEAREST); out.alpha_composite(e,(round(x-e.width/2),round(yy-e.height)))
    else:
        o,im=v; out.alpha_composite(im,(o['x'],o['y']))
dd=ImageDraw.Draw(out)
for o,im in objs:
    a=np.array(im)[:,:,3]>0; e=a&~(np.roll(a,1,0)&np.roll(a,-1,0)&np.roll(a,1,1)&np.roll(a,-1,1)); ys,xs=np.nonzero(e)
    for x,y in zip(xs,ys): out.putpixel((o['x']+x,o['y']+y),(255,0,255,255))
for g in m['gear']: dd.ellipse((g['x']-6,g['y']-6,g['x']+6,g['y']+6),outline=(255,255,0),width=3)
for x,y in P: dd.ellipse((x-4,y-4,x+4,y+4),fill=(255,255,0))
out.convert('RGB').save('/mnt/project-files/sdra/training_map_check_v2_x2.png')
out.crop((0,560,1300,848)).resize((2600,576),Image.NEAREST).convert('RGB').save('/mnt/project-files/sdra/training_map_check_v2_zoomL_x4.png')
out.crop((1300,560,2554,848)).resize((2508,576),Image.NEAREST).convert('RGB').save('/mnt/project-files/sdra/training_map_check_v2_zoomR_x4.png')
