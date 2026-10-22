"""큐라스 결함 목록(docs/캐릭터제작서/큐라스_결함목록_2026-10-22.md)의 '코드 보정' 항목과 손 좌표.

빌더(tools/build_kyuras_full_demo.py)가 시연판에 넣기 직전의 장 목록에 클립별로 적용한다. 원본 kyuras/clips/는 건드리지 않는다.
장 번호는 생성 원본 장 번호(idx) 기준으로 적는다.
"""
import os, sys, importlib.util
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location('krig', os.path.join(ROOT, 'game-src', 'action', 'kyuras', 'scripts', 'krig.py'))
krig = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(krig)
R = krig.R
_v4spec = importlib.util.spec_from_file_location('kyuras_snap_v4', os.path.join(ROOT, 'game-src', 'action', 'kyuras', 'scripts', 'krig_v4_snaps_unrun.py'))
snap_v4 = importlib.util.module_from_spec(_v4spec); _v4spec.loader.exec_module(snap_v4)
# Only promote the rig for clips whose new frames have actually been installed.
for _clip in ('snap1', 'snap2', 'snap3'):
    krig.CLIPS[_clip] = snap_v4.CLIPS[_clip]

DROP_CLIPS = set()       # 버림: 생성기가 자세를 못 그린 클립
DROP_FRAMES = {}         # {클립: {원본 장 번호, ...}} 깨진 장 빼기
SHIFT = {}               # 캔버스 왼쪽 끝에서 뒤통수가 잘린 클립: 오른쪽으로 옮기고 잘린 머리 끝을 둥글게 그려 넣음(빌더가 origin으로 위치 보정)
ORIGIN = {'down': krig.DOWN_DX, 'getup': krig.DOWN_DX}   # v3: 뼈대째 오른쪽으로 옮겨 생성한 클립(그림은 그대로, origin만 보정. 손 좌표는 뼈대에 이미 들어 있음)
ORDER = {}               # {클립: [원본 장 번호 순서]}
# {클립: [(원본 장, x0, y0, x1, y1[, 방식]), ...]} 그림에 섞여 나온 효과·가구 지우기. 방식 'nonskin' = 피부색이 아닌 픽셀만 지움
ERASE = {'drink': [(6, 65, 40, 82, 57)]}   # 2026-10-22 검수: 컵 위 초록 김
# {클립: [(원본 장, x0, y0, x1, y1), ...]} 갈색으로 뭉갠 손을 피부 그늘색으로(drink 0~2 배 앞 뒷손이 갈색 덩어리로 보임)
TOSKIN = {'drink': [(0, 58, 71, 78, 84), (1, 58, 71, 78, 84), (2, 58, 71, 78, 84)]}
AIRBORNE = {'jump', 'airsnap', 'down', 'getup', 'support', 'evade'}   # 발이 바닥선보다 내려가도 맞추지 않는 클립


def wrists(clip, i):
    """뼈대의 i번째 장 두 손목 좌표(캔버스 px). 앞손=RIGHT ARM, 뒷손=LEFT ARM."""
    ps = krig.CLIPS[clip][2]
    p = ps[min(i, len(ps) - 1)]
    f = lambda k: (p[k][0] + R.DX, p[k][1] + R.DY)
    return f('RIGHT ARM'), f('RIGHT ELBOW'), f('LEFT ARM'), f('LEFT ELBOW')


def anchors(src, idx):
    """장마다 손 좌표. hand=앞손 손목, hand2=뒷손 손목, angle=앞손 팔꿈치→손목 방향(도, 0=앞, 아래가 +), hip=골반 가운데."""
    if src not in krig.CLIPS: return None
    out = []
    for raw in idx:
        w, e, w2, _ = wrists(src, raw)
        ang = float(np.degrees(np.arctan2(w[1] - e[1], w[0] - e[0])))
        p = krig.CLIPS[src][2][min(raw, len(krig.CLIPS[src][2]) - 1)]
        hip = [(p['RIGHT HIP'][0] + p['LEFT HIP'][0]) / 2 + R.DX, (p['RIGHT HIP'][1] + p['LEFT HIP'][1]) / 2 + R.DY]
        out.append({'hand': [round(w[0]), round(w[1])], 'hand2': [round(w2[0]), round(w2[1])], 'angle': round(ang),
                    'hip': [round(hip[0]), round(hip[1])]})
        if src == 'run_shotgun':
            # Actual recovered wrist / free corrected grip, not the missed skeleton pose.
            out[-1]['hand'] = [[88,66],[86,68],[84,81],[84,81],[84,79],[84,81],[84,81],[86,68]][raw]
    return out


def _hair_mask(a):
    c = a[:, :, :3].astype(float) / 255; mx = c.max(2); mn = c.min(2); l = (mx + mn) / 2
    d = mx - mn; sat = np.where(d == 0, 0, d / (1 - abs(2 * l - 1) + 1e-6))
    r, g, b = c[:, :, 0], c[:, :, 1], c[:, :, 2]
    greenish = (g > r + 0.02) & (g >= b) & (sat > 0.08)
    return (a[:, :, 3] > 0) & greenish & (l > 0.08) & (l < 0.8)


def _dilate(m, it):
    for _ in range(it):
        o = m.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                o |= np.roll(np.roll(m, dy, 0), dx, 1)
        m = o
    return m


def _label(m):
    lab = np.zeros(m.shape, int); n = 0; H, W = m.shape
    for y0, x0 in zip(*np.where(m)):
        if lab[y0, x0]: continue
        n += 1; st = [(y0, x0)]; lab[y0, x0] = n
        while st:
            y, x = st.pop()
            for yy in range(y - 1, y + 2):
                for xx in range(x - 1, x + 2):
                    if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n; st.append((yy, xx))
    return lab, n


def head_box(m):
    """머리 중심 = 회록색이 가장 빽빽한 15×15 칸. 그 둘레 16px 안(앞머리 가닥·눈 포함)을 머리로 침"""
    ii = np.pad(m.astype(int), ((1, 0), (1, 0))).cumsum(0).cumsum(1); k = 15
    dens = ii[k:, k:] - ii[:-k, k:] - ii[k:, :-k] + ii[:-k, :-k]
    cy, cx = np.unravel_index(np.argmax(dens), dens.shape); cy += k // 2; cx += k // 2
    yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
    return (abs(yy - cy) <= 16) & (abs(xx - cx) <= 16)


def clean_stray_hair(im):
    """결함 공통(2026-10-22 검수): 머리 덩어리와 떨어진 회록색 점·자국(신발 테두리 초록 번짐, 손에 묻은 머리색, 움직임 꼬리)을 지운다.
    머리 = 회록색 연결 덩어리 중 가장 큰 것(+그와 3px 안에 붙은 것). 나머지: 투명과 맞닿은 점은 지우고(가장자리 번짐·꼬리), 안쪽 점은 이웃 비머리색으로."""
    a = np.array(im); m = _hair_mask(a)
    if m.sum() == 0: return im
    keep = head_box(m)
    lab, n = _label(m & ~keep)
    main = -1
    alpha = a[:, :, 3] > 0
    edge = _dilate(~alpha, 1)
    H, W = m.shape
    for k in range(1, n + 1):
        if k == main: continue
        comp = lab == k
        ys, xs = np.where(comp)
        for y, x in zip(ys, xs):
            body = [a[yy, xx] for yy in range(y - 1, y + 2) for xx in range(x - 1, x + 2)
                    if 0 <= yy < H and 0 <= xx < W and a[yy, xx, 3] > 0 and not m[yy, xx]]
            if len(body) < 2: a[y, x] = 0                       # 떠 있는 꼬리·점
            elif edge[y, x]: a[y, x] = (0, 0, 0, 255)           # 몸 가장자리 초록 번짐 → 외곽선
            else: a[y, x] = body[0]
    return Image.fromarray(a)


def drop_specks(im, maxn=40):
    """몸과 떨어진 작은 점 덩어리(움직임 꼬리 찌꺼기) 지우기"""
    a = np.array(im); m = a[:, :, 3] > 0
    lab, n = _label(m)
    if n <= 1: return im
    sizes = [int((lab == k).sum()) for k in range(1, n + 1)]
    head = head_box(_hair_mask(a))
    for k, sz in enumerate(sizes, 1):
        if sz <= maxn and not (head & (lab == k)).any(): a[lab == k] = 0   # 떨어진 앞머리 가닥은 남김
    return Image.fromarray(a)


def cap_left(im, k):
    """오른쪽으로 k px 옮긴 뒤, 원래 x=0에 닿아 잘렸던 줄을 둥글게 이어 그림(바깥 1px 외곽선)"""
    a = np.array(im); o = np.zeros_like(a); o[:, k:] = a[:, :-k]
    rows = [y for y in range(a.shape[0]) if a[y, 0, 3] > 0]
    if rows:
        y0, y1 = rows[0], rows[-1]; mid = (y0 + y1) / 2; half = max(1, (y1 - y0) / 2)
        for y in rows:
            ext = int(round(k * (1 - ((y - mid) / half) ** 2) ** 0.5))
            col = a[y, 0]
            for i in range(1, ext + 1):
                o[y, k - i] = col if i < ext else (0, 0, 0, 255)
            if ext == 0: o[y, k - 1] = (0, 0, 0, 255)
    return Image.fromarray(o)


def _skin(a):
    r, g, b = (a[:, :, i].astype(int) for i in range(3))
    return (a[:, :, 3] > 0) & (r > 140) & (r > g + 12) & (g > b) & (r - b > 40)


def skin_stains(im):
    """머리 상자 안이라 clean_stray_hair가 못 지운 손·얼굴 위 회록 얼룩(cool 1, airsnap 0·5, super 5, firewall 3, support 0 등)을 피부색으로.
    머리 본체(가장 큰 회록 덩어리)에서 2px 넘게 떨어져 있고, 둘레의 30% 이상이 피부인 회록 덩어리만 바꾼다(앞머리 가닥은 본체에 붙어 있어 남음)."""
    a = np.array(im); m = _hair_mask(a)
    if m.sum() == 0: return im
    lab, n = _label(m)
    if n <= 1: return im
    sizes = [(lab == k).sum() for k in range(1, n + 1)]
    main = int(np.argmax(sizes)) + 1
    near = _dilate(lab == main, 2)
    cy, cx = (v.mean() for v in np.where(lab == main))
    sk = _skin(a)
    if not sk.any(): return im
    mid = np.median(a[sk][:, :3], axis=0).astype(np.uint8)
    H, W = m.shape
    for k in range(1, n + 1):
        comp = lab == k
        if k == main: continue
        ys, xs = np.where(comp)
        below = ys.mean() > cy + 12 and xs.mean() > cx + 2      # 머리 본체 중심보다 한참 아래·앞 = 턱·손 위(머리는 뒤로 넘긴 모양이라 거기 없음)
        if (comp & near).any() and not below: continue
        ring = _dilate(comp, 1) & ~comp & (a[:, :, 3] > 0)
        if ring.sum() == 0 or (not below and (ring & sk).sum() / ring.sum() < 0.3): continue
        for y, x in zip(*np.where(comp)):
            nb = [a[yy, xx] for yy in range(y - 2, y + 3) for xx in range(x - 2, x + 3) if 0 <= yy < H and 0 <= xx < W and sk[yy, xx]]
            if not nb and below:   # 피부가 안 닿은 턱 밑 얼룩은 둘레 정장·셔츠색
                nb = [a[yy, xx] for yy in range(y - 2, y + 3) for xx in range(x - 2, x + 3) if 0 <= yy < H and 0 <= xx < W and a[yy, xx, 3] and not m[yy, xx] and a[yy, xx, :3].max() > 20]
            a[y, x] = nb[0] if nb else (*mid, 255)
    return Image.fromarray(a)


def to_skin(im, box):
    """갈색으로 뭉갠 손(그늘 피부가 너무 어둡고 붉음)을 피부 그늘~중간색 쪽으로 반쯤 당김. 외곽선(검정)은 그대로"""
    a = np.array(im).astype(int); x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, al = a[y, x]
            if al and r > g + 10 and g >= b - 4 and 40 < r < 200:
                t = (214, 161, 124) if r < 150 else (245, 196, 153)
                a[y, x, :3] = [(v + w) // 2 for v, w in zip((r, g, b), t)]
    return Image.fromarray(a.astype(np.uint8))


def outline_black(im):
    """알파 경계 1px의 어두운 픽셀(max<90)을 순흑으로(쟈알디와 같은 외곽선 규칙. 2026-10-22 검수: 외곽선 21~32%가 정장 회색이라 끊겨 보임)"""
    a = np.array(im); al = a[:, :, 3] > 0
    tr = ~al; edge = np.zeros_like(al)
    edge[1:] |= tr[:-1]; edge[:-1] |= tr[1:]; edge[:, 1:] |= tr[:, :-1]; edge[:, :-1] |= tr[:, 1:]
    edge[0] = edge[-1] = True; edge[:, 0] = edge[:, -1] = True
    e = al & edge & (a[:, :, :3].max(2) < 90)
    a[e, :3] = 0; a[e, 3] = 255
    return Image.fromarray(a)


def ground(im):
    """발이 바닥선(y=136) 아래로 1~4px 내려간 장을 올림(walk 3~4, crouchwalk 3~5 등)"""
    a = np.array(im); ys = np.where(a[:, :, 3].any(1))[0]
    if not len(ys) or ys[-1] <= 136 or ys[-1] > 140: return im
    d = ys[-1] - 136; o = np.zeros_like(a); o[:-d] = a[d:]
    return Image.fromarray(o)


GPT = {'undress', 'showerturn', 'shower', 'bath'}


def apply(key, fr, idx):
    """fr: 장 목록, idx: 각 장의 원본 번호. 지우기·장 빼기·순서를 거친 (fr, idx)를 돌려준다."""
    fr = list(fr); idx = list(idx)
    for i, x0, y0, x1, y1, *mode in ERASE.get(key, []):
        if i in idx:
            j = idx.index(i); a = np.array(fr[j])
            if mode and mode[0] == 'nonskin':
                sub = a[y0:y1, x0:x1]; sub[~_skin(sub)] = 0
            else: a[y0:y1, x0:x1] = 0
            fr[j] = Image.fromarray(a)
    if key not in GPT:
        for i, x0, y0, x1, y1 in TOSKIN.get(key, []):
            if i in idx: j = idx.index(i); fr[j] = to_skin(fr[j], (x0, y0, x1, y1))
        fr = [outline_black(skin_stains(drop_specks(clean_stray_hair(f)))) for f in fr]
    if key not in AIRBORNE: fr = [ground(f) for f in fr]   # GPT 그림도 발이 137에 닿은 장이 있어 같이 맞춤
    if key in SHIFT:
        fr = [cap_left(f, SHIFT[key]) for f in fr]
    if key in ORDER:
        m = dict(zip(idx, fr)); idx = [i for i in ORDER[key] if i in m]; fr = [m[i] for i in idx]
    drop = DROP_FRAMES.get(key, set())
    keep = [(f, i) for f, i in zip(fr, idx) if i not in drop]
    return [f for f, _ in keep], [i for _, i in keep]
