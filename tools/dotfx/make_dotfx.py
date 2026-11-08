"""손으로 짠 도트 이펙트(11-08 사용자 「그래」: PixelLab 없이 Claude가 직접 찍은 도트 이펙트를 필살기 하나에 넣어 보기).
점 하나씩 규칙으로 찍는다(흐림·그라데이션·반투명 없음, 색 단계만). 결과는 테스트룸 이펙트 폴더(game-src/action/testroom3/vfx/dot-*.png/json)에
PixelLab 시트와 같은 꼴로 둔다. 사용: python3 tools/dotfx/make_dotfx.py"""
import json, math
from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parents[2] / "game-src" / "action" / "testroom3" / "vfx"
# 색 단계(밝은 → 어두운). 0 = 빈칸
PAL = {1: (255, 255, 255), 2: (255, 246, 168), 3: (255, 206, 64), 4: (255, 132, 32), 5: (214, 52, 30), 6: (110, 22, 22),
       7: (70, 60, 62), 8: (112, 100, 98), 9: (160, 150, 144), 10: (40, 32, 34)}


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
    gx, gy = x / cell, y / cell; x0, y0 = int(gx), int(gy); fx, fy = gx - x0, gy - y0
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


if __name__ == "__main__":
    for fn in (impact, boom, burst):
        sh = fn(); print(fn.__name__, sh.size)
