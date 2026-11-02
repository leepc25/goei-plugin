"""v2(15:30 계단 생겨 바닥 선 빼고 건물 밑선만). 백일몽 거리 잇기 창 선 밑그림(사용자 11-02 15:25 「해」). 창 512x424, 투명 바탕 어두운 선.
수평선 = p6에서 잰 y: 건물 밑 294·304, 인도 줄 321·343, 연석 369·377·401, 차도 408. 기둥 48px 폭, 160px 간격(p6 바깥 기둥 자리에 맞춤)."""
from PIL import Image, ImageDraw
import sys
out = sys.argv[1]
for side, pillars in (('L', (8, 168, 328)), ('R', (135, 295, 455))):
    im = Image.new('RGBA', (512, 424), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (40, 44, 52, 255)
    for y in (294, 304): d.line([(0, y), (511, y)], fill=K, width=2)
    for x in pillars: d.rectangle([x, 0, x + 47, 304], outline=K, width=2)
    im.save(f'{out}/by_street_ext_guide2_{side}.png')
