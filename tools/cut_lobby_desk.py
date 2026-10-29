# 로비 안내 데스크를 lobby.png에서 투명 오브젝트로 오린다 (2026-10-25).
# python3 tools/cut_lobby_desk.py game-src/art/field/hq/lobby.png game-src/art/field/objects/lobby/desk.png
import sys
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
src,out=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGBA'); a=np.array(im).astype(int)
H,W=a.shape[:2]
m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m)
# 데스크 몸체(상판 앞면·원목·받침·오른쪽 꺾임)
d.polygon([(494,316),(1060,316),(1062,307),(1088,297),(1137,297),(1137,420),(1113,466),(1073,466),(1073,463),(507,463),(507,445),(501,445),(501,336),(494,336)],fill=255)
# 모니터
d.rectangle((729,270,825,316),fill=255)
# 화분 몸통
d.polygon([(552,280),(613,280),(611,314),(555,314)],fill=255)
# 잎·꽃: 색으로 고름
box=(520,203,642,300)
x0,y0,x1,y1=box
r,g,b=a[y0:y1,x0:x1,0],a[y0:y1,x0:x1,1],a[y0:y1,x0:x1,2]
leaf=((g>=r-14)&(g>b+18))|((r>205)&(g>205)&(b>195)&(abs(r-b)<30))
lm=Image.fromarray((leaf*255).astype('uint8'))
lm=lm.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))  # 구멍 메움
# 12px 미만 조각 버림(8방향 연결)
la=np.array(lm)>0; keep=np.zeros_like(la); seen=np.zeros_like(la)
for sy,sx in zip(*np.nonzero(la)):
    if seen[sy,sx]: continue
    st=[(sy,sx)]; seen[sy,sx]=1; comp=[]
    while st:
        y,x=st.pop(); comp.append((y,x))
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                ny,nx=y+dy,x+dx
                if 0<=ny<la.shape[0] and 0<=nx<la.shape[1] and la[ny,nx] and not seen[ny,nx]:
                    seen[ny,nx]=1; st.append((ny,nx))
    if len(comp)>=12:
        for y,x in comp: keep[y,x]=1
m.paste(255,(x0,y0),Image.fromarray((keep*255).astype('uint8')))
im.putalpha(m)
bb=m.getbbox(); obj=im.crop(bb); obj.save(out)
print('bbox',bb)
