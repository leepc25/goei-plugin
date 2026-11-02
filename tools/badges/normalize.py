# 판마다 다른 동전 크기·은색 톤을 1판(기준)에 맞춘다. 사용: python3 normalize.py <기준.png> <입력.png> <출력.png>
# 크기: 칸(64px)마다 불투명 영역 테두리 상자를 기준판 평균 지름에 맞춰 늘이고 가운데 놓음(nearest).
# 색: 밝기 분포를 기준판에 맞춘 뒤(히스토그램 매칭) 기준판의 「밝기→색」 표로 다시 칠함 → 다른 색(빨강·파랑)도 은색이 됨.
import sys
from PIL import Image
C = 64
def lum(p): return round(.299*p[0] + .587*p[1] + .114*p[2])
def cells(im):
    for r in range(im.height // C):
        for c in range(im.width // C):
            yield c*C, r*C
def bbox(im, x, y): return im.crop((x, y, x+C, y+C)).getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox()
ref = Image.open(sys.argv[1]).convert('RGBA'); src = Image.open(sys.argv[2]).convert('RGBA')
# 기준 지름
ws = [b[2]-b[0] for b in (bbox(ref, x, y) for x, y in cells(ref)) if b]; hs = [b[3]-b[1] for b in (bbox(ref, x, y) for x, y in cells(ref)) if b]
W = round(sorted(ws)[len(ws)//2]); H = round(sorted(hs)[len(hs)//2])
# 기준 밝기 분포·밝기→색 표
def hist(im):
    h = [0]*256
    for p in im.getdata():
        if p[3] > 8: h[lum(p)] += 1
    return h
def cdf(h):
    s = sum(h); out = []; a = 0
    for v in h: a += v; out.append(a / s)
    return out
rh = hist(ref); rc = cdf(rh)
colsum = [[0, 0, 0, 0] for _ in range(256)]
for p in ref.getdata():
    if p[3] > 8:
        l = lum(p); cs = colsum[l]; cs[0] += p[0]; cs[1] += p[1]; cs[2] += p[2]; cs[3] += 1
table = [None]*256
for l in range(256):
    if colsum[l][3]: table[l] = tuple(round(colsum[l][i]/colsum[l][3]) for i in range(3))
for l in range(256):  # 빈 칸은 가까운 값으로
    if table[l] is None:
        for d in range(1, 256):
            for k in (l-d, l+d):
                if 0 <= k < 256 and colsum[k][3]: table[l] = tuple(round(colsum[k][i]/colsum[k][3]) for i in range(3)); break
            if table[l]: break
out = Image.new('RGBA', src.size, (0, 0, 0, 0))
for x, y in cells(src):
    b = bbox(src, x, y)
    if not b: continue
    piece = src.crop((x+b[0], y+b[1], x+b[2], y+b[3])).resize((W, H), Image.NEAREST)
    out.alpha_composite(piece, (x + (C-W)//2, y + (C-H)//2))
sc = cdf(hist(out)); mp = []
j = 0
for l in range(256):
    while j < 255 and rc[j] < sc[l]: j += 1
    mp.append(j)
px = out.load()
for yy in range(out.height):
    for xx in range(out.width):
        p = px[xx, yy]
        if p[3] > 8: px[xx, yy] = table[mp[lum(p)]] + (p[3],)
out.save(sys.argv[3]); print('ref coin', W, H)
