"""손길 대기실 배경에서 화분을 코드로 지운 새 판 (사용자 2026-11-02 13:27 「코드로 화분 지워봐」). 원본은 그대로 둔다.
화분 가림(coverMask, 2배) 을 1배로 줄여 1px 넓힌 자리 + 떨어진 잎을, 같은 줄 왼쪽 바닥(−60px)으로 메운다.
깔개(발판) 높이(1배 y≥391)에서는 왼쪽이 깔개라 왼쪽 위 바닥(−40, −35)에서 가져온다."""
import base64, io, json
from pathlib import Path
from PIL import Image, ImageFilter
ROOT = Path(__file__).resolve().parents[2]
D = ROOT / 'game-src/mapedit/jr_songil'
m = json.loads((D / 'map.json').read_text())
o = [o for o in m['objects'] if o['id'] == 'plant'][0]
mk = Image.open(io.BytesIO(base64.b64decode(o['coverMask'].split(',', 1)[1]))).convert('L')
full = Image.new('L', (632, 424), 0)
full.paste(mk.resize((mk.width // 2, mk.height // 2), Image.NEAREST), (o['x'] // 2, o['y'] // 2))
full = full.point(lambda v: 255 if v > 127 else 0).filter(ImageFilter.MaxFilter(3))
for x in range(442, 464):
    for y in range(406, 422): full.putpixel((x, y), 255)   # 떨어진 잎
for x0, y0, x1, y1 in [(504, 342, 511, 356), (492, 385, 504, 417), (498, 408, 512, 422)]:   # 1차에 남은 잎 끝·화분 오른쪽 테·그림자
    for x in range(x0, x1):
        for y in range(y0, y1): full.putpixel((x, y), 255)
bg = Image.open(D / 'songil_v8_632x424.png').convert('RGB')
out = bg.copy(); px = out.load(); src = px; mp = full.load()   # 메운 화소를 다시 원천으로 (위·왼쪽부터 차례로)
for y in range(424):
    for x in range(632):
        if mp[x, y]:
            sx, sy = (x - 60, y) if y < 391 else (x - 40, y - 35)
            px[x, y] = src[sx, sy]
out.save(D / 'songil_v8_noplant_632x424.png')
full.save(D / 'songil_v8_noplant_mask.png')
print('ok', full.getbbox())
