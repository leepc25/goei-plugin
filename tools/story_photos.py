# 대사 시연판용 작은 얼굴 사진 (assets/agents/*_default.avif → 144px webp, base64 JSON).
# 사용: python3 tools/story_photos.py  → src/game/action/story/demo-photos.json
import base64, io, json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
NAMES = ['Jyaldi', 'Aileen', 'Spangdal', 'Geshugan', 'Gorgodio', 'Kyuras', 'Deadpole', 'Rojemon',
         'Jaemtri', 'Gognija', 'Dejure', 'Konjyuce', 'Ma Deok-hee']
out = {}
for n in NAMES:
    im = Image.open(ROOT / 'assets/agents' / f'{n}_default.avif').convert('RGBA')
    w, h = im.size
    a = im.getchannel('A')
    top = a.crop((0, 0, w, int(h * 0.4))).getbbox() or (0, 0, w, h)
    cx = (top[0] + top[2]) // 2
    side = int(w * 0.5)
    y0 = max(0, top[1] + int(h * 0.02))
    x0 = max(0, min(w - side, cx - side // 2))
    crop = im.crop((x0, y0, x0 + side, y0 + side)).resize((144, 144), Image.LANCZOS)
    bg = Image.new('RGBA', crop.size, (29, 38, 43, 255))
    bg.alpha_composite(crop)
    buf = io.BytesIO()
    bg.convert('RGB').save(buf, 'WEBP', quality=72, method=6)
    out[n] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
dst = ROOT / 'src/game/action/story/demo-photos.json'
dst.write_text(json.dumps(out, ensure_ascii=False))
print(dst, sum(len(v) for v in out.values()))
