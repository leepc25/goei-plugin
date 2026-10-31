"""통로 칸 요청문을 기준(앞골목 ④ jr_b1_p4_v1)과 대조한다(사용자 10-31: 고정 문장·가게 크기 틀을 어겨 두 번 망침).
- 첫 줄(장소·카메라·원근·바닥 몫·옆벽)이 기준과 글자 그대로 같아야 함
- 가게 줄은 'back wall, centered: a big ' 로 시작하고 'filling the middle 80 percent of the width, recessed like a deep lit room' 을 담아야 함(셔터+통로 칸은 'in the shop-sized space')
- 양끝 비움 줄(이음 쪽)이 있어야 함
사용: python3 tools/pixellab/check_corridor_prompt.py <prompt.txt> [--end left|right]"""
import sys
BASE = 'game-src/art/pixellab-test-20261028/specs/jr_b1_p4_v1_prompt.txt'
p = open(sys.argv[1]).read(); b = open(BASE).read()
end = sys.argv[sys.argv.index('--end') + 1] if '--end' in sys.argv else None
fails = []
SIDE = {'left': "Only the left side wall is visible; on the right the room continues past the image edge.", 'right': "Only the right side wall is visible; on the left the room continues past the image edge."}
want = b.split('\n')[0]
if end: want = want.replace("No side walls: the room keeps going past both image edges.", SIDE[end])   # 끝 칸만 그쪽 옆벽(사용자 10-31: 끝 벽 처리 주의)
if p.split('\n')[0] != want: fails.append('첫 줄(장소·카메라·원근·바닥 몫·옆벽)이 앞골목 ④와 다름')
if ('left' in sys.argv or 'right' in sys.argv) and not __import__('re').search(r'\bboth sides of the shop|left of the shop|right of the shop', p): pass
if 'in the shop-sized space' not in p and not ('back wall, centered: a big ' in p and 'filling the middle 80 percent of the width, recessed like a deep lit room' in p):
    fails.append('가게 줄 크기 틀(가운데·가로 80%·깊은 방)이 앞골목과 다름')
if end != 'left' and 'left 10 percent of the image: only bare back wall and floor' not in p: fails.append('왼쪽 10% 비움 줄 없음')
if end != 'right' and 'right 10 percent of the image: only bare back wall and floor' not in p: fails.append('오른쪽 10% 비움 줄 없음')
for f in fails: print('FAIL', f)
if 'reading "' in p and 'OPEN' not in p and not any(k in p for k in ('right above the opening, just under the ceiling strip','sign board','sign band','blade sign','hanging sign','empty sign board')): fails.append('간판 자리 문구 없음')
if ('neon sign reading' in p or 'awning' in p) and 'right above the opening, just under the ceiling strip' not in p: fails.append('네온·차양 간판은 자리를 「천장 띠 바로 아래·입구 바로 위」로 고정해야 함(사용자 10-31: 높이 안 맞음)')
if 'left of the shop' not in p or 'right of the shop' not in p: fails.append('소품이 가게 양쪽에 나뉘어 있지 않음(left of the shop / right of the shop)')
if fails: sys.exit(1)
print('통과(앞골목 기준과 구조 같음)')
