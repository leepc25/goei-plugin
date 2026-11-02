"""관리국 사무실 배경을 백일몽 13층 복도 색(짙은 나무·금색)에 맞춰 코드로 색만 바꾸는 시안 (사용자 11-02 13:51 「톤이 안 맞는데, 백일몽은 금색 계열」).
복도 확정판(by_f13_hall_g4_full_fix.png)의 밝기별 중간 색을 띠(ramp)로 만들어, 사무실 픽셀을 같은 밝기의 복도 색으로 옮긴다.
A = 전부 옮김, B = 원래 색과 반반, C = 회색·푸른 픽셀(채도 낮음·푸른 색상)만 옮기고 원래 나무·종이 색은 둔다. 형태·픽셀 위치는 그대로(색만)."""
import sys
from PIL import Image
import numpy as np
A = 'game-src/art/pixellab-baekilmong/'
hall = np.asarray(Image.open(A + 'by_f13_hall_g4_full_fix.png').convert('RGB')).reshape(-1, 3).astype(float)
lum = lambda c: 0.299 * c[..., 0] + 0.587 * c[..., 1] + 0.114 * c[..., 2]
hl = lum(hall); ramp = np.zeros((256, 3))
order = np.argsort(hl); hs, hls = hall[order], hl[order]
for v in range(256):
    i = np.searchsorted(hls, v); sl = hs[max(0, i - 300):i + 300]
    ramp[v] = np.median(sl, axis=0)
src = Image.open(sys.argv[1]).convert('RGBA'); a = np.asarray(src).astype(float)
rgb = a[..., :3]; L = np.clip(lum(rgb), 0, 255).astype(int); mapped = ramp[L]
mx, mn = rgb.max(-1), rgb.min(-1); sat = (mx - mn) / np.maximum(mx, 1)
blue = rgb[..., 2] >= rgb[..., 0]
out = {'A': mapped, 'B': (rgb + mapped) / 2}
w = np.clip(((0.35 - sat) / 0.2), 0, 1)[..., None]; w = np.maximum(w, blue[..., None].astype(float))
out['C'] = rgb * (1 - w) + mapped * w
for k, v in out.items():
    o = a.copy(); o[..., :3] = v
    Image.fromarray(np.clip(o, 0, 255).astype(np.uint8)).save(sys.argv[2].replace('X', k))
