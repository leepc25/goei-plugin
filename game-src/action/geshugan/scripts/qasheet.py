# 장 단위 검수판: 클립마다 줄, 한 줄 최대 8장(넘치면 다음 줄), 2배, 장 번호 표시. 사용: python3 qasheet.py out.png 클립...
import sys,os
from PIL import Image,ImageDraw
out,names=sys.argv[1],sys.argv[2:]
CW,CH,PER=120,124,8
rows=[]
for n in names:
    d=f'clips/{n}'
    if not os.path.isdir(d): continue
    fs=sorted(f for f in os.listdir(d) if f.endswith('.png'))
    for k in range(0,len(fs),PER):
        part=fs[k:k+PER]; row=Image.new('RGBA',(CW*PER,CH),(120,130,140,255)); dr=ImageDraw.Draw(row)
        for i,f in enumerate(part):
            row.alpha_composite(Image.open(f'{d}/{f}').convert('RGBA').crop((10,20,130,144)),(CW*i,0))
            dr.line([(CW*i,0),(CW*i,CH)],fill=(90,100,110,255)); dr.line([(CW*i,116),(CW*i+CW,116)],fill=(160,120,120,255))
            dr.text((CW*i+3,12),str(k+i),fill=(255,255,255,255))
        dr.text((2,1),n+(' (이어서)' if k else ''),fill=(255,255,0,255)); rows.append(row)
o=Image.new('RGBA',(CW*PER,CH*len(rows)),(90,90,90,255))
for i,r in enumerate(rows): o.alpha_composite(r,(0,CH*i))
o.resize((o.width*2,o.height*2),Image.NEAREST).save(out)
