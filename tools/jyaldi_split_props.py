#!/usr/bin/env python3
"""쟈알디 생활 클립에서 생성기가 같이 그린 가구를 캐릭터와 분리한다(결함 목록 '가구 분리', 2026-10-21).

방법: rig.py 뼈대로 몸 영역(팔다리 굵은 선 + 몸통 + 머리 + 뒤로 흐르는 머리카락 + 손목 주변)을 만들고,
- 몸 영역 밖의 큰 덩어리(25px 이상) = 가구 씨앗
- 씨앗에서 몸 영역 안으로, 캐릭터 색표(A2)와 먼 색 픽셀을 따라 번져 들어감(몸 뒤·앞에 걸친 가구)
- 나머지 = 캐릭터
결과: full/split/<클립>/NN.png(캐릭터만), full/split/<클립>/prop_NN.png(가구만).
가구가 캐릭터 앞에 오는지(욕조·책상) 뒤에 오는지는 빌더의 PROP_FRONT가 정한다.
한 번 돌려 결과를 커밋해 두는 도구라 scipy를 쓴다(빌더는 numpy·PIL만).
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FULL = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'full')
sys.path.insert(0, os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'scripts'))
import rig  # noqa: E402

# 눈으로 확인해 잘 떨어진 클립만(2026-10-21). 못 떼어 낸 것(사무 의자·검은 책상·소파·식탁·사다리·문·화장실)은 '가구 없이 다시 생성'으로 넘김
CLIPS = ['push', 'bedlie', 'board', 'brief', 'locker', 'window', 'coffee', 'microwave', 'wash', 'dishes', 'water', 'stairs', 'button',
         'showerin', 'shower', 'showerout', 'bathin', 'bath', 'bathout', 'handwash']

A = np.array(Image.open(os.path.join(FULL, 'A2-pad.png')).convert('RGBA'))
PAL = np.unique(A[A[:, :, 3] > 0][:, :3], axis=0).astype(int)
SKIN = np.array([[244, 200, 170], [230, 170, 140], [210, 150, 120], [250, 215, 190]])  # 맨몸 장면용 피부


def pal_dist(a):
    rgb = a[:, :, :3].astype(int).reshape(-1, 3)
    d = np.full(len(rgb), 1e9)
    for p in (PAL, SKIN):
        for i in range(0, len(p), 64):
            q = p[i:i + 64]
            d = np.minimum(d, np.sqrt(((rgb[:, None, :] - q[None]) ** 2).sum(2)).min(1))
    return d.reshape(a.shape[:2])


def body_mask(p):
    im = Image.new('L', (192, 144), 0); d = ImageDraw.Draw(im)
    P = lambda k: (p[k][0] + rig.DX, p[k][1] + rig.DY)
    limbs = [('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'),
             ('RIGHT HIP', 'RIGHT KNEE'), ('RIGHT KNEE', 'RIGHT LEG'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'RIGHT HIP'), ('NECK', 'LEFT HIP')]
    for a, b in limbs:
        d.line([P(a), P(b)], fill=255, width=13)
    d.polygon([P('RIGHT SHOULDER'), P('LEFT SHOULDER'), P('LEFT HIP'), P('RIGHT HIP')], fill=255)
    hx = (P('NOSE')[0] + P('RIGHT EAR')[0]) / 2; hy = (P('NOSE')[1] + P('RIGHT EAR')[1]) / 2 - 3
    d.ellipse([hx - 13, hy - 14, hx + 13, hy + 13], fill=255)
    ny, hip = P('NECK')[1], (P('RIGHT HIP')[1] + P('LEFT HIP')[1]) / 2
    d.polygon([(hx - 2, hy - 12), (hx - 22, hy), (hx - 20, max(hip, ny + 20) + 4), (hx + 2, ny)], fill=255)   # 뒤로 흐르는 긴 머리
    for k in ('RIGHT ARM', 'LEFT ARM'):
        x, y = P(k); d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=255)
    for k in ('RIGHT LEG', 'LEFT LEG'):
        x, y = P(k); d.ellipse([x - 9, y - 6, x + 11, y + 10], fill=255)   # 신발
    return nd.binary_dilation(np.array(im) > 0, iterations=2)


def split(frame, pose):
    a = np.array(frame); alpha = a[:, :, 3] > 0
    body = body_mask(pose)
    rgb = a[:, :, :3].astype(int)
    pd = pal_dist(a)
    far = pd > 22
    hair = rgb.max(2) < 52
    light = (rgb.min(2) > 150) & ((rgb.max(2) - rgb.min(2)) < 40)   # 흰 시트·도자기·금속
    out = alpha & ~body
    lab, n = nd.label(out)
    seed = np.zeros_like(out)
    for i in range(1, n + 1):
        m = lab == i; sz = m.sum()
        # 몸 밖 덩어리라도 거의 검정(머리카락)이 대부분이면 캐릭터
        if sz >= 25 and hair[m].mean() < 0.5:
            seed |= m
    prop = seed.copy()
    grow = alpha & (far | light)
    for _ in range(60):   # 가구 색을 따라 몸 영역 안까지 번짐
        nxt = nd.binary_dilation(prop) & (grow | prop)
        if (nxt == prop).all(): break
        prop = nxt
    if prop.any():   # 떨어져 있어도 가구와 같은 색이면 가구(손 앞 상자 조각 등)
        cols = np.unique(rgb[prop & far], axis=0)
        if len(cols):
            cols = cols[:: max(1, len(cols) // 400)]
            cand = alpha & (pd > 9) & ~prop
            ys, xs = np.nonzero(cand)
            if len(ys):
                px = rgb[ys, xs]
                dd = np.sqrt(((px[:, None, :] - cols[None]) ** 2).sum(2)).min(1)
                hit = dd < 10
                prop[ys[hit], xs[hit]] = True
    edge = nd.binary_dilation(prop) & alpha & ~body & ~prop   # 가구 테두리 1px
    prop |= edge
    ch_m = alpha & ~prop   # 캐릭터 쪽에 남은 작은 떨어진 조각(욕조 다리 끝 등)은 가구로
    lab, n = nd.label(ch_m)
    if n > 1:
        sz = nd.sum(ch_m, lab, range(1, n + 1))
        for i, z in enumerate(sz):
            if z < 40: prop |= lab == i + 1
    ch = a.copy(); ch[prop] = 0
    pr = a.copy(); pr[~prop] = 0
    return Image.fromarray(ch), Image.fromarray(pr)


def main(names):
    for c in names:
        src = os.path.join(FULL, 'clips', c)
        if not os.path.isdir(src) or c not in rig.CLIPS:
            print('건너뜀', c); continue
        poses = rig.CLIPS[c][2]
        files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
        dst = os.path.join(FULL, 'split', c); os.makedirs(dst, exist_ok=True)
        for i, f in enumerate(files):
            ch, pr = split(Image.open(os.path.join(src, f)).convert('RGBA'), poses[min(i, len(poses) - 1)])
            ch.save(os.path.join(dst, f)); pr.save(os.path.join(dst, 'prop_' + f))
        print(c, len(files))


if __name__ == '__main__':
    main(sys.argv[1:] or CLIPS)
