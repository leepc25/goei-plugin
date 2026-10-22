# 생성된 클립을 한 장에(줄 = 클립, 칸 = 장). 맨 앞 칸은 쟈알디 기준 그림(크기 비교). 사용: python3 clipsheet.py 태그 id:클립,클립 ... -> ../review/clips-<태그>.png
import sys,os
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); C=os.path.join(HERE,'../clips')
J=Image.open(os.path.join(HERE,'../../jyaldi-v5/full/A2-pad.png')).convert('RGBA')
tag=sys.argv[1]; rows=[]
for a in sys.argv[2:]:
    id,ns=a.split(':')
    for n in ns.split(','):
        d=f'{C}/{id}/{n}'
        if os.path.isdir(d): rows.append((f'{id}/{n}',[f'{d}/{f}' for f in sorted(os.listdir(d)) if f.endswith('.png')]))
s=2; cw,ch=130*s,124*s; n=max(len(r[1]) for r in rows)+1
im=Image.new('RGBA',(cw*n,ch*len(rows)),(44,56,62,255)); d=ImageDraw.Draw(im)
for y,(name,fs) in enumerate(rows):
    for x,f in enumerate([None]+fs):
        fr=J if f is None else Image.open(f).convert('RGBA')
        fr=fr.crop((0,20,130,144)).resize((cw,ch),Image.NEAREST)
        if f is None: fr.putalpha(fr.getchannel('A').point(lambda v:v//3))
        im.alpha_composite(fr,(x*cw,y*ch))
    d.line([(0,y*ch+116*s),(cw*n,y*ch+116*s)],fill=(90,100,110,255)); d.text((4,y*ch+4),name,fill=(255,255,0,255))
im.save(os.path.join(HERE,f'../review/clips-{tag}.png')); print(im.size)
