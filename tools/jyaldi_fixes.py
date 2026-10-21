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
# 기본 클립 재설계(docs/캐릭터제작서/쟈알디_기본클립_재설계_2026-10-21.md 4장): 장면·물건이 박혀 폐기. 같은 이름으로 다시 뽑는 9개(tie 등)는 새 그림이 덮어씀
DROP_CLIPS |= set('''bath bathin bathout shower showerin showerout toilet toiletin toiletout handwash wash dishes coffee microwave board brief
window readwall button lever locker rope stairs water mop backpack giftbox transmit deskwork seatphone seatread seatgame seatdrink seatnoodle
toast feast sofa bedwake situp idle_box walk_box run_box idle_brick walk_brick run_brick idle_cup walk_cup run_cup idle_folder walk_folder
run_folder notebook papers phonelook phone towel handover smoke music walllean sigh smile angry'''.split())

# 장 빼기(결함 6~10): 끝 장 깨짐·대기 자세로 튐·얼굴 뭉개짐·달리기 0장
DROP = {
    'super': [-1],                             # 다시 생성분 끝 장 뭉개짐
    'glove': [-1], 'power': [-1], 'support': [-1], 'land': [0, -1], 'board': [4], 'microwave': [4],
    'nausea': [-1], 'push': [-1], 'gearcheck': [-1], 'locker': [4, 5], 'down': [1, 2], 'giftbox': [0], 'button': [5],
}
# 지울 영역(결함 5·37·46): (장, x0, y0, x1, y1) — 유령 상대·회색 찌꺼기·떨어진 조각
ERASE = {
    'handover': [(0, 100, 0, 192, 144), (1, 100, 0, 192, 144), (2, 116, 0, 192, 144), (3, 116, 0, 192, 144), (4, 116, 0, 192, 144)],
    'hug': [(0, 90, 0, 192, 144), (1, 90, 0, 192, 144)],
    'seatnoodle': [(i, 88, 0, 192, 144) for i in range(4)],   # 생성기가 손 앞에 컵을 하나 더 띄워 그림
}

OUTLINE = (24, 26, 30, 255)

# 그림에 박힌 효과·찌꺼기(전수검사 C·E, 2026-10-21): 캐릭터 본체에서 떨어진 조각은 모두 지운다. 효과는 게임이 그린다
DETACHED = {'fire', 'shotgun', 'grabblast', 'super', 'support', 'smoke', 'hug', 'deskslam', 'inspect', 'tie', 'push',
            'idle_light', 'walk_light', 'run_light'}
# 본체에 붙은 효과: 뼈대 몸 영역 밖의 밝은 회색·캐릭터 색표와 먼 색을 지움(총구 불꽃·광탄·잔상·연기·상자 조각)
OUTSIDE_FX = {'fire', 'shotgun', 'support', 'smoke', 'hug', 'deskslam', 'push'}


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


def keep_main(f, gap=2):
    """본체(가장 큰 덩어리)와 gap px 안으로 붙은 것만 남긴다."""
    from scipy import ndimage as nd
    a = np.array(f); al = a[:, :, 3] > 0
    lab, n = nd.label(nd.binary_dilation(al, iterations=gap), structure=np.ones((3, 3)))
    if n <= 1: return f
    sz = nd.sum(al, lab, range(1, n + 1))
    a[(lab != 1 + int(np.argmax(sz))) & al] = 0
    return Image.fromarray(a)


def strip_beam(f):
    """손전등 빛(전수검사 C): 채도 낮은 밝은 회색 덩어리 중 가로 20px 넘는 것 = 빛."""
    from scipy import ndimage as nd
    a = np.array(f); rgb = a[:, :, :3].astype(int)
    g = (a[:, :, 3] > 0) & (rgb.max(2) - rgb.min(2) < 30) & (rgb.max(2) > 100)
    lab, n = nd.label(g, structure=np.ones((3, 3)))
    for i, sl in enumerate(nd.find_objects(lab), 1):
        if sl[1].stop - sl[1].start > 20: a[lab == i] = 0
    return Image.fromarray(a)


def strip_flash(f):
    """총구 불꽃(노랑·주황)."""
    a = np.array(f); rgb = a[:, :, :3].astype(int)
    m = (a[:, :, 3] > 0) & (rgb[:, :, 0] > 200) & (rgb[:, :, 1] > 120) & (rgb[:, :, 2] < 140)
    a[m] = 0
    return Image.fromarray(a)


def strip_outside(f, pose):
    from jyaldi_split_props import body_mask, pal_dist
    a = np.array(f); rgb = a[:, :, :3].astype(int)
    light = (rgb.max(2) > 120) & (rgb.max(2) - rgb.min(2) < 40)
    red = ((rgb[:, :, 0] > 150) & (rgb[:, :, 1] < 120) & (rgb[:, :, 2] < 120)) | ((rgb[:, :, 0] > 170) & (rgb[:, :, 0] - rgb[:, :, 2] > 60))
    m = (a[:, :, 3] > 0) & ~body_mask(pose) & (light | red | (pal_dist(a) > 22))
    a[m] = 0
    return Image.fromarray(a)


# 뒤돌아보기: 생성기가 화면 반대쪽으로 도는 자세를 못 그려(2회 실패, rig lookback_try·try2) 기본 대기 장의 목 위만 좌우로 뒤집는다.
# 뒤집힌 머리 중 뒤통수 쪽으로 늘어진 머리카락(귀 높이 아래)은 비스듬히 잘라 내고, 원래 등 뒤 머리카락은 남겨 이어 붙인다.
LOOKBACK_ORDER = [0, 1, 2, 3, 0, 1, 2, 3]   # 기본 대기 장 번호
LOOKBACK_TURNED = {2, 3, 4, 5}              # 이 순번만 고개를 돌림
def lookback_frames(idle):
    out = []
    for n, raw in enumerate(LOOKBACK_ORDER):
        a = np.array(idle[raw % len(idle)])
        if n in LOOKBACK_TURNED:
            p = rig.CLIPS['idle'][2][min(raw, len(rig.CLIPS['idle'][2]) - 1)]
            cx, y1 = round(p['NECK'][0] + rig.DX) - 1, round(p['NECK'][1] + rig.DY) + 1
            top = a[:y1].copy(); m = np.zeros_like(top)
            for x in range(FW_):
                sx = 2 * cx - x
                if 0 <= sx < FW_: m[:, x] = top[:, sx]
            dark = (top[:, :, 3] > 0) & (top[:, :, :3].sum(2) < 150)
            for y in range(y1 - 16, y1):                 # 뒤통수 아래 머리카락: 아래로 갈수록 몸 쪽으로 깎음
                m[y, int(cx + 8 - (y - (y1 - 16)) * 0.5):] = 0
            keep = dark & (m[:, :, 3] == 0); keep[:y1 - 14] = False; keep[:, cx - 1:] = False
            m[keep] = top[keep]; a = a.copy(); a[:y1] = m
        out.append(Image.fromarray(a))
    return out
FW_ = 192


def anchors(src, idx):
    """장마다 손 좌표(전수검사 원칙 2). hand=앞손 손목, hand2=뒷손 손목, angle=앞손 팔꿈치→손목 방향(도, 0=앞, 아래가 +)."""
    if src not in rig.CLIPS: return None
    out = []
    for raw in idx:
        w, e, w2, _ = wrists(src, raw)
        ang = float(np.degrees(np.arctan2(w[1] - e[1], w[0] - e[0])))
        p = rig.CLIPS[src][2][min(raw, len(rig.CLIPS[src][2]) - 1)]
        hip = [(p['RIGHT HIP'][0] + p['LEFT HIP'][0]) / 2 + rig.DX, (p['RIGHT HIP'][1] + p['LEFT HIP'][1]) / 2 + rig.DY]
        out.append({'hand': [round(w[0]), round(w[1])], 'hand2': [round(w2[0]), round(w2[1])], 'angle': round(ang),
                    'hip': [round(hip[0]), round(hip[1])]})   # 앉기·눕기: 엔진이 의자 좌판·침대 면을 이 점에 맞춤
    return out


def apply(key, fr, pr=None, src=None, idx=None):
    """idx(원본 장 번호)를 주면 (fr, pr, idx)를 돌려준다 — 장 빼기를 거친 뒤에도 손 좌표가 맞도록."""
    ret_idx = idx is not None
    idx = list(idx) if idx is not None else list(range(len(fr)))
    src = src or key
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
    if key == 'pipe':                          # 재생성본(28e8170)엔 파이프가 다 그려져 있음 → 옛 덧그림은 겹쳐 두 자루가 돼서 뺌. 떨어진 1px 선만 지움
        fr = [keep_main(f) for f in fr]
        for i, f in enumerate(fr):             # 내려친 장 손 위로 솟은 1px 세로선
            a = np.array(f); col = a[55:92, 100:116]
            for x in range(1, col.shape[1] - 1):
                thin = (col[:, x, 3] > 0) & (col[:, x - 1, 3] == 0) & (col[:, x + 1, 3] == 0)
                if thin.sum() >= 6: col[thin, x] = 0
            fr[i] = Image.fromarray(a)
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
                # 칫솔: 주먹이 입 바로 앞이라, 솔은 입 안(주먹 뒤쪽)에 물고 손잡이가 주먹 앞으로 거의 수평으로 나옴
                f = lambda d, im, w=w: (d.point([(w[0] - 2, w[1]), (w[0] - 2, w[1] + 1)], fill=(250, 250, 250, 255)),
                                        d.line([(w[0] + 2, w[1] + 1), (w[0] + 9, w[1] + 2)], fill=(30, 60, 90, 255), width=3),
                                        d.line([(w[0] + 2, w[1] + 1), (w[0] + 9, w[1] + 2)], fill=(70, 150, 210, 255), width=1))
            fr[i] = over(fr[i], f)
    if key.endswith('_light'):
        fr = [strip_beam(f) for f in fr]
    if key == 'fire':
        fr = [strip_flash(f) for f in fr]
    if key in OUTSIDE_FX and src in rig.CLIPS:
        ps = rig.CLIPS[src][2]
        fr = [strip_outside(f, ps[min(r, len(ps) - 1)]) for f, r in zip(fr, idx)]
    if key == 'push':                          # 손 앞 상자 조각(갈색, 얼굴 아래만)
        def nobox(f):
            a = np.array(f); rgb = a[:, :, :3].astype(int)
            m = (rgb[:, :, 0] > 110) & (rgb[:, :, 0] - rgb[:, :, 2] > 50) & (rgb[:, :, 1] < 150); m[:70] = False
            a[m & (a[:, :, 3] > 0)] = 0; return Image.fromarray(a)
        fr = [nobox(f) for f in fr]
    if key in DETACHED:
        fr = [keep_main(f) for f in fr]
    if key in DROP:
        n = len(fr)
        drop = {i % n for i in DROP[key]}
        fr = [f for i, f in enumerate(fr) if i not in drop]
        if pr: pr = [f for i, f in enumerate(pr) if i not in drop]
        idx = [r for i, r in enumerate(idx) if i not in drop]
    return (fr, pr, idx) if ret_idx else (fr, pr)
