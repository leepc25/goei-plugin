"""모바일 원형 버튼 시트 → src/game/action/ui/mobileButtons.gen.ts (docs/모바일조작/모바일_조작_설계.md).

원본 game-src/art/ui/pixellab/mobile/buttons_sheet_v1.png (512×256, 4×2, 순서: 약공격·강공격·회피·막기 / 점프·고유·필살·조사)를
그림은 그대로 두고 색 57개 팔레트 PNG 로만 다시 담는다(무손실, 57KB → 약 29KB). 칸마다 원의 자리는 시트에서 잰 값이다:
원은 가로 125px·세로 126px 간격, 지름 약 116px. 버튼은 118px 정사각을 잘라 쓴다.
"""
import base64
import io
from pathlib import Path

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'game-src/art/ui/pixellab/mobile/buttons_sheet_v1.png'
OUT = ROOT / 'src/game/action/ui/mobileButtons.gen.ts'

im = Image.open(SRC).convert('RGBA')
cols = [c for _, c in im.getcolors(4096)]
assert len(cols) <= 256 and all(c[3] in (0, 255) for c in cols)
idx = {c: i for i, c in enumerate(cols)}
pal = Image.new('P', im.size)
pal.putdata([idx[p] for p in im.get_flattened_data()] if hasattr(im, 'get_flattened_data') else [idx[p] for p in im.getdata()])
flat = []
for c in cols:
    flat += c[:3]
pal.putpalette(flat)
buf = io.BytesIO()
pal.save(buf, 'PNG', optimize=True, transparency=bytes(c[3] for c in cols))
back = Image.open(io.BytesIO(buf.getvalue())).convert('RGBA')
assert ImageChops.difference(im, back).getbbox() is None, '무손실이 아니다'
b64 = base64.b64encode(buf.getvalue()).decode()
cells = [[10 + 125 * (i % 4), 6 + 126 * (i // 4)] for i in range(8)]
OUT.write_text(
    '// tools/mobile_buttons_gen.py 가 만든 파일. 손으로 고치지 않는다.\n'
    '// PixelLab 모바일 원형 버튼 시트 v1 (game-src/art/ui/pixellab/mobile/buttons_sheet_v1.png, 무손실 팔레트 PNG).\n'
    f'export const BTN_SHEET = \'data:image/png;base64,{b64}\';\n'
    f'export const BTN_SHEET_W = {im.width}, BTN_SHEET_H = {im.height};\n'
    '/** 칸 하나 = 정사각 [왼쪽, 위], 한 변 BTN_CELL. 순서: 약공격·강공격·회피·막기·점프·고유·필살·조사 */\n'
    f'export const BTN_CELLS: [number, number][] = {cells};\n'
    'export const BTN_CELL = 118;\n'
    '/** 칸 안 원: 남색 안쪽 타원 반지름 (빈 틀을 만들 때 아이콘을 덮는다), 안쪽 색 */\n'
    "export const BTN_INNER = { rx: 48, ry: 46, color: '#292c3b' };\n",
    encoding='utf-8',
)
print(OUT, len(buf.getvalue()), 'bytes png')
