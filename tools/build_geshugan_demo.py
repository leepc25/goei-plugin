#!/usr/bin/env python3
"""게슈간 전 동작 시연판 빌더 (2026-10-22).

game-src/action/geshugan/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144, 발바닥 y=136, 기준 x=57 — 쟈알디와 같은 캔버스)를
클립별 가로 스트립으로 묶어 단일 HTML(release/demo/geshugan-full.html)에 내장한다.
클립 목록·이름은 game-src/action/geshugan/plan.py, 뼈대는 scripts/grig.py(손 고정점 = 가까운 손목 관절).
생성기 버릇 때문에 덧붙인 버릴 끝 장(grig.tail)은 plan.py 장 수를 넘는 만큼 뒤에서 뺀다.
검수에서 정한 장 빼기·순서는 game-src/action/geshugan/fixes.json({클립: {"drop": [장], "order": [장]}}).
게임용 최종 스트립·manifest.json·hands.json은 game-src/action/geshugan/final/에도 쓴다.
"""
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'geshugan')
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'geshugan-full.html')
sys.path.insert(0, SRC); sys.path.insert(0, os.path.join(SRC, 'scripts'))
import plan  # noqa: E402
import grig  # noqa: E402

FW, FH, FOOT, ANCHOR = 192, 144, 136, 57
DX, DY = grig.J.DX, grig.J.DY

# 게임에서 쓰는 속도·타격 장(최종 스트립 기준 번호). 없으면 묶음 기본값.
FPS = {'idle': 5, 'stance': 6, 'walk': 10, 'step': 12, 'run': 14, 'jump': 12, 'crouch': 14, 'crouchwalk': 12, 'lowmark': 14,
       'tackle': 15, 'airstomp': 14, 'airmark': 12, 'designate': 8, 'clench': 14, 'hold': 14, 'holdloop': 8, 'fling': 15, 'parry': 20,
       'parryfail': 14, 'tkleap': 18, 'grab': 14, 'grabreap': 14, 'grabcrush': 12, 'super': 12, 'chain2': 12, 'support': 10,
       'focus': 5, 'tkswing': 14, 'gunclench': 14, 'pickup': 10, 'toss': 14, 'hit': 14, 'down': 12, 'getup': 10, 'talk': 6,
       'engage': 12, 'turn': 12, 'fall': 10, 'land': 14, 'ladder': 10, 'vault': 14, 'crawl': 10, 'sneak': 8, 'carry2_run': 14,
       'carry1_run': 14, 'carry2_walk': 10, 'carry1_walk': 10, 'limp': 8, 'collapse': 10, 'startlefall': 14, 'surprise': 14}
HITS = {'lowmark': [4], 'tackle': [4], 'airstomp': [4], 'airmark': [3], 'clench': [1], 'hold': [4], 'fling': [2], 'parry': [2],
        'grabreap': [4], 'grabcrush': [4], 'super': [7], 'chain2': [2, 4], 'support': [3], 'tkswing': [3], 'gunclench': [1],
        'toss': [2], 'pickup': [4]}
# A 연계 15장은 게임에서 세 단으로 끊어 씀(스냅다운 0~4 → 지정 5~8 → 내려찍기 9~14)
SPLIT = [('snap', 'chain3', (0, 5), '1타 스냅다운', 16, [3]), ('mark', 'chain3', (5, 9), '2타 지정(한 박자 뒤 띄움)', 12, [2]),
         ('slam', 'chain3', (9, 15), '3타 내려찍기', 14, [3])]


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d):
        return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


ONESHOT = {'step', 'jump', 'crouch', 'chain3', 'tackle', 'airstomp', 'grabreap', 'grabcrush', 'super', 'chain2', 'support', 'down', 'getup',
           'stepup', 'stepover', 'turn', 'collapse', 'victory', 'stretch', 'nod', 'headshake'}


def is_loop(key):
    """grig.LOOP: True/False = 명시, None = 인자 없음(대부분 순환 동작, 한 번 하는 것은 ONESHOT)."""
    v = grig.LOOP.get(key)
    return v if v is not None else key not in ONESHOT


def lookback_frames():
    """뒤돌아보기(생성 0): 기본 대기 장의 목 위만 좌우 반전, 뒤통수 쪽은 둥근 머리 윤곽 밖을 깎음(쟈알디 jyaldi_fixes.lookback_frames와 같은 기술)."""
    import numpy as np
    idle = frames_of('idle')
    if not idle:
        return []
    out = []
    for n, raw in enumerate([0, 1, 2, 3, 0, 1, 2, 3]):
        a = np.array(idle[raw % len(idle)])
        if n in (2, 3, 4, 5):
            p = grig.CLIPS['idle'][2][raw % len(grig.CLIPS['idle'][2])]
            cx, y1 = round(p['NECK'][0] + DX) - 1, round(p['NECK'][1] + DY) + 1
            top = a[:y1].copy(); m = np.zeros_like(top)
            for x in range(FW):
                sx = 2 * cx - x
                if 0 <= sx < FW: m[:, x] = top[:, sx]
            dark = (top[:, :, 3] > 0) & (top[:, :, :3].sum(2) < 150)
            hy = round(p['RIGHT EAR'][1] + DY) - 1
            yy, xx = np.mgrid[0:y1, 0:FW]
            m[(xx > cx + 1) & ((xx - cx - 1) ** 2 + ((yy - hy) * 0.9) ** 2 > 11.5 ** 2)] = 0
            keep = dark & (m[:, :, 3] == 0); keep[:y1 - 14] = False; keep[:, cx - 1:] = False
            m[keep] = top[keep]; a = a.copy(); a[:y1] = m
        out.append(Image.fromarray(a))
    return out


def despeckle(im):
    """몸에서 떨어진 작은 점 덩어리(80px 미만, 몸과 4px 넘게 떨어짐)를 지움 — 생성기가 흘린 회색 점(검수: stepover 1장, fall 2장)."""
    import numpy as np
    from scipy import ndimage
    a = np.array(im); m = a[:, :, 3] > 0
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    if n < 2:
        return im
    sizes = ndimage.sum(m, lab, range(1, n + 1)); main = lab == (int(np.argmax(sizes)) + 1)
    near = ndimage.binary_dilation(main, iterations=4)
    for k in range(1, n + 1):
        part = lab == k
        if sizes[k - 1] < 80 and not (part & near).any():
            a[part] = 0
    return Image.fromarray(a)


def shift_to(im, bottom):
    import numpy as np
    a = np.array(im); rows = np.nonzero(a[:, :, 3].any(1))[0]
    dy = bottom - int(rows.max()); out = np.zeros_like(a)
    if dy >= 0: out[dy:] = a[:FH - dy]
    else: out[:FH + dy] = a[-dy:]
    return Image.fromarray(out)


def outline(im):
    """GPT 그림 외곽선 맞춤: 바깥 테두리 중 피부·수건 색 픽셀(점선처럼 끊겨 보임)을 기준 그림 G0처럼 #000000으로. 머리·셔츠 회색 테두리는 G0도 회색이라 둠."""
    import numpy as np
    from scipy import ndimage
    a = np.array(im); m = a[:, :, 3] > 0
    edge = m & ~ndimage.binary_erosion(m)
    rgb = a[:, :, :3].astype(int)
    grey = (rgb.max(2) - rgb.min(2)) < 20
    sel = edge & ~grey
    a[sel, :3] = 0
    return Image.fromarray(a)


def strip(frames):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * FW, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def hand(src, i):
    ps = grig.CLIPS.get(src, (None, None, []))[2]
    if i >= len(ps):
        return None
    x, y = ps[i]['RIGHT ARM']
    return [round(x + DX), round(y + DY)]


def main():
    fixes = {}
    fp = os.path.join(SRC, 'fixes.json')
    if os.path.exists(fp):
        fixes = json.load(open(fp, encoding='utf-8'))
    defs = []
    for key, grp, name, n, *_ in plan.P:
        if n == 0 and key != 'lookback':
            continue
        loop = is_loop(key)
        defs.append(dict(key=key, src=key, rng=None, label=name, group=grp, plan=n, fps=FPS.get(key, 12 if grp == '전투' else 7),
                         loop=bool(loop), hits=HITS.get(key, [])))
    for key, src, rng, name, fps, hits in SPLIT:
        defs.append(dict(key=key, src=src, rng=rng, label=name, group='게임용 나눔(A 연계)', plan=rng[1] - rng[0], fps=fps, loop=False, hits=hits))
    for key, name, n in plan.GPT:
        defs.append(dict(key=key, src=key, rng=None, label=name + ' (GPT)', group='GPT 담당(샤워·목욕)', plan=n, fps=6, loop=key in ('shower', 'bath'), hits=[]))
    manifest = {'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing, later = {}, [], []   # later = 사용자 지시(2026-10-22 03:17)로 미룬 생활·사교·감정·지형 동작
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    for d in defs:
        fr = lookback_frames() if d['key'] == 'lookback' else frames_of(d['src'])
        idx = list(range(len(fr)))
        if d['src'] in grig.CLIPS and d['plan'] and len(fr) > d['plan'] and not d['rng']:
            idx = idx[:d['plan']]                      # 버릴 끝 장
        if d['rng']:
            idx = idx[d['rng'][0]:d['rng'][1]]
        fx = fixes.get(d['key'], {})
        for raw, bottom in fx.get('align', {}).items():   # 장 바닥(가장 아래 불투명 줄)을 정한 y로 옮김: {원본 장: y}
            fr[int(raw)] = shift_to(fr[int(raw)], bottom)
        if fx.get('compose'):                      # 다른 클립 장을 빌려 엮음: [[클립, 장], ...]
            fr = [frames_of(c)[i] for c, i in fx['compose']]
            idx = list(range(len(fr)))
        if fx.get('order'):
            idx = [idx[i] for i in fx['order'] if i < len(idx)]
        if fx.get('drop'):
            idx = [v for i, v in enumerate(idx) if i not in set(fx['drop'])]
        if not idx:
            (later if d['group'] not in ('전투', '게임용 나눔(A 연계)', 'GPT 담당(샤워·목욕)') else missing).append(d['key']); continue
        frames = [despeckle(fr[i]) for i in idx]
        if fx.get('outline'):
            frames = [outline(f) for f in frames]
        data = strip(frames)
        strips[d['key']] = base64.b64encode(data).decode()
        open(os.path.join(final, d['key'] + '.png'), 'wb').write(data)
        c = {k: d[k] for k in ('label', 'fps', 'loop', 'hits', 'group')} | {'frames': len(frames), 'src': d['src'], 'idx': idx}
        if fx.get('compose'):
            hs = [hand(c, i) for c, i in fx['compose']]
        else:
            hs = [hand('idle' if d['key'] == 'lookback' else d['src'], i % 4 if d['key'] == 'lookback' else i) for i in idx]
        if all(hs):
            c['hand'] = hs
        manifest['clips'][d['key']] = c
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump({k: v['hand'] for k, v in manifest['clips'].items() if v.get('hand')}, open(os.path.join(final, 'hands.json'), 'w'), separators=(',', ':'))
    manifest['missing'] = missing; manifest['later'] = later
    tpl = open(os.path.join(ROOT, 'tools', 'geshugan_demo_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', missing, 'later', len(later))


if __name__ == '__main__':
    main()
