#!/usr/bin/env python3
"""로제몬 GPT 탈의·샤워·목욕 20장 자동 검사 (의뢰서 3절 값). 사용법: python3 tools/check_rojemon_gpt.py"""
import os, sys
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, 'game-src', 'action', 'rojemon', 'clips')
N = {'undress': 7, 'showerturn': 3, 'shower': 6, 'bath': 4}
bad = 0
for clip, n in N.items():
    for i in range(n):
        p = os.path.join(D, clip, f'{i:02d}.png'); err = []
        if not os.path.exists(p):
            print('없음', clip, i); bad += 1; continue
        im = Image.open(p).convert('RGBA'); px = im.load(); W, H = im.size
        if (W, H) != (192, 144): err.append(f'크기 {W}x{H}')
        a = [px[x, y][3] for y in range(H) for x in range(W)]
        if any(0 < v < 255 for v in a): err.append('반투명 점')
        bb = im.split()[3].getbbox()
        if not bb: err.append('빈 장')
        else:
            if bb[3] != 136: err.append(f'발 아래끝 {bb[3]}(136이어야)')
            cx = (bb[0] + bb[2]) / 2
            if clip != 'bath' and not 53 <= cx <= 61: err.append(f'몸 중심 x {cx:.0f}')
            if clip != 'bath' and not 43 <= bb[1] <= 45: err.append(f'머리끝 y {bb[1]}(44)')
            edge = [px[x, y][:3] for y in range(H) for x in range(W) if px[x, y][3] and any(not (0 <= x + dx < W and 0 <= y + dy < H) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
            dark = sum(1 for c in edge if max(c) < 24) / max(1, len(edge))
            if dark < 0.85: err.append(f'검정 테두리 {dark:.0%}')
        print('통과' if not err else '고침 필요', clip, i, ' · '.join(err)); bad += bool(err)
sys.exit(1 if bad else 0)
