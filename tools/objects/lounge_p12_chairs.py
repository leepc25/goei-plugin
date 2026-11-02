"""휴게실 p12s 위에 쉘 의자 4방향 배치(1배 그대로, 저장 2배). python3 lounge_p12_chairs.py <out.png>"""
import sys
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2]
import os
BK=float(os.environ.get('BK','1'))  # 배경 확대 배율(의자는 1배 원본 그대로)
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_lounge_p12s.png').convert('RGBA')
if BK!=1: bg=bg.resize((round(bg.width*BK),round(bg.height*BK)),Image.NEAREST)
CH=R/'game-src/art/objects/chairs_shell/fit'
import os
SC=float(os.environ.get('SC','1'))  # 1배 원본에서 바로 줄임(확대 거치지 않음)
def ch(d):
    im=Image.open(CH/f'{d}.png').convert('RGBA')
    if SC!=1:
        n=Image.new('RGBA',(200,200),(0,0,0,0)); s=im.resize((round(200*SC),round(200*SC)),Image.NEAREST)
        n.alpha_composite(s,(100-round(100*SC),171-round(171*SC))); im=n   # 가운데 x100·바닥 y171 유지
    return im
# 테이블(1배 잰 값): 상판 x범위, 가운데
TABLES=[(round(a*BK),round(b*BK)) for a,b in [(39,159),(260,370),(472,592)]]
FOOT_BACK, FOOT_FRONT, FOOT_SIDE = [round(v*BK) for v in (352, 402, 378)]   # 의자 발 y
items=[]  # (그리는 순서 y, img, x, y)
for x0,x1 in TABLES:
    cx=(x0+x1)//2
    items.append((FOOT_BACK, ch('south'), cx-100, FOOT_BACK-171))     # 테이블 뒤, 보는 사람 쪽을 봄
    items.append((FOOT_FRONT, ch('north'), cx-100, FOOT_FRONT-171))   # 테이블 앞, 등이 보임
    e=ch('east'); b=e.getbbox(); items.append((FOOT_SIDE, e, x0+8-b[2], FOOT_SIDE-171))    # 왼쪽, 테이블 쪽을 봄(좌판 앞끝이 테이블 밑으로 8px)
    w=ch('west'); b=w.getbbox(); items.append((FOOT_SIDE, w, x1-8-b[0], FOOT_SIDE-171))  # 오른쪽
# 테이블 앞부분(앞다리)은 뒤 의자보다 앞, 앞 의자보다 뒤 → 배경 그대로 두고, 뒤 의자는 테이블 픽셀 뒤로 숨김
tab_mask=Image.new('L',bg.size,0)
out=bg.copy()
for y,img,x,yy in sorted(items,key=lambda t:t[0]):
    layer=Image.new('RGBA',bg.size,(0,0,0,0)); layer.alpha_composite(img,(x,yy)) if x>=0 else layer.paste(img,(x,yy),img)
    if y==FOOT_BACK:
        # 테이블 상판·다리 영역(사각) 뒤로: 그 영역에선 배경을 다시 위에
        for x0,x1 in TABLES:
            box=(x0,round(296*BK),x1+1,round(388*BK))
            layer.paste((0,0,0,0),box,bg.crop(box).split()[3].point(lambda a:0) if False else None) if False else None
    out.alpha_composite(layer)
    if y==FOOT_BACK:
        for x0,x1 in TABLES:
            # 테이블 픽셀(상판 띠 + 다리) 다시 그리기: 상판 y296~321 전체, 다리는 어두운 세로줄만
            box=(x0-2,round(296*BK),x1+3,round(322*BK)); out.paste(bg.crop(box),box[:2])
out.save(sys.argv[1])  # 1배 그대로 저장(사용자 04:32 「2배 적용 안 하고」)
