"""본부 B1 샤워실 선 가이드 v2(사용자 14:50 「오른쪽 벽은 어쩔건데, 출입문을 오른쪽 벽에, 밑에 통로가 없잖아」).
v1에서 바꾼 것: 입구를 뒷벽이 아니라 오른쪽 옆벽(원근으로 비스듬히 보이는 벽)에 둠, 칸막이 벽은 y360에서 끝나 그 아래 앞쪽 통로(y360~424)를 비움.
632×424 투명 바탕, 검은 1px 선. 뒷벽 x0~548, 밑선 y286, 천장선 y40. 오른쪽 옆벽: 위 (548,40)→(631,4), 밑 (548,286)→(631,352).
옆벽 문: 앞뒤 x566~612, 문 위는 옆벽 위선과 나란히, 문 밑은 옆벽 밑선 위.
칸막이 벽 2개 x 60·400 중심(v4: 사용자 14:54 「간격 더 늘려야해」 → 사이 340px; v3은 110·330), 폭 12, 위 y70 ~ 앞 끝 y360, 양면 샤워기 표시(y150).
사용: python3 guide_hq_bath_v3.py <출력폴더>"""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]
W, H = 632, 424
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im); K = (0, 0, 0, 255)
BX = 548
d.line([(0, 40), (BX, 40)], fill=K); d.line([(0, 286), (BX, 286)], fill=K); d.line([(BX, 40), (BX, 286)], fill=K)
d.line([(BX, 40), (W - 1, 4)], fill=K); d.line([(BX, 286), (W - 1, 352)], fill=K)       # 오른쪽 옆벽
fy = lambda x: 286 + (x - BX) * (352 - 286) / (W - 1 - BX)       # 옆벽 밑선
ty = lambda x: 40 + (x - BX) * (4 - 40) / (W - 1 - BX)           # 옆벽 위선
dh = lambda x: (fy(x) - ty(x)) * 0.62                            # 문 높이(벽 높이의 62%)
a, b = 566, 612
d.polygon([(a, fy(a)), (a, fy(a) - dh(a)), (b, fy(b) - dh(b)), (b, fy(b))], outline=K)   # 입구 문
for cx in (60, 400):
    d.rectangle([cx - 5, 41, cx + 5, 360], fill=(0, 0, 0, 0))
    d.rectangle([cx - 6, 70, cx + 6, 360], outline=K)
    d.line([(cx - 6, 150), (cx - 18, 150), (cx - 18, 156)], fill=K)
    d.line([(cx + 6, 150), (cx + 18, 150), (cx + 18, 156)], fill=K)
im.save(P + '/hq_bath_guide_v4.png')
bg = Image.new('RGBA', (W, H), (235, 235, 230, 255)); bg.alpha_composite(im)
bg.resize((W * 2, H * 2), Image.NEAREST).save(P + '/hq_bath_guide_v4_x2_view.png')
# 보기용: 에일린(2배 키 334)을 칸막이 사이 앞 통로와 벽 사이 안쪽에 세워 크기 확인(가이드 파일에는 안 들어감)
from pathlib import Path
e = Image.open(Path(__file__).resolve().parents[1] / 'mapedit/eileen_stand.png').convert('RGBA')
v = Image.open(P + '/hq_bath_guide_v4_x2_view.png').convert('RGBA')
for fx, fy2, hh in ((460, 846, 334), (300, 640, 250), (620, 640, 250)):
    s = e.resize((max(1, round(e.width * hh / e.height)), hh), Image.NEAREST)
    v.alpha_composite(s, (fx - s.width // 2, fy2 - hh))
v.save(P + '/hq_bath_guide_v4_x2_view.png')
