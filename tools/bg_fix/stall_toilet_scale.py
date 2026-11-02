"""대변기 칸: 변기(배관 포함)만 줄여 보기 (2026-11-01 14:44 사용자 「변기가 좀 큰가?」 → 「한번 테스트 해봐」, 생성 없음).
stall_toilet_raise.py 와 같은 방법으로 변기 픽셀(통째로 R 위로 올린 것)을 떼어 낸 뒤, 변기 아래 가운데(바닥 닿는 점)를 기준으로
S 배로 줄여(NEAREST) 다시 얹는다. 변기가 비운 자리는 raise_toilet 과 같은 벽 메움 그대로.
출력: stall_body_tall_s<S>.png, stall_body_end_tall_s<S>.png (원본은 그대로)
사용: python3 tools/bg_fix/stall_toilet_scale.py [S=0.65]"""
import sys
src = open('tools/bg_fix/stall_toilet_raise.py', encoding='utf-8').read()
head = src[:src.index("raise_toilet('stall_body.png'")]
head = head.replace("R = int(sys.argv[3]) if len(sys.argv) > 3 else 14", "R = 14")
head = head.replace("    A = out[..., 3] > 0\n    b[A] = out[A]\n    Image.fromarray(b).save(D + p_out)", "    return b, out")
g = {}
exec(compile(head, 'stall_toilet_raise.py', 'exec'), g)
import numpy as np
from PIL import Image
S = float(sys.argv[1]) if len(sys.argv) > 1 else 0.65
D = g['D']
for p_in, p_out in [('stall_body.png', 'stall_body_tall'), ('stall_body_end.png', 'stall_body_end_tall')]:
    b, out = g['raise_toilet'](p_in, None)
    t = Image.fromarray(out)
    bb = t.getbbox()
    c = t.crop(bb)
    w, h = max(1, round(c.width * S)), max(1, round(c.height * S))
    c2 = c.resize((w, h), Image.NEAREST)
    # 바닥 닿는 점(변기 아래 가운데)은 그대로
    cx, by = (bb[0] + bb[2]) / 2, bb[3]
    base = Image.fromarray(b)
    base.alpha_composite(c2, (round(cx - w / 2), by - h))
    tag = f'{p_out}_s{round(S * 100)}.png'
    base.save(D + tag)
    print(tag, 'toilet', bb, '->', (w, h))
