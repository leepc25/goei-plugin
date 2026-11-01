# 동전 안쪽 투명 구멍(바깥과 이어지지 않은 투명)을 흰색으로 채운다. 사용: python3 fill_white.py sheet2_0.png out.png
import sys
from PIL import Image
from collections import deque
im = Image.open(sys.argv[1]).convert("RGBA"); W, H = im.size; px = im.load()
out = set(); q = deque()
for x in range(W):
    for y in (0, H-1): q.append((x, y))
for y in range(H):
    for x in (0, W-1): q.append((x, y))
# 칸 경계(64px 격자)도 바깥으로 본다
for g in range(0, W, 64):
    for y in range(H): q.append((g, y)); q.append((min(g+63, W-1), y))
for g in range(0, H, 64):
    for x in range(W): q.append((x, g)); q.append((x, min(g+63, H-1)))
while q:
    x, y = q.popleft()
    if (x, y) in out or px[x, y][3] > 0: continue
    out.add((x, y))
    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx, ny = x+dx, y+dy
        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in out and px[nx, ny][3] == 0: q.append((nx, ny))
n = 0
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if p[3] < 255 and (x, y) not in out:
            px[x, y] = (255, 255, 255, 255); n += 1
im.save(sys.argv[2]); print(sys.argv[1], "filled", n)
