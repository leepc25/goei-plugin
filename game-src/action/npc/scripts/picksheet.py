# 후보 그림을 한 장에 3배로 모아 봄. 사용: python3 picksheet.py 태그 id... (각 id의 모든 번호) -> ../review/pick-<태그>.png
import sys,os,re
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); B=os.path.join(HERE,'../base')
tag=sys.argv[1]; rows=[]
for id in sys.argv[2:]:
    fs=sorted([f for f in os.listdir(B) if re.fullmatch(re.escape(id)+r'-\d+\.png',f)],key=lambda f:int(f.split('-')[-1][:-4]))
    rows.append(fs)
s=3; W=96*s; n=max(len(r) for r in rows)
sheet=Image.new('RGBA',(W*n,W*len(rows)),(44,56,62,255)); d=ImageDraw.Draw(sheet)
for y,r in enumerate(rows):
    for x,f in enumerate(r):
        im=Image.open(f'{B}/{f}').convert('RGBA'); im=im.resize((im.width*s,im.height*s),Image.NEAREST)
        sheet.alpha_composite(im,(x*W,y*W+W-im.height)); d.text((x*W+4,y*W+4),f,fill=(255,255,0,255))
sheet.save(os.path.join(HERE,f'../review/pick-{tag}.png'))
