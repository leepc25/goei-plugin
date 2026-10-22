# 생성 결과 검수 시트: ../qa/<이름>.png (클립 한 줄, 3배, 바닥선 y=136 빨강, 장 번호·머리끝·발끝 표기)
import sys,os
from PIL import Image,ImageDraw
OUT='../clips'
def stats(im):
    a=im.split()[3]; bb=a.getbbox(); return bb
def row(n,s=3):
    fs=sorted(os.listdir(f'{OUT}/{n}'))
    ims=[Image.open(f'{OUT}/{n}/{f}').convert('RGBA') for f in fs]
    w,h=ims[0].size; cw=w*s
    r=Image.new('RGBA',(cw*len(ims),h*s+14),(58,64,72,255)); d=ImageDraw.Draw(r)
    for i,im in enumerate(ims):
        r.alpha_composite(im.resize((w*s,h*s),Image.NEAREST),(i*cw,14))
        g=136 if w>100 else 88
        d.line([(i*cw,14+g*s),(i*cw+cw,14+g*s)],fill=(255,60,60,255))
        d.line([(i*cw,14),(i*cw,14+h*s)],fill=(20,20,20,255))
        bb=stats(im); d.text((i*cw+3,1),f'{n} {i} top{bb[1]} bot{bb[3]} x{bb[0]}-{bb[2]}' if bb else f'{n} {i} EMPTY',fill=(255,255,0,255))
    return r
if __name__=='__main__':
    os.makedirs('../qa',exist_ok=True)
    out=sys.argv[1]; names=sys.argv[2:]
    rows=[row(n) for n in names]
    W=max(x.width for x in rows); sh=Image.new('RGBA',(W,sum(x.height for x in rows)),(0,0,0,255)); y=0
    for x in rows: sh.alpha_composite(x,(0,y)); y+=x.height
    sh.save(out)
