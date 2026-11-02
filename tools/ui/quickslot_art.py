# 퀵슬롯 칸 그림 = 전에 뽑아 둔 칸 16안 중 15번(game-src/art/ui/pixellab/slot_14.png), 테두리 안 50x50만 잘라 TS로.
# 사용: python3 tools/ui/quickslot_art.py
import base64, io
from PIL import Image
im = Image.open('game-src/art/ui/pixellab/slot_14.png').convert('RGBA'); im = im.crop(im.getbbox())
b = io.BytesIO(); im.save(b, 'PNG')
open('src/game/action/ui/quickSlotArt.ts', 'w').write(
  '// tools/ui/quickslot_art.py 가 만든다. 손으로 고치지 말 것\n'
  f'// 퀵슬롯 칸(칸 16안 15번, {im.width}x{im.height}) — 통합창 소지품 탭 퀵슬롯에 2배로\n'
  f'export const QUICK_SLOT = "data:image/png;base64,{base64.b64encode(b.getvalue()).decode()}";\n')
print(im.size)
