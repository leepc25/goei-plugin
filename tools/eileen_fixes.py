"""에일린 클립 코드 보정 (2026-10-22 장 단위 검수 결과, docs/캐릭터제작서/에일린_결함목록_2026-10-22.md).
apply(key, frames, idx, get) → (frames, idx). get(이름) = 효과 지우기를 거친 다른 클립의 장 목록."""
import numpy as np
from PIL import Image, ImageDraw
import erig, rig

# 쇠파이프(임시 둔기): 생성기가 pipe·walk_pipe에 파이프를 안 그림 → 앞손 손목에서 장마다 방향으로 그림(무기는 그림 안, idle_pipe와 같은 색)
PIPE_DIR = {'pipe': [(0.5, -1), (-0.15, -1), (0.5, -1), (1, 0.35), (0.8, -0.4), (0.5, -1)], 'walk_pipe': [(0.5, -1)] * 8}


def draw_pipe(im, w, v, L=34):
    n = (v[0] ** 2 + v[1] ** 2) ** .5; ux, uy = v[0] / n, v[1] / n
    x0, y0 = w[0] - ux * 5, w[1] - uy * 5; x1, y1 = w[0] + ux * L, w[1] + uy * L
    im = im.copy(); d = ImageDraw.Draw(im)
    d.line([(x0, y0), (x1, y1)], fill=(17, 22, 23, 255), width=5)
    d.line([(x0, y0), (x1, y1)], fill=(110, 118, 124, 255), width=3)
    d.line([(x0 - uy, y0 + ux), (x1 - uy, y1 + ux)], fill=(160, 168, 174, 255), width=1)
    return im


def shift_region(im, x0, dy, dx=0):
    """x0보다 앞(오른쪽) 픽셀만 dy·dx만큼 옮김 = 손·총만 반동으로 튀게"""
    a = np.array(im); b = a.copy(); b[:, x0:] = 0
    part = np.zeros_like(a); part[:, x0:] = a[:, x0:]
    part = np.roll(np.roll(part, dy, 0), dx, 1)
    m = part[..., 3] > 0; b[m] = part[m]
    return Image.fromarray(b)


def erase_nondark(im, x0, y0, x1, y1):
    a = np.array(im); r = a[y0:y1, x0:x1]
    mx = r[..., :3].max(axis=2)
    r[mx >= 90] = 0
    return Image.fromarray(a)


def floor_fix(fr, maxb=137, whole=False):
    """발이 바닥선(발바닥 y=136) 아래로 빠진 장을 위로 올림. whole=True면 클립 전체를 같은 만큼(기어가기처럼 몸 전체가 낮은 클립)."""
    bots = [f.getbbox()[3] if f.getbbox() else 0 for f in fr]
    out = []
    for f, b in zip(fr, bots):
        d = (max(bots) if whole else b) - maxb
        if d > 0:
            a = np.array(f); a = np.roll(a, -d, 0); a[-d:] = 0; f = Image.fromarray(a)
        out.append(f)
    return out


def apply(key, fr, idx, get):
    fr = list(fr); idx = list(idx)
    if key == 'crawl': fr = floor_fix(fr, 136, whole=True)   # 무릎·발끝이 캔버스 아래로 잘림 → 8px 올림(잘린 줄은 결함 목록)
    elif key in ('slide', 'turn', 'sneak'): fr = floor_fix(fr)
    if key == 'pistolfire':
        # 결함: 생성기가 권총 대신 소총을 들려 놓음 → 권총 전환 끝 장(권총 두 손 조준)으로 다시 짬, 반동은 손·총만 위로
        t = get('transition')
        if t:
            base = t[-1]; a = np.array(base); xs = np.nonzero(a[..., 3].any(axis=0))[0]
            x0 = int(xs.max()) - 26   # 앞팔 끝~권총
            fr = [base, shift_region(base, x0, -3, -1), shift_region(base, x0, -1), base]
            idx = [len(t) - 1] * 4; idx = [('transition', i) for i in idx]
    if key == 'pistolreload':
        t = get('transition')
        if t and len(fr) >= 6:
            for i in (0, 4, 5): fr[i] = t[-1]; idx[i] = ('transition', len(t) - 1)
    if key == 'read' and len(fr) > 6:
        fr[6] = erase_nondark(fr[6], 97, 95, 104, 112)   # 총구 아래로 늘어진 가는 선
    if key in PIPE_DIR:
        for n, raw in enumerate(idx):
            p = erig.CLIPS[key][3][min(raw, len(erig.CLIPS[key][3]) - 1)]
            w = (p['RIGHT ARM'][0] + rig.DX, p['RIGHT ARM'][1] + rig.DY)
            fr[n] = draw_pipe(fr[n], w, PIPE_DIR[key][min(raw, len(PIPE_DIR[key]) - 1)])
    if key == 'vault' and len(fr) > 4:
        fr, idx = fr[:4], idx[:4]   # 끝 장: 몸이 가늘게 깨짐(생성기 되돌림) → 버림
    if key == 'bandage' and len(fr) > 5:
        fr, idx = fr[:5], idx[:5]   # 끝 장: 붕대 대신 회색 반투명 덩어리 → 버림(4장에서 대기로 넘어감)
    return fr, idx
