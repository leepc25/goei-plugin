#!/usr/bin/env python3
"""쟈알디 전 동작 시연판 빌더 (2026-10-21, 계획안 41행 전부).

game-src/action/jyaldi-v5/full/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144, 한 픽셀도 바꾸지 않음)를
클립별 가로 스트립으로 묶어 단일 HTML(release/demo/jyaldi-full.html)에 내장한다.
모든 장은 같은 캔버스·같은 바닥선(발바닥 y=136)·같은 기준 x(57)라서 코드는 장마다 발을 재지 않는다.
말하기(33)는 기본 대기 장에 입 2px을 칠한 파생 장이고, 컷인은 기준 그림 A2 얼굴을 정수배로 키운 것이다.
"""
import base64, io, json, os, sys
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
    D('crouchwalk', 'crouchwalk', '7 앉아 이동', 10, adv=9),
    D('lowstrike', 'lowstrike', '8 하단 공격(지면 폭파)', 14, hits=[3], hold=0.06),
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
    D('block', 'block', '18 가드', 16),
    D('blockhit', 'blockhit', '19 가드 피격', 14),
    D('evade', 'evade', '20 회피(방향 대시)', 18),
    D('grab', 'grab', '21 잡기', 14),
    D('grabknee', 'grabknee', '22 잡기 타격(무릎)', 14, hits=[2], hold=0.05),
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
    D('talk', '@talk', '33 말하기', 8, loop=True),
    D('papers', 'papers', '34 본부: 서류 검토', 4, loop=True),
    D('smoke', 'smoke', '34 본부: 담배', 4),
    D('chain', 'chain', '36 숙련 3: 연쇄 폭파', 10, hits=[1, 3, 5], hold=0.05),
    D('wall', 'wall', '37 숙련 6: 벽 통째로', 10, hits=[4], hold=0.15),
    D('pipe', 'pipe', '38 임시 둔기 휘두르기', 12, hits=[3], hold=0.06),
    D('shotgun', 'shotgun', '39 임시 총 사격', 12, order=[3, 2, 0, 1], hits=[0]),
    D('tired', 'tired', '41 피로·부상 대기', 4, loop=True),
]
FW, FH, FOOT, ANCHOR = 192, 144, 136, 57


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d):
        return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def pipe_fix(frames):
    """생성 결과에서 쇠파이프가 빠진 장(0·2·4·5)에 뼈대 손목 좌표로 파이프를 덧그린다(2px 회색 선)."""
    sys.path.insert(0, os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'scripts'))
    import rig
    from PIL import ImageDraw
    ps = rig.CLIPS['pipe'][2]
    out = []
    for i, f in enumerate(frames):
        if i in (0, 2, 4, 5) and i < len(ps):
            p = ps[i]; w = p['RIGHT ARM']; e = p['RIGHT ELBOW']
            dx, dy = w[0] - e[0], w[1] - e[1]; L = max(1e-3, (dx * dx + dy * dy) ** .5)
            x0, y0 = w[0] + rig.DX, w[1] + rig.DY
            x1, y1 = x0 + dx / L * 44, y0 + dy / L * 44
            f = f.copy(); d = ImageDraw.Draw(f)
            d.line([(x0, y0), (x1, y1)], fill=(40, 44, 48, 255), width=4)
            d.line([(x0, y0), (x1, y1)], fill=(139, 147, 154, 255), width=2)
        out.append(f)
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
    a2 = Image.open(os.path.join(SRC, 'A2.png')).convert('RGBA')
    face = a2.crop((38, 0, 70, 32))
    b = io.BytesIO(); face.save(b, 'PNG'); return base64.b64encode(b.getvalue()).decode()


def strip(frames):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * FW, 0))
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def main():
    manifest = {'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing = {}, []
    for d in DEFS:
        fr = talk_frames() if d['src'] == '@talk' else frames_of(d['src'])
        if d['key'] == 'getup' and fr:  # 생성된 0·1장에 회색 얼룩 → 다운 마지막 누운 장으로 대체
            fr = frames_of('down')[6:7] + fr[2:]
        if d['key'] == 'pipe' and fr:
            fr = pipe_fix(fr)
        if d['order'] and fr:
            fr = [fr[i] for i in d['order'] if i < len(fr)]
        if d['rng'] and fr:
            fr = fr[d['rng'][0]:d['rng'][1]]
        if d['rev']:
            fr = fr[::-1]
        if not fr:
            missing.append(d['key']); print('없음', d['key'], file=sys.stderr); continue
        data = strip(fr)
        strips[d['key']] = base64.b64encode(data).decode()
        manifest['clips'][d['key']] = {k: d[k] for k in ('label', 'fps', 'loop', 'hits', 'adv', 'origin', 'hold')} | {'frames': len(fr), 'bytes': len(data)}
    manifest['missing'] = missing
    tpl = open(os.path.join(ROOT, 'tools', 'jyaldi_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()).replace('__CUTIN__', cutin_png()))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', missing)


if __name__ == '__main__':
    main()
