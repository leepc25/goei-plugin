"""백일몽 잇기 밑그림 v3(사용자 15:40 「잇기 할 때 좀 더 많이 줘봐」): 창 keep352 new160 ov100 → 옛 그림 252px 보임.
선 = 건물 밑선(294·304)만 + 기둥 48폭 160간격(p6 바깥 기둥 자리 기준: 왼창 48·208, 오른창 255·415)."""
from PIL import Image, ImageDraw
import sys
for side, pillars in (('L', (48, 208)), ('R', (255, 415))):
    im = Image.new('RGBA', (512, 424), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (40, 44, 52, 255)
    for y in (294, 304): d.line([(0, y), (511, y)], fill=K, width=2)
    for x in pillars: d.rectangle([x, 0, x + 47, 304], outline=K, width=2)
    im.save(f'{sys.argv[1]}/by_street_ext_guide3_{side}.png')
