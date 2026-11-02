"""백일몽 오른쪽 잇기5 밑그림(p6 바탕, 창 keep352 new160 ov60): p6 오른쪽 바깥 기둥 532~580을 지우지 않고 보이게 둠.
선 = 건물 밑선 294·304 + 다음 기둥 p6 x687(간격 155) → 창 x407~454."""
from PIL import Image, ImageDraw
import sys
im = Image.new('RGBA', (512, 424), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (40, 44, 52, 255)
for y in (294, 304): d.line([(0, y), (511, y)], fill=K, width=2)
d.rectangle([407, 0, 454, 304], outline=K, width=2)
im.save(sys.argv[1] + '/by_street_ext_guide5_R.png')
