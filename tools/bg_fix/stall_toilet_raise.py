"""대변기 칸: 원래 변기로 되돌리고 높이만 올림 (2026-11-01 13:35 사용자 「기존 변기로 환원한 다음 높이를 높여보자」, 생성 없음)
변기를 모양 그대로 통째로 R px 위로 옮김(13:37 사용자 「늘이지 말고 위치를 올려」).
옛 자리는 벽 색으로 메우고(밸브는 그대로), 바닥 쪽은 투명.
사용: python3 stall_toilet_raise.py <미리보기.png> <에일린2배.png> [R=14] [full]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
D = 'game-src/art/objects/restroom/'
SRC = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_stalls_v2.png'
X0 = 14
R = int(sys.argv[3]) if len(sys.argv) > 3 else 14
WALL = 210                                        # 배경 벽 밑 띠 시작(배경 y326) = 칸 캔버스 y210
a = np.array(Image.open(SRC).convert('RGBA'))
L = a[..., :3].astype(int).mean(2)
box = np.zeros(L.shape, bool); box[186:244, 122:178] = True
fg = ((L > 112) | (L < 60)) & box
lab, n = nd.label(fg); sizes = nd.sum(fg, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
m = nd.binary_fill_holes(m); m = nd.binary_opening(m, iterations=1) | (m & (L < 60)); m = nd.binary_fill_holes(m)
m[226, :133] = False; m[226, 163:] = False        # 벽 밑 검은 선은 변기가 아님
# 13:37 사용자 「배관이랑 통채로」: 벽 밸브·배관(원본 x128~172, y148~187)도 같이 옮김
# 밸브: 네모(원본 x129~171, y144~188) 안에서 그 줄 벽 색(양옆 x117~128·172~183 중앙값)과 밝기가 10 넘게 다른 픽셀 = 밸브·배관·그늘
v = np.zeros(L.shape, bool)
for yy in range(144, 189):
    wl = np.median(np.r_[L[yy, 117:129], L[yy, 172:184]])
    v[yy, 129:172] = np.abs(L[yy, 129:172] - wl) > 10
v = nd.binary_opening(v, iterations=1) | (v & (L < 60))
v = nd.binary_fill_holes(v)
m |= v

def raise_toilet(p_in, p_out):
    b = np.array(Image.open(D + p_in).convert('RGBA'))
    tp = np.zeros_like(b)                          # 변기 픽셀(캔버스 좌표), 몸통에 남은 것 기준
    mc = np.zeros(b.shape[:2], bool); mc[:, :] = False
    mc[:, 122 - X0:178 - X0] = m[:, 122:178]
    tp[mc] = b[mc]
    for y in range(144, 226):                      # 옛 자리: 벽(줄마다 양끝 벽 색 이음)
        xs = np.nonzero(mc[y])[0]
        if not len(xs): continue
        l, r = b[y, xs.min() - 1, :3].astype(int), b[y, xs.max() + 1, :3].astype(int)
        for x in xs:
            t = (x - xs.min() + 1) / (xs.max() - xs.min() + 2)
            b[y, x, :3] = np.round(l * (1 - t) + r * t); b[y, x, 3] = 255
    b[226, 133 - X0:163 - X0] = [1, 1, 1, 255]
    b[227:][mc[227:]] = 0
    rows = list(range(186, 220)) + [220] * 0
    out = np.zeros_like(b)
    for y in range(144, 244): out[y - R] = tp[y]                     # 13:37 사용자: 늘이지 말고 변기 통째로 R 위로
    # 13:40 사용자 「뒤 벽을 땡겨 올리고 바닥 처리」: 칸 안 뒷벽(원본 x121~181)을 캔버스 y에서 끊어
    # 아래는 투명 → 배경의 벽 밑 띠(배경 y326~332)·바닥이 그대로 보임
    # 13:42 사용자 「휴지통 윤곽선 날라갔다」「옆도 맞춰야지」: 휴지통(캔버스 x89~107)은 남기고,
    # 왼쪽 칸막이 옆판(x73~88)은 아래 끝을 (73,226)→(88,WALL) 사선으로 다시 자르고 검은 선을 긋고,
    # 오른쪽 구석 솔(x166~172, y212~232)은 변기처럼 위로 옮김
    keep = np.zeros(b.shape[:2], bool); keep[205:238, 89:108] = b[205:238, 89:108, 3] > 0
    brush = b[212:233, 166:173].copy()
    b[212:233, 166:173, 3] = 0
    for yy in range(WALL, 227):
        for xx in range(73, 173):
            if keep[yy, xx]: continue
            if xx < 89:                                     # 옆판: 사선 아래만 지움
                edge = 226 - (xx - 73) * (226 - WALL) / (88 - 73)
                if yy > edge + 0.5: b[yy, xx, 3] = 0
                elif yy > edge - 0.5: b[yy, xx] = [1, 1, 1, 255]
            else:
                b[yy, xx, 3] = 0
    bm = brush[..., 3] > 0
    sub = b[212 - (226 - WALL):233 - (226 - WALL), 166:173]
    sub[bm] = brush[bm]
    A = out[..., 3] > 0
    b[A] = out[A]
    Image.fromarray(b).save(D + p_out)

raise_toilet('stall_body.png', 'stall_body_tall.png')
raise_toilet('stall_body_end.png', 'stall_body_end_tall.png')

body = Image.open(D + 'stall_body_tall.png'); body_end = Image.open(D + 'stall_body_end_tall.png')
endpost = Image.open(D + 'stall_endpost.png').convert('RGBA')
doors = [Image.open(D + f'stall_door_{i}.png').convert('RGBA') for i in range(6)]
BG = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_v2_984x424.png'   # 13:41 소변기 칸막이 손질판
FOOT, RIGHT, PITCH, N = 368, 398, 158, 3
xs = [RIGHT - 206 - PITCH * i for i in range(N)]
y = FOOT - 252
K = 334 / 234
kyu = Image.open('game-src/action/motion3/1.6_큐라스/102/00.png').convert('RGBA')
kyu = kyu.resize((round(kyu.width * K), round(kyu.height * K)), Image.NEAREST)
HIP = (65 * K, 167 * K)
SEAT = (147 - X0, 196 - R)                         # 좌석 가운데(캔버스)
states = [0, 5, 5]
bg = Image.open(BG).convert('RGBA')
for i, x in enumerate(xs): bg.alpha_composite(body_end if i == 0 else body, (x, y))
bg.alpha_composite(endpost, (xs[0], y))
big = bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST)
big.alpha_composite(kyu, (round((xs[1] + SEAT[0]) * 2 - HIP[0]), round((y + SEAT[1]) * 2 - HIP[1])))
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
full = 'full' in sys.argv[3:]
(big if full else big.crop((0, 0, 1100, 848))).convert('RGB').save(sys.argv[1])
print('R', R)
