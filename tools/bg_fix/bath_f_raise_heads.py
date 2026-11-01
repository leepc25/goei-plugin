"""여자 샤워실(확정 hq_bath_f_p5_extL1) 샤워기 헤드+받침을 그대로 위로 올리고, 받침 아래 호스만 늘인다
(사용자 2026-11-01 15:52 「샤워기를 코드로 위로」, 15:59 「받침까지 올리고 밑에 끈을 늘리고」, 16:04 찌꺼기 격노).
방법(v4):
 1) 깨끗한 배경판: 칸막이 벽 면은 같은 세로줄에서 20px(타일 2칸)씩 떨어진 픽셀들의 중간값, 뒷벽은 같은 줄에서 27px(타일 2칸)씩 떨어진 픽셀들의 중간값.
    물건(호스·헤드)은 한 줄에서 소수라 중간값에서 빠진다.
 2) 샤워기 칸 전체를 배경판으로 덮는다(옛 헤드 찌꺼기가 남을 수 없음). 병은 원본 그대로.
 3) 원본과 배경판이 다른 픽셀 중 받침에 이어진 덩어리 = 샤워기. 받침 위(헤드·받침)는 dy 위로 통째로, 받침 아래~수도꼭지 위 호스는 세로로 늘여 붙인다.
사용: python3 bath_f_raise_heads.py <원본> <출력> [dy=20]"""
import sys
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
DY = int(sys.argv[3]) if len(sys.argv) > 3 else 20
orig = np.asarray(Image.open(src).convert('RGBA')).copy()
img = orig.copy()
L = orig[..., :3].astype(int).mean(2)
H, W = L.shape
# (x0, y0, x1, yl, yk): 칸, yl 호스 끝(수도꼭지 위), yk 받침 밑
FX = {2: (178, 146, 212, 255, 187), 3: (222, 156, 254, 245, 192), 4: (455, 146, 490, 254, 186), 5: (486, 161, 517, 245, 193),
      6: (638, 158, 683, 244, 193), 7: (678, 144, 711, 254, 186)}
FACES = [(150, 242), (440, 499), (666, 720)]          # 칸막이 벽 면 x 범위 (모서리선 A x243, B x500, C x664·665)
TOP = [((150, 105), (243, 150)), ((440, 105), (500, 152)), ((664, 149), (720, 105))]
KEEP = [(640, 180, 664, 214), (515, 180, 532, 214)]   # 6번 옆 병 두 개, 5번 옆 노란 병
def face(x): return any(a <= x <= b for a, b in FACES)
def wall_top(x):
    for (ax, ay), (bx, by) in TOP:
        if ax <= x <= bx: return ay + (by - ay) * (x - ax) / (bx - ax)
    return None
def in_keep(y, x): return any(b <= y < e and a <= x < c for a, b, c, e in KEEP)
NOSRC = [(515, 178, 575, 214), (638, 178, 666, 214)]   # 뒷벽 선반 병들 — 배경판 출처로 쓰지 않음
def bad_src(y, x): return any(b <= y < e and a <= x < c for a, b, c, e in NOSRC) or any(f[0] <= x < f[2] and f[1] - 24 <= y < f[3] for f in FX.values())
# 1) 배경판
plate = orig.copy()
REG = np.zeros((H, W), bool)
for x0, y0, x1, yl, yk in FX.values(): REG[y0 - DY - 4:yl + 1, x0 - 2:x1 + 2] = True
for y, x in zip(*np.nonzero(REG)):
    if in_keep(y, x): continue
    if face(x):
        t = wall_top(x)
        if t is not None and y <= t + 1: continue      # 벽 윗선 위 = 뒷벽 쪽, 아래에서 처리
        ss = [orig[sy, x] for sy in range(y % 20, 248, 20) if (t is None or sy > t + 1) and abs(sy - y) <= 60]
    else:
        ss = [orig[y, sx] for sx in range(x % 27, W, 27) if not face(sx) and not bad_src(y, sx) and abs(sx - x) <= 27 * 4]
    if len(ss) >= 2:
        plate[y, x] = np.median(np.array(ss), axis=0).astype(np.uint8)
# 면 위 벽 윗선 위쪽(뒷벽이 보이는 곳)
for y, x in zip(*np.nonzero(REG)):
    t = wall_top(x)
    if face(x) and t is not None and y <= t + 1 and not in_keep(y, x):
        ss = [orig[y, sx] for sx in range(x % 27, W, 27) if not face(sx) and not bad_src(y, sx) and abs(sx - x) <= 27 * 4]
        if len(ss) >= 2: plate[y, x] = np.median(np.array(ss), axis=0).astype(np.uint8)
# 3) 샤워기 마스크 + 옮겨 붙이기
diff = np.abs(orig[..., :3].astype(int) - plate[..., :3].astype(int)).sum(2) > 40
ERASE = []; MS = {}; EDGEFIX = []
for n, (x0, y0, x1, yl, yk) in FX.items():
    d = diff[y0:yl, x0:x1].copy()
    for a, b, c, e in KEEP: d[max(0, b - y0):max(0, e - y0), max(0, a - x0):max(0, c - x0)] = False
    h, w = d.shape; comp = np.zeros_like(d)
    st = [(y, x) for y in range(yk - y0 - 6, yk - y0) for x in range(w) if d[y, x]]
    while st:
        y, x = st.pop()
        if comp[y, x]: continue
        comp[y, x] = True
        for yy in (y - 1, y, y + 1):
            for xx in (x - 1, x, x + 1):
                if 0 <= yy < h and 0 <= xx < w and d[yy, xx] and not comp[yy, xx]: st.append((yy, xx))
    m = np.zeros((H, W), bool); m[y0:yl, x0:x1] = comp
    e = m.copy()   # 2) 샤워기 자리(3칸 넓혀 흐린 가장자리까지)를 배경판으로 지움
    for _ in range(3):
        t_ = e.copy(); t_[1:] |= e[:-1]; t_[:-1] |= e[1:]; t_[:, 1:] |= e[:, :-1]; t_[:, :-1] |= e[:, 1:]; e = t_
    for y, x in zip(*np.nonzero(e)):
        if in_keep(y, x): continue
        t = wall_top(x)
        if x in (243, 500, 664, 665) and (t is None or y > t + 1): EDGEFIX.append((y, x))  # 벽 모서리선: 같은 세로줄 깨끗한 줄(y220) 색
        else: ERASE.append((y, x))
    MS[n] = m
for y, x in ERASE: img[y, x] = plate[y, x]
for y, x in EDGEFIX: img[y, x] = orig[220, x]
for n, (x0, y0, x1, yl, yk) in FX.items():
    m = MS[n]
    for y, x in zip(*np.nonzero(m)):
        if y < yk: img[y - DY, x] = orig[y, x]
    Lh = yl - yk
    for y in range(yk - DY, yl):
        sy = min(max(int(round(yl - (yl - y) * Lh / (Lh + DY))), yk), yl - 1)
        for x in range(x0, x1):
            if m[sy, x]: img[y, x] = orig[sy, x]
Image.fromarray(img).save(out)
print('올린 px(1x):', DY)
