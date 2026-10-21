"""GPT 배경 그림 → 게임 도트 (docs/GPT요청_게임배경.md).

입력: game-src/art/bg/raw/<장소>/<이름>.png  (GPT 평면 채색 원본)
출력: game-src/art/bg/dot/<장소>/<이름>.png  (도트 1px = 화면 2px, 엔진이 2배로 그림)
      game-src/art/bg/dot/<장소>/objects/<이름>_<번호>.png + objects.json (바닥 접점)

종류는 파일 이름 꼬리로 정한다: _wall_N / _wall / _floor / _far / _far_tall / _objects.
장소 하나의 모든 그림은 한 팔레트(기본 32색)로 줄여 칸끼리 색이 같게 한다.
캐릭터가 묻히지 않게 명도·채도를 낮춘다(DIM, DESAT).

사용: python3 tools/bg_pixelize.py [장소 ...]   (없으면 전부)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'game-src/art/bg/raw'
OUT = ROOT / 'game-src/art/bg/dot'

WALL = (320, 220)        # 화면 640×440 (벽 0~440)
FLOOR = 128              # 화면 256 정사각 무늬
FAR = (384, 256)         # 화면 768×512, 느리게 흐름
FAR_TALL = (256, 384)
COLORS = 32
DIM = 0.82               # 명도
DESAT = 0.78             # 채도
# 물건 모음: 원본 셀 높이 341px에서 문 2.1m = 60% → 205px. 벽은 2.9m = 220도트 → 76도트/m.
OBJ_SCALE = (220 / 2.9) / (1024 / 3 * 0.6 / 2.1)
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


def cover(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    """비율 유지로 꽉 채운 뒤 가운데 자르기. 줄일 때 BOX(평균)로 계단 없이."""
    w, h = size
    s = max(w / im.width, h / im.height)
    nw, nh = max(w, round(im.width * s)), max(h, round(im.height * s))
    im = im.resize((nw, nh), Image.Resampling.BOX)
    x, y = (nw - w) // 2, (nh - h) // 2
    return im.crop((x, y, x + w, y + h))


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
    sheet = sheet.convert('RGBA')
    if sheet.getchannel('A').getextrema()[0] == 255:  # 투명 아님 → 마젠타 빼기
        px = sheet.load()
        for y in range(sheet.height):
            for x in range(sheet.width):
                r, g, b, _ = px[x, y]
                if r > 200 and b > 200 and g < 90:
                    px[x, y] = (0, 0, 0, 0)
    cw, ch = sheet.width // 3, sheet.height // 3
    out = []
    for i in range(9):
        cell = sheet.crop(((i % 3) * cw, (i // 3) * ch, (i % 3 + 1) * cw, (i // 3 + 1) * ch))
        box = cell.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox()
        if not box:
            continue
        cell = cell.crop(box)
        nw, nh = max(1, round(cell.width * OBJ_SCALE)), max(1, round(cell.height * OBJ_SCALE))
        out.append(cell.resize((nw, nh), Image.Resampling.BOX))
    return out


def quantize_place(images: list[Image.Image]) -> list[Image.Image]:
    """장소 전체를 한 팔레트로. 반투명은 0/255로 끊는다."""
    strip_w = sum(im.width for im in images)
    strip = Image.new('RGB', (strip_w, max(im.height for im in images)), (0, 0, 0))
    x = 0
    for im in images:
        strip.paste(im.convert('RGB'), (x, 0))
        x += im.width
    pal = strip.quantize(COLORS, method=Image.Quantize.MEDIANCUT)
    res = []
    for im in images:
        q = im.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA')
        if im.mode == 'RGBA':
            q.putalpha(im.getchannel('A').point(lambda a: 255 if a > 127 else 0))
        res.append(q)
    return res


def run_place(place: Path) -> dict:
    files = sorted(place.glob('*.png'))
    jobs: list[tuple[str, Image.Image]] = []
    for f in files:
        k = kind_of(f.stem)
        src = Image.open(f).convert('RGBA')
        im = tone(src)
        if k == 'wall':
            jobs.append((f.stem, cover(im, WALL)))
        elif k == 'floor':
            jobs.append((f.stem, seamless(cover(im, (FLOOR, FLOOR)))))
        elif k == 'far':
            jobs.append((f.stem, cover(im, FAR)))
        elif k == 'far_tall':
            jobs.append((f.stem, cover(im, FAR_TALL)))
        elif k == 'objects':
            for i, o in enumerate(cut_objects(src), 1):
                jobs.append((f'objects/{f.stem}_{i}', tone(o)))
    if not jobs:
        return {}
    out_dir = OUT / place.name
    (out_dir / 'objects').mkdir(parents=True, exist_ok=True)
    meta: dict = {}
    for (name, _), q in zip(jobs, quantize_place([im for _, im in jobs])):
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
