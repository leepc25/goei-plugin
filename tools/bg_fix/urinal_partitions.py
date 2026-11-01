"""남자 화장실 소변기 칸막이 손질 (2026-11-01 13:41 사용자 「가운데 두 개를 가장 오른쪽 걸로 통일, 제일 왼쪽 칸막이는 없애고」, 생성 없음)
배경 좌표: 칸막이 P1 x399~415(왼쪽, 지움), P2 x464~479, P3 x532~543(→ P4 모양으로), P4 x599~607(본보기). 벽 이음줄 x412·475·539·601.
지운 자리는 줄마다 양옆 벽 색을 이어 메우고 이음줄은 칸막이 밖(위·아래)에서 잰 어둡기로 다시 그림.
P4는 그 줄 벽 색과 밝기가 8 넘게 다른 픽셀(칸막이·고정쇠·그늘)만 옮겨 붙임(이음줄 기준 같은 자리)."""
import numpy as np
from PIL import Image
SRC = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_984x424.png'
OUT = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_v2_984x424.png'
a = np.array(Image.open(SRC).convert('RGB')).astype(float)
L = a.mean(2)
Y0, Y1 = 238, 320
o = a.copy()

def fill(x0, x1, seam, flat=False):
    # 이음줄 어둡기: 칸막이 위아래 줄(Y0-4~Y0-1, Y1+1~Y1+3)에서 이음줄/옆 벽 비
    ref = [y for y in list(range(Y0 - 4, Y0)) + list(range(Y1 + 1, Y1 + 4))]
    ratio = np.mean([a[y, seam] / np.maximum(1, (a[y, seam - 3] + a[y, seam + 3]) / 2) for y in ref], axis=0)
    for y in range(Y0, Y1 + 1):
        l, r = a[y, x0 - 1], a[y, x1 + 1]
        if flat: l = r                  # 왼쪽 끝이 경계선(검은 줄)이면 오른쪽 벽 색만
        for x in range(x0, x1 + 1):
            t = (x - x0 + 1) / (x1 - x0 + 2)
            o[y, x] = l * (1 - t) + r * t
        if seam is not None: o[y, seam] = o[y, seam] * ratio

def p4_mask():
    m = np.zeros(L.shape, bool)
    for y in range(Y0, Y1 + 1):
        ref = np.median(np.r_[L[y, 590:595], L[y, 611:616]])
        m[y, 595:611] = np.abs(L[y, 595:611] - ref) > 8
    m[:, 601] &= np.abs(L[:, 601] - L[:, 600]) > 8          # 이음줄 자체는 빼고
    return m

fill(398, 423, 412, flat=True)       # P1 지움(왼쪽 x397 = 벽 경계선)
fill(461, 487, 475)                  # P2 지움
fill(526, 552, 539)                  # P3 지움
m = p4_mask()
ys, xs = np.nonzero(m)
for dx in (475 - 601, 539 - 601):    # 이음줄 기준 같은 자리로
    o[ys, xs + dx] = a[ys, xs]
Image.fromarray(np.clip(np.round(o), 0, 255).astype(np.uint8)).save(OUT)
print('ok', m.sum())
