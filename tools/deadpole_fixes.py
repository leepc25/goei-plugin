"""데드폴 클립 코드 보정 (build_deadpole_full_demo.py가 부름).

생성기는 데드폴 기준 그림(full/base.png) 팔레트를 거의 그대로 쓴다. 팔레트 밖의 밝고 따뜻한 점(총구 불꽃·불티)과
몸에서 떨어진 작은 덩어리(탄피·연기)는 지시문에 없는 효과라 지운다. 총구 불꽃은 게임이 코드로 그린다.
GPT 납품 클립(수건 색이 팔레트 밖)은 건드리지 않는다. 장별 수작업 보정은 FIX에.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(HERE, '..', 'game-src', 'action', 'deadpole', 'full', 'base.png')
GPT = {'undress', 'showerturn', 'shower', 'bath'}
_pal = None


def palette():
    global _pal
    if _pal is None:
        im = Image.open(BASE).convert('RGBA')
        _pal = {im.getpixel((x, y))[:3] for y in range(im.height) for x in range(im.width) if im.getpixel((x, y))[3]}
    return _pal


def is_flash(p):
    r, g, b = p[:3]
    return p[:3] not in palette() and r > 200 and g > 110 and r - b > 30


def components(im):
    """불투명 점의 4방향 연결 덩어리들 [(점 목록)]"""
    w, h = im.size; px = im.load(); seen = set(); out = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); comp = []
                while st:
                    cx, cy = st.pop(); comp.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and px[nx, ny][3]:
                            seen.add((nx, ny)); st.append((nx, ny))
                out.append(comp)
    return out


def clean(im):
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and is_flash(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    comps = sorted(components(im), key=len, reverse=True)
    for c in comps[1:]:
        if len(c) < 24:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    return im


FIX = {}   # 클립: 함수(장 목록) → 장 목록 (검수 결함 보정)


def apply(key, src, frames):
    if src in GPT:
        return frames
    frames = [clean(f) for f in frames]
    if key in FIX:
        frames = FIX[key](frames)
    return frames
