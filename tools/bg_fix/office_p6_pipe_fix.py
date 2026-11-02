"""사무실 p6 이음 자리 굵은 배관 끊김(x368~379) 코드 손질 — 사용자 11-02 07:13 「이부분 코드로 고쳐」(41%,19%).
v2(07:25 「제대로 한거냐」: 한 열 반복은 납작한 띠): 왼쪽 배관 몸통 12열 덩어리(x338~349, y69~84, 위 밝은 띠 포함)를 그대로 옮겨 붙인다.
사용: python3 office_p6_pipe_fix.py <in> <out> [x 밀기(p7처럼 왼쪽에 이어 붙였으면 그 폭)]"""
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]; dx = int(sys.argv[3]) if len(sys.argv) > 3 else 0
im = Image.open(src).convert('RGBA')
im.paste(im.crop((338 + dx, 69, 350 + dx, 85)), (368 + dx, 69))
im.save(out); print('changed x', 368 + dx, '-', 379 + dx, 'y69-84')
