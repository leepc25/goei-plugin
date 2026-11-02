"""손으로 사타구니 점 찍기용 확대 그림(11-02): 정면 앉기 끝 장의 허리~무릎 부분을 4배로, 5px 격자와 좌표 숫자.
  python3 tools/objects/office_pick_grid.py out.png 키,키,...   (lid 기본 60, LID=96/61 로 바꿈)
"""
import sys, os
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
A=sys.argv[1:]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',12)
out,ks=A[0],A[1].split(','); lid=os.environ.get('LID','60'); Z=int(os.environ.get('Z',3))
Y0,Y1=int(os.environ.get('Y0',140)),int(os.environ.get('Y1',215))
MK=[m.split(':') for m in os.environ.get('MARK','').split(',')] if os.environ.get('MARK') else []
cells=[]
for i,k in enumerate(ks):
    c,_=fc.load(k); im=fc.last(c,lid); bb=im.getbbox(); x0,x1=max(0,bb[0]-2),min(im.size[0],bb[2]+2)
    T=Image.new('RGBA',im.size,(170,165,150,255)); T.alpha_composite(im); T=T.crop((x0,Y0,x1,Y1)).resize(((x1-x0)*Z,(Y1-Y0)*Z),Image.NEAREST)
    d=ImageDraw.Draw(T)
    for y in range(Y0,Y1):
        if y%10==0: d.line([(0,(y-Y0)*Z),(T.width,(y-Y0)*Z)],fill=(255,0,0)); d.text((1,(y-Y0)*Z),str(y),fill=(255,0,0),font=F)
    for x in range(x0,x1):
        if x%10==0: d.line([((x-x0)*Z,0),((x-x0)*Z,T.height)],fill=(0,90,255)); d.text(((x-x0)*Z+1,T.height-14),str(x),fill=(0,60,255),font=F)
    if i<len(MK):
        mx,my=(float(MK[i][0])-x0)*Z+Z/2,(float(MK[i][1])-Y0)*Z+Z/2; d.line([(mx-10,my),(mx+10,my)],fill=(255,0,255),width=2); d.line([(mx,my-10),(mx,my+10)],fill=(255,0,255),width=2)
    L=Image.new('RGB',(T.width,T.height+16),(20,20,20)); L.paste(T.convert('RGB'),(0,16)); ImageDraw.Draw(L).text((2,1),k,fill=(255,255,255),font=F)
    cells.append(L)
W=sum(c.width for c in cells); H=max(c.height for c in cells); S=Image.new('RGB',(W,H),(0,0,0)); x=0
for c in cells: S.paste(c,(x,0)); x+=c.width
S.save(out); print(out,S.size)
