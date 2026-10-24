"""이어 그린 구간 붙이기: 다음 구간 왼쪽 keep px가 앞 구간 오른쪽 keep px와 겹친다. 겹친 곳 가운데에서 blend px만큼 섞는다.
사용: python3 stitch.py <출력> <keep> <blend> <구간1> <구간2> ..."""
import sys
import numpy as np
from PIL import Image

out, keep, blend = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
segs = [np.asarray(Image.open(p).convert("RGB")).astype(np.float32) for p in sys.argv[4:]]
pano = segs[0]
for s in segs[1:]:
    w = pano.shape[1]
    ov_a, ov_b = pano[:, w - keep:], s[:, :keep]
    print("겹친 곳 평균 차이", round(float(np.abs(ov_a - ov_b).mean()), 2))
    cut = keep // 2
    t = np.clip((np.arange(keep) - (cut - blend / 2)) / blend, 0, 1)[None, :, None]
    mixed = ov_a * (1 - t) + ov_b * t
    pano = np.concatenate([pano[:, :w - keep], mixed, s[:, keep:]], axis=1)
Image.fromarray(pano.round().astype(np.uint8)).save(out)
print("크기", pano.shape[1], "x", pano.shape[0])
