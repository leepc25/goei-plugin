"""쟈알디 결함 목록(docs/캐릭터제작서/쟈알디_결함목록_2026-10-21.md)의 '코드 보정' 항목.

빌더가 시연판에 넣기 직전의 장 목록(끝 장 자동 정리·순서·범위를 거친 뒤)에 클립별로 적용한다.
장 번호는 모두 그 최종 목록 기준. 원본 full/clips/는 건드리지 않는다. 가구를 떼어 낸 클립은 full/split/(tools/jyaldi_split_props.py)을 쓴다.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'scripts'))
import rig  # noqa: E402

# 버림(결함 35·36): 생성기가 자세를 못 그림
DROP_CLIPS = {'pushup', 'sleepside'}

# 장 빼기(결함 6~10): 끝 장 깨짐·대기 자세로 튐·얼굴 뭉개짐·달리기 0장
DROP = {
    'glove': [-1], 'power': [-1], 'support': [-1], 'land': [0, -1], 'board': [4], 'microwave': [4], 'mop': [5],
    'nausea': [-1], 'push': [-1], 'locker': [4, 5], 'down': [1, 2], 'giftbox': [0], 'run': [0], 'button': [5],
}
# 지울 영역(결함 5·37·46): (장, x0, y0, x1, y1) — 유령 상대·회색 찌꺼기·떨어진 조각
ERASE = {
    'handover': [(0, 100, 0, 192, 144), (1, 100, 0, 192, 144), (2, 116, 0, 192, 144), (3, 116, 0, 192, 144), (4, 116, 0, 192, 144)],
    'hug': [(0, 90, 0, 192, 144), (1, 90, 0, 192, 144)],
}

OUTLINE = (24, 26, 30, 255)


def wrists(clip, i):
    """rig 뼈대의 i번째 장 두 손목 좌표(캔버스 px). 앞손=RIGHT ARM, 뒷손=LEFT ARM."""
    ps = rig.CLIPS[clip][2]
    p = ps[min(i, len(ps) - 1)]
    f = lambda k: (p[k][0] + rig.DX, p[k][1] + rig.DY)
    return f('RIGHT ARM'), f('RIGHT ELBOW'), f('LEFT ARM'), f('LEFT ELBOW')


def over(fr, draw_fn):
    fr = fr.copy(); draw_fn(ImageDraw.Draw(fr), fr); return fr


def box(d, x0, y0, x1, y1, fill, edge=OUTLINE, hi=None):
    d.rectangle([x0, y0, x1, y1], fill=edge)
    d.rectangle([x0 + 1, y0 + 1, x1 - 1, y1 - 1], fill=fill)
    if hi: d.line([(x0 + 1, y0 + 1), (x1 - 1, y0 + 1)], fill=hi)


def pipe_line(d, w, e, L=44):
    dx, dy = w[0] - e[0], w[1] - e[1]; n = max(1e-3, (dx * dx + dy * dy) ** .5)
    x1, y1 = w[0] + dx / n * L, w[1] + dy / n * L
    x0, y0 = w[0] - dx / n * 6, w[1] - dy / n * 6
    d.line([(x0, y0), (x1, y1)], fill=(40, 44, 48, 255), width=4)
    d.line([(x0, y0), (x1, y1)], fill=(139, 147, 154, 255), width=2)


def brick(d, cx, cy):
    """벽돌(결함 23): 13×7, 줄눈 두 줄."""
    x0, y0 = cx - 6, cy - 3
    box(d, x0, y0, x0 + 12, y0 + 6, (150, 66, 44, 255), hi=(186, 96, 66, 255))
    d.line([(x0 + 1, y0 + 3), (x0 + 11, y0 + 3)], fill=(96, 44, 32, 255))
    d.point([(x0 + 6, y0 + 1), (x0 + 6, y0 + 2), (x0 + 3, y0 + 4), (x0 + 3, y0 + 5), (x0 + 9, y0 + 4), (x0 + 9, y0 + 5)], fill=(96, 44, 32, 255))


def replace_red(fr):
    """빨간 덩어리(생성된 벽돌)를 지우고 같은 자리에 벽돌을 그린다."""
    a = np.array(fr)
    m = (a[:, :, 3] > 60) & (a[:, :, 0] > 110) & (a[:, :, 1] < 70) & (a[:, :, 2] < 70)
    ys, xs = np.nonzero(m)
    if len(xs) < 6: return fr
    a[m] = 0
    out = Image.fromarray(a)
    return over(out, lambda d, im: brick(d, int(xs.mean()), int(ys.mean())))


def recolor_hair(f, ymax=75):
    """결함 43: 샤워 0~2장 회청색으로 바뀐 머리를 정장 머리색(검정 계열)으로. 밝기 단계는 유지."""
    a = np.array(f); rgb = a[:, :, :3].astype(int)
    m = (a[:, :, 3] > 0) & (rgb[:, :, 2] - rgb[:, :, 0] > 12) & (rgb.max(2) < 215)
    m[ymax:] = False
    lum = rgb[m].mean(1)
    v = np.clip(12 + (lum - 60) * 0.45, 8, 70).astype(int)
    a[m, 0] = v; a[m, 1] = v + 2; a[m, 2] = v + 8
    return Image.fromarray(a)


def apply(key, fr, pr=None):
    """fr: 캐릭터 장, pr: 같은 길이의 가구 장(없으면 None). 둘 다 보정·장 빼기를 같이 거쳐 돌려준다."""
    fr = list(fr); pr = list(pr) if pr else None
    if key in ERASE:
        for i, x0, y0, x1, y1 in ERASE[key]:
            if i < len(fr):
                a = np.array(fr[i]); a[y0:y1, x0:x1] = 0; fr[i] = Image.fromarray(a)
    if key == 'readwall':                      # 결함 39: 허공 글씨는 벽 공고문(가구 층)으로 옮김
        pr = pr or [Image.new('RGBA', f.size) for f in fr]
        for i, f in enumerate(fr):
            a = np.array(f); b = np.array(pr[i]); b[:, 95:] = a[:, 95:]; a[:, 95:] = 0
            fr[i] = Image.fromarray(a); pr[i] = Image.fromarray(b)
    if key == 'shower':
        fr = [recolor_hair(f) if i < 3 else f for i, f in enumerate(fr)]
    if key == 'pipe':                          # 결함 1: 파이프 빠진 장에 뼈대 손목 따라 덧그림
        for i, raw in ((0, 1), (2, 2)):   # (최종 장, 원본 장): 빌더 order=[1, 0, 2, 3]
            if i < len(fr):
                w, e, _, _ = wrists('pipe2', raw); fr[i] = over(fr[i], lambda d, im: pipe_line(d, w, e))
    if key == 'idle_pipe':                     # 결함 2: 대기도 걷기처럼 어깨에 걸침 → 걷기 중 두 발 모인 장
        from build_jyaldi_full_demo import frames_of
        wp = frames_of('walk_pipe')[:7]
        def spread(f):
            a = np.array(f)[118:137, :, 3] > 40; xs = np.nonzero(a)[1]; return xs.max() - xs.min()
        if wp: fr = [min(wp, key=spread)] * 4
    if 'brick' in key:                         # 결함 23
        fr = [replace_red(f) for f in fr]
    if key == 'reload':                        # 결함 21: 뒷손에 탄창
        for i in range(1, min(4, len(fr))):
            _, _, w, _ = wrists('reload', i)
            fr[i] = over(fr[i], lambda d, im, w=w: box(d, w[0] - 1, w[1] - 7, w[0] + 2, w[1] + 1, (52, 56, 62, 255), hi=(120, 126, 134, 255)))
    if key in ('drink', 'eat', 'bandage', 'brushteeth'):   # 결함 22·33: 손에 든 물건
        for i in range(len(fr)):
            w, e, _, _ = wrists(key, i)
            if key == 'drink':
                f = lambda d, im, w=w: box(d, w[0] - 2, w[1] - 6, w[0] + 3, w[1] + 2, (168, 42, 48, 255), hi=(214, 214, 220, 255))
            elif key == 'eat':
                f = lambda d, im, w=w: box(d, w[0] - 3, w[1] - 5, w[0] + 3, w[1] + 1, (226, 178, 70, 255), hi=(250, 224, 140, 255))
            elif key == 'bandage':
                f = lambda d, im, w=w: box(d, w[0] - 3, w[1] - 3, w[0] + 3, w[1] + 3, (236, 232, 222, 255), hi=(255, 255, 255, 255))
            else:
                f = lambda d, im, w=w: (d.line([(w[0], w[1]), (w[0] + 2, w[1] - 7)], fill=(60, 140, 200, 255), width=2), d.point([(w[0] + 2, w[1] - 8), (w[0] + 3, w[1] - 8)], fill=(250, 250, 250, 255)))
            fr[i] = over(fr[i], f)
    if key in DROP:
        n = len(fr)
        idx = {i % n for i in DROP[key]}
        fr = [f for i, f in enumerate(fr) if i not in idx]
        if pr: pr = [f for i, f in enumerate(pr) if i not in idx]
    return fr, pr
