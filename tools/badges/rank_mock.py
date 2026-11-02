# 랭크 표시 시안(코드만): 랭크1 = 표시 없음, 2·3만. 줄 = 방법(점·로마숫자·테두리 불빛·꺾쇠), 칸 = 랭크1·2·3, 판 = 금·은·동.
# 사용: python3 tools/badges/rank_mock.py <출력.png>
import sys, math
from PIL import Image
B = 'game-src/art/ui/badges/'
toks = {k: Image.open(B + f'sheet1_완성{s}.png').convert('RGBA').crop((0, 0, 64, 64)) for k, s in (('gold', '_gold'), ('silver', ''), ('bronze', '_bronze'))}
HI = {'gold': (255, 236, 150), 'silver': (240, 244, 250), 'bronze': (236, 176, 120)}
MID = {'gold': (196, 146, 30), 'silver': (150, 155, 168), 'bronze': (150, 84, 40)}
DK = (20, 22, 30, 255)
CW, CH = 72, 80
def put(im, pts, col):
    for x, y in pts: im.putpixel((x, y), col)
def outline(im, pts):
    s = set(pts)
    for x, y in pts:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x+dx, y+dy)
                if q not in s and 0 <= q[0] < im.width and 0 <= q[1] < im.height: im.putpixel(q, DK)
def mark(im, pts, g):
    outline(im, pts); put(im, pts, HI[g] + (255,))
def dot(cx, cy):  # 5x5 마름모
    return [(cx+dx, cy+dy) for dx in range(-2, 3) for dy in range(-2, 3) if abs(dx)+abs(dy) <= 2]
def chev(cx, cy):  # ∧ 9x5, 굵기 2
    return [(cx+dx, cy-4+abs(dx)) for dx in range(-4, 5)] + [(cx+dx, cy-3+abs(dx)) for dx in range(-4, 5)]
def roman(n, x, y):  # I 하나 = 2x7, 사이 1칸, 위아래 가로대
    pts = []
    w = n*2 + (n-1) + 2
    for i in range(n):
        for yy in range(7): pts += [(x+1+i*3, y+yy), (x+2+i*3, y+yy)]
    pts += [(x+xx, y) for xx in range(w)] + [(x+xx, y+6) for xx in range(w)]
    return pts
def cell(g, method, rank):
    im = Image.new('RGBA', (CW, CH), (0, 0, 0, 0)); im.alpha_composite(toks[g], (4, 2))
    if rank == 1: return im
    cx, cy = 4+32, 2+32
    if method == 'dot':
        xs = [cx] if rank == 2 else [cx-5, cx+5]
        for x in xs: mark(im, dot(x, 72), g)
    elif method == 'roman':
        w = rank*2 + (rank-1) + 2
        mark(im, roman(rank, CW-6-w, CH-14), g)
    elif method == 'rim':
        a = toks[g]; px = im.load()
        for y in range(CH):
            for x in range(CW):
                r = math.hypot(x+.5-cx, y+.5-cy)
                if 26.5 <= r <= 30.5 and px[x, y][3] > 0:
                    ang = math.degrees(math.atan2(y+.5-cy, x+.5-cx))  # 0=오른쪽, 90=아래
                    if rank == 3 or ang >= 0:  # 랭크2 = 아래 반쪽
                        p = px[x, y]; px[x, y] = tuple(min(255, round(p[i]*.35 + HI[g][i]*.85)) for i in range(3)) + (255,)
    elif method == 'chev':
        ys = [73] if rank == 2 else [70, 76]
        for y in ys: mark(im, chev(cx, y), g)
    return im
rows = ['dot', 'roman', 'rim', 'chev']
out = Image.new('RGBA', (3*(3*CW)+2*12, 4*CH), (40, 44, 60, 255))
for gi, g in enumerate(('gold', 'silver', 'bronze')):
    for ri, m in enumerate(rows):
        for k in range(3):
            out.alpha_composite(cell(g, m, k+1), (gi*(3*CW+12) + k*CW, ri*CH))
out.resize((out.width*3, out.height*3), Image.NEAREST).save(sys.argv[1])
