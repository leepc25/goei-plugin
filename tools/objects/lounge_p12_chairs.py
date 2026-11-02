"""휴게실 p12s 위에 쉘 의자 4방향 배치(1배 그대로, 저장 2배). python3 lounge_p12_chairs.py <out.png>"""
import sys
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[2]
bg=Image.open(R/'game-src/art/pixellab-hq-20261031/hq_lounge_p12s.png').convert('RGBA')
CH=R/'game-src/art/objects/chairs_shell/fit'
def ch(d): return Image.open(CH/f'{d}.png').convert('RGBA')
# 테이블(1배 잰 값): 상판 x범위, 가운데
TABLES=[(39,159),(260,370),(472,592)]
FOOT_BACK, FOOT_FRONT, FOOT_SIDE = 352, 402, 378   # 의자 발 y
items=[]  # (그리는 순서 y, img, x, y)
for x0,x1 in TABLES:
    cx=(x0+x1)//2
    items.append((FOOT_BACK, ch('south'), cx-100, FOOT_BACK-171))     # 테이블 뒤, 보는 사람 쪽을 봄
    items.append((FOOT_FRONT, ch('north'), cx-100, FOOT_FRONT-171))   # 테이블 앞, 등이 보임
    items.append((FOOT_SIDE, ch('east'), x0-89+20, FOOT_SIDE-171))    # 왼쪽, 테이블 쪽(오른쪽)을 봄
    items.append((FOOT_SIDE, ch('west'), x1-111-20+3, FOOT_SIDE-171)) # 오른쪽, 왼쪽을 봄
# 테이블 앞부분(앞다리)은 뒤 의자보다 앞, 앞 의자보다 뒤 → 배경 그대로 두고, 뒤 의자는 테이블 픽셀 뒤로 숨김
tab_mask=Image.new('L',bg.size,0)
out=bg.copy()
for y,img,x,yy in sorted(items,key=lambda t:t[0]):
    layer=Image.new('RGBA',bg.size,(0,0,0,0)); layer.alpha_composite(img,(x,yy)) if x>=0 else layer.paste(img,(x,yy),img)
    if y==FOOT_BACK:
        # 테이블 상판·다리 영역(사각) 뒤로: 그 영역에선 배경을 다시 위에
        for x0,x1 in TABLES:
            box=(x0,296,x1+1,388)
            layer.paste((0,0,0,0),box,bg.crop(box).split()[3].point(lambda a:0) if False else None) if False else None
    out.alpha_composite(layer)
    if y==FOOT_BACK:
        for x0,x1 in TABLES:
            # 테이블 픽셀(상판 띠 + 다리) 다시 그리기: 상판 y296~321 전체, 다리는 어두운 세로줄만
            box=(x0-2,296,x1+3,322); out.paste(bg.crop(box),box[:2])
out.resize((out.width*2,out.height*2),Image.NEAREST).save(sys.argv[1])
