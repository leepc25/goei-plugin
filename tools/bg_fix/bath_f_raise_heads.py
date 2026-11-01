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
# 사용자 15:59 「받침을 기준으로 받침까지 올리고 밑에 끈(호스)을 늘리고」: (x0, y0, x1, yl, yk) — yk 받침 밑, yl 수도꼭지 위(호스 끝)
FX = {2: (178, 148, 212, 255, 187), 3: (222, 158, 253, 245, 192), 4: (455, 148, 490, 254, 186), 5: (486, 163, 516, 245, 193),
      6: (638, 160, 683, 244, 193), 7: (678, 146, 711, 254, 186)}
BOX = {n: (a, b, c, d) for n, (a, b, c, d, e) in FX.items()}
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
for n, (x0, y0, x1, y1) in BOX.items(): FIX[y0:y1 + 45, x0:x1] = True  # 아래 수도꼭지도 배경 출처에서 뺌
KEEP = [(640, 185, 666, 214)]  # 칸 안에 걸친 병(6번 옆) — 건드리지 않음
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
orig = img.copy(); res = {}; PASTED = np.zeros((H, W), bool)
for n, (x0, y0, x1, y1) in BOX.items():
    B = background(x0, y0, x1, y1)
    d = np.abs(orig[y0:y1, x0:x1, :3].astype(int) - B[..., :3].astype(int)).sum(2)
    m0 = d > 45
    # 꼭지에 붙은 큰 덩어리만(8방향 연결, 120px 이상) + 구멍 채우기
    h_, w_ = m0.shape; lab = np.zeros(m0.shape, bool); keep = np.zeros(m0.shape, bool)
    for sy0 in range(h_):
        for sx0 in range(w_):
            if m0[sy0, sx0] and not lab[sy0, sx0]:
                st = [(sy0, sx0)]; lab[sy0, sx0] = True; pts = []
                while st:
                    y, x = st.pop(); pts.append((y, x))
                    for yy in (y - 1, y, y + 1):
                        for xx in (x - 1, x, x + 1):
                            if 0 <= yy < h_ and 0 <= xx < w_ and m0[yy, xx] and not lab[yy, xx]: lab[yy, xx] = True; st.append((yy, xx))
                if len(pts) >= 120:
                    for y, x in pts: keep[y, x] = True
    out_ = np.zeros(keep.shape, bool); st = [(y, x) for y in range(h_) for x in (0, w_ - 1)] + [(0, x) for x in range(w_)]
    while st:
        y, x = st.pop()
        if out_[y, x] or keep[y, x]: continue
        out_[y, x] = True
        for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= yy < h_ and 0 <= xx < w_: st.append((yy, xx))
    core = ~out_
    ring = core.copy(); ring[1:] |= core[:-1]; ring[:-1] |= core[1:]; ring[:, 1:] |= core[:, :-1]; ring[:, :-1] |= core[:, 1:]
    ring &= ~core
    # 테두리 한 줄은 어두운 윤곽(밝기<90)만 물건으로 — 밝은 타일·줄눈은 옮기지 않음(얼룩 원인)
    m1 = core | (ring & (L[y0:y1, x0:x1] < 90))
    # 2차 배경: 물건(넓힌 마스크)이 아닌 같은 세로줄 픽셀을 주기 배수만큼 가장 가까운 데서 — 칸 안 깨끗한 타일 우선, 바닥·수도꼭지(yl+3 아래)는 안 씀
    bad = m1.copy()
    for _ in range(2):
        t_ = bad.copy(); t_[1:] |= bad[:-1]; t_[:-1] |= bad[1:]; t_[:, 1:] |= bad[:, :-1]; t_[:, :-1] |= bad[:, 1:]; bad = t_
    BAD = np.zeros((H, W), bool); BAD[y0:y1, x0:x1] = bad
    B = orig[y0:y1, x0:x1].copy()
    for x in range(x0, x1):
        p_ = col_period(x, y0 - 30, y1)
        t = wall_top(x)
        for y in range(y0, y1):
            for k in range(1, 15):
                ok = False
                for sy in (y + k * p_, y - k * p_):
                    if sy < 0 or sy >= y1 + 3 or BAD[sy, x]: continue
                    if t is not None and sy <= t + 2: continue
                    B[y - y0, x - x0] = orig[sy, x]; ok = True; break
                if ok: break
    m = np.zeros((H, W), bool); m[y0:y1, x0:x1] = m1
    for a, b, c, e in KEEP: m[b:e, a:c] = False
    ys, xs = np.nonzero(m)
    dy = MAXDY; res[n] = dy  # 받침이 벽에 붙어 있으니 헤드는 벽 윗선 위로 넘어가도 됨 (사용자 15:59) — 모두 같은 높이
    yk = FX[n][4]; yl = y1
    me = m.copy()  # 지울 땐 두 칸 더 넓혀 옛 헤드 가장자리 찌꺼기까지
    for _ in range(2):
        t_ = me.copy(); t_[1:] |= me[:-1]; t_[:-1] |= me[1:]; t_[:, 1:] |= me[:, :-1]; t_[:, :-1] |= me[:, 1:]; me = t_
    me[:, :x0] = False; me[:, x1:] = False; me[:y0] = False; me[y1:] = False
    for a, b, c, e in KEEP: me[b:e, a:c] = False
    for y, x in zip(*np.nonzero(me)): img[y, x] = B[y - y0, x - x0]
    for y, x in zip(ys, xs):
        if y < yk: img[y - dy, x] = orig[y, x]; PASTED[y - dy, x] = True        # 헤드·받침: 통째로 위로
    Lh = yl - yk
    for y in range(yk - dy, yl):                       # 호스: 받침 밑~수도꼭지 위를 세로로 늘임
        sy = int(round(yl - (yl - y) * Lh / (Lh + dy)))
        sy = min(max(sy, yk), yl - 1)
        for x in range(x0, x1):
            if m[sy, x]: img[y, x] = orig[sy, x]; PASTED[y, x] = True
# 칸막이 벽 세로 모서리선(벽 A x243, B x500, C x650·651)은 옛 헤드가 가리던 줄을 같은 세로줄 깨끗한 줄(y220)로 되살림
for xe, ytop in ((243, 150), (500, 152), (650, 149), (651, 149)):
    for y in range(ytop, 250):
        if not PASTED[y, xe] and any(b[0] <= xe < b[2] and b[1] <= y < b[3] for b in BOX.values()):
            img[y, xe] = orig[220, xe]
Image.fromarray(img).save(out)
print('올린 px(1x):', res)
