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


def skin_blob(im):
    """얼굴·손목 살색 덩어리: 팔레트 살색 점에서 따뜻한 점을 타고 번진 범위. 팔레트 밖 밝은 살색(239,165,116 등)도
    얼굴이면 여기에 들어가 불꽃으로 지워지지 않는다(1차 검수에서 얼굴에 구멍이 뚫렸던 원인)"""
    px = im.load(); w, h = im.size
    warm = lambda q: q[3] and q[0] - q[2] > 30 and q[0] > 60
    st = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and px[x, y][:3] in {(251, 196, 150), (235, 156, 104), (232, 129, 89)}]
    seen = set(st)
    while st:
        x, y = st.pop()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (x + dx, y + dy)
                if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and warm(px[n]):
                    seen.add(n); st.append(n)
    return seen


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
    im = im.copy(); px = im.load(); keep = skin_blob(im)
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3] and is_flash(px[x, y]) and (x, y) not in keep:
                px[x, y] = (0, 0, 0, 0)
    comps = sorted(components(im), key=len, reverse=True)
    for c in comps[1:]:
        if len(c) < 24:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    # 팔레트 색(피부·셔츠 흰색)으로 그린 불꽃·연기: 몸 테두리(검은 외곽선)의 가장 앞 x보다 앞에 있는 밝은 점은 효과
    if comps:
        lum = lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]
        dark = [x for x, y in comps[0] if lum(px[x, y]) < 40]
        if dark:
            front = max(dark)
            for y in range(im.height):
                for x in range(front + 2, im.width):
                    if px[x, y][3]:
                        px[x, y] = (0, 0, 0, 0)
    for c in sorted(components(im), key=len, reverse=True)[1:]:
        if len(c) < 24:
            for x, y in c:
                px[x, y] = (0, 0, 0, 0)
    return im


def clip_frames(name):
    d = os.path.join(HERE, '..', 'game-src', 'action', 'deadpole', 'full', 'clips', name)
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def warm_suit(im):
    """GPT 탈의 앞 장은 2차 기준 그림(쟈알디 청회색 정장)으로 그려짐 → 청회색 점을 3차 숯빛 정장 단계로 밝기 맞춰 바꿈"""
    ramp = sorted({c for c in palette() if max(c) < 80 and abs(c[0] - c[2]) < 12}, key=lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and b > r + 6 and max(r, g, b) < 150:
                L = lum((r, g, b)) * 0.92
                px[x, y] = (*min(ramp, key=lambda c: abs(lum(c) - L)), 255)
    return im


def grey_gun(im):
    """총구 끝에 남은 주황·갈색 점(불꽃 찌꺼기): 얼굴 피부보다 8px 앞에 있는 따뜻한 색은 장갑 낀 손 앞이라 총뿐 → 같은 밝기의 회색으로"""
    im = im.copy(); px = im.load()
    warm = lambda p: p[0] - p[2] > 40 and p[0] > 100
    skin = [x for y in range(im.height) for x in range(im.width) if px[x, y][3] and warm(px[x, y]) and px[x, y][0] > 200]
    if not skin:
        return im
    face = min(skin) + 14   # 얼굴 뒤 끝 + 얼굴 폭 남짓 (불꽃 점도 밝은 주황이라 max는 못 씀)
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    greys = sorted({c for c in palette() if abs(c[0] - c[2]) < 18}, key=lum)
    for y in range(im.height):
        for x in range(face + 8, im.width):
            q = px[x, y]
            if q[3] and warm(q):
                px[x, y] = (*min(greys, key=lambda c: abs(lum(c) - lum(q) * 0.6)), 255)
    return im


def unsmear(im, x1, color):
    """x < x1 범위의 한 색 점을 지움 (머리 뒤 회색 번짐)"""
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(x1):
            if px[x, y][3] and px[x, y][:3] in color:
                px[x, y] = (0, 0, 0, 0)
    return im


SKIN = {(251, 196, 150), (235, 156, 104), (232, 129, 89)}
BLUEGREY = {(106, 112, 123), (158, 162, 166)}


def haze(c):
    """청회색 팔레트 점, 또는 팔레트 밖 중간 밝기 무채색(먼지·연기)"""
    return c in BLUEGREY or (c not in palette() and abs(c[0] - c[2]) < 12 and 80 < c[0] < 170)


def unhaze(im):
    """머리카락 둘레의 연기 같은 번짐: 투명에 닿은 청회색 점을 바깥부터 벗겨 냄 (셔츠 흰색은 남김)"""
    im = im.copy(); px = im.load(); w, h = im.size
    while True:
        ch = [(x, y) for y in range(h) for x in range(w) if px[x, y][3] and haze(px[x, y][:3])
              and any(not (0 <= x + dx < w and 0 <= y + dy < h) or not px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        if not ch:
            return im
        for x, y in ch:
            px[x, y] = (0, 0, 0, 0)


def floor(im, foot=135):
    """바닥에 붙는 장(누움·기기·슬라이딩)이 몇 점 뜨거나 가라앉은 것을 바닥선에 맞춤"""
    bb = im.getbbox()
    if not bb or not 126 <= bb[3] - 1 <= 143 or bb[3] - 1 == foot:
        return im
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (0, foot - (bb[3] - 1)), im); return out


def no_muzzle(im):
    """산탄총 총구 끝(그림 맨 앞 3줄)의 주황·갈색 점 = 불꽃 찌꺼기. 나무 개머리판은 훨씬 뒤라 안 닿음"""
    im = im.copy(); px = im.load(); bb = im.getbbox()
    if not bb:
        return im
    for y in range(im.height):
        for x in range(bb[2] - 3, bb[2]):
            if px[x, y][3] and px[x, y][0] - px[x, y][2] > 40:
                px[x, y] = (0, 0, 0, 0)
    return im


GROUND = ('down', 'crawl', 'purge', 'tomoe', 'getup', 'revive', 'die', 'superrise', 'sniffground', 'slide')
HAZE = ('airshot', 'getup', 'revive', 'purge', 'down', 'tomoe', 'slide', 'sniffground', 'crawl', 'superrise', 'die', 'roll')
GUN = ('airshot', 'slide', 'collar', 'ready', 'fire', 'step', 'draw', 'cq1', 'cq2', 'cq3', 'kneel', 'kneelwalk', 'kneelshot', 'catch', 'contact', 'reload')


# 클립: 함수(장 목록) → 장 목록 (검수 결함 보정)
FIX = {
    'undress': lambda fr: [warm_suit(f) for f in fr],
    'revive': lambda fr: fr[:-1],      # 마지막 장: 얼굴 앞에 회색 네모(손) → 앞 장에서 끝냄
    'kneelwalk': lambda fr: fr[:-1],   # 마지막 장만 몸이 커지고 머리가 튐(돌이 장)
    'sniffground': lambda fr: [unsmear(f, 50, {(106, 112, 123), (158, 162, 166), (214, 215, 217)}) if i == 2 else f for i, f in enumerate(fr)],
}


def apply(key, src, frames):
    if src in GPT:
        return FIX[key](frames) if key in FIX else frames
    frames = [clean(f) for f in frames]
    if key in GUN:
        frames = [grey_gun(f) for f in frames]
    if key in HAZE:
        frames = [unhaze(f) for f in frames]
    if key in GROUND:
        frames = [floor(f) for f in frames]
    if key in ('shotgun', 'idle_shotgun', 'walk_shotgun', 'run_shotgun'):
        frames = [no_muzzle(f) for f in frames]
    if key in FIX:
        frames = FIX[key](frames)
    return frames
