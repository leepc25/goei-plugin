"""animate 결과의 배경 번쩍임(칸 전체 색 바뀜)을 걷어내고 움직인 주인공만 원본 위에 얹는다(무료 후처리, 11-09 망상홈쇼핑 손 칸).
방법: 프레임마다 주인공이 닿지 않는 가장자리 점으로 원본→프레임 색 변환(채널별 1차식)을 맞추고, 그 예측과 크게 다른 점 = 주인공.
가장 큰 덩어리(고정 칸에 닿는 것)만 남긴다.
사용: python3 anim_clean_flash.py <scene.png> x0 y0 <in_dir> <out_dir> --lock x0,y0,x1,y1 [--thr 70]"""
import sys, glob, os, numpy as np
from PIL import Image
from scipy import ndimage
scene, X, Y, src, dst = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
lock = [int(v) for v in sys.argv[sys.argv.index('--lock') + 1].split(',')]
thr = int(sys.argv[sys.argv.index('--thr') + 1]) if '--thr' in sys.argv else 70
fs = sorted(glob.glob(src + '/f*.png')); w, h = Image.open(fs[0]).size
o = np.array(Image.open(scene).convert('RGB'))[Y:Y + h, X:X + w].astype(float)
# 원본의 주인공(밝은 살·흰 단 + 소매) 대략 자리: 처음 장과 원본은 같으므로, 모든 프레임에서 바뀐 점의 합집합을 쓰지 않고 가장자리 띠로만 맞춘다
edge = np.zeros((h, w), bool); edge[:, -12:] = True; edge[-12:, :] = True; edge[:12, 40:] = True
os.makedirs(dst, exist_ok=True)
for fi, f in enumerate(fs):
    if fi == 0 or fi == len(fs) - 1:  # 처음·끝 장 = 원본 그대로
        Image.fromarray(o.astype('uint8')).save(dst + '/' + os.path.basename(f)); continue
    a = np.array(Image.open(f).convert('RGB')).astype(float)
    pred = np.empty_like(o)
    for c in range(3):
        A = np.vstack([o[..., c][edge], np.ones(edge.sum())]).T
        k, b = np.linalg.lstsq(A, a[..., c][edge], rcond=None)[0]
        pred[..., c] = k * o[..., c] + b
    r = np.abs(a - pred).sum(2)
    m = r > thr
    m[lock[1]:lock[3], lock[0]:lock[2]] = True  # 덩어리 씨앗
    m = ndimage.binary_closing(m, iterations=2)
    lab, n = ndimage.label(m)
    keep = np.isin(lab, np.unique(lab[lock[1]:lock[3], lock[0]:lock[2]])[1:])
    keep = ndimage.binary_fill_holes(keep)
    sat = a.max(2) - a.min(2)
    keep &= (sat < 60)  # 살·흰 단·검은 소매·윤곽은 채도 낮음, 번쩍인 배경(빨강·주황·노랑)은 높음
    keep = ndimage.binary_opening(keep, iterations=1) | (keep & (a.min(2) > 110))
    lab2, _ = ndimage.label(keep); sz = ndimage.sum(keep, lab2, range(1, lab2.max() + 1))
    if len(sz): keep = lab2 == (1 + int(np.argmax(sz)))
    keep[lock[1]:lock[3], lock[0]:lock[2]] = False
    # 원본 손 자리는 지워야 하므로: 원본 살 점 중 이번 프레임 손이 아닌 곳 = 원본 배경 추정(주변 원본 배경색으로 채움)
    out = o.copy()
    oh = (o.min(2) > 110); oh[lock[1]:lock[3], lock[0]:lock[2]] = False
    oh = ndimage.binary_dilation(oh, iterations=1) & ~keep
    if oh.any():
        # 가로로 가장 가까운 원본 비-손 점 색으로 채움
        idx = ndimage.distance_transform_edt(ndimage.binary_dilation(o.min(2) > 110, iterations=1), return_distances=False, return_indices=True)
        out[oh] = o[idx[0][oh], idx[1][oh]]
    out[keep] = a[keep]
    Image.fromarray(out.clip(0, 255).astype('uint8')).save(dst + '/' + os.path.basename(f))
print('ok', len(fs))
