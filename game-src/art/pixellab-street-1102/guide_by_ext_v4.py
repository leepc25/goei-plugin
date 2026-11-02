"""백일몽 왼쪽 잇기5 밑그림(ext4L 바탕, 창 keep352 new160): 건물 밑선 294·304 + 기둥(ext4L 기둥 52~94·207~253, 간격 약 155) → 창 기둥 57·212."""
from PIL import Image, ImageDraw
import sys
im = Image.new('RGBA', (512, 424), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (40, 44, 52, 255)
for y in (294, 304): d.line([(0, y), (511, y)], fill=K, width=2)
for x0, x1 in ((57, 100), (212, 254)): d.rectangle([x0, 0, x1, 304], outline=K, width=2)
im.save(sys.argv[1] + '/by_street_ext_guide4_L.png')
