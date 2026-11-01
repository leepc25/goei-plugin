"""대변기 칸 배치 미리보기: 확정 남자 화장실 배경에 칸 N개(몸통은 오른쪽부터, 문은 마지막에) + 에일린.
사용: python3 stall_place_preview.py <출력.png 또는 .gif> <에일린2배.png> [문 장면 목록 예: 0,0,5]"""
import sys
from PIL import Image
D = 'game-src/art/objects/restroom/'
BG = 'game-src/art/pixellab-hq-20261031/hq_restroom_m_final_984x424.png'
body = Image.open(D + 'stall_body.png').convert('RGBA')
doors = [Image.open(D + f'stall_door_{i}.png').convert('RGBA') for i in range(6)]
FOOT, RIGHT, PITCH, N = 368, 400, 158, 3      # 캔버스 x229 = 가운데 기둥 오른쪽 끝, 발 y252
xs = [RIGHT - 229 - PITCH * i for i in range(N)]
y = FOOT - 252
def render(states):
    bg = Image.open(BG).convert('RGBA')
    for x in xs: bg.alpha_composite(body, (x, y))
    for x, s in zip(xs, states): bg.alpha_composite(doors[s], (x, y))
    big = bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST)
    e = Image.open(sys.argv[2]); big.alpha_composite(e, (20, 840 - e.height))
    return big.crop((0, 0, 1100, 848)).convert('RGB')
out = sys.argv[1]
if out.endswith('.gif'):
    seq = [0, 0, 0, 1, 2, 3, 4, 5, 5, 5, 5, 4, 3, 2, 1, 0]
    fr = [render([0, s, 5]) for s in seq]
    fr[0].save(out, save_all=True, append_images=fr[1:], duration=[400 if s in (0, 5) else 80 for s in seq], loop=0)
else:
    render([int(v) for v in (sys.argv[3] if len(sys.argv) > 3 else '0,0,5').split(',')]).save(out)
print(xs)
