"""본부 B1 샤워실 선 가이드 v1(사용자 2026-11-01 14:48 「투명배경에 선으로 가이드 짜서 줘야할거 같다」).
632×424 투명 바탕에 검은 1px 선만. 합의 배치(시안 v4, 14:14·14:36):
- 뒷벽 밑선 y286(여자 탈의실과 같은 높이), 천장선 y40.
- 입구 = 오른쪽: 뒷벽 오른쪽 끝 문틀 x512~600, y130~286.
- 입구 왼쪽에 칸막이 벽 3개: 뒷벽에서 화면 앞쪽으로 곧게(정면에서 봐서 모이지 않음) → 세로 띠 폭 12, x 90·230·370 중심, 위 y70~아래 y424.
- 벽 양면에 샤워기 3개씩: 띠 양옆 짧은 가로 꺾쇠(y150), 앞뒤 3자리는 바닥 위 발자리 점(y330·370·410).
사용: python3 guide_hq_bath_v1.py <출력폴더>"""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
d.line([(0, 40), (W - 1, 40)], fill=K)            # 천장선
d.line([(0, 286), (W - 1, 286)], fill=K)          # 뒷벽 밑선(바닥과 만나는 선)
d.rectangle([512, 130, 600, 286], outline=K)     # 오른쪽 입구 문틀
for cx in (90, 230, 370):                         # 칸막이 벽(뒷벽→앞쪽 곧게)
    d.rectangle([cx - 5, 41, cx + 5, H - 1], fill=(0, 0, 0, 0))   # 벽 앞에서 뒷벽 선 끊기
    d.rectangle([cx - 6, 70, cx + 6, H - 1], outline=K)
    for y in (150,):                              # 샤워기(양면)
        d.line([(cx - 6, y), (cx - 18, y), (cx - 18, y + 6)], fill=K)
        d.line([(cx + 6, y), (cx + 18, y), (cx + 18, y + 6)], fill=K)
im.save(P + '/hq_bath_guide_v1.png')
bg = Image.new('RGBA', (W, H), (235, 235, 230, 255)); bg.alpha_composite(im)
bg.resize((W * 2, H * 2), Image.NEAREST).save(P + '/hq_bath_guide_v1_x2_view.png')
print('ok')
