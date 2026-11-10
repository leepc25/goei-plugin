import sys
from PIL import Image, ImageDraw, ImageFont
plate=Image.open('bg_plate_512x384_bright.png').convert('RGBA')
host=Image.open('host_sprite_v1.png')
font=ImageFont.truetype('neodgm.ttf',16)
def mock(box,title,hostpos=None):
    x0,y0,x1,y1=box; s=512/(x1-x0)
    bg=plate.crop(box).resize((512,384),Image.NEAREST)
    hs=host.resize((round(256*s),round(256*s)),Image.NEAREST)
    hx,hy=hostpos if hostpos else (round((-6-x0)*s),round((65-y0)*s))
    bg.alpha_composite(hs,(hx,hy)) if hx>=0 else bg.paste(hs,(hx,hy),hs)
    d=ImageDraw.Draw(bg)
    d.rectangle((70,40,325,295),outline=(255,60,60),width=1)
    d.rectangle((362,60,500,290),fill=(25,15,15),outline=(220,180,80),width=2)
    d.text((370,66),'빈 판',font=font,fill=(220,180,80))
    d.rectangle((0,296,190,340),fill=(200,20,30)); d.rectangle((190,296,512,340),fill=(240,240,240))
    d.rectangle((0,340,512,384),fill=(250,200,30))
    d.text((8,310),'상품명',font=font,fill='white'); d.text((8,354),'전화 주문',font=font,fill='black')
    out=Image.new('RGBA',(512,404),(0,0,0,255)); out.paste(bg,(0,20)); ImageDraw.Draw(out).text((6,2),title,font=font,fill='white')
    return out
a=mock((0,53,330,301),'가) 지금 자른 곳 (A컷 그대로 1.55배)')
b=mock((40,30,370,278),'나) 아치 쪽으로 옮겨 자름',hostpos=(round((-6-0)*1.55),round((65-53)*1.55)))
c=Image.new('RGBA',(1032,404),(0,0,0,255)); c.paste(a,(0,0)); c.paste(b,(520,0))
c.resize((2064,808),Image.NEAREST).save('/mnt/project-files/망상홈쇼핑_1109/cutB_crop_compare_x2.png')
