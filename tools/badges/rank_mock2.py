# 랭크 표시 시안 2(코드만): 표시는 토큰 위에 겹쳐 그린다(토큰 밖으로 안 나감). 랭크1 = 없음, 2·3만.
# 줄 = 테두리 위 별 · 겹테 · 테두리 아래 보석 · 테두리 아래 로마숫자. 칸 = 랭크1·2·3, 판 = 금·은·동.
import sys, math
from PIL import Image
B = 'game-src/art/ui/badges/'
toks = {k: Image.open(B + f'sheet1_완성{s}.png').convert('RGBA').crop((0, 0, 64, 64)) for k, s in (('gold', '_gold'), ('silver', ''), ('bronze', '_bronze'))}
HI = {'gold': (255, 240, 170), 'silver': (250, 252, 255), 'bronze': (250, 200, 150)}
GEM = {'gold': (220, 40, 50), 'silver': (60, 130, 230), 'bronze': (40, 170, 110)}
DK = (20, 22, 30, 255)
def outline(im, pts):
    s = set(pts)
    for x, y in pts:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x+dx, y+dy)
                if q not in s and im.getpixel(q)[3] > 0: im.putpixel(q, DK)
def fill(im, pts, col):
    for p in pts: im.putpixel(p, col + (255,))
def star(cx, cy):  # 7x7 별
    rows = ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "##...##"]
    return [(cx-3+x, cy-3+y) for y, r in enumerate(rows) for x, ch in enumerate(r) if ch == '#']
def gem(cx, cy):  # 5x5 마름모 + 반짝 한 점
    return [(cx+dx, cy+dy) for dx in range(-2, 3) for dy in range(-2, 3) if abs(dx)+abs(dy) <= 2]
def roman(n, x, y):
    w = n*2 + (n-1) + 2; pts = []
    for i in range(n):
        for yy in range(6): pts += [(x+1+i*3, y+yy), (x+2+i*3, y+yy)]
    pts += [(x+xx, y) for xx in range(w)] + [(x+xx, y+5) for xx in range(w)]
    return pts, w
def cell(g, m, rank):
    im = toks[g].copy()
    if rank == 1: return im
    cx, cy = 32, 32
    if m == 'star':
        xs = [cx] if rank == 2 else [cx-6, cx+6]
        for x in xs:
            y = 6 + (0 if rank == 2 else 1)
            p = star(x, y); outline(im, p); fill(im, p, HI[g])
    elif m == 'ring':
        px = im.load()
        for k in range(rank-1):
            r0 = 24.5 - k*2.5
            for y in range(64):
                for x in range(64):
                    r = math.hypot(x+.5-cx, y+.5-cy)
                    if r0-.6 <= r <= r0+.6: px[x, y] = HI[g] + (255,)
                    elif r0+.6 < r <= r0+1.4: px[x, y] = DK
    elif m == 'gem':
        xs = [cx] if rank == 2 else [cx-5, cx+5]
        for x in xs:
            p = gem(x, 57); outline(im, p); fill(im, p, GEM[g]); im.putpixel((x-1, 56), (255, 255, 255, 255))
    elif m == 'roman':
        p, w = roman(rank, 0, 0); p = [(a + cx - w//2, b + 54) for a, b in p]; outline(im, p); fill(im, p, HI[g])
    return im
rows = ['star', 'ring', 'gem', 'roman']; C = 70
out = Image.new('RGBA', (3*3*C + 2*12, 4*C), (40, 44, 60, 255))
for gi, g in enumerate(('gold', 'silver', 'bronze')):
    for ri, m in enumerate(rows):
        for k in range(3):
            out.alpha_composite(cell(g, m, k+1), (gi*(3*C+12) + k*C + 3, ri*C + 3))
out.resize((out.width*3, out.height*3), Image.NEAREST).save(sys.argv[1])
