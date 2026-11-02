"""그림 윤곽 자동 읽기 (2026-11-01, 사용자 「벽·바닥 연결선, 못 가는 곳, 앞에 보일 사물을 픽셀 단위로 정확하게」).
- floor_line: 기둥(x)마다 바닥 쪽 시작 y에서 위로 올라가 처음 만나는 어두운 윤곽선(벽 아래 끝·벽에 붙은 물건 아래 끝) 바로 아래 = 바닥 윗선.
- pile_tops: 화면 앞(카메라 쪽) 무더기는 기둥마다 바닥에서 아래로 내려가 처음 만나는 어두운 윤곽선 = 무더기 윗선(그 아래 그림 끝까지 무더기).
- 외톨이 점(바닥 얼룩)은 버리고, 윤곽선이 밝아 안쪽까지 내려간 칸은 이웃으로 메운다.
읽은 선은 반드시 확대 덮어보기로 확인한다(docs/가림_따기_지침.md)."""
from PIL import Image


def floor_line(im, start, thr=70, starts=()):
    p = im.load(); W, H = im.size; ys = []
    for x in range(W):
        sy = start
        for a, b, s2 in starts:
            if a <= x < b: sy = s2
        y = sy
        while y > 0 and max(p[x, y]) >= thr: y -= 1
        ys.append(y + 1)
    return [sorted(ys[max(0, i - 1):i + 2])[len(ys[max(0, i - 1):i + 2]) // 2] for i in range(W)]


def pile_tops(im, x0, x1, start, thr=70):
    p = im.load(); W, H = im.size; t = {}
    for x in range(x0, min(x1, W)):
        y = start
        while y < H and max(p[x, y]) >= thr: y += 1
        if y < H: t[x] = y
    # 외톨이(양옆과 3px 넘게 다르고 양옆이 서로 비슷) 버림
    for x in list(t):
        l, r = t.get(x - 1), t.get(x + 1)
        if (l is None or abs(t[x] - l) > 3) and (r is None or abs(t[x] - r) > 3): del t[x]
    # 빈 기둥(윤곽선이 밝아 못 찾음) 메우기: 양옆 3칸 안에 선이 있으면 둘 중 낮은 쪽(더 아래 y)
    if t:
        for x in range(min(t), max(t)):
            if x in t: continue
            l = next((t[x - k] for k in range(1, 4) if x - k in t), None)
            r = next((t[x + k] for k in range(1, 4) if x + k in t), None)
            if l is not None and r is not None: t[x] = max(l, r)
    # 바닥 얼룩(폭 3칸 이하로 위로 튄 점): 7칸 중앙값보다 4px 넘게 높으면 중앙값으로
    xs = sorted(t)
    for x in xs:
        win = [t[k] for k in range(x - 3, x + 4) if k in t]
        med = sorted(win)[len(win) // 2]
        if t[x] < med - 4: t[x] = med
    # 윤곽선이 밝아 안쪽으로 내려간 칸: 양옆 4칸 안의 더 높은 선으로 메움
    for x in sorted(t):
        for k in range(1, 5):
            l, r = t.get(x - k), t.get(x + k)
            if l is not None and r is not None: t[x] = min(t[x], max(l, r))
    return t


def tops_poly(t, bottom):
    xs = sorted(t)
    if not xs: return []
    pts = [(xs[0], bottom)]
    for x in xs: pts += [(x, t[x]), (x + 1, t[x])]
    pts.append((xs[-1] + 1, bottom))
    # 같은 y가 이어지는 점 줄이기
    out = []
    for q in pts:
        if len(out) >= 2 and out[-1][1] == q[1] == out[-2][1]: out[-1] = q
        else: out.append(q)
    return out


def line_poly(ys, x0, x1, bottom):
    pts = [(x0, ys[x0])]
    for x in range(x0 + 1, x1):
        if ys[x] != ys[x - 1]: pts += [(x, ys[x - 1]), (x, ys[x])]
    pts += [(x1, ys[x1 - 1]), (x1, bottom), (x0, bottom)]
    return pts


def mask_from_tops(size, t, bottom):
    m = Image.new('L', size, 0); p = m.load()
    for x, y in t.items():
        for yy in range(y, min(bottom, size[1])): p[x, yy] = 255
    return m
