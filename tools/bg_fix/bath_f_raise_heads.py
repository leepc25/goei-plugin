"""여자 샤워실(확정 hq_bath_f_p5_extL1) 샤워기 꼭지·받침을 코드로 위로 올린다 (사용자 2026-11-01 15:52 「샤워기를 코드로 위로 전부 올릴 수 있나」).
1) 꼭지 둘레 칸에서 검은 윤곽선(밝기<70)과 그 안쪽을 물건 마스크로 딴다(픽셀 단위, 위·옆 테두리에서 닿는 곳은 바깥).
2) 마스크 자리는 같은 세로줄의 타일을 그 줄 타일 주기만큼 위아래에서 가져와 지운다.
3) 마스크를 dy만큼 위로 옮겨 붙이고, 칸 맨 아래 호스 줄을 dy줄 늘여 원래 호스와 잇는다.
dy = 칸막이 벽 윗선 밑 3px까지(최대 MAXDY)."""
import sys
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
MAXDY = int(sys.argv[3]) if len(sys.argv) > 3 else 20
img = np.asarray(Image.open(src).convert('RGBA')).copy()
L = img[..., :3].astype(int).mean(2)
H, W = L.shape
# 칸 (x0, y0, x1, y1): 꼭지·받침·곧은 호스 윗부분, 맨 아래 줄은 호스를 자르는 자리
BOX = {2: (178, 148, 212, 206), 3: (222, 158, 253, 206), 4: (455, 148, 490, 206), 5: (486, 163, 516, 208),
       6: (642, 163, 672, 208), 7: (668, 148, 701, 206)}
TOP = [((150, 105), (243, 150)), ((440, 105), (500, 152)), ((655, 149), (712, 105))]  # 칸막이 벽 윗선
def wall_top(x):
    for (ax, ay), (bx, by) in TOP:
        if ax <= x <= bx: return ay + (by - ay) * (x - ax) / (bx - ax)
    return None
def mask_of(x0, y0, x1, y1):
    dark = L[y0:y1, x0:x1] < 70
    h, w = dark.shape; reach = np.zeros_like(dark); st = []
    for x in range(w):
        if not dark[0, x]: st.append((0, x))
    for y in range(h):
        for x in (0, w - 1):
            if not dark[y, x]: st.append((y, x))
    while st:
        y, x = st.pop()
        if reach[y, x] or dark[y, x]: continue
        reach[y, x] = True
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < h and 0 <= xx < w and not reach[yy, xx] and not dark[yy, xx]: st.append((yy, xx))
    return ~reach
FIX = np.zeros((H, W), bool)
for n, (x0, y0, x1, y1) in BOX.items(): FIX[y0:y1, x0:x1] = True
KEEP = [(630, 184, 661, 214)]  # 칸 안에 걸친 병(6번 옆) — 건드리지 않음
def col_period(x, y0, y1):
    c = L[y0:y1, x]; best, bp = 1e9, 10
    for p in range(8, 16):
        e = np.abs(c[p:] - c[:-p]).mean()
        if e < best: best, bp = e, p
    return bp
def background(x0, y0, x1, y1):
    """칸 밖(아래 먼저, 그다음 위) 같은 세로줄 타일을 주기만큼 옮겨 온 배경 추정. 벽 면 줄은 벽 윗선 아래에서만 가져옴."""
    B = img[y0:y1, x0:x1].copy()
    for x in range(x0, x1):
        p = col_period(x, y1, y1 + 50)
        t = wall_top(x)
        for y in range(y0, y1):
            got = False
            for k in range(1, 12):
                for sy in (y + k * p, y - k * p):
                    if 0 <= sy < H and not FIX[sy, x] and (t is None or sy > t + 2) and not (y1 <= sy < y1 + 2):
                        B[y - y0, x - x0] = img[sy, x]; got = True; break
                if got: break
    return B
orig = img.copy(); res = {}
for n, (x0, y0, x1, y1) in BOX.items():
    B = background(x0, y0, x1, y1)
    d = np.abs(orig[y0:y1, x0:x1, :3].astype(int) - B[..., :3].astype(int)).sum(2)
    m0 = d > 45
    m1 = m0.copy()  # 한 칸 넓혀 테두리 그림자까지
    m1[1:] |= m0[:-1]; m1[:-1] |= m0[1:]; m1[:, 1:] |= m0[:, :-1]; m1[:, :-1] |= m0[:, 1:]
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = m1
    for a, b, c, e in KEEP: m[b:e, a:c] = False
    ys, xs = np.nonzero(m)
    dy = MAXDY
    for y, x in zip(ys, xs):
        t = wall_top(x)
        if t is not None and y < y0 + 30: dy = min(dy, int(y - t) - 3)
    dy = max(0, dy); res[n] = dy
    for y, x in zip(ys, xs): img[y, x] = B[y - y0, x - x0]
    for y, x in zip(ys, xs): img[y - dy, x] = orig[y, x]
    yb = y1 - 1
    for x in range(x0, x1):
        if m[yb, x]:
            for y in range(yb - dy, yb + 1): img[y, x] = orig[yb, x]
Image.fromarray(img).save(out)
print('올린 px(1x):', res)
