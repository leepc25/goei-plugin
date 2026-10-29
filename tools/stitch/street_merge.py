"""건물 사이 골목에서 거리 그림 두 장을 잇는다.
뒤 그림을 앞 그림 끝에 겹침px만큼 겹쳐 놓고, 지정한 가림 영역에서는 앞 그림을 보여 준다.
경계는 흐림 반경만큼 부드럽게 섞는다. 가림 영역 밖의 겹침 구간은 뒤 그림이 덮는다.
사용: python3 street_merge.py 출력 앞그림 뒤그림 겹침px 뒤그림왼쪽자름px 흐림반경 섞임폭 [x0,y0,x1,y1 ...]
  섞임폭: 겹침 시작부터 이 폭에 걸쳐 앞 그림→뒤 그림으로 고르게 넘어간다(바닥·도로 경계를 지운다).
  가림 영역 좌표는 뒤 그림 원본 기준.
"""
import sys
import numpy as np
from PIL import Image


def box_blur(a, r):
    if r <= 0:
        return a
    k = np.ones(2 * r + 1) / (2 * r + 1)
    for ax in (0, 1):
        a = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode='edge'), k, 'valid'), ax, a)
    return a


out, pa, pb = sys.argv[1:4]
ov, cut, r, ramp = (int(v) for v in sys.argv[4:8])
A = np.asarray(Image.open(pa).convert('RGB')).astype(np.float32)
B = np.asarray(Image.open(pb).convert('RGB')).astype(np.float32)[:, cut:]
h = min(A.shape[0], B.shape[0]); A, B = A[:h], B[:h]
wa, wb = A.shape[1], B.shape[1]
alpha = np.ones((h, wb), np.float32)
alpha[:, :ramp] = np.linspace(0, 1, ramp)[None, :]
for box in sys.argv[8:]:
    x0, y0, x1, y1 = map(int, box.split(','))
    alpha[y0:y1, max(0, x0 - cut):max(0, x1 - cut)] = 0
alpha = np.clip(box_blur(alpha, r), 0, 1)[:, :ov]  # 가림 영역은 겹침 안쪽(ov - r 이내)에 둔다
canvas = np.zeros((h, wa + wb - ov, 3), np.float32)
canvas[:, :wa] = A
a = alpha[..., None]
canvas[:, wa - ov:wa] = A[:, wa - ov:] * (1 - a) + B[:, :ov] * a
canvas[:, wa:] = B[:, ov:]
Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).save(out)
print(out, canvas.shape)
