# 랭크 별(코드 그림): 다섯 꼭지 별을 다각형으로 채운 뒤 위 밝게·아래 어둡게 입체 음영 + 어두운 윤곽. 토큰 테두리 위쪽에 겹쳐 그림.
# 사용: python3 tools/badges/rank_star.py <출력.png>
import sys, math
from PIL import Image
B = 'game-src/art/ui/badges/'
toks = {k: Image.open(B + f'sheet1_완성{s}.png').convert('RGBA').crop((0, 0, 64, 64)) for k, s in (('gold', '_gold'), ('silver', ''), ('bronze', '_bronze'))}
RAMP = {'gold': [(110, 70, 10), (220, 170, 40), (255, 245, 180)], 'silver': [(90, 95, 110), (190, 196, 208), (255, 255, 255)],
        'bronze': [(90, 45, 20), (200, 120, 60), (255, 215, 170)]}
DK = (20, 22, 30, 255)
def inside(px, py, cx, cy, R, r):
    pts = []
    for i in range(10):
        a = -math.pi/2 + i*math.pi/5; rr = R if i % 2 == 0 else r
        pts.append((cx + rr*math.cos(a), cy + rr*math.sin(a)))
    c = False; j = len(pts)-1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > py) != (yj > py) and px < (xj-xi)*(py-yi)/(yj-yi)+xi: c = not c
        j = i
    return c
def draw_star(im, cx, cy, R, ratio, g):
    r = R*ratio; pts = set()
    for y in range(int(cy-R-1), int(cy+R+2)):
        for x in range(int(cx-R-1), int(cx+R+2)):
            if inside(x+.5, y+.5, cx, cy, R, r): pts.add((x, y))
    for x, y in pts:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x+dx, y+dy)
                if q not in pts: im.putpixel(q, DK)
    lo, mid, hi = RAMP[g]
    for x, y in pts:
        # 빛은 왼쪽 위: 꼭지 방향 면 나눔(중심선 기준 왼쪽 위 = 밝음, 오른쪽 아래 = 어두움)
        ang = math.atan2(y+.5-cy, x+.5-cx)
        sector = (ang + math.pi/2) % (2*math.pi/5) < (math.pi/5)
        col = hi if sector else mid
        if (x+.5-cx) + (y+.5-cy) > R*0.55: col = lo if not sector else mid
        im.putpixel((x, y), col + (255,))
VARS = [(4.5, .45, 7), (5.5, .45, 7), (6.5, .42, 8)]  # (바깥 반지름, 안쪽 비율, 중심 y)
C = 70
out = Image.new('RGBA', (3*3*C + 2*12, len(VARS)*C), (40, 44, 60, 255))
for gi, g in enumerate(('gold', 'silver', 'bronze')):
    for vi, (R, ratio, cy) in enumerate(VARS):
        for k in range(3):
            im = toks[g].copy()
            if k: 
                xs = [32] if k == 1 else [32 - R - 2, 32 + R + 2]
                for x in xs: draw_star(im, x, cy, R, ratio, g)
            out.alpha_composite(im, (gi*(3*C+12) + k*C + 3, vi*C + 3))
out.resize((out.width*3, out.height*3), Image.NEAREST).save(sys.argv[1])
