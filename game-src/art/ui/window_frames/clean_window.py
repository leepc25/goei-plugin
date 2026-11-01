# 창 틀 안쪽 비우기: 판 바탕색을 씨앗점에서 번져 찾고, 줄마다 양 끝 사이를 바탕색으로 메운다(글자·견본 지우기)
import sys
from PIL import Image
from collections import deque
im = Image.open('window_0.png').convert('RGBA'); px = im.load(); W, H = im.size
seeds = [tuple(map(int, s.split(','))) for s in sys.argv[1:]]
def flood(sx, sy):
    c = px[sx, sy]; seen = {(sx, sy)}; q = deque([(sx, sy)])
    while q:
        x, y = q.popleft()
        for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
            if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and px[nx, ny] == c:
                seen.add((nx, ny)); q.append((nx, ny))
    return c, seen
for sx, sy in seeds:
    c, reg = flood(sx, sy)
    rows = {}
    for x, y in reg: rows.setdefault(y, []).append(x)
    n = 0
    for y, xs in rows.items():
        for x in range(min(xs), max(xs)+1):
            if px[x, y] != c: px[x, y] = c; n += 1
    print((sx, sy), c, 'region', len(reg), 'filled', n)
im.save('window_clean.png')
