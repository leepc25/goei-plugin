"""관리국 본부 복도 가이드 v1(사용자 10-31): 투명 바탕에 선만. 층마다 복도 한 장(이어 붙이지 않음) — 지킬 것은 사람 크기와 걷는 바닥.
선 y26 천장 끝, y262 걷는 바닥이 뒷벽에 닿는 선(중림 통로와 같은 자리 → 문 높이 160~180px로 나옴), 사각형 x490~600 y66~262 = 오른쪽 끝 뒷벽 엘리베이터(모든 층 같은 자리)."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
d.line([(0, 26), (W, 26)], fill=K); d.line([(0, 262), (W, 262)], fill=K)
d.rectangle([490, 66, 600, 262], outline=K)
im.save(P + '/hq_corridor_guide_v1.png')
