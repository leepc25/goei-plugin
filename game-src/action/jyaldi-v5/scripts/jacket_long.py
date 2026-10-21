"""기준표 A의 재킷을 엉덩이까지 손으로 늘린다 (생성 없음, 무료).
출력: sheet8/a-jacket-long.png, 비교판 sheet8/compare.png (A | 고친 판)."""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent.parent
A = Image.open(HERE / 'sheet7/jyaldi-base-pixen-a.png').convert('RGBA')

K = (0, 0, 0, 255)
C3 = (26, 30, 33, 255)    # 가장 어두움
C5 = (29, 33, 37, 255)
CA = (32, 37, 41, 255)
C9 = (43, 49, 54, 255)
CF = (48, 57, 65, 255)
C1 = (62, 77, 89, 255)    # 기본
C2 = (65, 81, 94, 255)
CM = (70, 87, 100, 255)
CN = (99, 121, 137, 255)  # 앞섶 빛

# 자락: 허리(y44) → 엉덩이 뒤로 살짝 부풀고 → 밑단 y57 → 앞섶은 거의 수직
POLY = [(32, 43), (52, 43), (52, 48), (51, 53), (48, 55), (42, 57), (35, 58), (30, 58), (28, 55), (28, 50), (30, 46)]


def tone(x, y):
    if x <= 30:
        c = C3
    elif x <= 33:
        c = CA
    elif x <= 37:
        c = C9
    elif x <= 45:
        c = C1
    else:
        c = C2
    if y >= 56:  # 밑단 쪽 한 단계 어둡게
        c = {C1: CF, C2: C1, C9: CA, CA: C5}.get(c, c)
    return c


def build():
    out = A.copy()
    m = Image.new('L', A.size, 0)
    ImageDraw.Draw(m).polygon(POLY, fill=255)
    px, mp = out.load(), m.load()
    W, H = A.size
    inside = lambda x, y: 0 <= x < W and 0 <= y < H and mp[x, y]
    cells = [(x, y) for y in range(43, H) for x in range(W) if mp[x, y]]
    src = A.load()
    for x, y in cells:
        # 몸통 재킷 질감(39~42줄)을 아래로 이어 붙임; 검정·흰색은 평면 색으로 대체
        sy = 39 + (y - 43) % 4
        sx = min(max(x + (y - 43) // 6, 33), 45)
        c = src[sx, sy]
        if c[3] == 0 or c == K or sum(c[:3]) > 400:
            c = tone(x, y)
        if x <= 30:
            c = C3
        elif x >= 47:
            c = C2 if y % 3 else CM
        px[x, y] = c if y < 56 else {C1: CF, C2: C1}.get(c, c)
    # 엉덩이 주름 두 줄(어두운 선 + 옆 밝은 선)
    for y in range(47, 57):
        fx = 40 - (y - 47) // 5
        px[fx, y] = C5
        px[fx + 1, y] = CM
    for y in range(50, 57):
        px[34, y] = CA
    # 테두리: 위쪽(몸통과 이어지는 곳) 빼고 검은 외곽선
    for x, y in cells:
        if y <= 44:
            continue
        if any(not inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1))):
            px[x, y] = K
    # 앞섶 하이라이트: 오른쪽 외곽선 바로 안쪽
    for y in range(45, 57):
        xs = [x for x in range(W) if inside(x, y)]
        if xs:
            px[max(xs) - 1, y] = CN
    # 밑단 아래 바지에 그림자 한 줄
    for x in range(W):
        ys = [y for y in range(H) if inside(x, y)]
        if ys:
            y = max(ys) + 1
            if y < H and A.getpixel((x, y))[3] and A.getpixel((x, y)) != K:
                px[x, y] = C3
    return out


long_ = build()
(HERE / 'sheet8').mkdir(exist_ok=True)
long_.save(HERE / 'sheet8/a-jacket-long.png')

S = 6
bb = A.getbbox()
cw, ch = bb[2] - bb[0], bb[3] - bb[1]
for name, bgc in (('compare.png', (214, 210, 200, 255)), ('compare-dark.png', (40, 44, 52, 255))):
    sheet = Image.new('RGBA', (cw * S * 2 + 30, ch * S + 20), bgc)
    for i, im in enumerate((A, long_)):
        sheet.alpha_composite(im.crop(bb).resize((cw * S, ch * S), Image.NEAREST), (10 + i * (cw * S + 10), 10))
    sheet.save(HERE / 'sheet8' / name)
