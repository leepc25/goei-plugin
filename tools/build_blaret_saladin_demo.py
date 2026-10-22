#!/usr/bin/env python3
"""블라렛·살라딘·소환체 시연판 빌더 (2026-10-22).

game-src/action/blaret_saladin/clips/<캐릭터>/<클립>/NN.png (animate_with_skeleton_v3 원본, 256×176)를
클립별 가로 스트립으로 묶어
  - 게임용: game-src/action/blaret_saladin/final/<캐릭터>/<클립>.png + manifest.json(장 수·fps·반복·피해 장·발 기준점) + hands.json
  - 시연판: release/demo/blaret-saladin.html (단일 파일, 그림 내장)
에 쓴다. 모든 장은 같은 캔버스(256×176)·같은 바닥선(발바닥 y≈168)·같은 기준 x(96)라서 코드는 장마다 발을 재지 않는다.
hands.json = 엔진 형식 {클립: [[x,y,각도], ...]} (가까운 손 = 주무기 손), hand2 = 먼 손, 각도 0 = 위로 세움·시계 +.
살라딘은 carry(가까운 어깨) 좌표도 넣는다(메고 있는 형제를 엔진이 그림).
결함으로 뺀 장·클립은 FIX(아래)에 적는다.
"""
import base64, io, json, math, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BS = os.path.join(ROOT, 'game-src', 'action', 'blaret_saladin')
sys.path.insert(0, os.path.join(BS, 'scripts'))
import bsrig  # noqa: E402
from fxclean import clean  # noqa: E402  모델이 그려 넣은 총구 불꽃·연기 지움

OUT = os.path.join(ROOT, 'release', 'demo', 'blaret-saladin.html')
TPL = os.path.join(ROOT, 'tools', 'blaret_saladin_template.html')
JY = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'full', 'clips', 'idle', '00.png')

LOOP = {'idle', 'walk', 'run', 'guns_idle', 'sword_idle', 'armed_idle', 'guard', 'tense', 'dance', 'arms_crossed',
        'advance_fire', 'guard_advance', 'carry_fire', 'march', 'fire', 'mixer', 'sweep', 'gallop', 'laugh'}
FPS = {'idle': 5, 'guns_idle': 6, 'sword_idle': 6, 'armed_idle': 5, 'arms_crossed': 4, 'tense': 6, 'walk': 10, 'run': 16,
       'blink': 16, 'fire': 16, 'fire_split': 14, 'mixer': 16, 'burst': 16, 'sweep': 12, 'advance_fire': 10, 'cut1': 16,
       'cut2': 16, 'cut3': 14, 'lunge': 16, 'rise': 14, 'plunge': 14, 'slash1': 14, 'slash2': 14, 'leap_cleave': 12,
       'super_cut': 12, 'super_judge': 8, 'cathedral': 8, 'chant': 9, 'weep': 6, 'dance': 9, 'bow': 8, 'gallop': 12}
# 피해(판정) 장: 뼈대 기준으로 정함. 엔진은 이 장에서 히트스톱을 건다.
HITS = {'blaret': {'fire': [0, 3], 'fire_split': [2, 4], 'air_fire': [3, 5, 6], 'stake_throw': [4], 'stake_finish': [5], 'cut1': [3],
                   'cut2': [3], 'cut3': [5], 'lunge': [3], 'rise': [3], 'plunge': [4], 'palm': [3], 'wave': [5], 'high_kick': [2],
                   'super_cut': [5], 'smash': [5]},
        'saladin': {'advance_fire': [1, 3, 5, 7], 'slash1': [3], 'slash2': [3], 'mixer': [1, 3, 5, 7, 9, 11], 'burst': [1, 3],
                    'sweep': [1, 3, 5, 7], 'rpg_fire': [1], 'grenade': [4], 'leap_cleave': [6], 'super_judge': [10], 'carry_fire': [1, 5]},
        'knight': {'slash': [3]}, 'crusader': {'slash': [3]}, 'modernspirit': {'fire': [2]}}
NAMES = {'blaret': '블라렛', 'saladin': '살라딘', 'knight': '성기사(블라렛 소환)', 'crusader': '성전 병사(살라딘 군세)',
         'highmamluk': '고위 맘루크(군세·자폭)', 'modernspirit': '현대 영령(군세·로켓)', 'horse': '맘루크 중기병(군세)'}
SPIRIT = {'crusader', 'highmamluk', 'modernspirit', 'horse'}   # 시연판에서 반투명 푸른빛으로 칠해 보는 군세
# 검수 결과(game-src/action/blaret_saladin/qa.md): {(캐릭터, 클립): {'drop': [원본 장 번호], 'erase': [(x0,y0,x1,y1[, [장...]])], 'skip': True}}
FIX = {('blaret', 'blink'): {'drop': [4]}, ('blaret', 'cut1'): {'drop': [0]}, ('blaret', 'extract'): {'drop': [5]},
       ('blaret', 'sword_idle'): {'drop': [0]}, ('blaret', 'cut2'): {'drop': [3]},
       ('blaret', 'rise'): {'drop': [4]}, ('blaret', 'super_cut'): {'drop': [0, 1]}, ('blaret', 'plunge'): {'erase': [(136, 40, 152, 155, [4, 5, 6])]},
       ('blaret', 'air_fire'): {'erase': [(130, 108, 200, 160)], 'drop': [2, 4]}}
DOC = os.path.join(ROOT, 'docs', '캐릭터제작서', '동작설계_블라렛_살라딘.md')
SUMMON_KO = {'idle': '대기', 'march': '행진', 'slash': '베기', 'rise': '땅에서 솟아오름', 'run': '돌격(자폭은 코드)',
             'fire': '어깨에 로켓 겨눠 발사', 'gallop': '질주'}


def ko_labels():
    """설계서 4.1·4.2 표에서 클립별 한국어 설명을 읽음(시연판은 한국어만)."""
    out, cur = {}, None
    for ln in open(DOC, encoding='utf-8'):
        if ln.startswith('### 4.1'): cur = 'blaret'
        elif ln.startswith('### 4.2'): cur = 'saladin'
        elif ln.startswith('#'): cur = None
        elif cur and ln.startswith('|'):
            c = [x.strip() for x in ln.strip().strip('|').split('|')]
            if len(c) >= 4 and c[0].isdigit():
                out[(cur, c[1])] = c[3]
    return out


def hands_for(cn, clip):
    ch = bsrig.CHARS.get(cn)
    if not ch or clip not in ch['clips']:
        return None
    k = ch['scale']
    out = {'hand': [], 'hand2': [], 'carry': []}
    for p in ch['clips'][clip][2]:
        q = bsrig.scaled(p, k)
        for side, key in (('RIGHT', 'hand'), ('LEFT', 'hand2')):
            e, w = q[f'{side} ELBOW'], q[f'{side} ARM']
            ang = math.degrees(math.atan2(w[0] - e[0], -(w[1] - e[1])))
            out[key].append([round(w[0] + bsrig.OX, 1), round(w[1] + bsrig.OY, 1), round(ang)])
        s = q['RIGHT SHOULDER']
        out['carry'].append([round(s[0] + bsrig.OX, 1), round(s[1] + bsrig.OY, 1), 0])
    return out


def strip(frames):
    w, h = frames[0].size
    im = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        im.alpha_composite(f, (i * w, 0))
    return im


def b64(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def build():
    data = {'chars': [], 'jyaldi': b64(Image.open(JY).convert('RGBA'))}
    KO = ko_labels()
    clips_root = os.path.join(BS, 'clips')
    for cn in ['blaret', 'saladin', 'knight', 'crusader', 'highmamluk', 'modernspirit', 'horse']:
        d = os.path.join(clips_root, cn)
        if not os.path.isdir(d):
            continue
        order = list(bsrig.CHARS[cn]['clips']) if cn in bsrig.CHARS else sorted(os.listdir(d))
        final = os.path.join(BS, 'final', cn); os.makedirs(final, exist_ok=True)
        man, hands, items = {}, {}, []
        for clip in order:
            cd = os.path.join(d, clip)
            fx = FIX.get((cn, clip), {})
            if not os.path.isdir(cd) or fx.get('skip'):
                continue
            files = sorted(f for f in os.listdir(cd) if f.endswith('.png'))
            frames = [clean(Image.open(os.path.join(cd, f)), erase=[e[:4] for e in fx.get('erase', ()) if len(e) == 4 or i in e[4]])
                      for i, f in enumerate(files) if i not in fx.get('drop', [])]
            if not frames:
                continue
            loop = clip in LOOP
            if loop and cn in bsrig.CHARS and len(frames) > 4 and clip == 'idle':
                frames = frames[:-1]   # tail()로 붙인 되돌림 장
            st = strip(frames)
            st.save(os.path.join(final, f'{clip}.png'))
            act = bsrig.CHARS[cn]['clips'][clip][0] if cn in bsrig.CHARS and clip in bsrig.CHARS[cn]['clips'] else ''
            kind = '상호' if cn in ('blaret', 'saladin') and act and clip in INTERACT.get(cn, set()) else '전투'
            keep = [i for i in range(len(files)) if i not in fx.get('drop', [])][:len(frames)]
            hits = sorted({min(range(len(keep)), key=lambda k: (keep[k] < i, abs(keep[k] - i))) for i in HITS.get(cn, {}).get(clip, [])})   # 원본 장 번호 → 뺀 뒤 번호(뺀 장이면 다음 장)
            m = dict(frames=len(frames), w=frames[0].width, h=frames[0].height, fps=FPS.get(clip, 10), loop=loop,
                     hits=hits, foot=[96, 168], kind=kind)
            man[clip] = m
            hd = hands_for(cn, clip)
            if hd:
                hands[clip] = {k: [v[i] for i in keep if i < len(v)] for k, v in hd.items()}
            ko = KO.get((cn, clip)) or SUMMON_KO.get(clip, clip)
            title, _, rest = ko.partition(':')
            items.append(dict(key=clip, title=title.strip(), label=rest.strip(), img=b64(st), **m))
        json.dump(man, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
        json.dump(hands, open(os.path.join(final, 'hands.json'), 'w'))
        data['chars'].append(dict(key=cn, name=NAMES[cn], spirit=cn in SPIRIT, clips=items))
    html = open(TPL, encoding='utf-8').read().replace('/*DATA*/null', json.dumps(data, ensure_ascii=False))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, round(os.path.getsize(OUT) / 1e6, 2), 'MB', {c['key']: len(c['clips']) for c in data['chars']})


INTERACT = {
    'blaret': {'intro', 'pitch', 'sell', 'smash', 'card', 'arms_crossed', 'laugh', 'surprise', 'tense', 'help_up', 'bless', 'defeat', 'flee'},
    'saladin': {'talk', 'adopt', 'dance', 'lift', 'laugh', 'weep', 'resume', 'tense', 'intervene', 'trade', 'refuse', 'break', 'bow', 'surprise'},
}

if __name__ == '__main__':
    build()
