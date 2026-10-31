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
if p.split('\n')[0] not in (want, b.split('\n')[0]):   # 끝 칸도 옆벽 문장 없이 같은 첫 줄 허용(사용자 10-31 ⑦ 천장 높이)
    pass
if p.split('\n')[0] not in (want, b.split('\n')[0]): fails.append('첫 줄(장소·카메라·원근·바닥 몫·옆벽)이 앞골목 ④와 다름')
if ('left' in sys.argv or 'right' in sys.argv) and not __import__('re').search(r'\bboth sides of the shop|left of the shop|right of the shop', p): pass
if '--same-shop' not in sys.argv and 'in the shop-sized space' not in p and not ('back wall, centered: a big ' in p and ('filling the middle 80 percent of the width, recessed like a deep lit room' in p or 'spanning the whole wall between the two empty edge strips, standing on the walkway floor line' in p or 'standing on the walkway floor line' in p and ('spanning the wall from the left empty strip to the fence' in p or 'spanning the wall from the left empty strip to the stairwell' in p))):   # 두 번째 틀: 가게 앞면이 바닥선에 섬(사용자 10-31 ⑥ 바닥 높이)
    fails.append('가게 줄 크기 틀(가운데·가로 80%·깊은 방)이 앞골목과 다름')
if end != 'left' and 'left 10 percent of the image: only bare back wall and floor' not in p: fails.append('왼쪽 10% 비움 줄 없음')
if end != 'right' and 'right 10 percent of the image: only bare back wall and floor' not in p: fails.append('오른쪽 10% 비움 줄 없음')
if 'reading "' in p and 'OPEN' not in p and not any(k in p for k in ('right above the opening, just under the ceiling strip','sign board','sign band','blade sign','hanging sign','empty sign board')): fails.append('간판 자리 문구 없음')
if ('neon sign reading' in p or 'awning' in p) and 'right above the opening, just under the ceiling strip' not in p: fails.append('네온·차양 간판은 자리를 「천장 띠 바로 아래·입구 바로 위」로 고정해야 함(사용자 10-31: 높이 안 맞음)')
if '--front-props' in sys.argv:   # 가게 양옆 벽 소품 금지(사용자 10-31 지하 2층: 80%+양끝 10%라 양옆 소품이 가게를 줄임)
    if 'left of the shop' in p or 'right of the shop' in p: fails.append('가게 양옆 벽 소품 있음(--front-props: 소품은 가게 앞면·앞 바닥·천장으로)')
elif 'left of the shop' not in p or 'right of the shop' not in p: fails.append('소품이 가게 양쪽에 나뉘어 있지 않음(left of the shop / right of the shop)')
# 금지 목록(STYLE 끝 「No …」)은 앞골목 ④와 같아야 함. 끝 칸만 그쪽 것(왼쪽 옆벽 / 오른쪽 계단)을 뺄 수 있음(사용자 10-31 지하 2층 v1: 가운데 칸에서 stairs·side walls를 빼 제각각)
import re as _re
_no = lambda t: _re.search(r'No (people.*?)\.\s*$', t.strip().split('\n')[-1])
bn, pn = _no(b), _no(p)
if not pn: fails.append('STYLE 끝 금지 목록(No …) 없음')
else:
    want_no = bn.group(1)
    ok = {want_no}
    if end == 'left': ok.add(want_no.replace(', stairs or side walls', ' or stairs'))
    if end == 'right': ok.add(want_no.replace(', stairs or side walls', ' or side walls'))
    if pn.group(1) not in ok: fails.append(f'금지 목록이 앞골목 ④와 다름: 「{pn.group(1)}」 ≠ 「{want_no}」')
# --same-shop: 가게 줄을 한 틀로(사용자 10-31 「전부 그림이 다르냐」): 폭 · 바닥선 · 가운데 문과 양옆 넓은 창 · 간판 자리
if '--same-shop' in sys.argv:
    m = _re.search(r'back wall, centered: a big [^;]*? front (filling the middle 80 percent of the width|spanning the wall from the [a-z ]+? to the [a-z ]+?), standing on the walkway floor line, [^;]*? in the middle and wide [^;]*? on both sides of it[^;]*; right above the opening, just under the ceiling strip, [^;]*reading "', p)
    if not m: fails.append('가게 줄이 공통 틀(a big X front 폭, standing on the walkway floor line, 문 in the middle and wide 창 on both sides of it; 간판 자리)과 다름')
for f in fails: print('FAIL', f)
if fails: sys.exit(1)
print('통과(앞골목 기준과 구조 같음)')
