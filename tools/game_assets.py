"""관찰형 게임 그림 준비: game-src/의 동작 시트를 프레임별로 잘라 src/game/assets/에 아틀라스로 묶는다.

GPT가 만든 시트는 칸 경계가 정확하지 않아(효과가 옆 칸까지 번지고, 옆 칸 조각이 들어옴) 균등 격자로 자르면
효과가 잘리거나 조각이 섞인다. 그래서 이어진 픽셀 덩어리마다 무게중심이 있는 칸에 배정해 프레임을 만든다.
크기를 바꾸지 않고(늘이기·줄이기 없음) 원본 픽셀 그대로 옮긴다.

사용법: python3 tools/game_assets.py
"""
import json
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src')
OUT = os.path.join(ROOT, 'src', 'game', 'assets')

AGENTS = ['jyaldi', 'gorgo', 'geshu', 'deadfall', 'spandal', 'eileen', 'curas', 'rose']
ENEMIES = ['corner', 'watchman', 'statue', 'master']
# 배경: 320×180 한 장씩 그대로 쓴다
BACKS = ['belt-school', 'room-classroom', 'room-lab', 'room-broadcast', 'room-courtyard', 'belt-camp']


def components(mask):
    """8방향으로 이어진 덩어리마다 픽셀 좌표 배열을 돌려준다"""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    ys, xs = np.nonzero(mask)
    for sy, sx in zip(ys.tolist(), xs.tolist()):
        if seen[sy, sx]:
            continue
        q = deque([(sy, sx)])
        seen[sy, sx] = True
        pts = []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((ny, nx))
        out.append(np.array(pts))
    return out


def cut(path, cols, rows):
    """시트를 프레임 목록으로. 각 프레임: (이미지, 발 기준 x, 발 기준 y)"""
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    mask = a[:, :, 3] > 24
    cw, ch = im.width / cols, im.height / rows
    cells = {}
    for comp in components(mask):
        ky = np.minimum(rows - 1, (comp[:, 0] // ch).astype(int))
        kx = np.minimum(cols - 1, (comp[:, 1] // cw).astype(int))
        keys = ky * cols + kx
        counts = np.bincount(keys, minlength=rows * cols)
        top = np.sort(counts)[::-1]
        if top[1] > len(comp) * 0.25:
            # 두 칸에 크게 걸친 덩어리(옆 칸 몸과 붙은 효과)는 칸 경계에서 나눈다
            for k in np.nonzero(counts)[0]:
                cells.setdefault((int(k) // cols, int(k) % cols), []).append(comp[keys == k])
            continue
        cy, cx = comp[:, 0].mean(), comp[:, 1].mean()
        key = (min(rows - 1, int(cy // ch)), min(cols - 1, int(cx // cw)))
        cells.setdefault(key, []).append(comp)
    frames = []
    for r in range(rows):
        for c in range(cols):
            comps = cells.get((r, c), [])
            if not comps:
                frames.append(None)
                continue
            body = max(comps, key=len)
            # 몸에서 너무 먼 작은 부스러기는 버린다 (다른 칸 잔상)
            keep = [p for p in comps if len(p) >= 6 or p is body]
            pts = np.concatenate(keep)
            y0, x0 = pts.min(axis=0)
            y1, x1 = pts.max(axis=0) + 1
            buf = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
            for p in keep:
                buf[p[:, 0] - y0, p[:, 1] - x0] = a[p[:, 0], p[:, 1]]
            # 발 기준: 몸 덩어리의 맨 아래, 가로는 머리·어깨 부근의 가운데 (걷기 때 몸이 좌우로 튀지 않게)
            by0, by1 = body[:, 0].min(), body[:, 0].max()
            band = body[(body[:, 0] >= by0 + (by1 - by0) * 0.08) & (body[:, 0] <= by0 + (by1 - by0) * 0.28)]
            ax = float(np.median(band[:, 1])) if len(band) else float(body[:, 1].mean())
            frames.append((Image.fromarray(buf), round(ax - x0), int(by1 + 1 - y0), int(by1 - by0 + 1)))
    return frames


def pack(frames, name, width=1024):
    """프레임을 선반식으로 한 장에 담는다"""
    order = sorted((i for i, f in enumerate(frames) if f), key=lambda i: -frames[i][0].height)
    x = y = shelf = 0
    pos = {}
    for i in order:
        img = frames[i][0]
        if x + img.width > width:
            x, y, shelf = 0, y + shelf + 1, 0
        pos[i] = (x, y)
        x += img.width + 1
        shelf = max(shelf, img.height)
    sheet = Image.new('RGBA', (width, y + shelf), (0, 0, 0, 0))
    meta = []
    for i, f in enumerate(frames):
        if not f:
            meta.append(None)
            continue
        img, ax, ay, body = f
        px, py = pos[i]
        sheet.paste(img, (px, py))
        meta.append([px, py, img.width, img.height, ax, ay, body])
    # 투명 영역 위주라 팔레트로 줄여도 원본 색이 그대로 남는다
    sheet.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(
        os.path.join(OUT, name + '.png'), optimize=True)
    return meta


def main():
    os.makedirs(OUT, exist_ok=True)
    atlas = {}
    for n in AGENTS:
        atlas[n] = pack(cut(os.path.join(SRC, f'actor9-{n}.png'), 6, 6), f'a-{n}')
    # 적: 6×4 (대기·공격·기술·피격/쓰러짐). walk-e6은 크기가 달라 섞으면 커졌다 작아졌다 해서 쓰지 않는다
    for n in ENEMIES:
        atlas[n] = pack(cut(os.path.join(SRC, f'anim-{n}.png'), 6, 4), f'e-{n}')
    # 얼굴: 2×2 칸 두 장, 요원 순서대로
    faces = Image.new('RGBA', (128 * 8, 128))
    for k, f in enumerate(['faces8a', 'faces8b']):
        im = Image.open(os.path.join(SRC, f + '.png')).convert('RGBA')
        for j in range(4):
            faces.paste(im.crop(((j % 2) * 128, (j // 2) * 128, (j % 2) * 128 + 128, (j // 2) * 128 + 128)), ((k * 4 + j) * 128, 0))
    faces.quantize(colors=255, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, 'faces.png'), optimize=True)
    for b in BACKS:
        Image.open(os.path.join(SRC, b + '.png')).convert('RGB').quantize(colors=128, dither=Image.Dither.NONE).save(
            os.path.join(OUT, 'bg-' + b + '.png'), optimize=True)
    with open(os.path.join(OUT, 'atlas.json'), 'w') as f:
        json.dump(atlas, f, separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(OUT, p)) for p in os.listdir(OUT))
    print('assets', total, 'bytes')


if __name__ == '__main__':
    main()
