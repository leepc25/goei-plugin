"""대변기 칸 변기 바꾸기 (2026-11-01 13:30 사용자가 웹에서 뽑은 변기 toilet8/toilet_user_1330.png, 생성 없음)
1) 칸 몸통에서 옛 변기·벽 밸브를 지운다(벽은 줄마다 양옆 벽 색을 이어 메우고, 바닥 쪽은 투명).
2) 미리보기: 새 변기를 요원과 같은 배율로 칸마다 놓고, 가운데 칸 문을 열어 큐라스(102 첫 장)를 좌석에 앉힌다.
사용: python3 stall_toilet_swap.py <출력.png> <에일린2배.png> [full]"""
import sys
import numpy as np
from PIL import Image
D = 'game-src/art/objects/restroom/'
SRC = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_stalls_v2.png'
X0 = 14                                            # 캔버스 x = 원본 x - 14
a = np.array(Image.open(SRC).convert('RGBA')).astype(int)
L = a[..., :3].mean(2)

def strip(p_in, p_out):
    b = np.array(Image.open(D + p_in).convert('RGBA'))
    H = b.shape[0]
    for y in range(148, 226):                      # 벽: 변기·밸브 자리(원본 x128~172)를 줄마다 양끝 벽 색으로 이음
        l, r = a[y, 127, :3], a[y, 173, :3]
        for x in range(128, 173):
            t = (x - 127) / 46
            b[y, x - X0, :3] = np.round(l * (1 - t) + r * t); b[y, x - X0, 3] = 255
    b[226, 128 - X0:173 - X0] = [1, 1, 1, 255]     # 벽 밑 검은 선 이어 그림
    b[227:, 128 - X0:173 - X0, 3] = 0              # 바닥 쪽은 투명(배경 바닥이 보임)
    Image.fromarray(b.astype(np.uint8)).save(D + p_out)

strip('stall_body.png', 'stall_body_notoilet.png')
strip('stall_body_end.png', 'stall_body_end_notoilet.png')

body = Image.open(D + 'stall_body_notoilet.png'); body_end = Image.open(D + 'stall_body_end_notoilet.png')
endpost = Image.open(D + 'stall_endpost.png').convert('RGBA')
doors = [Image.open(D + f'stall_door_{i}.png').convert('RGBA') for i in range(6)]
BG = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_984x424.png'
FOOT, RIGHT, PITCH, N = 368, 398, 158, 3
xs = [RIGHT - 206 - PITCH * i for i in range(N)]
y = FOOT - 252
K = 334 / 234                                      # 요원과 같은 2배 화면 배율
toilet = Image.open(D + 'toilet8/toilet_user_1330.png').convert('RGBA')
tb = toilet.getbbox()
toilet = toilet.crop(tb); toilet = toilet.resize((round(toilet.width * K), round(toilet.height * K)), Image.NEAREST)
SEAT = ((79 - tb[0]) * K, (132 - tb[1]) * K)       # 좌석 가운데(원본 그림 79,132)
TCX, TFOOT = 120, 244                           # 칸 캔버스: 변기 가운데 x120(요원 다리가 기둥에 덜 가리게 왼쪽으로), 밑동 y244
kyu = Image.open('game-src/action/motion3/1.6_큐라스/102/00.png').convert('RGBA')
kyu = kyu.resize((round(kyu.width * K), round(kyu.height * K)), Image.NEAREST)
HIP = (65 * K, 167 * K)                            # 큐라스 엉덩이(원본 65,167)
states = [0, 5, 5]
bg = Image.open(BG).convert('RGBA')
for i, x in enumerate(xs): bg.alpha_composite(body_end if i == 0 else body, (x, y))
bg.alpha_composite(endpost, (xs[0], y))
big = bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST)
for i, x in enumerate(xs):
    tx = round((x + TCX) * 2 - toilet.width / 2); ty = round((y + TFOOT) * 2 - toilet.height)
    big.alpha_composite(toilet, (tx, ty))
    if i == 1:
        big.alpha_composite(kyu, (round(tx + SEAT[0] - HIP[0]), round(ty + SEAT[1] - HIP[1])))
# 칸 앞면(기둥)은 앉은 요원보다 앞: 몸통의 가운데 기둥(캔버스 x170~)·왼쪽 기둥(x44~75)을 다시 덮음
front = Image.new('RGBA', bg.size, (0, 0, 0, 0))
for i, x in enumerate(xs):
    bb_ = body_end if i == 0 else body
    front.alpha_composite(bb_.crop((170, 0, bb_.width, bb_.height)), (x + 170, y))
    front.alpha_composite(bb_.crop((44, 0, 76, bb_.height)), (x + 44, y))
front.alpha_composite(endpost, (xs[0], y))
big.alpha_composite(front.resize((bg.width * 2, bg.height * 2), Image.NEAREST))
dl = Image.new('RGBA', bg.size, (0, 0, 0, 0))
for x, s in zip(xs, states): dl.alpha_composite(doors[s], (x, y))
big.alpha_composite(dl.resize((bg.width * 2, bg.height * 2), Image.NEAREST))
e = Image.open(sys.argv[2]); big.alpha_composite(e, (20, 840 - e.height))
full = len(sys.argv) > 3 and sys.argv[3] == 'full'
(big if full else big.crop((0, 0, 1100, 848))).convert('RGB').save(sys.argv[1])
print(xs, toilet.size)
