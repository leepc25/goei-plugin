# 의무실 p9_fix2(872x424) 침대 앞 난간 가림 — 픽셀 지도(밝기 4단계 글자)를 줄마다 눈으로 읽고 손으로 적은 값.
# 오른쪽 두 침대 = p6 값(infirmary_bed_front.py) + 240(왼쪽 잇기 폭). 왼쪽 뒤 침대(bed3_left)는 12:03 새로 읽음.
import sys; sys.path.insert(0, 'tools/objects')
from PIL import Image
from infirmary_bed_front import BEDS as P6
OFF = 240
BEDS = {k: {'ROWS': {y: (a + OFF, b + OFF) for y, (a, b) in v['ROWS'].items()},
            'HOLES': [(a + OFF, y0, b + OFF, y1) for a, y0, b, y1 in v['HOLES']]} for k, v in P6.items()}
BEDS['bed3_left'] = {
    'ROWS': {247: (215, 278), 248: (213, 279), 249: (212, 280), **{y: (211, 281) for y in range(250, 266)}, 266: (212, 280)},
    'HOLES': [(a, 251, b, 262) for a, b in [(215, 222), (226, 233), (237, 244), (249, 255), (260, 267), (271, 278)]],
}
BG = 'game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p9_fix2.png'
def mask(size=(872, 424)):
    m = Image.new('L', size, 0); px = m.load()
    for b in BEDS.values():
        for y, (x0, x1) in b['ROWS'].items():
            for x in range(x0, x1 + 1): px[x, y] = 255
        for x0, y0, x1, y1 in b['HOLES']:
            for y in range(y0, y1 + 1):
                for x in range(x0, x1 + 1): px[x, y] = 0
    return m
if __name__ == '__main__':
    bg = Image.open(BG).convert('RGBA')
    out = Image.new('RGBA', bg.size, (0, 0, 0, 0)); out.paste(bg, (0, 0), mask())
    out.save('game-src/art/objects/infirmary/p9_bed_rails_front.png')
