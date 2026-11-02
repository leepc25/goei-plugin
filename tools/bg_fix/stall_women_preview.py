"""여자 화장실 미리보기 (2026-11-01 13:57~13:58 사용자 「여자화장실은 이걸 고대로 카피」, 「대신 대변기칸을 여기부터 채운다」,
「여자화장실은 소변기칸이 필요 없으니까」): 남자 화장실 확정판(배경 v2 + 칸 오브젝트) 그대로, 칸 줄 오른쪽 끝만
소변기 벽 오른쪽 경계선 x667(소변기 벽과 검은 건조기 기둥 사이)로 옮겨 왼쪽으로 칸을 채운다. 생성 없음.
사용: python3 stall_women_preview.py <출력.png> <에일린.png> [문 상태 예: 0,0,0,0,0] [noagent]"""
import sys
from PIL import Image
D = 'game-src/art/objects/restroom/'
BG = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_v2_984x424.png'
body = Image.open(D + 'stall_body_tall.png').convert('RGBA'); body_end = Image.open(D + 'stall_body_end_tall.png').convert('RGBA')
endpost = Image.open(D + 'stall_endpost.png').convert('RGBA')
doors = [Image.open(D + f'stall_door_{i}.png').convert('RGBA') for i in range(6)]
FOOT, RIGHT, PITCH = 368, 668, 158             # 끝 기둥 오른쪽 끝(캔버스 x205) = 경계선 x667
N = 1
L0 = 45                                         # 몸통 캔버스에서 맨 왼쪽 불투명 열
while RIGHT - 206 - PITCH * (N - 1) + L0 > 0: N += 1   # 맨 왼쪽 칸이 화면 왼쪽 끝을 덮을 때까지
xs = [RIGHT - 206 - PITCH * i for i in range(N)]
y = FOOT - 252
states = [int(v) for v in sys.argv[3].split(',')] if len(sys.argv) > 3 and sys.argv[3][0].isdigit() else [0] * N
bg = Image.open(BG).convert('RGBA')
# 13:59 사용자 「오른쪽 두칸 메워야지」: 소변기 벽(x413~666) 윗판이 칸 문 위 틈으로 보임 → 같은 줄(y145~175)의 왼쪽 민 벽(x140~393)으로 메움
bg.paste(bg.crop((140, 145, 394, 176)), (413, 145))
CUT = 10                                        # 13:59 사용자 「여기부터 왼쪽으로 잘라버려」: 맨 왼쪽 기둥의 걸쇠(x4~9)까지 잘라 냄
bg.crop((CUT, 0, 984, 424)).save('game-src/art/pixellab-hq-20261031/hq_restroom_w_bg_974x424.png')   # 여자 화장실 배경(칸 x는 -CUT)
for i, x in enumerate(xs): bg.alpha_composite(body_end if i == 0 else body, (x, y))
bg.alpha_composite(endpost, (xs[0], y))
front = Image.new('RGBA', bg.size, (0, 0, 0, 0))
for i, x in enumerate(xs):
    bb_ = body_end if i == 0 else body
    front.alpha_composite(bb_.crop((170, 0, bb_.width, bb_.height)), (x + 170, y))
    front.alpha_composite(bb_.crop((44, 0, 76, bb_.height)), (x + 44, y))
front.alpha_composite(endpost, (xs[0], y))
bg.alpha_composite(front)
for x, s in reversed(list(zip(xs, states))): bg.alpha_composite(doors[s], (x, y))   # 왼쪽 칸 문부터
bg = bg.crop((CUT, 0, bg.width, bg.height))
big = bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST)
if 'noagent' not in sys.argv:
    e = Image.open(sys.argv[2]); big.alpha_composite(e, (20, 840 - e.height))
big.convert('RGB').save(sys.argv[1])
print('xs', xs)
