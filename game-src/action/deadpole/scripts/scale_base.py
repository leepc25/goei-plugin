# 편집한 쟈알디 크기 기준 그림을 데드폴 키(×0.88)로: BOX 축소 → 알파 0/255 → 원본 팔레트로 맞춤 → 발바닥 y=136, x = 원래 왼끝 + 2
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); x0, y0, x1, y1 = im.getbbox(); x0, y0 = min(x0, 36), min(y0, 37)   # 2차(e821)와 같은 원점 → 관절 기준점(gen.BASE_POSE) 그대로
c = im.crop((x0, y0, x1, y1)); w, h = round(c.width * 0.88), round(c.height * 0.88)
s = c.resize((w, h), Image.BOX)
pal = sorted({p[:3] for p in c.getdata() if p[3] > 0})
def snap(p): return min(pal, key=lambda q: (q[0]-p[0])**2 + (q[1]-p[1])**2 + (q[2]-p[2])**2)
px = s.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        px[x, y] = (*snap((r, g, b)), 255) if a >= 128 else (0, 0, 0, 0)
o = Image.new('RGBA', im.size, (0, 0, 0, 0)); o.paste(s, (x0 + 2, 136 - h)); o.save(out)
print(src, (x0, y0, x1, y1), '->', (w, h), o.getbbox())
