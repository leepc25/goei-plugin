"""대변기 칸에 요원 앉혀 보기 (2026-11-01 사용자 「요원 하나 앉혀보고」, 생성 없음)
가운데 칸 문을 열고 큐라스 102(앉아 볼일, 남자 화장실이라 남자 요원) 첫 장을 변기 위에. 크기는 에일린 미리보기와 같은 배율(서 있는 키 234px → 2배 화면 334px).
사용: python3 stall_sit_preview.py <출력.png> <에일린2배.png> [full]"""
import sys
from PIL import Image
sys.argv += [] ; import importlib.util
D = 'game-src/art/objects/restroom/'
BG = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_984x424.png'
body = Image.open(D + 'stall_body.png').convert('RGBA')
body_end = Image.open(D + 'stall_body_end.png').convert('RGBA')
endpost = Image.open(D + 'stall_endpost.png').convert('RGBA')
doors = [Image.open(D + f'stall_door_{i}.png').convert('RGBA') for i in range(6)]
FOOT, RIGHT, PITCH, N = 368, 398, 158, 3
xs = [RIGHT - 206 - PITCH * i for i in range(N)]
y = FOOT - 252
K = 334 / 234                                   # 2배 화면 배율
SIT = 'game-src/action/motion3/1.6_큐라스/102/00.png'
states = [0, 5, 5]
bg = Image.open(BG).convert('RGBA')
for i, x in enumerate(xs): bg.alpha_composite(body_end if i == 0 else body, (x, y))
bg.alpha_composite(endpost, (xs[0], y))
big = bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST)
a = Image.open(SIT).convert('RGBA')
a = a.resize((round(a.width * K), round(a.height * K)), Image.NEAREST)
cx = (xs[1] + 133) * 2                          # 변기 가운데(캔버스 x133)
feet = (y + 244) * 2                            # 변기 밑동 앞(캔버스 y244)
bb = a.getbbox()
big.alpha_composite(a, (round(cx - (bb[0] + bb[2]) / 2), round(feet - bb[3])))
dl = Image.new('RGBA', bg.size, (0, 0, 0, 0))
for x, s in zip(xs, states): dl.alpha_composite(doors[s], (x, y))
big.alpha_composite(dl.resize((bg.width * 2, bg.height * 2), Image.NEAREST))
e = Image.open(sys.argv[2]); big.alpha_composite(e, (20, 840 - e.height))
full = len(sys.argv) > 3 and sys.argv[3] == 'full'
(big if full else big.crop((0, 0, 1100, 848))).convert('RGB').save(sys.argv[1])
print(xs, cx, feet)
