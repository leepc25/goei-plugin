"""화면 표시 그림 도트화: game-src/art/ui/raw → game-src/art/ui/dot + src/game/action/ui/kit.gen.ts

GPT 원본(docs/GPT요청_화면표시.md)을 2배 격자 도트로 줄이고 색을 줄인다.
- jyaldi_face_sheet.png (2×2) → face_jyaldi_0..3.png (평소·맞음·위급·필살), 40×40 도트
- ui_frame_sheet.png → panel / row / portrait / bar / slot 조각 (9칸 자르기 기준점은 kit.gen.ts 에 함께)
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
    lines.append(f"export const PIXEL_FONT_URL = '{url(FONT, 'font/woff2')}';")
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print('wrote', OUT, OUT.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
