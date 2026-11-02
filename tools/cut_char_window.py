# 통합창 조각 자르기 (11-01): PixelLab generate-ui-v2 한 장(game-src/art/ui/char_window/kit_0.png, 512x256)을 잘라
# src/game/action/ui/charWindowArt.ts 로 넣는다. 원래 크기(1배)로 찍는다.
import base64, io, json
from PIL import Image
D = 'game-src/art/ui/char_window/'
k = Image.open(D + 'kit_0.png').convert('RGBA')
out = {}
def keep(name, box, **meta):
    im = k.crop(box)
    im.save(D + 'parts/' + name + '.png')
    b = io.BytesIO(); im.save(b, 'PNG')
    out[name] = {'src': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), 'w': im.width, 'h': im.height, **meta}
keep('frame', (10, 8, 287, 176), slice=[14, 14, 14, 14])
keep('inner', (307, 30, 499, 150), slice=[12, 12, 12, 12])
keep('tab', (128, 194, 244, 232), slice=[12, 12, 12, 12])
keep('socket', (414, 170, 501, 248))
open('src/game/action/ui/charWindowArt.ts', 'w').write('// tools/cut_char_window.py 가 만든다. 손으로 고치지 말 것\nexport const CW_ART = ' + json.dumps(out) + ' as const;\n')
print({n: (v['w'], v['h']) for n, v in out.items()})
