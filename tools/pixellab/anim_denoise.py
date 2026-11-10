"""동작 클립 자글거림 줄이기(코드, 무료). 11-10 망상홈쇼핑 컷F.
매 장에서 원본과 거의 같은 곳·몇 칸짜리 튄 점은 원본으로 되돌리고, 크게 움직인 덩어리만 새 그림을 남긴다.
사용: python3 tools/pixellab/anim_denoise.py <원본png> <x0,y0,x1,y1> <프레임폴더> <출력폴더> [색차이=60] [창=5] [최소칸수=8] [넓힘=1]"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter
src, box, fdir, out = sys.argv[1:5]
T, W, K, G = (list(map(float, sys.argv[5:9])) + [60, 5, 8, 1][len(sys.argv[5:9]):])
W, K, G = int(W), int(K), int(G)
o = np.array(Image.open(src).convert("RGB").crop(tuple(map(int, box.split(",")))), int)
def boxsum(m, w):
    p = w // 2; a = np.pad(m.astype(int), p); c = a.cumsum(0).cumsum(1); c = np.pad(c, ((1, 0), (1, 0)))
    h, ww = m.shape
    return c[w:w+h, w:w+ww] - c[:h, w:w+ww] - c[w:w+h, :ww] + c[:h, :ww]
os.makedirs(out, exist_ok=True)
for f in sorted(glob.glob(f"{fdir}/f*.png")):
    a = np.array(Image.open(f).convert("RGB"), int)
    ch = np.abs(a - o).sum(2) > T
    keep = ch & (boxsum(ch, W) >= K)
    if G:
        keep = np.array(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * G + 1))) > 0
    r = np.where(keep[..., None], a, o).astype(np.uint8)
    Image.fromarray(r).save(f"{out}/{os.path.basename(f)}")
    print(os.path.basename(f), "남긴 칸 %.1f%%" % (keep.mean() * 100))
