"""사무실 p7b 철제 랙 오른쪽 아래 모서리 손질 — 사용자 11-02 07:34 「여기 모서리 깨졌다니까」.
랙 아랫단(밑 윤곽 y297, 받침 띠 y298~300, 바닥 윤곽 y301)이 오른쪽 기둥(x410)까지 못 가고 비스듬히 잘려 있음 →
그 줄들을 같은 줄 x400 색으로 x419까지 채우고, 랙 옆면(x411~419)까지 아랫단을 이어 x420 윤곽(이미 검정)에 닿게 한다. 그 밖 픽셀은 그대로.
사용: python3 office_p7b_rack_corner_fix.py <in> <out> [x 밀기]"""
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]; dx = int(sys.argv[3]) if len(sys.argv) > 3 else 0
im = Image.open(src).convert('RGBA'); px = im.load()
OUT = px[410 + dx, 290]   # 기둥 윤곽 색
changed = []
for y in range(297, 302):
    c = px[400 + dx, y]
    for x in range(400 + dx, 420 + dx):
        if px[x, y] != c: px[x, y] = c; changed.append((x, y))
im.save(out); print(len(changed), 'px', min(changed), max(changed))
