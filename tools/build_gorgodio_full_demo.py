#!/usr/bin/env python3
"""고르고디오 전 동작 시연판 빌더 (2026-10-22, docs/캐릭터제작서/동작설계_gorgodio.md 5장 전부).

game-src/action/gorgodio/{full,armor}/clips/<클립>/NN.png (animate_with_skeleton_v3 원본)를 클립별 가로 스트립으로 묶어
단일 HTML(release/demo/gorgodio-full.html)에 내장한다. 게임용 최종 스트립·manifest.json·hands.json은 full/final/에 쓴다.
맨몸 224×176(발바닥 y168, 기준 x86), 장갑 256×192(발바닥 y184, 기준 x100). 이름표·묶음은 설계서 5장 표에서 읽는다.
손 고정점은 rig.py/rig_armor.py 뼈대의 손목(앞손 RIGHT ARM, 뒷손 LEFT ARM)을 그대로 쓴다(뼈대 좌표 = 캔버스 px).
말하기는 기본 대기 0번 장 + 입을 그린 장(코드).
"""
import base64, io, json, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GD = os.path.join(ROOT, 'game-src', 'action', 'gorgodio')
sys.path.insert(0, os.path.join(GD, 'scripts'))
import rig, rig_armor            # noqa: E402
import gorgodio_fixes as FIX     # noqa: E402

BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'gorgodio-full.html')
DOC = os.path.join(ROOT, 'docs', '캐릭터제작서', '동작설계_gorgodio.md')
SETS = {'bare': dict(w=224, h=176, foot=168, anchor=86), 'armor': dict(w=256, h=192, foot=184, anchor=100)}

# fps, 반복, 타격(또는 발사·회수) 장
TIMING = {
    'idle': (5, True), 'beard': (7, False), 'guard': (6, True), 'engage': (12, False), 'step': (12, True), 'walk': (10, True), 'run': (14, True),
    'jump': (12, False), 'crouch': (14, False), 'crouchwalk': (9, True), 'stomp': (12, False, [3]), 'chop1': (16, False, [2]), 'chop2': (16, False, [2]),
    'cleave': (13, False, [4]), 'tsuppari': (16, False, [1, 4, 6]), 'bigboot': (14, False, [2]), 'splash': (12, False, [3]), 'kready': (14, False),
    'kthrow': (16, False, [2]), 'kpull': (10, False, [4]), 'summon': (10, False, [3]), 'summonhold': (8, True), 'block': (16, False),
    'shove': (14, False, [2]), 'brace': (14, False), 'bearhug': (14, False), 'headbutt': (14, False, [2]), 'press': (12, False, [5]),
    'suplex': (12, False, [5]), 'pickup': (10, False), 'toss': (12, False, [3]), 'drink': (7, False, [4]), 'eat': (7, False, [4]),
    'bandage': (7, False, [5]), 'hit': (14, False), 'down': (12, False), 'getup': (9, False), 'talk': (6, True), 'pipe': (12, False, [3]),
    'shotgun': (12, False, [1]), 'tired': (4, True), 'turn': (12, False), 'fall': (8, True), 'land': (12, False), 'ladder': (8, True),
    'crawl': (8, True), 'sneak': (8, True), 'limp': (8, True), 'victory': (8, False), 'liftput': (9, False),
    'a_arrive': (10, False), 'a_idle': (5, True), 'a_walk': (9, True), 'a_glide': (12, True), 'a_jump': (12, False), 'a_land': (12, False),
    'a_crouch': (14, False), 'a_swat': (15, False, [2]), 'a_hammer': (15, False, [3]), 'a_axe': (13, False, [5]), 'a_stomp': (12, False, [3]),
    'a_lariat': (14, False, [2]), 'a_dive': (14, False, [4]), 'a_rubble': (10, False, [6]), 'a_charge': (14, False, [3, 5]),
    'a_vent': (8, False), 'a_guard': (16, False), 'a_guardwalk': (9, True), 'a_boost': (16, False), 'a_grab': (14, False),
    'a_grabhit': (14, False, [2]), 'a_throw': (12, False, [5]), 'a_smash': (12, False, [3]), 'a_pillar': (9, False), 'a_carry2': (12, True),
    'a_super': (12, False), 'a_break': (8, False), 'a_support': (12, False, [6]),
}
LOOP_WORDS = ('idle', 'walk', 'run', 'wait', 'rest', 'doze', 'typing', 'ride', 'bedlie', 'seat', 'hurt', 'fear', 'armscross', 'bored', 'sad',
              'cry', 'itch', 'think', 'brushteeth', 'handswork', 'handshead', 'holdlook', 'handear', 'sweep', 'liehold', 'shower', 'bath')


def doc_labels():
    """설계서 5장 표: {클립: (묶음, 이름표)}"""
    out, grp = {}, ''
    sec = open(DOC, encoding='utf-8').read().split('## 5. ')[1].split('## 6.')[0]
    for line in sec.splitlines():
        m = re.match(r'### 5\.\d+ (.+)', line)
        if m: grp = m.group(1).strip(); continue
        if not line.startswith('| ') or '---' in line: continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        names = re.findall(r'`([a-z0-9_]+)`', cells[1] if len(cells) > 4 else cells[0])
        if not names: continue
        scene = cells[0] if len(cells) > 4 else ''
        desc = cells[3] if len(cells) > 4 else cells[2]
        desc = re.split(r'[(:]', desc)[0].strip()
        for n in names:
            lab = (scene + ' · ' if scene and not scene.startswith('`') else '') + desc
            out.pop(n, None); out[n] = (grp, lab[:46])
    return out


def frames_of(setname, clip):
    d = os.path.join(GD, 'full' if setname == 'bare' else 'armor', 'clips', clip)
    if not os.path.isdir(d): return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def talk_frames():
    """기본 대기 0번 장 + 입을 연 장. 입 자리(95~96, 73~74)는 idle/00.png 얼굴을 픽셀로 읽어 정함(콧수염 바로 아래, 염소수염 위)."""
    base = frames_of('bare', 'idle')
    if not base: return []
    a = base[0]; b = a.copy(); px = b.load()
    for x, y, c in ((95, 73, (70, 22, 26, 255)), (96, 73, (70, 22, 26, 255)), (95, 74, (120, 44, 46, 255)), (96, 74, (92, 30, 34, 255))):
        if px[x, y][3]: px[x, y] = c
    return [a, b]


def strip(frames, w, h):
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * w, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def anchors(R, clip, idx):
    if clip not in R.B.CLIPS: return None
    ps = R.B.CLIPS[clip][2]; out = []
    for raw in idx:
        p = ps[min(raw, len(ps) - 1)]
        w, e, w2 = p['RIGHT ARM'], p['RIGHT ELBOW'], p['LEFT ARM']
        ang = float(np.degrees(np.arctan2(w[1] - e[1], w[0] - e[0])))
        hip = ((p['RIGHT HIP'][0] + p['LEFT HIP'][0]) / 2, (p['RIGHT HIP'][1] + p['LEFT HIP'][1]) / 2)
        out.append({'hand': [round(w[0]), round(w[1])], 'hand2': [round(w2[0]), round(w2[1])], 'angle': round(ang), 'hip': [round(hip[0]), round(hip[1])]})
    return out


def main():
    labels = doc_labels()
    order = [('bare', n) for n in rig.B.CLIPS] + [('bare', 'talk')] + [('bare', n) for n in ('undress', 'showerturn', 'shower', 'bath')] + [('armor', n) for n in rig_armor.B.CLIPS]
    # 설계서 표 순서대로 정렬(묶음이 흩어지지 않게)
    pos = {n: i for i, n in enumerate(labels)}
    order.sort(key=lambda t: pos.get(t[1], 9999))
    manifest = {'sets': SETS, 'clips': {}, 'missing': []}
    strips = {}
    final = os.path.join(GD, 'full', 'final'); os.makedirs(final, exist_ok=True)
    for setname, clip in order:
        if clip in FIX.DROP_CLIPS: continue
        R = rig if setname == 'bare' else rig_armor
        fr = talk_frames() if clip == 'talk' else frames_of(setname, clip)
        idx = list(range(len(fr)))
        if fr: fr, idx = FIX.apply(clip, fr, idx)
        grp, lab = labels.get(clip, ('기타', clip))
        if not fr:
            manifest['missing'].append(clip); continue
        D = SETS[setname]
        data = strip(fr, D['w'], D['h'])
        strips[clip] = base64.b64encode(data).decode()
        open(os.path.join(final, clip + '.png'), 'wb').write(data)
        t = TIMING.get(clip) or (6, any(w in clip for w in LOOP_WORDS))
        c = {'label': lab, 'group': grp, 'set': setname, 'fps': t[0], 'loop': t[1], 'hits': list(t[2]) if len(t) > 2 else [], 'frames': len(fr)}
        anc = anchors(R, 'idle' if clip == 'talk' else clip, [0, 0] if clip == 'talk' else idx)
        if anc: c['anchors'] = anc
        manifest['clips'][clip] = c
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    hands = {k: [[a['hand'][0], a['hand'][1], (a['angle'] + 90) % 360] for a in v['anchors']] for k, v in manifest['clips'].items() if v.get('anchors')}
    json.dump(hands, open(os.path.join(final, 'hands.json'), 'w'), separators=(',', ':'))
    nb = sum(1 for c in manifest['clips'].values() if c['set'] == 'bare'); na = len(manifest['clips']) - nb
    tpl = open(os.path.join(ROOT, 'tools', 'gorgodio_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()).replace('__NBARE__', str(nb)).replace('__NARMOR__', str(na)))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'bare', nb, 'armor', na, 'missing', manifest['missing'])


if __name__ == '__main__':
    main()
