"""백일몽 잇기6 밑그림(사용자 15:56): R = ext5R 원기둥 앞 x672에서 자른 판 바탕, 창 keep352(x320~672) new160 ov60 → p6 바깥 기둥 532~580 = 창 212~260 보임, 다음 기둥 x687 = 창 367~414.
L = ext5L(952) 바탕, 창 keep352 new160 ov100 → 기존 기둥 12~55·215~255 = 창 172~215·375~415, 새 기둥 창 12~55. 선 = 건물 밑선 294·304."""
from PIL import Image, ImageDraw
import sys
for side, pillars in (('R', ((367, 414),)), ('L', ((12, 55), (172, 215)))):
    im = Image.new('RGBA', (512, 424), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (40, 44, 52, 255)
    for y in (294, 304): d.line([(0, y), (511, y)], fill=K, width=2)
    for x0, x1 in pillars: d.rectangle([x0, 0, x1, 304], outline=K, width=2)
    im.save(f'{sys.argv[1]}/by_street_ext_guide6_{side}.png')
