"""배경 여러 장을 가로로 이어 붙인다.
1) 이음매 양쪽 가장자리 색을 행(y)별로 맞춘다(가운데로 갈수록 보정이 0이 되게).
2) 겹친 구간을 부드럽게 섞는다.
사용: python3 stitch_bg.py 출력.png 겹침px 그림1 그림2 ...
겹침px은 이음매마다 다르게 '40,6'처럼 쉼표로 줄 수 있다.
"""
import sys
import numpy as np
from PIL import Image

EDGE = 24      # 가장자리 색을 잴 폭
REACH = 0.5    # 보정이 그림 안쪽으로 퍼지는 비율(그림 폭 대비)
MAXG = 0.08    # 색 보정 한도(±8%). 이음매 양쪽 내용이 다를 때 과보정을 막는다


def load(p, h):
    im = Image.open(p).convert('RGB')
    if im.height != h:
        im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    return np.asarray(im).astype(np.float32)


def smooth_rows(a, r):
    k = np.ones(2 * r + 1, np.float32) / (2 * r + 1)
    pad = np.pad(a, ((r, r), (0, 0)), mode='edge')
    return np.stack([np.convolve(pad[:, c], k, 'valid') for c in range(a.shape[1])], 1)


def edge_profile(img, side):
    strip = img[:, :EDGE] if side == 'L' else img[:, -EDGE:]
    return smooth_rows(strip.mean(1), 25) + 1.0  # (h,3)


def main():
    out, paths = sys.argv[1], sys.argv[3:]
    ovs = [int(v) for v in sys.argv[2].split(',')]
    ovs = ovs * (len(paths) - 1) if len(ovs) == 1 else ovs
    h = min(Image.open(p).height for p in paths)
    imgs = [load(p, h) for p in paths]
    n = len(imgs)
    # 각 이음매에서 두 쪽이 만날 목표 색 = 평균
    gainL = [np.ones((h, 3), np.float32) for _ in imgs]
    gainR = [np.ones((h, 3), np.float32) for _ in imgs]
    for i in range(n - 1):
        a, b = edge_profile(imgs[i], 'R'), edge_profile(imgs[i + 1], 'L')
        t = (a + b) / 2
        gainR[i], gainL[i + 1] = np.clip(t / a, 1 - MAXG, 1 + MAXG), np.clip(t / b, 1 - MAXG, 1 + MAXG)
    for i, im in enumerate(imgs):
        w = im.shape[1]
        x = np.arange(w, dtype=np.float32)
        r = w * REACH
        wl = np.clip(1 - x / r, 0, 1)[None, :, None]
        wr = np.clip(1 - (w - 1 - x) / r, 0, 1)[None, :, None]
        wl, wr = wl ** 1.5, wr ** 1.5
        g = 1 + (gainL[i][:, None] - 1) * wl + (gainR[i][:, None] - 1) * wr
        imgs[i] = im * g
    total = sum(im.shape[1] for im in imgs) - sum(ovs)
    canvas = np.zeros((h, total, 3), np.float32)
    x0 = 0
    for i, im in enumerate(imgs):
        w = im.shape[1]
        alpha = np.ones(w, np.float32)
        ov = ovs[i - 1] if i > 0 else 0
        if ov:
            alpha[:ov] = np.linspace(0, 1, ov + 2)[1:-1]
        seg = canvas[:, x0:x0 + w]
        a = alpha[None, :, None]
        canvas[:, x0:x0 + w] = seg * (1 - a) + im * a
        x0 += w - (ovs[i] if i < n - 1 else 0)
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).save(out)
    print(out, canvas.shape)


if __name__ == '__main__':
    main()
