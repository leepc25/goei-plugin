# 은색 토큰 뱃지를 밝기 그대로 동·금으로 바꾼다(그라디언트 맵). 사용: python3 tools/badges/tint.py <입력.png> <출력 접두>
import sys
from PIL import Image
RAMPS = {  # 어두움 → 중간 → 밝음
  'bronze': [(40, 22, 12), (150, 84, 40), (236, 176, 120)],
  'gold':   [(56, 38, 6), (196, 146, 30), (255, 236, 150)],
}
def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def ramp(stops, v):
    t = v / 255
    return lerp(stops[0], stops[1], t * 2) if t < .5 else lerp(stops[1], stops[2], (t - .5) * 2)
def tint(im, stops):
    im = im.convert('RGBA'); px = im.load(); out = im.copy(); po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0: continue
            lum = round(.299 * r + .587 * g + .114 * b)
            po[x, y] = ramp(stops, lum) + (a,)
    return out
if __name__ == '__main__':
    src = Image.open(sys.argv[1])
    for k, st in RAMPS.items(): tint(src, st).save(f'{sys.argv[2]}_{k}.png')
