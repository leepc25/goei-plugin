#!/usr/bin/env python3
"""쟈알디 전 동작 시연판 빌더 (2026-10-21, 계획안 41행 전부).

game-src/action/jyaldi-v5/full/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144)를
클립별 가로 스트립으로 묶어 단일 HTML(release/demo/jyaldi-full.html)에 내장한다.
결함 목록의 코드 보정(tools/jyaldi_fixes.py)과 가구 분리(full/split/)를 거친 최종 스트립은 게임용으로 full/final/<클립>.png·<클립>.prop.png·manifest.json에도 쓴다.
모든 장은 같은 캔버스·같은 바닥선(발바닥 y=136)·같은 기준 x(57)라서 코드는 장마다 발을 재지 않는다.
말하기(33)는 기본 대기 장 + edit_image_pixen으로 입을 연 장의 입 부분(8×7px)만 옮긴 장, 컷인은 A2 얼굴을 pixen으로 다시 그린 것이다.
"""
import base64, io, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jyaldi_life_defs import LIFE
import jyaldi_fixes
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'full')
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'jyaldi-full.html')

# key, 원본 클립, 장 범위, 표 행, 이름, fps, 반복, 타격 장들, 그림 안 전진(px, 끝에서 코드가 옮김), 시작 기준 오프셋(px)
def D(key, src, label, fps, rng=None, loop=False, hits=(), adv=0, origin=0, rev=False, hold=0.0, order=None):
    return dict(key=key, src=src, rng=rng, order=order, label=label, fps=fps, loop=loop, hits=list(hits), adv=adv, origin=origin, rev=rev, hold=hold)
DEFS = [
    D('idle', 'idle', '1 기본 대기', 5, loop=True),
    D('glove', 'glove', '1·34 장갑 고쳐 끼기', 8),
    D('guard', 'guard', '2 전투 대기', 6, loop=True),
    D('walk', 'walk', '3 걷기(탐사)', 10, loop=True),
    D('step', 'step', '3 전투 걸음(밀고 끌기)', 14, adv=14),
    D('run', 'run', '4 달리기', 14, loop=True),
    D('jump', 'jump', '5 점프', 12),
    D('crouch', 'crouch', '6 앉기', 14),
    D('crouchwalk', 'duckwalk', '7 앉아 이동(쪼그려 걷기)', 12, rng=(0, 7), loop=True),
    D('lowstrike', 'lowkick', '8 하단 공격(하단 킥)', 14, hits=[2], hold=0.05),
    D('groundblast', 'lowstrike', '8+ 지면 폭파(기술: 앉아 D)', 14, hits=[3], hold=0.06),
    D('jab', 'combo', '9 근접 1타 잽', 18, rng=(0, 5), hits=[2], adv=6, hold=0.04),
    D('cross', 'combo', '10 근접 2타 스트레이트', 15, rng=(4, 10), hits=[3], adv=10, origin=6, hold=0.06),
    D('power', 'combo', '11 근접 3타 강한 스트레이트', 13, rng=(9, 15), hits=[3], adv=20, origin=16, hold=0.12),
    D('dash', 'dash', '12 돌진공격(어깨)', 14, hits=[2], adv=22, hold=0.06),
    D('airkick', 'airkick', '13 공중 공격(점프 킥)', 14, rng=(0, 5), hits=[2], hold=0.05),
    D('draw', 'draw', '14 권총 뽑기', 14),
    D('holster', 'draw', '14 권총 집어넣기', 14, rev=True),
    D('fire', 'fire', '15 권총 발사', 18, order=[3, 0, 2, 1], hits=[0]),
    D('reload', 'reload', '40 재장전', 10),
    D('blast', 'blast', '16 고유기 짧게(폭파)', 12, hits=[3], hold=0.08),
    D('charge', 'charge', '17 고유기 충전', 12, loop=True),
    D('block', 'blockfront', '18 가드(전면)', 16),
    D('evade', 'evade', '20 회피(방향 대시)', 18),
    D('grab', 'grab2', '21 잡기', 14),
    D('grabknee', 'grabknee2', '22 잡기 타격(무릎)', 14, hits=[2], hold=0.05),
    D('grabblast', 'grabblast', '23 잡기 폭파(던지기 대신)', 12, order=[0, 1, 2, 3, 4, 7, 5, 6], hits=[4], hold=0.1),
    D('super', 'super', '24 필살기', 10, hits=[6], hold=0.2),
    D('pickup', 'pickup', '25 상호작용·줍기', 10),
    D('toss', 'toss', '26 물건 던지기', 12, hits=[3]),
    D('drink', 'drink', '27 마시기', 6),
    D('eat', 'eat', '28 먹기', 6),
    D('bandage', 'bandage', '29 자기 치료', 7),
    D('hit', 'hit', '30 약 피격', 14),
    D('down', 'down', '31 강 피격·다운', 12, rng=(0, 7)),
    D('getup', 'getup', '32 기상', 8),
    D('talk', '_talk', '33 말하기', 6, loop=True),
    D('papers', 'papers', '34 본부: 서류 검토', 4, loop=True),
    D('smoke', 'smoke', '34 본부: 담배', 4),
    D('chain', 'chain', '36 숙련 3: 연쇄 폭파', 10, hits=[1, 3, 5], hold=0.05),
    D('wall', 'wall', '37 숙련 6: 벽 통째로', 10, hits=[4], hold=0.15),
    D('pipe', 'pipe2', '38 임시 둔기 휘두르기', 12, hits=[3], hold=0.06),
    D('shotgun', 'shotgun2', '39 임시 총 사격(견착)', 12, order=[2, 0, 1, 3, 4, 5], hits=[1]),
    D('tired', 'tired', '41 피로·부상 대기', 4, loop=True),
    D('engage', 'engage', '2 전투 대기 진입(해제 = 역재생)', 12),
    D('support', 'support', '35 지원 등장(걸어 들어와 폭파·장갑)', 10, hits=[5]),
    D('idle_pipe', 'idle_pipe', '38 쇠파이프 든 채 대기', 5, loop=True),
    D('walk_pipe', 'walk_pipe', '38 쇠파이프 든 채 걷기', 10, rng=(0, 7), loop=True),
    D('idle_shotgun', 'idle_shotgun', '39 산탄총 든 채 대기', 5, loop=True),
    D('walk_shotgun', 'walk_shotgun', '39 산탄총 든 채 걷기', 10, rng=(0, 7), loop=True),
    D('run_shotgun', 'run_shotgun', '39 산탄총 든 채 달리기', 14, loop=True),
    D('idle_brick', 'idle_brick', '26 벽돌 든 채 대기', 5, loop=True),
    D('walk_brick', 'walk_brick', '26 벽돌 든 채 걷기', 10, rng=(0, 7), loop=True),
    D('run_brick', 'run_brick', '26 벽돌 든 채 달리기', 14, loop=True),
]
for d in DEFS: d['group'] = '전투·기본 (계획안 1~41)'
for k, grp, name, fps, loop in LIFE:
    DEFS.append(dict(D(k, k, name, fps, loop=loop), group=grp))
FW, FH, FOOT, ANCHOR = 192, 144, 136, 57


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d):
        return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def layers_of(src):
    """가구를 떼어 낸 클립(full/split/)이면 (캐릭터 장, 가구 장), 아니면 (원본 장, None)."""
    d = os.path.join(SRC, 'split', src)
    if not os.path.isdir(d):
        return frames_of(src), None
    fs = sorted(f for f in os.listdir(d) if f.endswith('.png') and not f.startswith('prop_'))
    return ([Image.open(os.path.join(d, f)).convert('RGBA') for f in fs],
            [Image.open(os.path.join(d, 'prop_' + f)).convert('RGBA') for f in fs])


def auto_trim(frames):
    """생성기가 끝 장을 망치는 버릇(기준 그림으로 되돌아감·흩어짐)을 재서 끝에서부터 뺀다(생활 동작 묶음 전용).
    기준 그림과 겹침(IoU)이 클립 중앙값보다 0.12 넘게 높거나, 홀로 떨어진 점 비율이 2%를 넘으면 버림."""
    import numpy as np
    ref = np.array(Image.open(os.path.join(SRC, 'A2-pad.png')).convert('RGBA'))[:, :, 3] > 0
    def met(im):
        a = np.array(im)[:, :, 3] > 0
        nb = sum(np.roll(np.roll(a, dy, 0), dx, 1).astype(int) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        return ((nb <= 1) & a).sum() / max(1, a.sum()), (a & ref).sum() / max(1, (a | ref).sum())
    ms = [met(f) for f in frames]
    med = sorted(u for _, u in ms)[len(ms) // 2]
    out = list(frames)
    while len(out) > 3:
        sp, u = ms[len(out) - 1]
        if sp > 0.02 or u > med + 0.12: out.pop()
        else: break
    return out


def talk_frames():
    """기본 대기 0번 장 + 입을 연 장. 입 = 얼굴 피부 중 가장 앞(오른쪽) 아래쪽 2px."""
    base = frames_of('idle')
    if not base:
        return []
    a = base[0]
    px = a.load()
    skin = [(x, y) for y in range(30, 90) for x in range(FW) if px[x, y][3] and px[x, y][0] > 200 and px[x, y][1] > 160 and px[x, y][2] > 130 and px[x, y][0] - px[x, y][2] > 30]
    b = a.copy()
    if skin:
        ys = sorted(set(y for _, y in skin))
        face_bottom = max(ys)
        # 얼굴 아래쪽 4줄 안에서 가장 앞 x
        cand = [(x, y) for x, y in skin if y >= face_bottom - 4]
        mx = max(x for x, _ in cand)
        my = face_bottom - 2
        q = b.load()
        for dx in (0, -1):
            if q[mx + dx, my][3]:
                q[mx + dx, my] = (120, 40, 44, 255)
    return [a, b]


def cutin_png():
    """필살기 컷인: A2 얼굴을 edit_image_pixen으로 192×192 다시 그린 것(seed 51)"""
    return base64.b64encode(open(os.path.join(SRC, 'cutin51.png'), 'rb').read()).decode()


def strip(frames):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * FW, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def main():
    manifest = {'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing = {}, []
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    for d in DEFS:
        if d['key'] in jyaldi_fixes.DROP_CLIPS:
            continue
        fr, pr = (talk_frames(), None) if d['src'] == '@talk' else layers_of(d['src'])
        if d['key'] == 'getup' and fr:  # 생성된 0·1장에 회색 얼룩 → 다운 마지막 누운 장으로 대체
            fr = frames_of('down')[6:7] + fr[2:]
        idx = list(range(len(fr)))
        # Bathroom clips are reviewed explicitly; preserve the commissioned 4/6 frames.
        bathroom = {'showerin', 'shower', 'showerout', 'bathin', 'bath', 'bathout', 'toiletin', 'toilet', 'toiletout', 'handwash'}
        if d.get('group', '').startswith('전투') is False and fr and d['key'] not in bathroom:
            idx = idx[:len(auto_trim(fr))]
        if d['order'] and idx:
            idx = [idx[i] for i in d['order'] if i < len(idx)]
        if d['rng'] and idx:
            idx = idx[d['rng'][0]:d['rng'][1]]
        if d['rev']:
            idx = idx[::-1]
        fr = [fr[i] for i in idx]; pr = [pr[i] for i in idx] if pr else None
        if fr:
            fr, pr = jyaldi_fixes.apply(d['key'], fr, pr)
        if not fr:
            missing.append(d['key']); print('없음', d['key'], file=sys.stderr); continue
        data = strip(fr)
        strips[d['key']] = base64.b64encode(data).decode()
        open(os.path.join(final, d['key'] + '.png'), 'wb').write(data)
        manifest['clips'][d['key']] = {k: d[k] for k in ('label', 'fps', 'loop', 'hits', 'adv', 'origin', 'hold', 'group')} | {'frames': len(fr), 'bytes': len(data), 'prop': bool(pr)}
        if pr:
            pdata = strip(pr)
            strips['prop:' + d['key']] = base64.b64encode(pdata).decode()
            open(os.path.join(final, d['key'] + '.prop.png'), 'wb').write(pdata)
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    manifest['missing'] = missing
    tpl = open(os.path.join(ROOT, 'tools', 'jyaldi_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()).replace('__CUTIN__', cutin_png()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', missing)


if __name__ == '__main__':
    main()
