"""중림 지상 거리 가이드 v3(사용자 10-31): 선 y26 가게 앞면 윗선(간판 위 = 그림 위 끝), y280 인도와 건물이 닿는 선(인도 약 30%),
y405 연석(그 아래 아주 얇은 차도 띠). 사각형 x440~631 y110~330 오른쪽 끝 지하상가 출입구 앞부분."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
for y in (26, 280, 405): d.line([(0, y), (W, y)], fill=K)
d.rectangle([440, 110, 631, 330], outline=K)
im.save(P + '/jr_street_guide_v3.png')
