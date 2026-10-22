"""로제몬 시연판 장 단위 보정 (검수에서 나온 결함을 코드로 고침). apply(src, frames, idx) -> (frames, idx)
DROP[src] = 버릴 장 번호, ORDER[src] = 장 순서 바꾸기, SHIFT[src] = {장: (dx, dy)} 그림 옮기기."""
from PIL import Image

import numpy as np

DROP = {'down': {7}}            # 07: 생성기가 끝 장을 선 자세로 되돌림 + 회색 얼룩
ORDER = {}
SHIFT = {}
REPLACE = {'getup': {0: ('down', 6), 1: ('down', 6)}}   # getup 00·01 머리에 회색 노이즈 → 다운 마지막 누운 장
CUT_X = {'wfire': (128, (1, 2, 3, 4))}   # 총구 앞 떨어진 연기 덩이(그림 x≥128) 지움, 00의 총구 불꽃은 둠
LOAD = None                     # 빌더가 frames_of를 넣어 줌


def _shift(im, dx, dy):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (dx, dy)); return out


def _sole(im, foot):
    """발이 바닥선 아래로 1~2px 빠진 장(생성기 버릇)을 바닥선에 올림."""
    bb = im.split()[3].getbbox()
    if bb and foot < bb[3] <= foot + 2:
        return _shift(im, 0, foot - bb[3])
    return im


def _clean(im, small=14, cut=None):
    """몸과 떨어진 작은 점 덩이(생성기 찌꺼기) 지움. cut이면 그 x 이후 떨어진 덩이도 지움."""
    a = np.array(im); m = a[:, :, 3] > 0; H, W = m.shape
    lab = np.zeros(m.shape, int); comps = []
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]:
            continue
        k = len(comps) + 1; lab[y0, x0] = k; st = [(y0, x0)]; pts = []
        while st:
            y, x = st.pop(); pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    v, u = y + dy, x + dx
                    if 0 <= v < H and 0 <= u < W and m[v, u] and not lab[v, u]:
                        lab[v, u] = k; st.append((v, u))
        comps.append(pts)
    if len(comps) <= 1:
        return im
    big = max(range(len(comps)), key=lambda i: len(comps[i]))
    for i, pts in enumerate(comps):
        if i != big and (len(pts) < small or (cut is not None and min(x for _, x in pts) >= cut)):
            for y, x in pts:
                a[y, x] = 0
    return Image.fromarray(a)


def apply(src, frames, idx):
    foot = 88 if src.startswith('kid_') else 136
    if src in REPLACE and LOAD:
        frames = [LOAD(REPLACE[src][i][0])[REPLACE[src][i][1]] if i in REPLACE[src] else f for f, i in zip(frames, idx)]
    cx = CUT_X.get(src)
    frames = [_clean(f, cut=cx[0] if cx and i in cx[1] else None) for f, i in zip(frames, idx)]
    pairs = [(_sole(f, foot), i) for f, i in zip(frames, idx)]
    if src in SHIFT:
        pairs = [(_shift(f, *SHIFT[src][i]) if i in SHIFT[src] else f, i) for f, i in pairs]
    if src in ORDER:
        pairs = [pairs[i] for i in ORDER[src] if i < len(pairs)]
    if src in DROP:
        pairs = [p for p in pairs if p[1] not in DROP[src]]
    return [p[0] for p in pairs], [p[1] for p in pairs]
