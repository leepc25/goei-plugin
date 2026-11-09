"""손으로 짠 도트 이펙트(11-08 사용자 「그래」: PixelLab 없이 Claude가 직접 찍은 도트 이펙트를 필살기 하나에 넣어 보기).
점 하나씩 규칙으로 찍는다(흐림·그라데이션·반투명 없음, 색 단계만). 결과는 테스트룸 이펙트 폴더(game-src/action/testroom3/vfx/dot-*.png/json)에
PixelLab 시트와 같은 꼴로 둔다. 사용: python3 tools/dotfx/make_dotfx.py"""
import json, math
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "game-src" / "action" / "testroom3" / "vfx"
# 색 단계(밝은 → 어두운). 0 = 빈칸
PAL = {1: (255, 255, 255), 2: (255, 246, 168), 3: (255, 206, 64), 4: (255, 132, 32), 5: (214, 52, 30), 6: (110, 22, 22),
       7: (70, 60, 62), 8: (112, 100, 98), 9: (160, 150, 144), 10: (40, 32, 34),
       # 먹물 튐(짙은 갈색) · 푸른 기운 (11-09 킹오파식 큰 효과)
       11: (46, 22, 12), 12: (96, 46, 18), 13: (150, 78, 26),
       14: (240, 250, 255), 15: (176, 220, 255), 16: (96, 156, 230), 17: (40, 70, 150), 18: (20, 30, 70)}


def hsh(x, y, s=0):
    h = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    h = (h ^ (h >> 13)) * 1274126177 & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535


class F:
    def __init__(s, w, h): s.w, s.h, s.p = w, h, [[0] * w for _ in range(h)]
    def put(s, x, y, c, over=True):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < s.w and 0 <= y < s.h and (over or not s.p[y][x]): s.p[y][x] = c
    def img(s):
        im = Image.new("RGBA", (s.w, s.h), (0, 0, 0, 0)); px = im.load()
        for y in range(s.h):
            for x in range(s.w):
                c = s.p[y][x]
                if c: px[x, y] = PAL[c] + (255,)
        return im


def ray(f, cx, cy, a, r0, r1, wb, cols):
    """r0~r1 사이 가시. 밑동 굵기 wb, 끝으로 갈수록 가늘어짐. cols: 안→끝 색 단계"""
    ca, sa = math.cos(a), math.sin(a)
    n = max(1, int((r1 - r0) * 2))
    for i in range(n + 1):
        t = i / n; r = r0 + (r1 - r0) * t; w = wb * (1 - t) + 0.5
        c = cols[min(len(cols) - 1, int(t * len(cols)))]
        for k in range(-int(w * 2), int(w * 2) + 1):
            s_ = k / 2
            if abs(s_) <= w: f.put(cx + ca * r - sa * s_, cy + sa * r + ca * s_, c)


def disc(f, cx, cy, r, c, ry=None, over=True):
    ry = ry or r
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            if ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 <= 1: f.put(x, y, c, over)


def ring(f, cx, cy, r, th, c, gaps=0, rot=0.0, ry=None, gapw=0.35):
    ry = ry or r
    for y in range(int(cy - ry - th - 1), int(cy + ry + th + 2)):
        for x in range(int(cx - r - th - 1), int(cx + r + th + 2)):
            dx, dy = (x - cx), (y - cy) * r / ry
            d = math.hypot(dx, dy)
            if r - th / 2 <= d <= r + th / 2:
                if gaps:
                    a = (math.atan2(dy, dx) - rot) % (2 * math.pi / gaps)
                    if a < 2 * math.pi / gaps * gapw: continue
                f.put(x, y, c)


def save(name, frames, dur, pivot=(0.5, 0.5)):
    w, h = frames[0].w, frames[0].h; cols = min(len(frames), 4); rows = math.ceil(len(frames) / cols)
    sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0)); meta = []
    for i, fr in enumerate(frames):
        x, y = (i % cols) * w, (i // cols) * h; sheet.paste(fr.img(), (x, y))
        d = dur[i] if isinstance(dur, list) else dur
        meta.append({"filename": f"{name} {i}.png", "frame": {"x": x, "y": y, "w": w, "h": h}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}, "pivot": {"x": pivot[0], "y": pivot[1]}, "duration": d})
    sheet.save(OUT / f"{name}.png")
    (OUT / f"{name}.json").write_text(json.dumps({"frames": meta, "meta": {"app": "tools/dotfx/make_dotfx.py (손으로 짠 도트)", "image": f"{name}.png", "size": {"w": sheet.width, "h": sheet.height}}}, ensure_ascii=False))
    return sheet


# ── 1. 타격 불꽃: 흰 마름모 섬광 → 8갈래 가시 → 깨진 고리·튀는 조각 ──
def impact():
    S = 96; c = S / 2; out = []
    main = [i * math.pi / 2 + math.pi / 8 * 0 for i in range(4)]
    diag = [i * math.pi / 2 + math.pi / 4 for i in range(4)]
    for k in range(8):
        f = F(S, S)
        if k == 0:
            for r, col in ((9, 3), (7, 2), (5, 1)):
                for y in range(-r, r + 1):
                    for x in range(-r, r + 1):
                        if abs(x) + abs(y) <= r: f.put(c + x, c + y, col)
            for a in main: ray(f, c, c, a, 6, 20, 1.2, [1, 1, 2])
        elif k <= 3:
            L = [34, 42, 44][k - 1]; Ld = [20, 26, 24][k - 1]; st = [0, 6, 16][k - 1]
            for a in main: ray(f, c, c, a + 0.12, st, L, [3.4, 3.0, 2.2][k - 1], [1, 1, 2, 3, 4])
            for a in diag: ray(f, c, c, a + 0.12, st * 0.7, Ld, [2.2, 1.8, 1.2][k - 1], [1, 2, 3, 4])
            if k == 1:
                disc(f, c, c, 11, 3); disc(f, c, c, 9, 2); disc(f, c, c, 7, 1)
            elif k == 2:
                ring(f, c, c, 13, 4, 2); ring(f, c, c, 13, 2, 1)
            else:
                ring(f, c, c, 18, 3, 3, gaps=8, rot=0.2)
            for i in range(10):
                a = i * 2 * math.pi / 10 + 0.3; r = 14 + k * 8 + hsh(i, 1) * 6
                sz = 2 if k < 3 else 1
                for dy in range(sz + 1):
                    for dx in range(sz + 1): f.put(c + math.cos(a) * r + dx, c + math.sin(a) * r + dy, [2, 3, 4][k - 1])
        else:
            rr = 18 + (k - 3) * 6
            ring(f, c, c, rr, 2 if k < 6 else 1, [4, 4, 5, 6][k - 4], gaps=8, rot=0.2 + k * 0.05, gapw=0.35 + (k - 4) * 0.15)
            for a in main: ray(f, c, c, a + 0.12, 30 + (k - 4) * 6, 44 + (k - 4) * 2, 0.8, [4, 5])
            for i in range(10):
                if hsh(i, k) < (k - 4) * 0.25: continue
                a = i * 2 * math.pi / 10 + 0.3; r = 30 + (k - 3) * 6 + hsh(i, 1) * 6
                f.put(c + math.cos(a) * r, c + math.sin(a) * r, [4, 5, 5, 6][k - 4])
        out.append(f)
    return save("dot-impact", out, [40, 40, 40, 50, 50, 60, 60, 60])


# ── 2. 폭발: 섬광 → 덩이마다 명암 단계(위 왼쪽이 밝음)를 넣은 불덩이 → 식어 연기 덩이로 줄며 사라짐, 파편 ──
def vnoise(x, y, cell, seed):
    gx, gy = x / cell, y / cell; x0, y0 = math.floor(gx), math.floor(gy); fx, fy = gx - x0, gy - y0
    sm = lambda t: t * t * (3 - 2 * t)
    a, b, c_, d = hsh(x0, y0, seed), hsh(x0 + 1, y0, seed), hsh(x0, y0 + 1, seed), hsh(x0 + 1, y0 + 1, seed)
    u, v = sm(fx), sm(fy)
    return (a * (1 - u) + b * u) * (1 - v) + (c_ * (1 - u) + d * u) * v


def boom():
    W, H = 160, 150; cx, gy = W / 2, H - 6; out = []
    # 덩이: (가로, 세로, 크기) — 아래 큰 덩이 셋, 위로 갈수록 작게
    blobs = [(-0.62, 0.05, 0.62), (0.62, 0.08, 0.6), (0, 0.1, 0.78), (-0.3, -0.55, 0.62), (0.34, -0.5, 0.58), (0.02, -1.0, 0.5)]
    deb = [(hsh(i, 7) * 2 - 1, 0.6 + hsh(i, 8) * 0.8) for i in range(12)]
    FIRE = [1, 2, 3, 4, 5]; SMOKE = [9, 8, 7]
    N = 12
    for k in range(N):
        f = F(W, H)
        if k == 0:
            disc(f, cx, gy - 12, 20, 3, 11); disc(f, cx, gy - 12, 15, 2, 8); disc(f, cx, gy - 12, 9, 1, 5)
            for a in (0, math.pi): ray(f, cx, gy - 12, a, 14, 44, 2.4, [1, 1, 2, 3])
            ray(f, cx, gy - 12, -math.pi / 2, 8, 40, 2.4, [1, 1, 2, 3])
            out.append(f); continue
        t = (k - 1) / (N - 2)
        R = 26 + 30 * min(1, t * 3)
        lift = 34 * t * t
        owner = [[None] * W for _ in range(H)]
        for bi, (bx, by, br) in enumerate(blobs):
            shrink = 1 - max(0, t - 0.5) * 1.6 * (0.6 + 0.4 * hsh(bi, 3))   # 식으면 덩이가 줄어든다
            rr = R * br * max(0.0, shrink)
            if rr < 2: continue
            ox = cx + bx * R * (1 + t * 0.25); oy = gy - R * 0.62 - lift + by * R * (1 + t * 0.3) - (bi * 3 * t)
            for y in range(int(oy - rr - 4), int(oy + rr + 5)):
                for x in range(int(ox - rr - 4), int(ox + rr + 5)):
                    if not (0 <= x < W and 0 <= y < H): continue
                    wob = (vnoise(x, y, 7, bi + k // 4) - 0.5) * 0.24
                    d = math.hypot(x - ox, y - oy) / rr + wob
                    if d > 1: continue
                    hl = math.hypot(x - (ox - rr * 0.3), y - (oy - rr * 0.35)) / (rr * 1.25)   # 빛 받는 자리에서 거리
                    owner[y][x] = (hl, d, bi)
        for y in range(H):
            for x in range(W):
                o = owner[y][x]
                if not o: continue
                hl, d, bi = o
                heat = hl + t * 1.25 + (0.35 if bi < 3 and t > 0.2 else 0)
                if heat < 1.25:
                    q = heat / 1.25; c = FIRE[min(4, int(q * 5))]
                else:
                    q = min(0.999, (heat - 1.25) / 1.1); c = SMOKE[int(q * 3)]
                    if heat < 1.42 and d < 0.5: c = 5   # 연기 속 남은 불씨
                f.put(x, y, c)
        # 바깥 테(불이면 짙은 빨강, 연기면 짙은 회색)
        edge = []
        for y in range(H):
            for x in range(W):
                if f.p[y][x]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < H and f.p[yy][xx]:
                        edge.append((x, y, 6 if f.p[yy][xx] <= 5 else 10)); break
        for x, y, c in edge: f.put(x, y, c)
        # 바닥 불길
        if t < 0.45:
            for x in range(int(cx - R * 1.5), int(cx + R * 1.5)):
                h = (1 - abs(x - cx) / (R * 1.5)) * 12 * (1 - t * 2) + vnoise(x, 0, 4, k) * 5
                for y in range(int(gy - h), int(gy + 1)):
                    f.put(x, y, 3 if y > gy - h * 0.45 else 4, over=False)
        for i, (vx, vy) in enumerate(deb):
            tt = t * 1.7 + 0.1
            px = cx + vx * 78 * tt; py = gy - 24 - vy * 100 * tt + 130 * tt * tt
            if py > gy or tt > 1.5: continue
            c = 2 if t < 0.2 else 4 if t < 0.45 else 6
            for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)): f.put(px + dx, py + dy, c)
            f.put(px - vx * 4, py + vy * 4 - 1, 5)
        out.append(f)
    return save("dot-boom", out, [50, 50] + [60] * 4 + [55] * 6, pivot=(0.5, 1.0))


# ── 3. 필살기 시작 기운: 몸에서 퍼지는 굵은 고리 + 16갈래 빛살, 고리가 굵은 조각으로 끊기며 사라짐 ──
def burst():
    S = 208; c = S / 2; out = []
    for k in range(10):
        f = F(S, S); t = k / 9
        r = 18 + 78 * (1 - (1 - t) ** 2)
        if k < 7:
            for i in range(16):
                a = i * math.pi / 8 + 0.1
                L = (0.6 if i % 2 else 1.0) * (34 + 60 * t)
                ray(f, c, c, a, r * 0.3, r * 0.3 + L * (1 - t * 0.5), 3.6 * (1 - t) + 1.0, [1, 1, 2, 3] if k < 3 else [2, 3, 4])
        th = max(2, 9 * (1 - t))
        ring(f, c, c, r, th + 2, 3 if k < 6 else 4, gaps=0 if k < 4 else 8, rot=0.1, gapw=0.15 + t * 0.4, ry=r * 0.9)
        ring(f, c, c, r, th, 1 if k < 4 else 2, gaps=0 if k < 4 else 8, rot=0.1, gapw=0.15 + t * 0.4, ry=r * 0.9)
        if k < 3: disc(f, c, c, 22 - k * 7, 2); disc(f, c, c, 16 - k * 6, 1)
        out.append(f)
    return save("dot-burst", out, 70)


# ── 4. 필살기 마무리 에너지 대폭발(11-09 사용자 「이펙트 막 에너지 화면 폭발」): 흰 섬광 → 번개 테 두른 에너지 구 + 24갈래 빛살
#    → 구가 터져 굵은 조각·납작한 충격파 고리로 퍼지며 사라짐 ──
def nova():
    S = 256; c = S / 2; out = []; N = 14
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        if k == 0:
            disc(f, c, c, 30, 3); disc(f, c, c, 24, 2); disc(f, c, c, 17, 1)
            for i in range(4): ray(f, c, c, i * math.pi / 2, 20, 120, 4.0, [1, 1, 1, 2, 3])
            for i in range(4): ray(f, c, c, i * math.pi / 2 + math.pi / 4, 16, 70, 2.6, [1, 2, 3])
            out.append(f); continue
        R = 26 + 92 * (1 - (1 - min(1, t * 1.6)) ** 2)      # 구 반지름: 빠르게 커졌다 멈춤
        # 납작한 충격파 고리 (땅 쪽 느낌): 구보다 앞서 퍼짐
        sw = 40 + 160 * t
        # 빛살 24갈래 (앞쪽 장에서만)
        if k < 8:
            for i in range(24):
                a = i * math.pi / 12 + 0.07 + k * 0.02
                L = (1.0 if i % 3 == 0 else 0.62 if i % 3 == 1 else 0.45) * (R * 0.9 + 30)
                ray(f, c, c, a, R * 0.55, min(126, R * 0.55 + L), (3.2 if i % 3 == 0 else 2.0) * (1 - t * 0.9) + 0.6, [1, 1, 2, 3] if k < 4 else [2, 3, 4])
        if t < 0.62:
            # 에너지 구: 바깥 들쭉날쭉 번개 테 + 안쪽 단계
            for y in range(int(c - R - 8), int(c + R + 9)):
                for x in range(int(c - R - 8), int(c + R + 9)):
                    a = math.atan2(y - c, x - c)
                    jag = (vnoise(a * 9 + 50, k * 3, 1, 5) - 0.5) * 0.22 + (0.08 if int((a + math.pi) * 12 + k) % 3 == 0 else 0)
                    d = math.hypot(x - c, y - c) / R
                    if d > 1 + jag: continue
                    hl = math.hypot(x - (c - R * 0.25), y - (c - R * 0.3)) / R
                    q = d * 0.8 + hl * 0.2 + t * 0.9
                    col = 1 if q < 0.45 else 2 if q < 0.7 else 3 if q < 0.92 else 4
                    if d > 0.9 + jag: col = 5 if t > 0.3 else 3
                    f.put(x, y, col)
            # 안쪽 뚫린 고리 (터지기 직전 속이 빔)
            if t > 0.3:
                hr = R * (t - 0.3) * 2.2
                for y in range(S):
                    for x in range(S):
                        dd = math.hypot(x - c, y - c)
                        if dd < hr: f.p[y][x] = 0
                        elif dd < hr + 5 and f.p[y][x]: f.p[y][x] = 1 if dd < hr + 2.5 else 2
        else:
            # 터진 뒤: 굵은 조각이 바깥으로, 색이 식으며 사라짐
            for i in range(28):
                a = i * 2 * math.pi / 28 + hsh(i, 2) * 0.2
                r = 78 + (t - 0.62) / 0.38 * 40 + hsh(i, 3) * 8
                sz = max(1, int(2 + 5 * (1 - (t - 0.62) / 0.38) + hsh(i, 4) * 2))
                col = [3, 4, 5, 6][min(3, int((t - 0.62) / 0.38 * 4))]
                for dy in range(-sz, sz + 1):
                    for dx in range(-sz, sz + 1):
                        if abs(dx) + abs(dy) <= sz: f.put(c + math.cos(a) * r + dx, c + math.sin(a) * r + dy, col)
            ring(f, c, c, min(122, 92 + (t - 0.62) * 70), 4 if t < 0.8 else 2, 3 if t < 0.75 else 5 if t < 0.9 else 6, gaps=10, rot=0.4, gapw=0.3 + (t - 0.62) * 1.5)
        if k < N - 1:
            ring(f, c, c + 10, min(124, sw), max(2, 10 * (1 - t)), 2 if t < 0.3 else 3 if t < 0.6 else 4, gaps=0 if k < 6 else 12, rot=0.2, gapw=0.2 + t * 0.5, ry=min(124, sw) * 0.32)
        out.append(f)
    return save("dot-nova", out, [40, 45, 50, 50, 55, 55, 60, 60, 60, 60, 65, 65, 70, 70])


# ── 5. 큰 타격 폭발(11-09 「킹오파98 수준」): 흰 섬광 → 명암 단계 있는 불덩이 무리 + 바깥으로 튀는 먹물 가시·방울 → 불이 식어 갈라지며 사라짐.
#    불덩이는 덩이마다 빛 받는 쪽(왼위)이 밝고, 겉은 짙은 빨강 테. 먹물은 굵은 밑동에서 가늘어지는 가시와 끝 방울 ──
def blast():
    S = 224; c = S / 2; out = []; N = 11
    rng = [(hsh(i, 41), hsh(i, 42), hsh(i, 43)) for i in range(40)]
    spikes = [(i * 2 * math.pi / 13 + (rng[i][0] - 0.5) * 0.35, 0.65 + rng[i][1] * 0.5, 2.5 + rng[i][2] * 3) for i in range(13)]
    blobs = [((rng[i + 13][0] - 0.5) * 1.1, (rng[i + 13][1] - 0.5) * 1.0, 0.45 + rng[i + 13][2] * 0.35) for i in range(9)]
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        if k == 0:
            disc(f, c, c, 40, 3); disc(f, c, c, 32, 2); disc(f, c, c, 22, 1)
            for i in range(8): ray(f, c, c, i * math.pi / 4 + 0.2, 26, 104 if i % 2 == 0 else 70, 5 if i % 2 == 0 else 3, [1, 1, 2, 3])
            out.append(f); continue
        # 먹물 가시 (불덩이 뒤): 2장부터 뻗고, 뒤로 갈수록 끊겨 방울만
        if k >= 1:
            for i, (a, L, w) in enumerate(spikes):
                grow = min(1.0, k / 3)
                r0 = 30 + 10 * t; r1 = r0 + (L * 78) * grow
                if t > 0.55: r0 = r0 + (t - 0.55) * 140
                if r1 > r0:
                    ray(f, c, c, a, r0, min(r1, 110), w * 1.7 * (1 - t * 0.5), [11, 11, 12])
                    # 끝 방울
                    for j in range(2):
                        dd = r1 + 6 + j * 9 + t * 20
                        if dd < 110:
                            sz = max(1, int((3 - j) * (1 - t * 0.6)))
                            disc(f, c + math.cos(a + (j - 0.5) * 0.08) * dd, c + math.sin(a + (j - 0.5) * 0.08) * dd, sz, 11)
        # 불덩이 무리
        R = 26 + 46 * min(1, t * 2.2)
        owner = {}
        for bi, (bx, by, br) in enumerate(blobs):
            shrink = 1 - max(0, t - 0.45) * 1.7 * (0.5 + rng[bi][2] * 0.5)
            rr = R * br * max(0.0, shrink)
            if rr < 2: continue
            ox = c + bx * R * (1 + t * 0.6); oy = c + by * R * (1 + t * 0.6) - t * 10
            for y in range(int(oy - rr - 5), int(oy + rr + 6)):
                for x in range(int(ox - rr - 5), int(ox + rr + 6)):
                    if not (0 <= x < S and 0 <= y < S): continue
                    wob = (vnoise(x, y, 6, bi + k) - 0.5) * 0.3
                    d = math.hypot(x - ox, y - oy) / rr + wob
                    if d > 1: continue
                    hl = math.hypot(x - (ox - rr * 0.35), y - (oy - rr * 0.4)) / (rr * 1.3)
                    o = owner.get((x, y))
                    if o is None or hl < o: owner[(x, y)] = hl
        for (x, y), hl in owner.items():
            heat = hl * 0.9 + t * 1.1
            col = 1 if heat < 0.3 else 2 if heat < 0.55 else 3 if heat < 0.85 else 4 if heat < 1.15 else 5 if heat < 1.4 else 12
            f.put(x, y, col)
        # 바깥 테
        edge = []
        for (x, y) in owner:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if (xx, yy) not in owner and 0 <= xx < S and 0 <= yy < S:
                    edge.append((xx, yy))
        for x, y in edge: f.put(x, y, 6 if t < 0.6 else 11)
        # 흰 빛살 (앞쪽 장)
        if k <= 3:
            for i in range(6):
                a = i * math.pi / 3 + 0.5
                ray(f, c, c, a, R * 0.8, R * 0.8 + 40 - k * 8, 3.2 - k * 0.6, [1, 1, 2])
        # 튀는 불씨
        for i in range(16):
            a = rng[i][0] * 2 * math.pi; v = 50 + rng[i][1] * 60
            px = c + math.cos(a) * v * t * 1.6; py = c + math.sin(a) * v * t * 1.6 + 40 * t * t
            if 0 < t < 0.9:
                col = 2 if t < 0.3 else 3 if t < 0.6 else 5
                for dx in range(2):
                    for dy in range(2): f.put(px + dx, py + dy, col)
        out.append(f)
    return save("dot-blast", out, [40, 45, 45, 50, 50, 55, 55, 60, 60, 65, 70])


# ── 6. 기운 소용돌이(띄우기·공중): 푸른 흰 기운이 두 갈래로 휘감아 오르며 흩어짐 ──
def swirl():
    S = 192; c = S / 2; out = []; N = 10
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        for arm in range(3):
            base = arm * 2 * math.pi / 3 + t * 4.2
            L = int(160 * min(1, t * 2.5 + 0.2))
            for i in range(L):
                u = i / 160
                a = base + u * 4.4
                r = 14 + u * 70 * (0.6 + t * 0.5)
                x = c + math.cos(a) * r; y = c + math.sin(a) * r * 0.75 - u * 24
                w = (1 - u) * 14 * (1 - t * 0.6) + 2.5
                if t > 0.6 and hsh(i, arm + k * 7) < (t - 0.6) * 2.2: continue
                col = 14 if u < 0.25 else 15 if u < 0.5 else 16 if u < 0.8 else 17
                for dy in range(-int(w), int(w) + 1):
                    for dx in range(-int(w * 0.6), int(w * 0.6) + 1):
                        if dx * dx / max(0.5, (w * 0.6) ** 2) + dy * dy / max(0.5, w * w) <= 1:
                            f.put(x + dx, y + dy, col, over=False)
        # 겉 테
        edge = []
        for y in range(S):
            for x in range(S):
                if f.p[y][x]: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < S and 0 <= yy < S and f.p[yy][xx] in (14, 15, 16, 17):
                        edge.append((x, y)); break
        for x, y in edge: f.put(x, y, 18)
        if k < 3: disc(f, c, c, 16 - k * 4, 14)
        out.append(f)
    return save("dot-swirl", out, [45, 45, 50, 50, 55, 55, 60, 60, 65, 70])


# ── 손그림 결 도구(11-09 「파워포인트 도형 같음」): 여러 겹 잡음 + 비틀기로 덩어리 모양, 명암은 4×4 바둑 디더로 단계 사이를 섞는다 ──
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def fbm(x, y, seed, oct=4, cell=24):
    v, a, tot = 0.0, 1.0, 0.0
    for o in range(oct):
        v += vnoise(x + 1000 * o, y + 777 * o, cell / (2 ** o), seed + o * 13) * a
        tot += a; a *= 0.5
    return v / tot


def ramp(f, x, y, v, cols, dither=False):
    """v(0~1 밝음→어두움)를 색 단계 cols 로. dither 면 단계 사이를 바둑 디더, 아니면 뚝 끊긴 덩어리 명암(손그림 도트)"""
    n = len(cols)
    q = max(0.0, min(0.9999, v)) * (n - 1)
    i = int(q); fr = q - i
    j = min(n - 1, i + 1)
    if dither: f.put(x, y, cols[j] if fr * 16 > BAYER[y % 4][x % 4] + 0.5 else cols[i])
    else: f.put(x, y, cols[j] if fr > 0.5 else cols[i])


def blast2():
    """큰 타격 폭발: 비틀린 잡음 불덩이(불혀가 삐죽) → 식으며 연기 덩어리로 갈라짐, 둘레에 먹물 튐·물보라 방울"""
    S = 224; c = S / 2; out = []; N = 12
    FIRE = [1, 2, 3, 4, 5, 6, 12, 11]
    rnd = lambda i, s_: hsh(i, s_ + 900)
    spikes = [(i * 2 * math.pi / 11 + (rnd(i, 1) - 0.5) * 0.5, 0.5 + rnd(i, 2) * 0.7, 3 + rnd(i, 3) * 4) for i in range(11)]
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        if k == 0:
            # 흰 섬광: 들쭉날쭉 별
            for y in range(S):
                for x in range(S):
                    dx, dy = x - c, y - c; r = math.hypot(dx, dy); a = math.atan2(dy, dx)
                    star = 26 + 60 * max(0, math.cos(a * 4 + 0.4)) ** 6 + 26 * max(0, math.cos(a * 7 + 1.1)) ** 8 + (fbm(x, y, 3, 2, 10) - 0.5) * 18
                    if r < star: ramp(f, x, y, r / star * 0.9, [1, 1, 2, 3])
            out.append(f); continue
        R = 34 + 58 * min(1.0, t * 2.4)
        cool = max(0.0, t - 0.4) / 0.6          # 0 뜨거움 → 1 식음
        # 먹물 가시 (덩어리 뒤에 먼저)
        for i, (a, L, w) in enumerate(spikes):
            grow = min(1.0, k / 3.0)
            r0 = R * 0.55 + cool * 60; r1 = R * 0.6 + L * 70 * grow
            n = int(max(0, r1 - r0) * 2)
            for j in range(n):
                u = j / max(1, n); rr = r0 + (r1 - r0) * u
                ww = w * (1 - u) ** 0.7 * (1 - cool * 0.6) + 0.6 + (fbm(j, i, 5, 2, 6) - 0.5) * 2.2
                bend = (fbm(j * 0.5, i * 9, 7, 2, 12) - 0.5) * 0.25
                cx_, cy_ = c + math.cos(a + bend) * rr, c + math.sin(a + bend) * rr
                for oy in range(-int(ww) - 1, int(ww) + 2):
                    for ox in range(-int(ww) - 1, int(ww) + 2):
                        if ox * ox + oy * oy <= ww * ww: f.put(cx_ + ox, cy_ + oy, 11 if u > 0.15 else 12)
            # 방울
            for j in range(3):
                if rnd(i * 3 + j, 4) < cool * 0.8: continue
                dd = r1 + 8 + j * 10 + cool * 30 + rnd(i * 3 + j, 5) * 6
                sz = max(1.0, (3.2 - j) * (1 - cool * 0.5))
                px, py = c + math.cos(a + (rnd(i, j) - 0.5) * 0.2) * dd, c + math.sin(a + (rnd(i, j) - 0.5) * 0.2) * dd
                for oy in range(-3, 4):
                    for ox in range(-3, 4):
                        if ox * ox + oy * oy <= sz * sz: f.put(px + ox, py + oy, 11)
        # 불덩이·연기: 비틀린 잡음 밀도
        mask = {}
        for y in range(S):
            for x in range(S):
                dx, dy = x - c, y - c + cool * 14
                r = math.hypot(dx, dy) / R
                if r > 1.5: continue
                wx = fbm(x, y, 11 + k // 3, 3, 30) - 0.5; wy = fbm(x, y, 29 + k // 3, 3, 30) - 0.5
                n = fbm(x + wx * 60 - t * 20, y + wy * 60 + t * 30, 41, 4, 26)
                dens = (1 - r) * 1.15 + (n - 0.5) * 1.3 - cool * 0.55
                if dens <= 0.05: continue
                mask[(x, y)] = (dens, n, dx, dy, r)
        for (x, y), (dens, n, dx, dy, r) in mask.items():
            lit = (-dx - dy) / (R * 2.2)                     # 왼위가 밝음
            heat = 0.15 + r * 0.55 - lit * 0.35 + (0.5 - n) * 0.35 + cool * 0.95 - min(0.3, dens * 0.15)
            # 아주 식은 곳은 연기(갈색·회색)
            if cool > 0.45 and heat > 0.95: ramp(f, x, y, (heat - 0.95) * 1.4, [12, 8, 7, 10])
            else: ramp(f, x, y, heat, FIRE[:7])
        # 겉 테 (짙게)
        for (x, y) in mask:
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + ddx, y + ddy) not in mask and 0 <= x + ddx < S and 0 <= y + ddy < S:
                    f.put(x + ddx, y + ddy, 6 if cool < 0.5 else 11)
        # 튀는 불씨·파편
        for i in range(22):
            a = rnd(i, 7) * 2 * math.pi; v = 0.6 + rnd(i, 8) * 0.8
            tt = t * 1.4
            px = c + math.cos(a) * v * 110 * tt; py = c + math.sin(a) * v * 90 * tt + 60 * tt * tt
            if tt > 1.2 or not (0 <= px < S and 0 <= py < S): continue
            col = 1 if t < 0.2 else 3 if t < 0.45 else 5 if t < 0.7 else 11
            L = 3 if t < 0.4 else 2
            for q in range(L):
                f.put(px - math.cos(a) * q, py - math.sin(a) * q, col)
        out.append(f)
    return save("dot-blast", out, [40, 40, 45, 45, 50, 55, 55, 60, 60, 65, 70, 75])



def outline(f, inside, col):
    for y in range(f.h):
        for x in range(f.w):
            if f.p[y][x]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < f.w and 0 <= yy < f.h and f.p[yy][xx] in inside:
                    f.put(x, y, col); break


def hitball():
    """연타 한 대 불꽃: 흰 속 + 주황 테 불덩이(들쭉날쭉) + 사방으로 끊긴 점선 빛줄기. 짧고 세게"""
    S = 176; c = S / 2; out = []; N = 7
    rnd = lambda i, s_: hsh(i, s_ + 300)
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        R = [22, 34, 38, 36, 30, 22, 12][k]
        # 점선 빛줄기 (먼저, 뒤에 깔림)
        for i in range(14):
            a = rnd(i, 1) * 2 * math.pi; L0 = R + 6 + rnd(i, 2) * 10 + k * 10; L1 = L0 + 22 + rnd(i, 3) * 34 - k * 3
            if k > 5 or L1 <= L0: continue
            for q in range(int(L0), int(L1)):
                if (q // 3 + i) % 3 == 0 and k > 1: continue          # 끊긴 점선
                col = 1 if q < L0 + 6 and k < 3 else 2 if k < 3 else 3 if k < 5 else 4
                f.put(c + math.cos(a) * q, c + math.sin(a) * q, col)
                if k < 2: f.put(c + math.cos(a) * q + 1, c + math.sin(a) * q, col)
        if R <= 0: out.append(f); continue
        for y in range(int(c - R - 10), int(c + R + 11)):
            for x in range(int(c - R - 10), int(c + R + 11)):
                dx, dy = x - c, y - c; r = math.hypot(dx, dy)
                edge = R * (1 + (fbm(x, y, 70 + k, 3, 12) - 0.5) * 0.5)
                if r > edge: continue
                v = r / edge * 0.75 + (fbm(x, y, 90, 2, 8) - 0.5) * 0.25 + t * 0.55 - (-dx - dy) / (R * 6)
                ramp(f, x, y, v, [1, 1, 2, 3, 4, 5])
        outline(f, (1, 2, 3, 4, 5), 6)
        out.append(f)
    return save("dot-hitball", out, [35, 35, 40, 40, 45, 50, 55])


def wall():
    """땅에서 치솟는 불기둥(마무리): 흰 속 · 노랑 · 주황 불길이 위로 핥아 오르고, 밑동은 넓게 퍼짐"""
    W, H = 128, 320; out = []; N = 10
    for k in range(N):
        f = F(W, H); t = k / (N - 1)
        top = H * (1 - min(1.0, k / 2.5))                     # 처음 세 장에 걸쳐 솟음
        half = [10, 26, 38, 44, 46, 44, 38, 30, 20, 10][k]
        for y in range(int(top), H):
            u = (H - y) / H                                    # 0 밑 → 1 위
            wob = (fbm(y * 0.6 - k * 40, 3, 220, 3, 26) - 0.5) * 26 * u
            hw = half * (1.0 + (1 - u) ** 3 * 0.9) * (0.7 + fbm(5, y - k * 50, 230, 3, 16) * 0.6)
            hw *= min(1.0, (y - top) / 40 + 0.15)                  # 꼭대기는 불혀처럼 가늘게
            cx = W / 2 + wob
            for x in range(W):
                d = abs(x - cx) / max(1.0, hw)
                n = fbm(x * 1.4, y * 0.5 + k * 36, 240, 3, 12)
                if d > 1 + (n - 0.5) * 0.7: continue
                v = d * 0.85 + (0.5 - n) * 0.45 + u * 0.25 + t * 0.45
                ramp(f, x, y, v, [1, 1, 2, 3, 4, 5])
        outline(f, (1, 2, 3, 4, 5), 6)
        out.append(f)
    return save("dot-pillar", out, [35, 35, 40, 45, 50, 55, 55, 60, 65, 70], pivot=(0.5, 1.0))


def aura():
    """필살기 시작 뒤쪽 기운: 가운데 흰빛에서 주황 → 빨강 → 어둠으로 층층이 번지는 큰 둥근 빛(바깥 테가 일렁임)"""
    S = 256; c = S / 2; out = []; N = 8
    cols = [1, 2, 3, 4, 5, 6, 11]
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        R = 120 * (0.55 + 0.45 * min(1, k / 2)) * (1 - max(0, t - 0.75) * 1.2)
        for y in range(S):
            for x in range(S):
                dx, dy = x - c, y - c; r = math.hypot(dx, dy)
                edge = R * (1 + (fbm(x, y, 260 + k, 2, 18) - 0.5) * 0.12)
                if r > edge: continue
                q = r / edge
                # 층마다 굵기를 달리 (안쪽 흰빛 좁게, 바깥 어둠 넓게) + 층 경계가 살짝 일렁임
                v = q ** 0.8 + (fbm(x, y, 270 + k, 2, 10) - 0.5) * 0.08
                ramp(f, x, y, v, cols)
        out.append(f)
    return save("dot-aura", out, [50, 50, 60, 70, 70, 70, 70, 80])


def swirl2():
    """기운 소용돌이(띄우기): 비틀린 잡음 결로 세 갈래가 휘감아 오름, 푸른 흰 기운"""
    S = 208; c = S / 2; out = []; N = 10
    for k in range(N):
        f = F(S, S); t = k / (N - 1)
        Rm = 40 + 60 * min(1, t * 2)
        for y in range(S):
            for x in range(S):
                dx, dy = (x - c), (y - c) / 0.78
                r = math.hypot(dx, dy)
                if r > Rm * 1.1 or r < 4: continue
                a = math.atan2(dy, dx)
                ph = (a * 3 - r / 14 + t * 7 + (fbm(x, y, 150, 3, 18) - 0.5) * 2.4) % (2 * math.pi)
                band = math.cos(ph)
                thick = 0.35 + (1 - r / Rm) * 0.5 - max(0, t - 0.55) * 1.4
                if band < 1 - thick * 1.6: continue
                v = (1 - band) * 1.4 + r / Rm * 0.45 + t * 0.25
                ramp(f, x, y, v, [14, 14, 15, 16, 17])
        outline(f, (14, 15, 16, 17), 18)
        out.append(f)
    return save("dot-swirl", out, [45, 45, 50, 50, 55, 55, 60, 60, 65, 70])


if __name__ == "__main__":
    import sys
    pick = sys.argv[1:]
    for fn in (impact, boom, burst, nova, blast, swirl, blast2, hitball, wall, swirl2, aura):
        if pick and fn.__name__ not in pick: continue
        sh = fn(); print(fn.__name__, sh.size)
