"""중림 지상 거리 가이드 v1(사용자 10-31): 투명 바탕에 선만. 통로 가이드와 같은 높이 기준.
위 가로선 y262 = 인도가 건물 앞면과 만나는 선(바닥 38%), 아래 가로선 y390 = 연석(인도 끝, 그 아래 차도 띠 8%),
사각형 x440~631 y110~330 = 오른쪽 끝에 빼꼼 보이는 지하상가 출입구 앞부분(지붕 위 간판 포함), 나머지는 오른쪽 화면 밖으로 이어짐."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
d.line([(0, 262), (W, 262)], fill=K); d.line([(0, 390), (W, 390)], fill=K)
d.rectangle([440, 110, 631, 330], outline=K)   # 사용자 10-31: 길게가 아니라 오른쪽 끝에서 입구만 빼꼼, 나머지는 화면 밖으로 이어짐
im.save(P + '/jr_street_guide_v1.png')
