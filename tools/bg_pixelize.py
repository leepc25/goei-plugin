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
import re
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
DIM = 0.85               # 명도
DESAT = 1.1              # 채도
# 물건 크기: GPT 그림 안 비율은 믿지 않고 heights.json의 실제 높이(m)로 맞춘다. 쟈알디 키 128도트(화면 256px) = 1.65m (2026-10-21 새 쟈알디).
DPM = 128 / 1.65
HEIGHTS = json.loads((ROOT / 'game-src/art/bg/heights.json').read_text()) if (ROOT / 'game-src/art/bg/heights.json').exists() else {}
KEY = (255, 0, 255)


# 바닥 원본에서 쓸 부분: 탕비실은 바둑판 4×4칸(칸 = 무늬 1/4), 거리는 아래 연석·하수구 띠를 뺀 보도 (GPT요청_배경보강 5·6)
FLOOR_CONTRAST = {'hq_pantry_floor': 0.4}
FLOOR_CROP = {'hq_pantry_floor': (0, 0, 512, 512), 'hq_street_floor': (0, 0, 864, 864)}


def kind_of(stem: str) -> str:
    if re.search(r'_objects(_\d+)?$', stem):
        return 'objects'
    for k in ('far_tall', 'far', 'floor'):
        if stem.endswith('_' + k):
            return k
    return 'wall' if '_wall' in stem else 'other'


CONTRAST = 1.35         # 명암 단계가 또렷하게 (통합 검수 2026-10-22: 물 빠진 사진 같다)
EDGE = 80                # 이웃 칸 밝기 차가 이보다 크면 어두운 쪽을 외곽선 색으로
OUTLINE = (24, 22, 26)   # 물건 바깥 외곽선 (쟈알디 외곽선과 같은 거의 검정)


def tone(im: Image.Image, contrast: float = CONTRAST) -> Image.Image:
    rgb = im.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(DESAT)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
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


def ink(im: Image.Image, solid_edge: bool) -> Image.Image:
    """도트 외곽선: 밝기 경계의 어두운 쪽 칸을 한 단계 더 어둡게(선처럼), 물건은 바깥 테두리 1도트."""
    a = np.asarray(im.convert('RGBA')).copy()
    rgb = a[:, :, :3].astype(np.int32)
    lum = rgb @ np.array([299, 587, 114]) // 1000
    dark = np.zeros(lum.shape, bool)
    for dy, dx in ((0, 1), (1, 0)):
        l0 = lum[: lum.shape[0] - dy, : lum.shape[1] - dx]
        l1 = lum[dy:, dx:]
        d = l1 - l0
        m = np.abs(d) > EDGE
        dark[: lum.shape[0] - dy, : lum.shape[1] - dx] |= m & (d > 0)   # 왼/위가 더 어두움
        dark[dy:, dx:] |= m & (d < 0)
    a[dark, :3] = (a[dark, :3].astype(np.int32) * 55 // 100).astype(np.uint8)
    if solid_edge:
        al = a[:, :, 3] > 0
        ring = np.zeros_like(al)
        ring[1:] |= al[:-1]; ring[:-1] |= al[1:]; ring[:, 1:] |= al[:, :-1]; ring[:, :-1] |= al[:, 1:]
        ring &= ~al
        a[ring] = (*OUTLINE, 255)
    return Image.fromarray(a, 'RGBA')


def run_place(place: Path) -> dict:
    jobs: list[tuple[str, Image.Image, tuple[int, int], str]] = []
    for f in sorted(place.glob('*.png')):
        k = kind_of(f.stem)
        src = Image.open(f).convert('RGBA')
        size = {'wall': WALL, 'floor': (FLOOR, FLOOR), 'far': FAR, 'far_tall': FAR_TALL}.get(k)
        if size:
            if k == 'wall':
                src = trim_bottom(src)
            if f.stem in FLOOR_CROP:  # 원본 바닥 일부만 (칸을 크게, 연석 띠 빼기)
                src = src.crop(FLOOR_CROP[f.stem])
            # 바닥은 잔무늬가 지글거리지 않게 명암을 덜 올린다. 바둑판 바닥은 칸끼리 밝기 차를 더 줄인다
            jobs.append((f.stem, aspect_crop(tone(src, FLOOR_CONTRAST.get(f.stem, 1.05) if k == 'floor' else CONTRAST), size), size, k))
        elif k == 'objects':
            hs = HEIGHTS.get(f.stem, [])
            # 두 번째 시트(<장소>_objects_2)는 번호를 이어 붙인다: 10~18
            m = re.match(r'(.*_objects)(?:_(\d+))?$', f.stem)
            base, off = m.group(1), (int(m.group(2) or 1) - 1) * 9
            for i, o in enumerate(cut_objects(src), 1):
                nh = max(1, round((hs[i - 1] if i <= len(hs) else 1.0) * DPM))
                jobs.append((f'objects/{base}_{i + off}', tone(o), (max(1, round(o.width * nh / o.height)), nh), f'objects:{f.stem}'))
    if not jobs:
        return {}
    # 벽·바닥과 물건은 팔레트를 따로: 큰 벽이 색을 다 차지하면 작은 물건 색(파란 모니터, 빨간 의자)이 사라진다
    # 물건 모음은 시트마다 팔레트를 따로 (엘리베이터 시트의 회색 철판이 다른 시트의 금색에 끌려 노란 띠가 됐다)
    scene = [j[1] for j in jobs if not j[3].startswith('objects')]
    pals = {'scene': place_palette(scene) if scene else None}
    for sk in {j[3] for j in jobs if j[3].startswith('objects')}:
        pals[sk] = place_palette([j[1].convert('RGB') for j in jobs if j[3] == sk])
    out_dir = OUT / place.name
    (out_dir / 'objects').mkdir(parents=True, exist_ok=True)
    meta: dict = {}
    for name, im, size, k in jobs:
        q = mode_down(im, size, pals[k if k.startswith('objects') else 'scene'])
        if k.startswith('objects'):
            # 바깥 테두리 1도트가 들어가도록 한 칸씩 여유
            pad = Image.new('RGBA', (q.width + 2, q.height + 1))
            pad.paste(q, (1, 0))
            q = ink(pad, True)
        elif k == 'wall':
            q = ink(q, False)
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


# 벽에 그려진 빈 문틀(검은 구멍)을 닫힌 문이나 불 켜진 안쪽으로 채운다 (통합 재검수 3-4, 코디네이터 불합격 1).
# 벽 이름 → [((문 구멍 x0, x1[, 위 끝 y]), 문짝 그림 또는 'LIT'/'GLASS')]. 'LIT' = 어두운 칸을 밝히고 따뜻한 빛을 섞어 안쪽이 보이게, 'GLASS' = 그 위에 유리문 두 짝.
DOOR_FILL: dict[str, list[tuple[tuple[int, ...], str]]] = {
    'hq_corridor_wall_3': [((128, 205), 'lobby/objects/lobby_objects_9')],
    'hq_corridor_wall_4': [((124, 196), 'hq_pantry/objects/hq_pantry_objects_9')],
    'hq_clinic_wall_4': [((77, 163), 'hq_office/objects/hq_office_objects_9')],
    'hq_office_wall_3': [((126, 194), 'hq_office/objects/hq_office_objects_9')],
    'hq_office_wall_5': [((58, 135), 'hq_office/objects/hq_office_objects_9'), ((187, 260), 'hq_office/objects/hq_office_objects_9')],
    'hq_pantry_wall_2': [((62, 139), 'hq_pantry/objects/hq_pantry_objects_9')],
    'hq_pantry_wall_4': [((122, 198), 'hq_pantry/objects/hq_pantry_objects_9')],
    'hq_workshop_wall_1': [((29, 101), 'hq_workshop/objects/hq_workshop_objects_9')],
    'hq_workshop_wall_3': [((115, 206), 'hq_workshop/objects/hq_workshop_objects_9')],
    'hq_supply_wall_2': [((123, 215), 'hq_workshop/objects/hq_workshop_objects_9')],
    'hq_containment_wall_1': [((139, 216), 'hq_workshop/objects/hq_workshop_objects_9')],
    'hq_containment_wall_3': [((116, 204), 'hq_workshop/objects/hq_workshop_objects_9')],
    'hq_containment_wall_4': [((111, 211), 'hq_workshop/objects/hq_workshop_objects_9')],
    'hq_street_wall_1': [((130, 190), 'GLASS')],
    'hq_street_wall_3': [((204, 267), 'lobby/objects/lobby_objects_9')],
    'hq_lobby_wall_2': [((130, 238), 'LIT')],
    'apt_wall_1': [((68, 143), 'apt/objects/apt_objects_1')],
    'apt_wall_2': [((197, 279), 'apt/objects/apt_objects_1')],
    'apt_wall_4': [((214, 289), 'apt/objects/apt_objects_1')],
    'apt_red_wall_2': [((68, 143), 'apt/objects/apt_objects_1')],
    'apt_vacant_wall_1': [((68, 143), 'apt/objects/apt_objects_1')],
    'apt_vacant_wall_2': [((68, 143), 'apt/objects/apt_objects_1')],
    'chase_wall_1': [((122, 201), 'chase/objects/chase_objects_1')],
    'chase_wall_4': [((44, 119), 'chase/objects/chase_objects_1')],
    'dark_wall_3': [((27, 88), 'hq_workshop/objects/hq_workshop_objects_9')],
    'deep_wall_1': [((122, 201), 'lobby/objects/lobby_objects_9')],
    'el_hall_wall_1': [((116, 204), 'el_hall/objects/el_hall_objects_10+el_hall/objects/el_hall_objects_11')],
    'el_hall_wall_3': [((116, 204), 'lobby/objects/lobby_objects_9')],
    'el_hall_wall_4': [((119, 204), 'lobby/objects/lobby_objects_9')],
    'guardian_405_wall': [((54, 140), 'chase/objects/chase_objects_1')],
    'guardian_guard_wall': [((228, 304), 'chase/objects/chase_objects_1')],
    'guardian_legs_wall': [((190, 244, 40), 'chase/objects/chase_objects_1')],
    'lobby_wall_3': [((68, 146), 'lobby/objects/lobby_objects_9'), ((173, 252), 'lobby/objects/lobby_objects_9')],
    'lobby_wall_4': [((41, 109), 'lobby/objects/lobby_objects_9')],
    'service_wall_3': [((122, 201), 'hq_workshop/objects/hq_workshop_objects_9')],
    'service_wall_4': [((65, 119), 'hq_workshop/objects/hq_workshop_objects_9')],
    'silent_wall_3': [((119, 197), 'lobby/objects/lobby_objects_9')],
}


def door_hole(dark: np.ndarray, x0: int, x1: int) -> np.ndarray:
    """문 구멍 = 아래쪽에서 이어진 어두운 칸 (x 범위 안). 씨앗 여러 곳 중 가장 큰 덩어리."""
    h, w = dark.shape
    best = np.zeros_like(dark)
    for cx in ((x0 + x1) // 2, (x0 * 2 + x1) // 3, (x0 + x1 * 2) // 3):
        for sy in (h - 3, h - 8, h - 16, h - 30, h - 50):
            if not (0 <= cx < w) or not dark[sy, cx]:
                continue
            seen = np.zeros_like(dark)
            stack = [(sy, cx)]
            while stack:
                y, x = stack.pop()
                if not (0 <= y < h and max(0, x0 - 4) <= x <= min(w - 1, x1 + 4)) or seen[y, x] or not dark[y, x]:
                    continue
                seen[y, x] = True
                stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
            if seen.sum() > best.sum():
                best = seen
    return best


# 밝기 경계가 문턱값 근처라 외곽선이 점선처럼 끊긴 벽 (본부 로비 허리선, 불합격 4)
UNDASH = ('hq_lobby',)


def undash(places: set[str]) -> None:
    """밝은 벽 위에 외따로 떨어진 작은 어두운 조각(5×5 안에 어두운 칸 6개 이하)을 위·아래 벽색으로 덮는다."""
    for pl in UNDASH:
        if pl not in places:
            continue
        for f in sorted((OUT / pl).glob(f'{pl}_wall_*.png')):
            px = np.asarray(Image.open(f).convert('RGBA')).copy()
            lum = px[:, :, :3].astype(int) @ np.array([299, 587, 114]) // 1000
            h, w = lum.shape
            dark = lum < 90
            pad = np.pad(dark, 2).astype(int)
            cnt = sum(pad[dy:dy + h, dx:dx + w] for dy in range(5) for dx in range(5))
            padl = np.pad(lum, 2, mode='edge')
            mean = sum(padl[dy:dy + h, dx:dx + w] for dy in range(5) for dx in range(5)) / 25
            fix = dark & (cnt <= 6) & (mean > 120)
            for y, x in zip(*np.nonzero(fix)):
                for yy in (y - 2, y + 2, y - 3, y + 3):
                    if 0 <= yy < h and not dark[yy, x]:
                        px[y, x] = px[yy, x]
                        break
            Image.fromarray(px, 'RGBA').save(f, optimize=True)


# 벽 그림 속 빈 게시판·액자·화이트보드 자리에 GPT 게시판 그림(boards_objects, 보강 3번)을 붙인다 (검수 8·12-2: 빈 회색 판).
# 그림 이름 → [(도트 x0, y0, x1, y1, 게시판 번호)]. 번호: 1 코르크 게시판, 3 풍경화, 6 화이트보드
BOARD_PASTE = {
    'hq_office/hq_office_wall_2': [(48, 66, 168, 128, 6), (184, 63, 278, 131, 1)],
    'lobby/lobby_wall_4': [(128, 69, 208, 134, 1), (235, 65, 279, 128, 3)],
    'hq_office/objects/hq_office_objects_13': [(22, 6, 186, 90, 6)],
}


def paste_boards(places: set[str]) -> None:
    sheet = RAW / 'boards/boards_objects.png'
    if not sheet.exists():
        return
    boards = cut_objects(Image.open(sheet))
    for name, spots in BOARD_PASTE.items():
        place = name.split('/')[0]
        f = OUT / f'{name}.png'
        if place not in places or not f.exists():
            continue
        im = Image.open(f).convert('RGBA')
        for x0, y0, x1, y1, n in spots:
            b = tone(boards[n - 1]).resize((x1 - x0, y1 - y0), Image.Resampling.BOX)
            q = b.convert('RGB').quantize(24, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
            q.putalpha(b.getchannel('A').point(lambda v: 255 if v > 127 else 0))
            im.alpha_composite(q, (x0, y0))
        im.save(f, optimize=True)


def fill_doors(places: set[str]) -> None:
    """방금 다시 뽑은 장소의 벽만 채운다 (두 번 채우면 문짝 위에 문짝이 덧그려진다)."""
    for name, holes in DOOR_FILL.items():
        found = [f for f in OUT.glob(f'*/{name}.png') if f.parent.name in places]
        if not found:
            continue
        f = found[0]
        im = Image.open(f).convert('RGBA')
        for rng, leaf in holes:
            x0, x1, ytop = (*rng, 0)[:3]
            a = np.asarray(im.convert('RGB')).astype(int)
            lum = a @ np.array([299, 587, 114]) // 1000
            dark = lum < 40
            dark[:ytop] = False
            seen = door_hole(dark, x0, x1)
            ys, xs = np.nonzero(seen)
            if len(xs) < 200:
                print(f'{name} {x0}-{x1}: 문 구멍 못 찾음')
                continue
            bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            if leaf in ('LIT', 'GLASS'):
                # 불 켜진 안쪽: 위는 따뜻한 벽빛, 아래로 갈수록 조금 어둡게. 원래 어두운 결(계단 선 등)은 진하게 남긴다.
                px = np.asarray(im).copy()
                t = (ys - by0) / max(1, by1 - by0)
                base = np.stack([196 - 60 * t, 170 - 58 * t, 122 - 46 * t], 1)
                detail = (lum[ys, xs] / 40.0)[:, None]
                rgb = base * (0.72 + 0.28 * detail)
                if leaf == 'LIT':
                    # 계단실: 판처럼 밝게 칠하지 않고 원래 어두운 계단 결을 살려 은은하게 (밝은 반투명 판처럼 보였다, 검수 5)
                    rgb = a[ys, xs] * 2.4 + np.stack([58 - 24 * t, 44 - 20 * t, 26 - 12 * t], 1)
                px[ys, xs, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
                if leaf == 'LIT' and name == 'hq_lobby_wall_2':
                    # 계단참 뒷벽이 납작한 갈색 판으로 보였다(검수 6): 천장 등, 층계참 창문, 벽 그늘, 참 바닥 모서리
                    flat = np.zeros(px.shape[:2], bool)
                    flat[ys, xs] = lum[ys, xs] < 14
                    reg = np.zeros_like(flat)
                    reg[by0:by0 + 78, bx0:bx0 + 82] = True
                    flat &= reg
                    fy, fx = np.nonzero(flat)
                    lx, ly = bx0 + 40, by0 + 4
                    dist = np.hypot((fx - lx) / 1.4, fy - ly)
                    glow = np.clip(1 - dist / 70, 0, 1)[:, None]
                    wall = np.array([70, 60, 48]) * (0.65 + 0.7 * glow) + np.array([40, 30, 14]) * glow
                    px[fy, fx, :3] = np.clip(wall, 0, 255).astype(np.uint8)
                    px[ly:ly + 2, lx - 6:lx + 7, :3] = (250, 238, 200)
                    px[ly + 2, lx - 5:lx + 6, :3] = (120, 108, 86)
                    wx0, wy0, wx1, wy1 = bx0 + 24, by0 + 22, bx0 + 54, by0 + 52
                    px[wy0:wy1, wx0:wx1, :3] = (44, 38, 32)
                    px[wy0 + 2:wy1 - 2, wx0 + 2:wx1 - 2, :3] = (30, 42, 62)
                    px[wy0 + 2:wy1 - 2, (wx0 + wx1) // 2, :3] = (44, 38, 32)
                    px[(wy0 + wy1) // 2, wx0 + 2:wx1 - 2, :3] = (44, 38, 32)
                    for k in range(6):
                        px[wy0 + 4 + k, wx0 + 4 + k, :3] = (64, 80, 104)
                    px[wy1, wx0 - 1:wx1 + 1, :3] = (104, 92, 74)
                    sy = by0 + 74
                    px[sy:sy + 2, bx0 + 2:bx0 + 80, :3] = (52, 44, 36)
                if leaf == 'GLASS':
                    # 불 켜진 로비가 보이는 유리 여닫이문 두 짝: 안쪽 바닥 띠, 천장 등, 가운데·양옆 문틀, 손잡이
                    fy = by0 + (by1 - by0) * 3 // 4
                    px[fy:by1, bx0:bx1, :3] = (120, 104, 82)
                    px[fy, bx0:bx1, :3] = (84, 72, 58)
                    px[by0 + 6:by0 + 9, bx0 + 8:bx1 - 8, :3] = (246, 232, 190)
                    frame = (52, 58, 64)
                    cx = (bx0 + bx1) // 2
                    for x in (bx0, bx0 + 1, cx - 1, cx, bx1 - 2, bx1 - 1):
                        px[by0:by1, x, :3] = frame
                    px[by0:by0 + 2, bx0:bx1, :3] = frame
                    hy = by0 + (by1 - by0) // 2
                    px[hy - 8:hy + 8, cx - 4:cx - 2, :3] = (190, 196, 200)
                    px[hy - 8:hy + 8, cx + 2:cx + 4, :3] = (190, 196, 200)
                im = Image.fromarray(px, 'RGBA')
                print(f'{name}: 안쪽 밝힘 ({bx0},{by0})-({bx1},{by1})')
                continue
            parts = [Image.open(OUT / f'{l}.png').convert('RGBA') for l in leaf.split('+')]
            parts = [p.crop(p.getbbox()) for p in parts]
            door = Image.new('RGBA', (sum(p.width for p in parts), max(p.height for p in parts)))
            x = 0
            for p in parts:
                door.paste(p, (x, door.height - p.height))
                x += p.width
            door = door.resize((int(bx1 - bx0), int(by1 - by0)), Image.Resampling.NEAREST)
            im.alpha_composite(door, (int(bx0), int(by0)))
            print(f'{name}: 문 닫음 ({bx0},{by0})-({bx1},{by1})')
        im.save(f, optimize=True)


def main(argv: list[str]) -> None:
    places = [RAW / p for p in argv] if argv else sorted(p for p in RAW.glob('*') if p.is_dir())
    for p in places:
        meta = run_place(p)
        print(f'{p.name}: {len(meta)}개')
    if not __import__("os").environ.get("NOFILL"):
        undash({p.name for p in places})
        paste_boards({p.name for p in places})
        fill_doors({p.name for p in places})


if __name__ == '__main__':
    main(sys.argv[1:])
