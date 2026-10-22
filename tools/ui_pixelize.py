"""화면 표시 그림 도트화: game-src/art/ui/raw → game-src/art/ui/dot + src/game/action/ui/kit.gen.ts

GPT 원본(docs/GPT요청_화면표시.md)을 2배 격자 도트로 줄이고 색을 줄인다.
- jyaldi_face_sheet.png (2×2) → face_jyaldi_0..3.png (평소·맞음·위급·필살), 40×40 도트
- ui_frame_sheet.png → panel / row / portrait / bar / slot 조각 (9칸 자르기 기준점은 kit.gen.ts 에 함께)
- touch_buttons_sheet.png (4×4) → 터치 단추 판 16장 (그림이 박힌 금속 판, 60도트 폭)
- quickslot_icons_sheet.png (4×3) → 퀵슬롯 아이콘 12장 (32×32 도트)
- keycaps_sheet.png (5×4) → 키 글자판 20장 (높이 16 도트)
- 도트 글꼴: Galmuri11 Bold (OFL, game-src/art/ui/fonts/) 를 같이 data URL 로 넣는다.
실행: python3 tools/ui_pixelize.py
"""
import base64
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'game-src/art/ui/raw'
DOT = ROOT / 'game-src/art/ui/dot'
FONT = ROOT / 'game-src/art/ui/fonts/Galmuri11-Bold.woff2'
OUT = ROOT / 'src/game/action/ui/kit.gen.ts'


def dotify(im: Image.Image, w: int, h: int, colors: int = 32, alpha_cut: int = 160) -> Image.Image:
    """원본을 w×h 도트로: 상자 평균으로 줄이고, 알파는 0/255, 색은 colors 개로."""
    im = im.convert('RGBA')
    small = im.resize((w, h), Image.BOX)
    a = small.getchannel('A').point(lambda v: 255 if v >= alpha_cut else 0)
    rgb = small.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(a)
    return out


def main():
    DOT.mkdir(parents=True, exist_ok=True)
    meta = {}
    # 얼굴: 칸마다 같은 자리를 잘라 얼굴이 꽉 차게
    sheet = Image.open(RAW / 'jyaldi_face_sheet.png')
    crop = (150, 70, 430, 350)  # 칸(512) 안 얼굴 자리 280×280 (이마~턱)
    for i in range(4):
        cx, cy = (i % 2) * 512, (i // 2) * 512
        face = sheet.crop((cx + crop[0], cy + crop[1], cx + crop[2], cy + crop[3]))
        d = dotify(face, 40, 40, 40, 120)
        # 붉은 눈은 줄이면 검은 머리와 섞여 사라진다: 원본의 붉은 점이 칸의 15% 넘으면 그 도트를 눈 색으로
        red = face.convert('RGB').point(lambda v: v).split()
        r, g, b = (c.load() for c in red)
        mask = Image.new('L', face.size, 0)
        mk = mask.load()
        for y in range(face.height):
            for x in range(face.width):
                if r[x, y] > 140 and g[x, y] < 90 and b[x, y] < 100 and r[x, y] - g[x, y] > 80:
                    mk[x, y] = 255
        small = mask.resize((40, 40), Image.BOX).load()
        px = d.load()
        for y in range(40):
            for x in range(40):
                if small[x, y] > 38:
                    px[x, y] = (226, 48, 58, 255)
        d.save(DOT / f'face_jyaldi_{i}.png')
    # 테두리 조각: 원본에서 알파 200 넘는 테두리 상자 그대로, 4px = 1도트
    frames = Image.open(RAW / 'ui_frame_sheet.png')
    pieces = {
        'panel': (36, 154, 804, 890),
        'row': (831, 120, 1500, 211),
        'portrait': (852, 316, 1129, 584),
        'bar': (831, 670, 1507, 778),
        'slot': (1222, 347, 1422, 549),
    }
    for name, box in pieces.items():
        p = frames.crop(box)
        w, h = round(p.width / 4), round(p.height / 4)
        d = dotify(p, w, h, 24, 170)
        d.save(DOT / f'{name}.png')
        meta[name] = {'w': w, 'h': h}
    # 9칸 자르기 기준(도트): 모서리 장식이 들어간 두께
    meta['panel']['slice'] = [17, 17, 17, 17]
    meta['row']['slice'] = [6, 4, 6, 19]
    meta['portrait']['slice'] = [9, 9, 9, 9]
    meta['bar']['slice'] = [5, 14, 5, 14]
    meta['slot']['slice'] = [7, 7, 7, 7]

    # 격자 시트: 칸마다 불투명 부분만 잘라 같은 배율로 줄인다
    def cells(name: str, cols: int, rows: int):
        sh = Image.open(RAW / name).convert('RGBA')
        cw, ch = sh.width // cols, sh.height // rows
        for i in range(cols * rows):
            c = sh.crop(((i % cols) * cw, (i // cols) * ch, (i % cols + 1) * cw, (i // cols + 1) * ch))
            # 이웃 칸에서 넘어온 부스러기는 빼고: 불투명 비율이 3% 넘는 줄·열만
            a = c.getchannel('A').point(lambda v: 1 if v > 40 else 0)
            px = a.load()
            rows_ = [y for y in range(c.height) if sum(px[x, y] for x in range(c.width)) > c.width * 0.03]
            cols_ = [x for x in range(c.width) if sum(px[x, y] for y in range(c.height)) > c.height * 0.03]
            def longest(v):  # 이어진 가장 긴 구간
                runs, cur = [], []
                for t in v:
                    if cur and t != cur[-1] + 1:
                        runs.append(cur)
                        cur = []
                    cur.append(t)
                if cur:
                    runs.append(cur)
                r = max(runs, key=len)
                return r[0], r[-1] + 1
            if rows_ and cols_:
                (y0, y1), (x0, x1) = longest(rows_), longest(cols_)
                box = (x0, y0, x1, y1)
            else:
                box = None
            yield i, (c.crop(box) if box else None)

    touch_ids = ['attack', 'shoot', 'unique', 'guard', 'ult', 'interact', 'jump', 'evade', 'reload', 'support', 'menu', 'map', 'slot', 'plain', 'pressed', 'ready']
    touch = {}
    for i, c in cells('touch_buttons_sheet.png', 4, 4):
        k = 60 / 345  # 판 폭 345px → 60 도트 (16칸 같은 배율)
        d = dotify(c, max(1, round(c.width * k)), max(1, round(c.height * k)), 28, 150)
        d.save(DOT / f'touch_{touch_ids[i]}.png')
        touch[touch_ids[i]] = DOT / f'touch_{touch_ids[i]}.png'
    # 필살 참: 눈 그림 판에 금빛 테두리(16번 판의 바깥 5도트)를 씌운다
    ult = Image.open(touch['ult']).convert('RGBA')
    ready = Image.open(touch['ready']).convert('RGBA').resize(ult.size, Image.NEAREST)
    up, rp = ult.load(), ready.load()
    for y in range(ult.height):
        for x in range(ult.width):
            if min(x, y, ult.width - 1 - x, ult.height - 1 - y) < 5:
                up[x, y] = rp[x, y]
    ult.save(DOT / 'touch_ult_ready.png')
    touch['ult_ready'] = DOT / 'touch_ult_ready.png'
    item_ids = ['medkit', 'bandage', 'antidote', 'salt', 'flash', 'smoke', 'charm', 'energy', 'adrenaline', 'unknown', 'ammo']
    items = {}
    for i, c in cells('quickslot_icons_sheet.png', 4, 3):
        if i >= len(item_ids) or c is None:
            continue
        side = max(c.width, c.height)
        sq = Image.new('RGBA', (side, side))
        sq.alpha_composite(c, ((side - c.width) // 2, (side - c.height) // 2))
        dotify(sq, 32, 32, 24, 130).save(DOT / f'item_{item_ids[i]}.png')
        items[item_ids[i]] = DOT / f'item_{item_ids[i]}.png'
    key_ids = ['A', 'S', 'D', 'Q', 'W', 'E', 'R', 'C', 'Z', 'X', 'H', '1', '2', '3', '4', 'Esc', 'Space', 'Shift', 'PadA', 'PadB']
    keys = {}
    for i, c in cells('keycaps_sheet.png', 5, 4):
        k = 16 / 120  # 키 높이 약 120px → 16 도트
        dotify(c, max(1, round(c.width * k)), max(1, round(c.height * k)), 16, 140).save(DOT / f'key_{key_ids[i]}.png')
        keys[key_ids[i]] = DOT / f'key_{key_ids[i]}.png'

    def url(path: Path, mime: str) -> str:
        return f'data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}'

    lines = [
        '// tools/ui_pixelize.py 가 만든 파일. 손으로 고치지 않는다.',
        '// 화면 표시 도트 그림(GPT 원본 docs/GPT요청_화면표시.md)과 도트 글꼴 Galmuri11 Bold(OFL, game-src/art/ui/fonts/OFL.txt).',
        f'export const KIT_META = {json.dumps(meta, ensure_ascii=False)} as const;',
        'export const KIT_IMG: Record<string, string> = {',
    ]
    for name in pieces:
        lines.append(f"  {name}: '{url(DOT / f'{name}.png', 'image/png')}',")
    lines.append('};')
    lines.append('/** 쟈알디 얼굴: 0 평소, 1 맞음, 2 위급, 3 필살 준비 */')
    lines.append('export const FACE_JYALDI: string[] = [')
    for i in range(4):
        lines.append(f"  '{url(DOT / f'face_jyaldi_{i}.png', 'image/png')}',")
    lines.append('];')
    for title, const, table in (('터치 단추 판 (그림 박힘). slot 아이템 칸, plain 빈 판, pressed 누름, ready 필살 참', 'TOUCH_IMG', touch), ('퀵슬롯 아이콘 (아이템 id)', 'ITEM_IMG', items), ('키 글자판', 'KEY_IMG', keys)):
        lines.append(f'/** {title} */')
        lines.append(f'export const {const}: Record<string, string> = {{')
        for k2, path in table.items():
            lines.append(f"  '{k2}': '{url(path, 'image/png')}',")
        lines.append('};')
    lines.append(f"export const PIXEL_FONT_URL = '{url(FONT, 'font/woff2')}';")
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('wrote', OUT, OUT.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
