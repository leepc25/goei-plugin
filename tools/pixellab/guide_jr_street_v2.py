"""중림 지상 거리 가이드 v2(사용자 10-31 「그래」): v1 + 맨 위 선 y26(지하 통로 천장 선과 같은 자리) = 가게 간판·차양 윗선, 그 위는 그림 밖.
v1·v2 결과: 「1층만」이라 써도 2층 이상까지 그려 전체가 작아짐(가게 문 100~115px < 뒤 에일린 140px) → 위 한계선을 준다.
선: y26 가게 앞면 윗선, y262 인도와 건물이 닿는 선, y390 연석. 사각형 x440~631 y110~330 오른쪽 끝 지하상가 출입구 앞부분."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
for y in (26, 262, 390): d.line([(0, y), (W, y)], fill=K)
d.rectangle([440, 110, 631, 330], outline=K)
im.save(P + '/jr_street_guide_v2.png')
