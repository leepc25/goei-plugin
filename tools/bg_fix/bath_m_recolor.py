"""남자 샤워실 = 여자 샤워실 확정 그림(hq_bath_f_p5_extL1_heads.png)을 코드로 색만 바꾼 것(사용자 2026-11-01 17:35 「고대로 쓰고 색깔만」).
마스크·서는 자리·물줄기 좌표는 여자 것과 같다. 규칙(HSV):
- 채도 낮은 벽·바닥(청록 계열) → 색상을 따뜻한 회갈색(hue 40) 쪽으로, 채도 0.6배.
- 채도 높은 물건(바구니·대야·병) → 색상 +180°, 채도 0.7배(분홍→청록, 노랑→파랑, 주황→파랑, 파랑→주황빛).
사용: python3 tools/bg_fix/bath_m_recolor.py [out.png] [tile_hue] [obj_shift]"""
import sys
import numpy as np
from PIL import Image
SRC = 'game-src/art/pixellab-hq-20261031/hq_bath_f_p5_extL1_heads.png'
out = sys.argv[1] if len(sys.argv) > 1 else 'game-src/art/pixellab-hq-20261031/hq_bath_m_recolor.png'
TILE_HUE = float(sys.argv[2]) if len(sys.argv) > 2 else 40.0
OBJ_SHIFT = float(sys.argv[3]) if len(sys.argv) > 3 else 180.0
im = Image.open(SRC).convert('RGB')
hsv = np.array(im.convert('HSV')).astype(float)   # H 0~255
h, s, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
obj = s > 0.38
tile = ~obj & (s > 0.04)
h2 = h.copy(); s2 = s.copy()
h2[obj] = (h[obj] + OBJ_SHIFT) % 360; s2[obj] = s[obj] * 0.7
# 타일: 지금 색상(대개 180~220)을 TILE_HUE 둘레로 모으되 원래 편차의 절반은 남긴다(단조롭지 않게)
d = ((h[tile] - 200 + 180) % 360) - 180
h2[tile] = (TILE_HUE + d * 0.5) % 360; s2[tile] = s[tile] * 0.6
hsv2 = np.stack([h2 * 255 / 360, s2 * 255, v * 255], -1).clip(0, 255).astype('uint8')
Image.fromarray(hsv2, 'HSV').convert('RGB').save(out)
print('ok', out)
