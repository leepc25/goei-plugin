#!/usr/bin/env python3
"""로제몬 전 동작 시연판 빌더 (2026-10-22, 설계서 docs/캐릭터제작서/동작설계_rojemon.md 234행 전부).

game-src/action/rojemon/clips/<클립>/NN.png (animate_with_skeleton_v3 원본: 본체 192×144, 꼬마 인형 96×96, 마네킹 192×144)를
클립별 가로 스트립으로 묶어 단일 HTML(release/demo/rojemon-full.html)에 내장한다.
목록은 tools/rojemon_defs.py: make 'pl'·'gpt' = 자기 그림, 'base:<클립>' = 기본 클립 + 엔진 오브젝트(같은 스트립을 씀), 'code' = 말하기.
장 단위 보정은 tools/rojemon_fixes.py, 최종 스트립·manifest는 game-src/action/rojemon/final/ 에도 쓴다.
manifest 클립마다 anchors = 장별 {hand:[x,y], head:[x,y]}: 실이 나오는 앞손과 인형 실이 걸리는 머리 꼭대기(뼈대 관절을 그림 위 가장 가까운 불투명 점으로 맞춤).
"""
import base64, io, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, 'game-src', 'action', 'rojemon')
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(SRC, 'scripts'))
import rojemon_defs as D
import rojemon_fixes as FIX
import rig_rojemon as RR, rig_puppets as RP
from PIL import Image

BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'rojemon-full.html')
GEOM = {'roje': (192, 144, 136, 57), 'kid': (96, 96, 88, 43), 'man': (192, 144, 136, 56)}

# 재생 값: key -> (fps, loop, hits, adv, hold)
PLAY = {
    'idle': (5, 1), 'idle_snack': (7, 0), 'engage': (12, 0), 'guard': (6, 1), 'walk': (11, 1), 'step': (14, 0, (), 12), 'run': (15, 1),
    'jump': (12, 0), 'crouch': (14, 0), 'crouchwalk': (12, 1), 'lowcue': (14, 0, (2,)), 'cue1': (16, 0, (2,)), 'cue2': (15, 0, (3,)),
    'cue3': (13, 0, (5,), 0, 0.1), 'fling': (14, 0, (3,)), 'aircue': (14, 0, (2,)), 'stare': (8, 1), 'hypno': (12, 0, (1,)), 'hypnofail': (10, 0),
    'thread': (12, 0, (3,)), 'conduct': (8, 1), 'downbeat': (14, 0, (2,), 0, 0.12), 'cower': (16, 0), 'cowerhit': (14, 0), 'yank': (16, 0),
    'collar': (14, 0), 'glare': (10, 0, (2,)), 'sendoff': (11, 0, (4,)), 'super': (12, 0, (5,), 0, 0.2), 'superend': (8, 0),
    'pickup': (10, 0), 'toss': (12, 0, (3,)), 'drink': (6, 0), 'eat': (7, 0), 'bandage': (7, 0), 'hit': (14, 0), 'down': (12, 0), 'getup': (9, 0),
    'talk': (6, 1), 'praised': (6, 0), 'puppetshow': (4, 1), 'support': (10, 0, (4,)), 'peer': (9, 0, (4,)), 'trio': (10, 0, (5,)),
    'wswing': (12, 0, (3,), 0, 0.06), 'wfire': (14, 0, (2,)), 'reload': (10, 0), 'tired': (4, 1),
    'kid_idle': (6, 1), 'kid_hop': (12, 1), 'kid_leap': (14, 0, (3,)), 'kid_ankle': (12, 0, (2,)), 'kid_bite': (12, 0, (3,)), 'kid_drop': (12, 0, (2,)),
    'kid_roll': (16, 1), 'kid_block': (12, 0), 'kid_hit': (14, 0), 'kid_flop': (12, 0), 'kid_rise': (12, 0), 'kid_ride': (12, 1),
    'man_limp': (3, 1), 'man_rise': (10, 0), 'man_idle': (6, 1), 'man_walk': (10, 1), 'man_chop': (13, 0, (3,)), 'man_sweep': (13, 0, (3,)),
    'man_slam': (13, 0, (3,)), 'man_block': (12, 0), 'man_hit': (14, 0), 'man_break': (12, 0), 'man_grab': (12, 0), 'man_throw': (12, 0, (5,)),
}
LOOPY = ('idle_', 'walk_', 'run_', 'carry', 'seat', 'lie', 'floorrest', 'handswork', 'handshead', 'holdlook', 'handear', 'mouth', 'sweep', 'climb')


def play_of(key, src, frames):
    p = PLAY.get(key) or PLAY.get(src)
    if p:
        p = tuple(p) + (0,) * (5 - len(p))
        return dict(fps=p[0], loop=bool(p[1]), hits=list(p[2] or ()), adv=p[3] or 0, hold=p[4] or 0)
    loop = key.startswith(LOOPY) or src.startswith(LOOPY) or frames <= 4
    return dict(fps=6 if loop else 8, loop=loop, hits=[], adv=0, hold=0)


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d):
        return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def talk_frames():
    """기본 대기 0번 장 + 입을 연 장: 얼굴 피부 중 가장 앞·아래 2px를 입 안 색으로."""
    base = frames_of('idle')
    if not base:
        return []
    a = base[0]; px = a.load(); W, H = a.size
    skin = [(x, y) for y in range(40, 75) for x in range(W) if px[x, y][3] and px[x, y][0] > 200 and px[x, y][1] > 150 and px[x, y][0] - px[x, y][2] > 25]
    b = a.copy()
    if skin:
        fb = max(y for _, y in skin)
        cand = [(x, y) for x, y in skin if y >= fb - 4]
        mx = max(x for x, _ in cand); q = b.load()
        for dx in (0, -1):
            if q[mx + dx, fb - 2][3]:
                q[mx + dx, fb - 2] = (112, 40, 52, 255)
    return [a, b]


def snap(im, p, r=6):
    """뼈대 관절 p를 그림 위 가장 가까운 불투명 점으로."""
    px = im.load(); W, H = im.size; x0, y0 = int(round(p[0])), int(round(p[1])); best = None
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            x, y = x0 + dx, y0 + dy
            if 0 <= x < W and 0 <= y < H and px[x, y][3] > 40:
                d = dx * dx + dy * dy
                if best is None or d < best[0]:
                    best = (d, x, y)
    return [best[1], best[2]] if best else [x0, y0]


def anchors(src, frames, idx):
    rig = RR.CLIPS.get(src) or RP.CLIPS.get(src)
    if not rig:
        return None
    poses = rig[1]; out = []
    for im, i in zip(frames, idx):
        p = poses[min(i, len(poses) - 1)]
        hand = max((p['RIGHT ARM'], p['LEFT ARM']), key=lambda v: v[0])
        bb = im.split()[3].getbbox()
        top = [p['NOSE'][0] - 4, bb[1] + 1] if bb else [p['NOSE'][0] - 4, p['NOSE'][1] - 12]
        out.append({'hand': snap(im, hand), 'head': snap(im, top, 3)})
    return out


def strip(frames, fw, fh):
    s = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * fw, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def main():
    FIX.LOAD = frames_of
    manifest = {'clips': {}, 'missing': []}
    strips = {}
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    for r in D.ROWS:
        key, make, body = r['clip'], r['make'], r['body']
        if key in manifest['clips']:
            key = key + '_' + r['row']   # 같은 이름 행(기본 클립·장면 겸용)은 장면 쪽 이름을 바꿈
        src = make[5:] if make.startswith('base:') else key
        fw, fh, foot, anc = GEOM[body]
        if make == 'code':
            fr = talk_frames(); idx = [0, 0]
        else:
            fr = frames_of(src); idx = list(range(len(fr)))
        if fr and make != 'code':
            fr, idx = FIX.apply(src, fr, idx)
        if not fr:
            manifest['missing'].append([key, r['group']]); continue
        pl = play_of(key, src, len(fr))
        ent = dict(label=f"{r['row']} {r['name']}", group=r['group'], body=body, fw=fw, fh=fh, foot=foot, anc=anc, frames=len(fr), src=src,
                   how=r.get('how', ''), make=make, **pl)
        if src not in strips:
            data = strip(fr, fw, fh)
            strips[src] = base64.b64encode(data).decode()
            open(os.path.join(final, src + '.png'), 'wb').write(data)
            a = anchors(src, fr, idx)
            if a:
                ent['anchors'] = a
        elif 'anchors' in manifest['clips'].get(src, {}):
            ent['anchors'] = manifest['clips'][src]['anchors']
        manifest['clips'][key] = ent
    for k, v in manifest['clips'].items():   # 기본 클립을 빌려 쓰는 행에도 손 좌표
        if 'anchors' not in v and v['src'] in manifest['clips'] and 'anchors' in manifest['clips'][v['src']]:
            v['anchors'] = manifest['clips'][v['src']]['anchors']
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    tpl = open(os.path.join(HERE, 'rojemon_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(manifest['clips']), 'strips', len(strips), 'missing', len(manifest['missing']), [m[0] for m in manifest['missing'] if m[1] in ('전투', '꼬마 인형', '마네킹(그릇)')])


if __name__ == '__main__':
    main()
