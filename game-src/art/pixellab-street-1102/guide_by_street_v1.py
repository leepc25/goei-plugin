"""백일몽 거리 선 밑그림 v1 (사용자 11-02 14:58 「선 밑그림으로 문 크기 고정」 선택).
투명 바탕 검은 선. y263 건물이 인도에 닿는 선(바닥 38%), y385 연석. 가운데 문 x216~416 y40~263(인도~간판 바로 밑, 가운데 세로선 x316),
간판 글자 칸 x206~426 y8~34(석재 벽에 붙인 글자), 문 양옆 큰 기둥 x150~206·x426~482, 바깥 기둥 x0~40·x592~631."""
import sys
from PIL import Image, ImageDraw
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
for y in (263, 385): d.line([(0, y), (W - 1, y)], fill=K, width=2)
d.rectangle([216, 40, 416, 263], outline=K, width=2); d.line([(316, 40), (316, 263)], fill=K, width=2)
d.rectangle([206, 8, 426, 34], outline=K, width=2)
for x0, x1 in ((150, 206), (426, 482), (0, 40), (592, 631)): d.rectangle([x0, 0, x1, 263], outline=K, width=2)
im.save(sys.argv[1])
