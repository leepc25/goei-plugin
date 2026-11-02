"""중림 통로 ⑤ 가이드(사용자 10-31 「한 장에 셔터랑 입구를 같이」): v6과 같은 천장 선 y26·통행로 선 y262, 투명 바탕.
가게 자리(양끝 10% 안)에 사각형 둘: 왼쪽 닫힌 셔터 가게 x80~350, 오른쪽 뒷골목 통로 입구 x380~540(둘 다 y66~262)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
CY, FY = 26, 262
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
d.line([(0, CY), (W, CY)], fill=K); d.line([(0, FY), (W, FY)], fill=K)
d.rectangle([80, 66, 350, FY], outline=K)
d.rectangle([380, 66, 540, FY], outline=K)
im.save(P + '/jr_corridor_guide_v7.png')
