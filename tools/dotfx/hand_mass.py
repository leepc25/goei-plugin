"""큰 한 방 3판 (11-09 사용자: 「이펙트의 매스가 다르잖아」).
킹오파98 롬 장면을 확대해 본 것: 터짐이 몸통을 다 덮는 한 덩어리(캐릭터 키 0.6~0.65), 가시는 뿌리가 굵고 끝이 가는 쐐기,
가운데는 흰 덩어리, 가장자리로 갈수록 연노랑→노랑→주황 띠(띠 경계는 바둑판 섞기), 사라질 때는 X자로 남은 큰 쐐기가 주황으로 식음.
모양(가운데 덩어리 반지름 16방향, 쐐기 각도·뿌리 굵기·길이, 튀는 점)은 장마다 손으로 정한 값이고, 명암은 「가장자리에서 몇 칸 안쪽인가」로 띠를 칠한다.
사용: python3 tools/dotfx/hand_mass.py → game-src/action/testroom3/vfx/dot-hand-big3"""
import json, math
from pathlib import Path
from PIL import Image
import hand_dot as H

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "game-src" / "action" / "testroom3" / "vfx"
S = 64; C = 32

# 가장자리에서 안쪽 칸 수 → 색 (장마다 식는 정도 shift)
BANDS = ['O', 'o', 'y', 'Y', 'Y', 'W']          # 0칸(가장자리) … 5칸 이상
COOL = ['W', 'Y', 'y', 'o', 'O', 'r', 'R', 'R']


def cool(ch, n):
    i = COOL.index(ch) if ch in COOL else 0
    return COOL[min(len(COOL) - 1, i + n)]


def poly_fill(m, pts):
    ys = [p[1] for p in pts]
    for y in range(max(0, int(min(ys))), min(S, int(max(ys)) + 1)):
        yc = y + 0.5; xs = []
        for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
            if (y0 <= yc < y1) or (y1 <= yc < y0):
                xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for a, b in zip(xs[::2], xs[1::2]):
            for x in range(max(0, int(round(a))), min(S, int(round(b)))):
                m[y][x] = 1


def silhouette(core, spikes, cx=C, cy=C):
    m = [[0] * S for _ in range(S)]
    if core:
        n = len(core)
        poly_fill(m, [(cx + math.cos(2 * math.pi * i / n) * r, cy + math.sin(2 * math.pi * i / n) * r) for i, r in enumerate(core)])
    for deg, w, r0, r1 in spikes:            # 쐐기: 각도, 뿌리 반폭, 뿌리 거리, 끝 거리
        a = math.radians(deg); ca, sa = math.cos(a), math.sin(a)
        poly_fill(m, [(cx + ca * r0 - sa * w, cy + sa * r0 + ca * w), (cx + ca * r1, cy + sa * r1), (cx + ca * r0 + sa * w, cy + sa * r0 - ca * w)])
    return m


def shade(m, cool_n, flat=None):
    """가장자리에서 안쪽 칸 수로 띠 칠하기. 띠 경계 한 줄은 바둑판으로 섞음"""
    d = [[0 if m[y][x] else -1 for x in range(S)] for y in range(S)]
    INF = 99
    for y in range(S):
        for x in range(S):
            if m[y][x]: d[y][x] = INF
    for y in range(S):
        for x in range(S):
            if not m[y][x]: continue
            near = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if any(not (0 <= u < S and 0 <= v < S) or not m[v][u] for u, v in near): d[y][x] = 0
    for it in range(1, 7):
        for y in range(S):
            for x in range(S):
                if d[y][x] == INF and any(0 <= x + dx < S and 0 <= y + dy < S and d[y + dy][x + dx] == it - 1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    d[y][x] = it
    g = [['.'] * S for _ in range(S)]
    for y in range(S):
        for x in range(S):
            if d[y][x] < 0: continue
            if flat: g[y][x] = flat; continue
            k = min(d[y][x], 99)
            i = min(len(BANDS) - 1, k)
            # 띠 경계 섞기: 바로 바깥 띠 색을 바둑판으로
            if 0 < i < len(BANDS) - 1 and (x + y) % 2 == 0 and k == i: ch = BANDS[i - 1] if (x // 2 + y) % 3 == 0 else BANDS[i]
            else: ch = BANDS[i]
            g[y][x] = cool(ch, cool_n)
    return g


def specks(g, pts, cool_n=0):
    for x, y, ch in pts:
        if 0 <= x < S and 0 <= y < S: g[y][x] = str(min(9, int(ch) + cool_n)) if ch.isdigit() else cool(ch, cool_n)
    return g


# ── 3판 고침 (11-09 롬 구조 보고): 킹오파 큰 한 방 = 64x64 한 장, 16색 팔레트 하나(쓰는 색 10: 흰→크림 3단→노랑→주황 2→붉은 주황 2 + 검은 별 한 색),
#    덩어리는 둥근 판이 아니라 가운데서 뻗는 길쭉한 불바늘 수십 개가 겹친 것. 바늘마다 뿌리는 희고 끝으로 갈수록 9단으로 짙어짐. 한 그림 4게임장 유지.
# 바늘: (각도°, 뿌리 거리, 끝 거리, 뿌리 반폭) — 손으로 정한 값
NEEDLES = [(-171, 2, 27, 2.5), (-158, 3, 19, 1.5), (-146, 1, 30, 3.5), (-131, 4, 22, 1.2), (-119, 2, 31, 3.0), (-107, 5, 17, 1.0), (-97, 1, 26, 2.2),
           (-86, 3, 31, 1.4), (-74, 2, 21, 2.8), (-63, 1, 30, 3.6), (-51, 4, 18, 1.1), (-41, 2, 28, 2.4), (-30, 5, 23, 1.0), (-19, 1, 31, 3.2),
           (-8, 3, 20, 1.6), (3, 2, 29, 2.6), (14, 4, 25, 1.2), (24, 1, 31, 3.4), (36, 3, 19, 1.4), (47, 2, 27, 2.2), (58, 5, 22, 1.0),
           (69, 1, 31, 3.0), (81, 3, 24, 1.6), (93, 2, 29, 2.4), (104, 4, 18, 1.1), (116, 1, 31, 3.5), (128, 3, 21, 1.3), (139, 2, 27, 2.6),
           (150, 5, 24, 1.0), (162, 1, 30, 3.0), (175, 3, 20, 1.5), (-64, 9, 31, 0.8), (33, 8, 30, 0.8), (-140, 8, 31, 0.8), (108, 9, 30, 0.8), (-12, 9, 30, 0.7)]
# 사라질 때 남는 큰 바늘(X자): NEEDLES 번호
BIG = [9, 2, 25, 21, 13, 17]
DOTS1 = [(6, 18, '6'), (9, 50, '5'), (58, 12, '6'), (60, 44, '5'), (20, 3, '5'), (44, 61, '6'), (2, 34, '7'), (62, 28, '6'), (14, 58, '7'), (52, 4, '7')]
DOTS2 = DOTS1 + [(10, 10, '7'), (55, 55, '6'), (4, 40, '8'), (40, 2, '7'), (24, 62, '8'), (61, 20, '8'), (30, 1, '8'), (1, 26, '7')]


def needle_layer(g, sel, ls=1.0, ws=1.0, hot=1, span=8, flat=None, jit=0):
    """바늘을 긴 것부터 칠하고 짧은 것을 위에 (짧은 게 가운데 밝은 덩어리를 만듦)"""
    order = sorted(sel, key=lambda i: -NEEDLES[i][2])
    for i in order:
        deg, r0, r1, w = NEEDLES[i]
        deg += jit * ((i * 7) % 5 - 2)
        a = math.radians(deg); ca, sa = math.cos(a), math.sin(a)
        # 덩어리를 한쪽으로 길게(킹오파 장면은 대각선 두 갈래가 길고 나머지는 짧음): 손으로 정한 긴 축 -50°/130°, 버금 축 15°
        d1 = abs(math.cos(math.radians(deg + 50))); d2 = abs(math.cos(math.radians(deg - 15)))
        r1 = r1 * ls * (0.62 + 0.42 * d1 ** 3 + 0.16 * d2 ** 6); w = max(0.6, w * ws)
        n = int(r1 * 2) + 2
        for k in range(n + 1):
            t = k / n; r = r0 + (r1 - r0) * t; hw = w * (1 - t) ** 0.8
            cx, cy = C + ca * r, C + sa * r
            ch = flat or str(min(9, max(1, int(round(hot + span * t ** 1.3)))))
            if k == 0 and not flat and r0 <= 2: g[C][C] = ch
            for o in range(-int(math.ceil(hw)), int(math.ceil(hw)) + 1):
                if abs(o) > hw + 0.35: continue
                x, y = int(round(cx - sa * o)), int(round(cy + ca * o))
                if 0 <= x < S and 0 <= y < S:
                    if flat or g[y][x] == '.' or g[y][x] > ch: g[y][x] = ch
    return g


def blank():
    return [['.'] * S for _ in range(S)]


def frames():
    ALL = list(range(len(NEEDLES)))
    out = []
    sp = blank()
    needle_layer(sp, [3, 9, 13, 21, 25, 17], ls=0.45, ws=0.6, hot=1, span=5)
    out.append((sp, 66))                                                     # 작은 불똥(흰 화면과 같이)
    out.append((needle_layer(blank(), ALL, ls=1.18, ws=1.5, flat='K'), 66))     # 검은 별(한 색)
    out.append((specks(needle_layer(blank(), ALL, ls=1.18, ws=1.7, hot=1, span=3), DOTS1[:4]), 66))   # 흰 덩어리
    out.append((specks(needle_layer(blank(), ALL, ls=1.18, ws=1.5, hot=1, span=5, jit=1), DOTS1), 66))
    out.append((specks(needle_layer(blank(), ALL, ls=1.15, ws=1.2, hot=1, span=7, jit=2), DOTS1), 66))
    out.append((specks(needle_layer(blank(), [i for i in ALL if i % 3 != 1], ls=1.05, ws=0.9, hot=2, span=7, jit=2), DOTS2), 66))
    out.append((specks(needle_layer(blank(), [i for i in ALL if i % 2 == 0] + BIG, ls=1.05, ws=0.6, hot=3, span=6, jit=3), DOTS2), 33))
    out.append((specks(needle_layer(blank(), BIG + [31, 32, 33], ls=1.0, ws=0.5, hot=4, span=5, jit=3), DOTS2[::2]), 33))
    out.append((specks(needle_layer(blank(), BIG[:4], ls=0.95, ws=0.35, hot=4, span=5, jit=4), DOTS2[1::2]), 33))
    out.append((specks(needle_layer(blank(), BIG[:3], ls=0.7, ws=0.3, hot=5, span=4, jit=4), DOTS2[::3]), 33))
    return out


def main():
    fr = frames(); cols = 4; rows = (len(fr) + cols - 1) // cols
    sheet = Image.new("RGBA", (S * cols, S * rows), (0, 0, 0, 0)); px = sheet.load(); meta = []
    txt = ["# 큰 한 방 3판(만들어진 격자, tools/dotfx/hand_mass.py가 씀)"]
    for i, (g, d) in enumerate(fr):
        ox, oy = (i % cols) * S, (i // cols) * S
        txt.append(f"@ {d}"); txt += [''.join(r) for r in g]
        for y in range(S):
            for x in range(S):
                if g[y][x] in H.PAL: px[ox + x, oy + y] = H.PAL[g[y][x]] + (255,)
        meta.append({"filename": f"dot-hand-big3 {i}.png", "frame": {"x": ox, "y": oy, "w": S, "h": S}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": S, "h": S}, "sourceSize": {"w": S, "h": S}, "pivot": {"x": 0.5, "y": 0.5}, "duration": d})
    sheet.save(OUT / "dot-hand-big3.png")
    (OUT / "dot-hand-big3.json").write_text(json.dumps({"frames": meta, "meta": {"app": "tools/dotfx/hand_mass.py", "image": "dot-hand-big3.png", "size": {"w": sheet.width, "h": sheet.height}}}, ensure_ascii=False))
    (ROOT / "tools" / "dotfx" / "hand" / "hit_big3.txt").write_text('\n'.join(txt) + '\n', encoding="utf-8")
    print("dot-hand-big3", len(fr), "장", S)


if __name__ == "__main__":
    main()
