#!/usr/bin/env python3
"""스팡달 전 동작 시연판 빌더 (2026-10-22, 동작설계서 docs/캐릭터제작서/동작설계_spangdal.md 5장 145장면).

game-src/action/spangdal/full/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144)를 클립별 가로 스트립으로 묶어
단일 HTML(release/demo/spangdal-full.html)에 내장한다. 게임용 스트립·manifest.json·hands.json은 full/final/에 쓴다.
- 이름·묶음은 설계서 5장 표에서 읽는다(표가 바뀌면 시연판도 따라감).
- 뼈대(scripts/rig.py)의 끝 장은 생성기 버릇용 버릴 장이라 뺀다.
- 손 좌표(hands.json)는 뼈대의 손목·팔꿈치에서 뽑는다. 가시는 그림에 없고 엔진이 이 좌표에서 그린다(설계서 4.3).
- 쟈알디와 같은 캔버스·발바닥 y=136. 몸 기준 x는 68(엉덩이).
"""
import base64, io, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'game-src', 'action', 'spangdal')
SRC = os.path.join(BASE, 'full')
DOC = os.path.join(ROOT, 'docs', '캐릭터제작서', '동작설계_spangdal.md')
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'spangdal-full.html')
sys.path.insert(0, os.path.join(BASE, 'scripts'))
_cwd = os.getcwd(); os.chdir(os.path.join(BASE, 'scripts'))
import rig   # noqa: E402  (rig는 쟈알디 skel을 상대 경로로 읽음)
os.chdir(_cwd)
FW, FH, FOOT, ANCHOR = 192, 144, 136, 68

# 전투 클립 재생 값: fps, 반복, 타격 장(None = 손이 가장 멀리 나간 장 자동), 그림 안 전진 px, 멈춤
COMBAT = {
    'idle': (5, True), 'groom': (8, False), 'stance': (6, True), 'engage': (12, False), 'walk': (10, True),
    'glide': (14, False, [], 22), 'run': (14, True), 'jump': (12, False), 'crouch': (14, False), 'crouchwalk': (10, True),
    'groundspike': (14, False, [2], 0, 0.06), 'risestab': (14, False, [3], 0, 0.06),
    'stab1': (20, False, [2], 2, 0.03), 'slash2': (16, False, [3], 4, 0.05), 'pierce3': (14, False, [3], 8, 0.1),
    'execute': (12, False, [3], 0, 0.22), 'passslash': (16, False, [3], 36, 0.04), 'airrain': (14, False, [2]),
    'spineup': (14, False), 'throw': (18, False, [1]), 'fan': (14, False, [4]), 'pluck': (10, False),
    'sink': (14, False), 'rise': (14, False), 'latticecharge': (8, True), 'latticerelease': (14, False, [2], 0, 0.08),
    'spikeguard': (16, False), 'parry': (18, False), 'shadowstep': (16, False), 'reargrab': (16, False),
    'grabstab': (14, False, [2], 0, 0.05), 'pin': (12, False, [3], 0, 0.12), 'super': (10, False),
    'pickup': (10, False), 'toss': (12, False, [2]), 'drink': (6, False), 'eat': (6, False), 'stitch': (7, False),
    'hit': (14, False), 'down': (12, False), 'getup': (9, False), 'beckon': (8, True), 'toothpull': (10, False, [4], 0, 0.1),
    'pipe': (14, False, [2], 0, 0.05), 'shotgun': (12, False, [1]), 'idle_pipe': (5, True), 'walk_pipe': (10, True),
    'idle_shotgun': (5, True), 'walk_shotgun': (10, True), 'run_shotgun': (14, True), 'tired': (4, True), 'support': (12, False, [2, 4]),
}
LOOP_WORDS = ('idle', 'walk', 'run', 'carry', 'handswork', 'handshead', 'seat', 'holdlook', 'handear', 'sweep', 'liehold', 'typing',
              'doze', 'floorrest', 'elevwait', 'hurtidle', 'limp', 'bedlie', 'crawl', 'sneak', 'ladder', 'fear', 'cry', 'wallcry',
              'kneelcry', 'sad', 'bored', 'fidget', 'laugh', 'embarrassed', 'brushteeth', 'think', 'armscross')
NUDE = ('undress', 'showerturn', 'shower', 'bath')


def doc_rows():
    """설계서 5장 표 → [(클립, 묶음, 이름)]. 이름 = 설명 앞부분."""
    s = open(DOC, encoding='utf-8').read()
    sec, out = None, []
    for ln in s.splitlines():
        m = re.match(r'### 5\.\d+ (.+)', ln)
        if m: sec = re.sub(r'\s*\(.*\)$', '', m.group(1)); continue
        if ln.startswith('## 6'): break
        if not sec or not ln.startswith('|') or ln.startswith('| ---') or sec == '합계': continue
        c = [x.strip() for x in ln.strip('|').split('|')]
        if sec.startswith('스팡달 전용'):
            name, desc = c[0], c[2]
        elif sec.startswith('전투'):
            name, desc = c[2], c[4]
        else:
            name, desc = c[1], c[3]
        if not re.fullmatch(r'[a-z0-9_]+', name): continue
        desc = re.sub(r'\*\*|`', '', desc)
        short = re.split(r'[:.,(]', desc)[0].strip()
        out.append((name, sec, short[:22]))
    return out


def frames_of(k):
    d = os.path.join(SRC, 'clips', k)
    if not os.path.isdir(d): return []
    fs = [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]
    if k in rig.CLIPS and k not in NUDE and len(fs) == len(rig.CLIPS[k][2]) and len(fs) > 3:
        fs = fs[:-1]   # 뼈대 끝 장 = 버릴 장(rig.tail)
    return fs


AIR = {'jump', 'airrain', 'fall'}   # 공중 장은 발이 떠 있는 게 맞음
FIX_ERASE = {   # 클립: {장: [(x0, y0, x1, y1), ...]}  생성기가 그린 소품·효과를 지울 사각형(검수 결과)
    'execute': {4: [(102, 48, 112, 56)], 5: [(102, 48, 112, 56)]},   # 손끝 은색 바늘(가시는 코드가 그림)
    'shotgun': {0: [(152, 50, 192, 76)]},                            # 총구 불꽃(효과는 코드)
    'engage': {0: [(80, 80, 95, 90)], 1: [(84, 81, 101, 91)]},       # 손 앞 번진 잔상
    'door': {i: [(96, 0, 192, 144)] for i in range(7)},              # 생성기가 그린 문짝·손잡이(문은 배경 소품)
}
FIX_REPLACE = {'getup': {0: ('down', -1)},   # 머리 위 회색 먼지 → 다운 마지막 누운 장
               'land': {0: ('fall', -1)},    # 검게 뭉개진 첫 장 → 낙하 마지막 장
               'door': {6: ('door', 5)}}     # 문짝이 몸을 덮은 장 → 손잡이 잡은 장


def detach(im):
    """가장 큰 덩어리(8방향 연결)에서 2px 넘게 떨어진 조각을 지움: 날아간 물건·효과선."""
    import numpy as np
    from collections import deque
    a = np.array(im); al = a[:, :, 3] > 0
    lab = np.zeros(al.shape, int); sizes = [0]; n = 0
    for y0, x0 in zip(*np.where(al)):
        if lab[y0, x0]: continue
        n += 1; sizes.append(0); q = deque([(y0, x0)]); lab[y0, x0] = n
        while q:
            y, x = q.popleft(); sizes[n] += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < FH and 0 <= xx < FW and al[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
    if n <= 1: return im
    main = int(np.argmax(sizes))
    m = lab == main
    near = m.copy()
    for _ in range(2):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
    for i in range(1, n + 1):
        if i != main and not (near & (lab == i)).any(): a[lab == i] = 0
    return Image.fromarray(a)


def clean(k, fr):
    for i, (src, j) in FIX_REPLACE.get(k, {}).items():
        alt = frames_of(src)
        if alt and i < len(fr): fr = fr[:i] + [alt[j]] + fr[i + 1:]
    out = []
    for i, f in enumerate(fr):
        for r in FIX_ERASE.get(k, {}).get(i, []):
            f.paste((0, 0, 0, 0), r)
        f = detach(f)
        if k not in AIR:   # 발이 바닥선(불투명 맨 아래 y=135) 아래로 내려간 장은 위로 당김
            bb = f.split()[-1].getbbox()
            if bb and bb[3] - 1 > 135:
                g = Image.new('RGBA', f.size, (0, 0, 0, 0)); g.paste(f, (0, 135 - (bb[3] - 1))); f = g
        out.append(f)
    return out


def hands_of(k, n):
    """뼈대 손목·팔꿈치 → [[앞손 x, y, 각도], [뒷손 x, y, 각도]] (각도: 팔꿈치→손목, 오른쪽 0°, 시계 방향 +)."""
    import math
    if k not in rig.CLIPS: return None
    out = []
    for p in rig.CLIPS[k][2][:n]:
        fr = []
        for side in ('RIGHT', 'LEFT'):
            ex, ey = p[f'{side} ELBOW']; wx, wy = p[f'{side} ARM']
            fr.append([round(wx + rig.DX, 1), round(wy + rig.DY, 1), round(math.degrees(math.atan2(wy - ey, wx - ex)))])
        out.append(fr)
    return out


def auto_hits(k, hands):
    """앞손이 몸 기준에서 가장 멀리 나간 장(같으면 앞쪽)."""
    if not hands: return []
    best = max(range(len(hands)), key=lambda i: (hands[i][0][0] - abs(hands[i][0][1] - 70) * 0.2, -i))
    return [best]


def strip(frames):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * FW, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def main():
    rows = doc_rows()
    seen = set(); defs = []
    for name, grp, label in rows:
        if name in seen: continue
        seen.add(name); defs.append((name, grp, label))
    manifest = {'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing = {}, []
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    hands_all = {}
    for k, grp, label in defs:
        fr = frames_of(k)
        if k == 'talk': continue   # 말하기 = 대기 장 + 말풍선(코드)
        if fr and k not in NUDE: fr = clean(k, fr)
        if not fr:
            missing.append(k); continue
        cv = COMBAT.get(k)
        if cv:
            fps, loop = cv[0], cv[1]
            hits = cv[2] if len(cv) > 2 else []
            adv = cv[3] if len(cv) > 3 else 0
            hold = cv[4] if len(cv) > 4 else 0
        else:
            fps, loop, hits, adv, hold = 8, any(w in k for w in LOOP_WORDS), [], 0, 0
        hd = hands_of(k, len(fr))
        if hits is None: hits = auto_hits(k, hd)
        data = strip(fr)
        strips[k] = base64.b64encode(data).decode()
        open(os.path.join(final, k + '.png'), 'wb').write(data)
        manifest['clips'][k] = {'label': label, 'group': grp, 'fps': fps, 'loop': loop, 'hits': hits, 'adv': adv, 'hold': hold,
                                'origin': 0, 'frames': len(fr), 'bytes': len(data)}
        if hd: manifest['clips'][k]['hands'] = hd; hands_all[k] = hd
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(hands_all, open(os.path.join(final, 'hands.json'), 'w'), separators=(',', ':'))
    manifest['missing'] = missing
    tpl = open(os.path.join(ROOT, 'tools', 'spangdal_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', missing)


if __name__ == '__main__':
    main()
