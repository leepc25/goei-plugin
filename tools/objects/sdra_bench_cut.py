"""창구 대기의자 inpaint v1(sdra_counter_bench_v1.png)에서 의자만 오리기 (2026-11-02).
손으로 짚은 다각형(6배 격자로 1px씩 보고 찍음, 잘라낸 판 원점 (545,276)) 안에서, 바닥 색(밝고 붉은 기 있는 베이지)만 빼서 투명."""
from PIL import Image, ImageDraw
import numpy as np, sys
R='/home/user/goei-plugin/game-src/art/pixellab-hq-20261031/'
OX, OY, W, H = 545, 276, 221, 135
POLYS = [
  [(9,8),(11,6),(69,6),(71,8),(71,46),(76,47),(77,62),(74,70),(81,70),(80,8),(82,6),(141,6),(143,8),(143,48),(147,46),(152,46),(152,8),(154,6),(213,6),(215,8),(215,57),(213,72),(212,77),(12,77),(9,72)],  # 등받이 셋·좌석·밑틀
  [(17,77),(29,77),(31,101),(23,102),(21,95),(22,123),(13,124),(13,95),(16,85)],     # 왼쪽 다리 둘
  [(194,77),(207,77),(210,95),(210,124),(201,124),(200,101),(192,102),(192,85)],     # 오른쪽 다리 둘
]
im = Image.open(R+'sdra_counter_bench_v1.png').convert('RGBA').crop((OX, OY, OX+W, OY+H))
m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
for p in POLYS: d.polygon(p, fill=255)
a = np.array(im); rgb = a[:, :, :3].astype(int); L = rgb.mean(2)
floor = (L > 105) & (rgb[:, :, 0] - rgb[:, :, 2] > 10)          # 바닥·그림자 낀 바닥(베이지)
counter = (rgb[:, :, 0] - rgb[:, :, 2] > 25) & (L < 105)        # 창구 갈색 나무
k = (np.array(m) > 0) & ~floor & ~counter
a[:, :, 3] = np.where(k, 255, 0)
out = Image.fromarray(a); out.save(R+'sdra_counter_bench_v1_cut.png')
print('saved', out.size, int(k.sum()))
