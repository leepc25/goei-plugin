"""기술 칸 이름 글자를 Galmuri14(가는 도트 글꼴, OFL)로 미리 그려 src/game/action/ui/hudLabels.ts(흰 글자 데이터 URL)로 만든다.
글꼴 파일은 저장소에 넣지 않는다(5.6MB): `npm pack galmuri` 로 받아 dist/Galmuri14.ttf 경로를 넘긴다.
  python3 tools/render_hud_labels.py <Galmuri14.ttf>"""
import base64, io, json, sys
from PIL import Image, ImageDraw, ImageFont
LABELS = ['약공', '강공', '사격', '충전', '기술', '필살']
f = ImageFont.truetype(sys.argv[1], 14)
out = {}
for s in LABELS:
    im = Image.new('L', (80, 24), 0)
    d = ImageDraw.Draw(im); d.fontmode = '1'
    d.text((2, 2), s, font=f, fill=255)
    im = im.crop(im.getbbox())
    rgba = Image.new('RGBA', im.size, (255, 255, 255, 0)); rgba.putalpha(im.point(lambda v: 255 if v > 127 else 0))
    b = io.BytesIO(); rgba.save(b, 'PNG', optimize=True)
    out[s] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
open('src/game/action/ui/hudLabels.ts', 'w').write('// tools/render_hud_labels.py 가 만든다 (Galmuri14, SIL OFL 1.1 — https://github.com/quiple/galmuri). 손으로 고치지 말 것\n'
    'export const HUD_LABELS: Record<string, string> = ' + json.dumps(out, ensure_ascii=False) + ';\n')
print(len(out))
