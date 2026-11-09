"""animate 클립 정리: 원본과 크게 달라진 점 중 '주인공 점'만 남기고 나머지(배경 일렁임·번쩍임)는 원본으로 되돌림. 무료 후처리(11-09 망상홈쇼핑).
사용: python3 anim_clean.py <scene.png> x0 y0 <in_dir> <out_dir> [mode]  mode: body(색 무관) | hand(밝은 살·소매 흰 단만)
       [--lock x0,y0,x1,y1] 칸 안 좌표 범위는 늘 원본(움직이면 안 되는 이음매)."""
import sys, glob, os, numpy as np
from PIL import Image
from scipy import ndimage
scene, x0, y0, src, dst = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
mode = sys.argv[6] if len(sys.argv) > 6 and not sys.argv[6].startswith('--') else 'body'
lock = None
if '--lock' in sys.argv: lock = [int(v) for v in sys.argv[sys.argv.index('--lock') + 1].split(',')]
fs = sorted(glob.glob(src + '/f*.png'))
w, h = Image.open(fs[0]).size
o = np.array(Image.open(scene).convert('RGB'))[y0:y0 + h, x0:x0 + w].astype(int)
def subj(a):
    if mode == 'body': return np.ones(a.shape[:2], bool)
    mn = a.min(2); return (mn > 110)  # 살·흰 단
os.makedirs(dst, exist_ok=True)
for f in fs:
    a = np.array(Image.open(f).convert('RGB')).astype(int)
    d = np.abs(a - o).sum(2)
    m = (d > 60) & (subj(a) | subj(o))
    m = ndimage.binary_closing(m, iterations=2); m = ndimage.binary_dilation(m, iterations=1)
    m = ndimage.binary_fill_holes(m)
    if lock: m[lock[1]:lock[3], lock[0]:lock[2]] = False
    out = np.where(m[..., None], a, o).astype('uint8')
    Image.fromarray(out).save(dst + '/' + os.path.basename(f))
print('ok', len(fs))
