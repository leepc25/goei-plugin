"""사무실 p6 이음 자리 굵은 배관 끊김(x368~379) 코드 손질 — 사용자 11-02 07:13 「이부분 코드로 고쳐」(41%,19%).
왼쪽 배관 몸통 한 열(x350, y69~84)을 끊긴 칸에 그대로 반복해 채운다. 그 밖의 픽셀은 손대지 않는다."""
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA'); px = im.load()
col = [px[350, y] for y in range(69, 85)]
for x in range(368, 380):
    for i, y in enumerate(range(69, 85)): px[x, y] = col[i]
im.save(out); print('changed x368-379 y69-84')
