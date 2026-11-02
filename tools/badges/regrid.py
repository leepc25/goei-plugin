# 칸 줄에 안 맞게 놓인 동전을 통째로 찾아(이어진 불투명 덩어리) 1판 크기로 맞춰 8x4 칸 가운데에 다시 놓는다.
# 사용: python3 regrid.py <입력.png> <출력.png> [지름W 지름H]
import sys
from PIL import Image
from collections import deque
src = Image.open(sys.argv[1]).convert("RGBA"); W0, H0 = src.size; px = src.load()
CW, CH = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (61, 60)
seen = [[False]*W0 for _ in range(H0)]; comps = []
for y in range(H0):
    for x in range(W0):
        if seen[y][x] or px[x, y][3] <= 8: continue
        q = deque([(x, y)]); seen[y][x] = True; n = 0; x0 = x1 = x; y0 = y1 = y
        while q:
            cx, cy = q.popleft(); n += 1
            x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx, ny = cx+dx, cy+dy
                if 0 <= nx < W0 and 0 <= ny < H0 and not seen[ny][nx] and px[nx, ny][3] > 8:
                    seen[ny][nx] = True; q.append((nx, ny))
        if n > 1200: comps.append((x0, y0, x1+1, y1+1, n))
comps.sort(key=lambda c: (c[1]+c[3])/2)  # 위에서부터 8개씩 한 줄, 줄 안은 왼쪽부터
comps = [c for k in range(0, len(comps), 8) for c in sorted(comps[k:k+8], key=lambda c: (c[0]+c[2])/2)]
print(len(comps), "coins")
out = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
for i, (x0, y0, x1, y1, n) in enumerate(comps[:32]):
    piece = src.crop((x0, y0, x1, y1)).resize((CW, CH), Image.NEAREST)
    c, r = i % 8, i // 8
    out.alpha_composite(piece, (c*64 + (64-CW)//2, r*64 + (64-CH)//2))
out.save(sys.argv[2])
