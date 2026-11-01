# 통합창 조각 자르기 (11-01): 지난 스레드에서 뽑은 PixelLab 그림(창 틀 window_empty/window_0, 카드 틀, 뱃지 테)을 잘라
# src/game/action/ui/charWindowArt.ts 로 넣는다. 새 생성 없음.
import base64, io, json
from PIL import Image
D = 'game-src/art/ui/char_window/parts/'
we = Image.open(D + 'src_window_empty.png').convert('RGBA')
w0 = Image.open(D + 'src_window_0.png').convert('RGBA')
out = {}
def keep(name, im, **meta):
    im.save(D + name + '.png')
    b = io.BytesIO(); im.save(b, 'PNG')
    out[name] = {'src': 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode(), 'w': im.width, 'h': im.height, **meta}
keep('panel', we.crop((23, 83, 213, 257)), slice=[16, 16, 16, 16])
keep('banner', we.crop((22, 11, 620, 78)), slice=[0, 72, 0, 72])
# 탭: 원본 STATS 이름표에서 글자를 지운다 (글자 줄은 같은 줄 왼쪽 안쪽 색으로 덮음)
tab = w0.crop((74, 86, 164, 106)).copy()
px = tab.load()
for y in range(tab.height):
    base = px[14, y]
    for x in range(14, tab.width - 14):
        px[x, y] = base
keep('tab', tab.transpose(Image.FLIP_TOP_BOTTOM), slice=[0, 14, 0, 14])
keep('card', Image.open(D + 'src_card_2.png').convert('RGBA'), slice=[14, 14, 14, 14])
keep('rim', Image.open(D + 'src_rim_9.png').convert('RGBA'))
open('src/game/action/ui/charWindowArt.ts', 'w').write('// tools/cut_char_window.py 가 만든다. 손으로 고치지 말 것\nexport const CW_ART = ' + json.dumps(out) + ' as const;\n')
print({k: (v['w'], v['h']) for k, v in out.items()})
