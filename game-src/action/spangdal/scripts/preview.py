# 뼈대 미리보기(무료): 클립마다 한 줄, 장마다 몸 둘레만 잘라 3배. 첫 칸 = 기준 그림 위 A_KP 맞춤
import sys,rig
from PIL import Image,ImageDraw
CX0,CY0,CW,CH=10,30,150,114; S=2
def cell(p,base=None):
    im=rig.draw(p,base,1).crop((CX0,CY0,CX0+CW,CY0+CH)); return im.resize((CW*S,CH*S),Image.NEAREST)
def strip(n,base):
    ps=rig.CLIPS[n][2]; row=Image.new('RGBA',(CW*S*(len(ps)+1),CH*S),(30,34,40,255))
    row.alpha_composite(cell(rig.A_KP,base),(0,0))
    for i,p in enumerate(ps): row.alpha_composite(cell(p),((i+1)*CW*S,0))
    d=ImageDraw.Draw(row); d.text((6,6),n,fill=(255,255,0,255)); return row
if __name__=='__main__':
    base=Image.open('../base/S0-pad.png').convert('RGBA'); out=sys.argv[1]
    rows=[strip(n,base) for n in sys.argv[2:]]
    w=max(r.width for r in rows); sheet=Image.new('RGBA',(w,sum(r.height for r in rows)),(20,20,20,255)); y=0
    for r in rows: sheet.alpha_composite(r,(0,y)); y+=r.height
    sheet.save(out)
