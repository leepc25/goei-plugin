# 검수용 판: python3 sheet.py <클립 폴더 상위> 출력.png [칸 크기]
import sys,os
from PIL import Image,ImageDraw
root=sys.argv[1]; out=sys.argv[2]; S=int(sys.argv[3]) if len(sys.argv)>3 else 128
names=sorted(d for d in os.listdir(root) if os.path.isdir(f'{root}/{d}'))
rows=[]
for n in names:
    fs=sorted(f for f in os.listdir(f'{root}/{n}') if f.endswith('.png'))
    row=Image.new('RGBA',(S*16,S),(60,70,76,255))
    for i,f in enumerate(fs[:16]): row.alpha_composite(Image.open(f'{root}/{n}/{f}').convert('RGBA').resize((S,S),Image.NEAREST),(i*S,0))
    ImageDraw.Draw(row).text((2,2),n,fill=(255,255,0,255)); rows.append(row)
sh=Image.new('RGBA',(S*16,S*len(rows)),(20,20,24,255))
for j,r in enumerate(rows): sh.alpha_composite(r,(0,j*S))
sh.save(out); print(len(rows))
