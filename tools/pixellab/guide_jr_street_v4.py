"""중림 지상 거리 가이드 v4(사용자 10-31 「지하상가 출입구 너무 작아 뒤에 셔터에 비해서」): v3에서 입구 사각형만 키움.
선 y26·y280·y405 그대로, 사각형 x400~631 y60~330(셔터 높이만큼, 오른쪽 끝 밖으로 이어짐)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
for y in (26, 280, 405): d.line([(0, y), (W, y)], fill=K)
d.rectangle([400, 60, 631, 330], outline=K)
im.save(P + '/jr_street_guide_v4.png')
