#!/usr/bin/env python3
"""데드폴 전 동작 시연판 빌더 (2026-10-22, docs/캐릭터제작서/동작설계_deadpole.md).

game-src/action/deadpole/full/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144)를 클립별 가로 스트립으로 묶어
단일 HTML(release/demo/deadpole-full.html)에 내장한다. 게임용 최종 스트립·manifest.json·hands.json은 full/final/에.
뼈대(scripts/rig.py)의 마지막 장이 버림 장(tail: 앞 장 반복)이면 뺀다. 근접 사격 cq(15장)는 cq1·cq2·cq3로 자른다.
장마다의 코드 보정(총구 불꽃 지우기 등)은 tools/deadpole_fixes.py.
"""
import base64, io, json, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'deadpole', 'full')
sys.path.insert(0, os.path.join(ROOT, 'game-src', 'action', 'deadpole', 'scripts'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig
import deadpole_fixes
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'deadpole-full.html')
DOC = os.path.join(ROOT, 'docs', '캐릭터제작서', '동작설계_deadpole.md')
FW, FH, FOOT, ANCHOR = 192, 144, 136, 57


def doc_labels():
    """기획서 5장 표에서 클립 이름 → 한글 이름"""
    t = open(DOC, encoding='utf-8').read()
    sec = t[t.index('## 5. 클립 목록'):t.index('## 6.')]
    out = {}
    for ln in sec.splitlines():
        if not ln.startswith('|'):
            continue
        cells = [c.strip() for c in ln.strip('|').split('|')]
        for i, c in enumerate(cells[:2]):
            ks = re.findall(r'`([a-z0-9_]+)`', c)
            if not ks:
                continue
            name = re.sub(r'`[^`]*`|\(.*?\)|\*', '', c).strip()
            if i == 1:   # 전투 표: 첫 칸이 쟈알디 자리
                name = re.sub(r'`[^`]*`|\(.*?\)|\*', '', c).strip() or re.sub(r'^[a-z/_ ]+', '', cells[0]).strip()
            for k in ks:
                out.setdefault(k, name or k)
    return out


LOOP = {'idle', 'ready', 'walk', 'step', 'run', 'kneelwalk', 'sniff', 'cover', 'tired', 'idle_pipe', 'walk_pipe', 'idle_shotgun', 'walk_shotgun',
        'run_shotgun', 'handswork', 'handshead', 'seatmouth', 'seathold', 'holdlook', 'handear', 'sweep', 'liehold', 'carry2_idle', 'carry2_walk',
        'carry2_run', 'carry1_idle', 'carry1_walk', 'carry1_run', 'ladder', 'crawl', 'sneak', 'idle_light', 'walk_light', 'run_light', 'hurtidle',
        'fear', 'bedlie', 'elevwait', 'floorrest', 'sniffwalk', 'typing', 'seatrest', 'seatthink', 'brushteeth', 'armscross', 'bored', 'talk',
        'shower', 'bath', 'wallcry', 'kneelcry', 'sad', 'think', 'laugh', 'cry', 'glad', 'nod', 'wave'}
FPS = {'idle': 5, 'ready': 6, 'walk': 10, 'step': 12, 'run': 14, 'jump': 12, 'kneel': 16, 'kneelwalk': 12, 'kneelshot': 16, 'cq1': 18, 'cq2': 18,
       'cq3': 16, 'slide': 14, 'airshot': 16, 'fire': 20, 'draw': 18, 'holster': 10, 'reload': 9, 'rewind': 10, 'sniff': 5, 'cover': 5,
       'catch': 18, 'counter': 14, 'roll': 16, 'collar': 14, 'contact': 14, 'tomoe': 12, 'super': 8, 'superrise': 10, 'die': 8, 'revive': 7, 'hit': 14,
       'down': 12, 'getup': 10, 'tired': 4, 'sniffground': 6, 'purge': 8, 'rewindother': 8, 'pipe': 12, 'shotgun': 10, 'support': 10,
       'talk': 6, 'undress': 3, 'showerturn': 4, 'shower': 4, 'bath': 2}
# 타격 장(잘라 낸 뒤 장 번호), 그림 안 전진, 시작 오프셋, 멈춤
META = {
    'cq1': dict(hits=[2], hold=0.03), 'cq2': dict(hits=[2, 3], hold=0.03, adv=9), 'cq3': dict(hits=[2, 3, 4, 5], hold=0.04, origin=9, adv=-4),
    'kneelshot': dict(hits=[2]), 'slide': dict(hits=[3, 4], adv=10), 'airshot': dict(hits=[2, 4]), 'fire': dict(hits=[1]),
    'draw': dict(hits=[2]), 'contact': dict(hits=[2], hold=0.06), 'counter': dict(hits=[2], hold=0.08), 'tomoe': dict(hits=[4], hold=0.1, origin=28),
    'pipe': dict(hits=[3], hold=0.05), 'down': dict(origin=24), 'superrise': dict(origin=24), 'shotgun': dict(hits=[1, 4]), 'toss': dict(hits=[3]), 'roll': dict(adv=44), 'super': dict(adv=7),
}
CQ = {'cq1': (0, 4), 'cq2': (4, 8), 'cq3': (8, 15)}
GPT = [('undress', '탈의 (GPT)'), ('showerturn', '샤워 돌아서기 (GPT)'), ('shower', '샤워 (GPT)'), ('bath', '목욕 (GPT)')]


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d):
        return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def is_tail(name):
    ps = rig.CLIPS[name][2]
    return len(ps) > 3 and (rig.kp(ps[-1]) == rig.kp(ps[-2]) or (name in LOOP and rig.kp(ps[-1]) == rig.kp(ps[0])))


def talk_frames():
    """기본 대기 0번 장 + 입을 연 장(얼굴 피부 중 가장 앞 아래쪽 2px)."""
    base = frames_of('idle')
    if not base:
        return []
    a = base[0]; px = a.load()
    skin = [(x, y) for y in range(40, 70) for x in range(FW) if px[x, y][3] and px[x, y][0] > 200 and px[x, y][1] > 140 and px[x, y][0] - px[x, y][2] > 40]
    b = a.copy()
    if skin:
        fb = max(y for _, y in skin)
        cand = [(x, y) for x, y in skin if y >= fb - 3]
        mx = max(x for x, _ in cand); q = b.load()
        for dx in (0, -1):
            if q[mx + dx, fb - 1][3]:
                q[mx + dx, fb - 1] = (120, 40, 44, 255)
    return [a, b]


def strip(frames):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * FW, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def defs():
    lab = doc_labels(); out = []
    for name in rig.CLIPS:
        grp = rig.GROUP[name]
        if name == 'cq':
            for k, nm in (('cq1', '근접 사격 1타 리텐션'), ('cq2', '근접 사격 2타 더블탭'), ('cq3', '근접 사격 3타 「죄송합니다」')):
                out.append(dict(key=k, src='cq', rng=CQ[k], label=nm, group=grp))
            continue
        out.append(dict(key=name, src=name, rng=None, label=lab.get(name, name), group=grp))
        if name == 'idle':
            out.append(dict(key='talk', src='@talk', rng=None, label='말하기', group=grp))
        if name == 'contact':   # 칼날 잡은 뒤 맞쏘기 = 접사 그림
            out.append(dict(key='counter', src='contact', rng=None, label='칼날 잡고 맞쏘기', group=grp))
    for k, nm in GPT:
        out.append(dict(key=k, src=k, rng=None, label=nm, group='씻기 (GPT 납품)'))
    for d in out:
        k = d['key']; m = META.get(k, {})
        d.update(fps=FPS.get(k, 8), loop=k in LOOP, hits=m.get('hits', []), adv=m.get('adv', 0), origin=m.get('origin', 0), hold=m.get('hold', 0))
    return out


def main():
    manifest = {'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing = {}, []
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    for d in defs():
        k = d['key']
        if d['src'] == '@talk':
            fr = talk_frames()
        else:
            fr = frames_of(d['src'])
            if fr and d['src'] in rig.CLIPS and is_tail(d['src']) and len(fr) == len(rig.CLIPS[d['src']][2]):
                fr = fr[:-1]
            if d['rng'] and fr:
                fr = fr[d['rng'][0]:d['rng'][1]]
        if fr:
            fr = deadpole_fixes.apply(k, d['src'], fr)
        if not fr:
            missing.append(k); continue
        data = strip(fr)
        strips[k] = base64.b64encode(data).decode()
        open(os.path.join(final, k + '.png'), 'wb').write(data)
        manifest['clips'][k] = {x: d[x] for x in ('label', 'fps', 'loop', 'hits', 'adv', 'origin', 'hold', 'group')} | {'frames': len(fr), 'bytes': len(data)}
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    manifest['missing'] = missing
    tpl = open(os.path.join(ROOT, 'tools', 'deadpole_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', missing)


if __name__ == '__main__':
    main()
