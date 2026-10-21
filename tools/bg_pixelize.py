"""GPT 배경 그림 → 게임 도트 (docs/GPT요청_게임배경.md).

입력: game-src/art/bg/raw/<장소>/<이름>.png  (GPT 평면 채색 원본)
출력: game-src/art/bg/dot/<장소>/<이름>.png  (도트 1px = 화면 2px, 엔진이 2배로 그림)
      game-src/art/bg/dot/<장소>/objects/<이름>_<번호>.png + objects.json (바닥 접점)

종류는 파일 이름 꼬리로 정한다: _wall_N / _wall / _floor / _far / _far_tall / _objects.
장소 하나의 모든 그림은 한 팔레트(기본 32색)로 줄여 칸끼리 색이 같게 한다.
캐릭터가 묻히지 않게 명도를 조금 낮춘다(DIM, DESAT).
줄일 때 색을 평균 내지 않고 칸마다 가장 많은 색 하나를 고른다(번짐 없는 도트 경계, 2026-10-21 사용자 비교 B안).

사용: python3 tools/bg_pixelize.py [장소 ...]   (없으면 전부)
"""
from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'game-src/art/bg/raw'
OUT = ROOT / 'game-src/art/bg/dot'

WALL = (320, 220)        # 화면 640×440 (벽 0~440)
FLOOR = 128              # 화면 256 정사각 무늬
FAR = (384, 256)         # 화면 768×512, 느리게 흐름
FAR_TALL = (256, 384)
COLORS = 32
DIM = 0.9                # 명도
DESAT = 1.0              # 채도
# 물건 크기: GPT 그림 안 비율은 믿지 않고 heights.json의 실제 높이(m)로 맞춘다. 쟈알디 대기 키 99도트 = 1.65m.
DPM = 99 / 1.65
HEIGHTS = json.loads((ROOT / 'game-src/art/bg/heights.json').read_text()) if (ROOT / 'game-src/art/bg/heights.json').exists() else {}
KEY = (255, 0, 255)


def kind_of(stem: str) -> str:
    for k in ('far_tall', 'far', 'floor', 'objects'):
        if stem.endswith('_' + k):
            return k
    return 'wall' if '_wall' in stem else 'other'


def tone(im: Image.Image) -> Image.Image:
    rgb = im.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(DESAT)
    rgb = ImageEnhance.Brightness(rgb).enhance(DIM)
    if im.mode == 'RGBA':
        rgb.putalpha(im.getchannel('A'))
    return rgb


def seamless(im: Image.Image) -> Image.Image:
    """바닥 무늬 이음새: 반 칸 밀어 가운데 십자 이음을 가장자리 쪽 원본과 섞는다."""
    w, h = im.size
    shifted = Image.new(im.mode, im.size)
    shifted.paste(im, (-w // 2, -h // 2))
    shifted.paste(im, (w - w // 2, -h // 2))
    shifted.paste(im, (-w // 2, h - h // 2))
    shifted.paste(im, (w - w // 2, h - h // 2))
    mask = Image.new('L', im.size)
    px = mask.load()
    for y in range(h):
        for x in range(w):
            d = min(x, w - 1 - x, y, h - 1 - y)
            px[x, y] = max(0, 255 - d * 255 // max(1, w // 6))
    return Image.composite(shifted, im, mask)


def cut_objects(sheet: Image.Image) -> list[Image.Image]:
    """투명(또는 마젠타) 바탕의 물건 모음 → 덩어리 9개. 줄 순서(위→아래, 왼→오른)."""
    sheet = sheet.convert('RGBA')
    if sheet.getchannel('A').getextrema()[0] == 255:  # 투명 아님 → 마젠타 빼기
        px = sheet.load()
        for y in range(sheet.height):
            for x in range(sheet.width):
                r, g, b, _ = px[x, y]
                if r > 200 and b > 200 and g < 90:
                    px[x, y] = (0, 0, 0, 0)
    f = 4
    small = sheet.getchannel('A').resize((sheet.width // f, sheet.height // f), Image.Resampling.BOX)
    w, h = small.size
    a = small.load()
    seen = [[False] * w for _ in range(h)]
    found = []
    for y in range(h):
        for x in range(w):
            if a[x, y] > 128 and not seen[y][x]:
                seen[y][x] = True
                q = deque([(x, y)])
                x0 = x1 = x
                y0 = y1 = y
                n = 0
                while q:
                    cx, cy = q.popleft()
                    n += 1
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for dy in (-2, -1, 0, 1, 2):
                        for dx in (-2, -1, 0, 1, 2):
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and a[nx, ny] > 128:
                                seen[ny][nx] = True
                                q.append((nx, ny))
                found.append((n, (x0 * f, y0 * f, (x1 + 1) * f, (y1 + 1) * f)))
    # 덩어리를 3×3 칸(가운데 기준)으로 묶는다: 한 칸에 두 덩어리(의자 둘, 밧줄 둘)도 한 물건.
    cells: dict[int, list[int]] = {}
    for n, (x0, y0, x1, y1) in found:
        if n < 30:  # 부스러기
            continue
        c = min(2, (y0 + y1) * 3 // (2 * sheet.height)) * 3 + min(2, (x0 + x1) * 3 // (2 * sheet.width))
        if c in cells:
            b = cells[c]
            cells[c] = [min(b[0], x0), min(b[1], y0), max(b[2], x1), max(b[3], y1)]
        else:
            cells[c] = [x0, y0, x1, y1]
    boxes = [tuple(cells[c]) for c in sorted(cells)]
    return [sheet.crop(bx) for bx in boxes]


def trim_bottom(im: Image.Image) -> Image.Image:
    """벽 아래의 평평한 띠(흰 여백·바닥 줄)를 잘라 낸다. 최대 8%."""
    a = np.asarray(im.convert('L')).astype(float)
    h = a.shape[0]
    cut = h
    while cut > h * 0.92 and a[cut - 1].std() < 12:
        cut -= 1
    return im.crop((0, 0, im.width, cut)) if cut < h else im


def aspect_crop(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """목표 비율로 가운데 자르기(원본 해상도 유지)."""
    w, h = size
    s = max(w / im.width, h / im.height)
    cw, ch = min(im.width, round(w / s)), min(im.height, round(h / s))
    x, y = (im.width - cw) // 2, (im.height - ch) // 2
    return im.crop((x, y, x + cw, y + ch))


def place_palette(images: list[Image.Image]) -> Image.Image:
    small = [im.convert('RGB').resize((max(1, im.width // 3), max(1, im.height // 3)), Image.Resampling.BOX) for im in images]
    strip = Image.new('RGB', (sum(i.width for i in small), max(i.height for i in small)))
    x = 0
    for i in small:
        strip.paste(i, (x, 0))
        x += i.width
    return strip.quantize(COLORS, method=Image.Quantize.MEDIANCUT)


def mode_down(im: Image.Image, size: tuple[int, int], pal: Image.Image) -> Image.Image:
    """장소 팔레트로 원본 해상도에서 색을 고른 뒤, 칸마다 다수결 색으로 줄인다."""
    W, H = size
    idx = np.asarray(im.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE))
    ys = np.linspace(0, idx.shape[0], H + 1).astype(int)
    xs = np.linspace(0, idx.shape[1], W + 1).astype(int)
    out = np.zeros((H, W), np.uint8)
    for j in range(H):
        row = idx[ys[j]:ys[j + 1]]
        for i in range(W):
            out[j, i] = np.bincount(row[:, xs[i]:xs[i + 1]].ravel()).argmax()
    o = Image.fromarray(out, 'P')
    o.putpalette(pal.getpalette())
    o = o.convert('RGBA')
    if im.mode == 'RGBA':
        a = np.asarray(im.getchannel('A').resize(size, Image.Resampling.BOX))
        o.putalpha(Image.fromarray(np.where(a > 127, 255, 0).astype(np.uint8)))
    return o


def run_place(place: Path) -> dict:
    jobs: list[tuple[str, Image.Image, tuple[int, int], str]] = []
    for f in sorted(place.glob('*.png')):
        k = kind_of(f.stem)
        src = Image.open(f).convert('RGBA')
        size = {'wall': WALL, 'floor': (FLOOR, FLOOR), 'far': FAR, 'far_tall': FAR_TALL}.get(k)
        if size:
            if k == 'wall':
                src = trim_bottom(src)
            jobs.append((f.stem, aspect_crop(tone(src), size), size, k))
        elif k == 'objects':
            hs = HEIGHTS.get(f.stem, [])
            for i, o in enumerate(cut_objects(src), 1):
                nh = max(1, round((hs[i - 1] if i <= len(hs) else 1.0) * DPM))
                jobs.append((f'objects/{f.stem}_{i}', tone(o), (max(1, round(o.width * nh / o.height)), nh), k))
    if not jobs:
        return {}
    pal = place_palette([j[1] for j in jobs])
    out_dir = OUT / place.name
    (out_dir / 'objects').mkdir(parents=True, exist_ok=True)
    meta: dict = {}
    for name, im, size, k in jobs:
        q = mode_down(im, size, pal)
        if k == 'floor':
            q = seamless(q)
        q.save(out_dir / f'{name}.png', optimize=True)
        entry = {'w': q.width, 'h': q.height}
        if name.startswith('objects/'):
            # 바닥 접점 = 아래 가운데. 문손잡이·앉는 높이는 사람이 보고 objects.json에 덧붙인다.
            entry['foot'] = [q.width // 2, q.height]
        meta[name] = entry
    (out_dir / 'index.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def main(argv: list[str]) -> None:
    places = [RAW / p for p in argv] if argv else sorted(p for p in RAW.glob('*') if p.is_dir())
    for p in places:
        meta = run_place(p)
        print(f'{p.name}: {len(meta)}개')


if __name__ == '__main__':
    main(sys.argv[1:])
