#!/usr/bin/env python3
"""에일린 전 동작 시연판 빌더 (2026-10-22, docs/캐릭터제작서/동작설계_eileen.md 5장 138클립).

game-src/action/eileen/clips/<클립>/NN.png (animate_with_skeleton_v3 원본, 192×144)를
- 끝에 붙인 버릴 장 빼기(erig.TAIL), 장 순서·범위(DEFS),
- 효과 지우기(몸과 떨어진 조각, 손목보다 앞의 총구 불꽃·빛 — 효과는 게임 코드가 그림),
- 결함 보정(tools/eileen_fixes.py)
을 거쳐 가로 스트립으로 묶고 release/demo/eileen-full.html에 내장한다.
게임용 최종본은 eileen/final/<클립>.png · manifest.json · hands.json.
manifest anchors: hand(앞손=방아쇠 손목) · hand2(뒷손) · angle · hip · muzzle([x, y, 각도], 총 클립만, 그림에서 잰 총구 끝).
"""
import base64, io, json, os, re, sys
import numpy as np
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'eileen')
sys.path.insert(0, os.path.join(SRC, 'scripts'))
sys.path.insert(0, os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'scripts'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import erig, rig
import resume_grounding
try:
    import eileen_fixes
except ImportError:
    eileen_fixes = None
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')
OUT = os.path.join(ROOT, 'release', 'demo', 'eileen-full.html')
DOC = os.path.join(ROOT, 'docs', '캐릭터제작서', '동작설계_eileen.md')
FW, FH, FOOT, ANCHOR = 192, 144, 136, 57

# 그림 안에서 총을 쏘는(반동) 장 = 엔진이 총구 불꽃·탄도선·명중을 내는 장. 근접은 닿는 장
SHOTS = {'pair1': [3, 5], 'pair2': [2, 4], 'aimshot': [3], 'kneelfire': [1, 3], 'airshot': [3], 'pistolfire': [1], 'grabshot': [1],
         'precise': [1], 'super': [6, 8], 'suppress': [2, 4, 6], 'cover': [3, 5], 'support': [4], 'shotgun': [1]}
MELEE = {'muzzle': [3], 'buttstroke': [4], 'pushkick': [2], 'shove': [2], 'slide': [2], 'pipe': [3]}
FPS = {'idle': 4, 'guard': 5, 'talk': 6, 'walk': 11, 'step': 10, 'run': 15, 'jump': 12, 'crouch': 14, 'crouchwalk': 10, 'kneelfire': 16,
       'pair1': 18, 'pair2': 20, 'aimshot': 12, 'muzzle': 16, 'buttstroke': 14, 'pushkick': 13, 'slide': 14, 'airshot': 14,
       'transition': 14, 'pistolfire': 20, 'pistolreload': 10, 'reload': 9, 'reload_empty': 8, 'read': 8, 'aim': 4, 'precise': 12,
       'block': 16, 'evade': 18, 'grab': 14, 'grabshot': 16, 'shove': 13, 'super': 12, 'hit': 14, 'down': 12, 'getup': 10,
       'suppress': 14, 'cover': 10, 'support': 12, 'tired': 4, 'turn': 12, 'fall': 10, 'land': 12, 'sneak': 7, 'limp': 8}
ADVK = {'evade', 'slide', 'pushkick', 'shove'}   # 끝 장에서 몸이 옮겨 간 만큼(엉덩이 x 차이) 코드가 기준점을 옮김
GROUPS = {'5-1': '전투', '5-2': '기본 클립 (몸만, 물건·장면은 엔진)', '5-3': '지형·이동', '5-4': '탐사', '5-5': '상태·결과',
          '5-6': '본부 업무', '5-7': '생활·여가', '5-8': '사교', '5-9': '감정', '5-10': '씻기 (GPT)'}
NAMES = {'pair1': '페어 1 (A 1타)', 'pair2': '페어 2 (A 2타)', 'aimshot': '조준 1발 (A 3타)', 'muzzle': '떼어내기 1: 총구 찌르기',
         'buttstroke': '떼어내기 2: 총몸 내려찍기', 'pushkick': '떼어내기 3: 밀어차기', 'transition': '소총 → 권총 전환 (S)', 'read': '판독 (D)',
         'aim': '정밀 조준 유지 (A 홀드)', 'precise': '정밀 1발 (A 떼기)', 'super': '필살기 「증명해.」', 'evade': '이탈 백스텝 (Shift)',
         'reload': '전술 재장전', 'reload_empty': '빈 탄창 재장전', 'kneelfire': '무릎 쏴 페어', 'slide': '슬라이딩 (달리며 A)',
         'airshot': '공중 하향 사격', 'suppress': '숙련 3 제압 사격', 'cover': '숙련 6 엄폐 사격', 'support': '지원 등장', 'block': '소총 막기 (Q)',
         'undress': '탈의', 'showerturn': '샤워 앞 돌아서기', 'shower': '샤워', 'bath': '목욕'}
KO = {'idle': '기본 대기', 'presscheck': '약실 확인(대기 삽입)', 'guard': '전투 대기(로우 레디)', 'engage': '총 앞으로 돌려 잡기', 'walk': '걷기(본부)', 'step': '전술 보행', 'run': '달리기', 'jump': '점프', 'crouch': '무릎 쏴 자세', 'crouchwalk': '낮은 자세 이동', 'hit': '약 피격', 'down': '강 피격·다운', 'getup': '기상', 'talk': '말하기', 'pickup': '줍기', 'toss': '던지기', 'drink': '마시기', 'eat': '먹기', 'bandage': '자기 치료', 'grab': '잡기', 'grabshot': '접사 1발', 'shove': '밀어차 넘어뜨리기', 'pistolfire': '권총 발사', 'pistolreload': '권총 재장전', 'tired': '피로 대기', 'gearup': '출동 준비', 'gunclean': '본부: 총 손질', 'pipe': '임시 둔기 내려치기', 'idle_pipe': '둔기 든 채 대기', 'walk_pipe': '둔기 든 채 걷기', 'shotgun': '산탄총 사격', 'idle_shotgun': '산탄총 든 채 대기', 'walk_shotgun': '산탄총 든 채 걷기', 'run_shotgun': '산탄총 든 채 달리기', 'stepup': '계단·턱 오르기', 'stepover': '넘어 들어가기', 'liesit': '눕기 → 일어나 앉기', 'handswork': '서서 손 작업', 'handshead': '머리에 두 손', 'seatmouth': '앉아 입으로', 'seathold': '앉아 들고 보기', 'holdlook': '서서 들고 보기', 'handear': '귀에 대기(전화)', 'sweep': '쓸기', 'liehold': '누워 들고 보기', 'carry2_idle': '두 손 들고 서기', 'carry2_walk': '두 손 들고 걷기', 'carry2_run': '두 손 들고 달리기', 'carry1_idle': '한 손 들고 서기', 'carry1_walk': '한 손 들고 걷기', 'carry1_run': '한 손 들고 달리기', 'turn': '돌아서기', 'fall': '떨어지기', 'land': '착지', 'ladder': '사다리·로프', 'mantle': '턱 오르기', 'vault': '넘기', 'crawl': '낮은 포복', 'sneak': '살금 걷기', 'lookback': '뒤 확인', 'hide': '숨기', 'readwall': '벽 글씨 읽기', 'door': '문 열고 들어가기', 'doorclose': '문 닫기', 'knock': '노크', 'push': '밀기', 'inspect': '살펴보기', 'leadhand': '손목 잡고 이끌기', 'bow': '목례', 'elevwait': '엘리베이터 기다리기', 'floorsit': '바닥에 앉기', 'floorrest': '바닥에서 쉬기', 'hurtidle': '부상 대기', 'limp': '절뚝이기', 'fear': '공포(굳음)', 'nausea': '메스꺼움', 'collapse': '쓰러짐', 'bedlie': '누워 자기', 'victory': '승리(총 넘기기)', 'chairsit': '의자 앉기', 'typing': '타자', 'gearcheck': '권총 점검', 'tie': '넥타이 당기기', 'seatrest': '앉아 쉬기', 'seatthink': '앉아 생각', 'doze': '졸기', 'yawn': '하품', 'stretch': '목·어깨 풀기', 'ponytail': '포니테일 다시 묶기', 'brushteeth': '양치', 'gesture': '손짓(「여기.」)', 'armscross': '팔짱', 'nod': '끄덕', 'headshake': '고개 젓기', 'wave': '두 손가락 인사', 'handshake': '악수', 'pat': '어깨 툭', 'point': '수신호 가리키기', 'shrug': '한쪽 어깨', 'hug': '한 팔 포옹', 'sigh': '한숨', 'laugh': '코웃음', 'glad': '혼자 끄덕', 'cry': '콧등 누르기(울음)', 'wallcry': '벽에 기대 참기', 'kneelcry': '무릎 꿇고 주먹', 'sad': '셔츠 깃 쥐기', 'shout': '한 단어 명령', 'deskslam': '손바닥 내리침', 'surprise': '놀람(권총집)', 'startlefall': '놀라 무릎', 'plopdown': '벽 타고 주저앉기', 'embarrassed': '당황(포니테일 끝)', 'annoyed': '짜증(콧등)', 'think': '생각(입술 톡톡)', 'bored': '지루함(권총집 톡톡)', 'smirk': '옅은 입꼬리'}
NAMES = KO | NAMES
LOOPS = {'idle', 'guard', 'walk', 'step', 'run', 'crouchwalk', 'aim', 'talk', 'tired', 'sneak', 'limp', 'ladder', 'crawl', 'leadhand',
         'idle_pipe', 'walk_pipe', 'idle_shotgun', 'walk_shotgun', 'run_shotgun', 'gunclean', 'shower', 'bath'}


def doc_rows():
    """설계서 5장 표 → {클립: (분류, 에일린 동작 설명)}"""
    rows, grp = {}, None
    for ln in open(DOC, encoding='utf-8'):
        m = re.match(r'### (5-\d+)\.', ln)
        if m: grp = m.group(1); continue
        if ln.startswith('## 6'): break
        if grp and ln.startswith('| ') and not ln.startswith('| 클립') and not ln.startswith('| ---'):
            c = [x.strip() for x in ln.strip().strip('|').split('|')]
            if len(c) >= 4 and re.fullmatch(r'[a-z0-9_]+', c[0]): rows[c[0]] = (grp, c[3])
    return rows


def short(desc):
    d = re.sub(r'\*\*', '', desc)
    d = re.split(r'[:：(]|, |\. ', d)[0]
    return d[:26]


def label(a):
    lab = np.zeros(a.shape, int); k = 0; H, W = a.shape
    for y, x in zip(*np.nonzero(a)):
        if lab[y, x]: continue
        k += 1; q = deque([(y, x)]); lab[y, x] = k
        while q:
            cy, cx = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and a[ny, nx] and not lab[ny, nx]: lab[ny, nx] = k; q.append((ny, nx))
    return lab, k


def pose(src, i):
    ps = erig.CLIPS[src][3]
    return ps[min(i, len(ps) - 1)]


def is_gun(src):
    """총을 손에 든 클립(멘 총·맨손 제외)"""
    if src in ('engage', 'victory', 'gearup'): return True
    if src not in erig.CLIPS or erig.CLIPS[src][2] not in 'RFQ': return False
    pr = (erig.CLIPS[src][1] or '').split(',')[0]
    return any(k in pr for k in ('in both hands', 'one-handed', 'pistol', 'shotgun', 'carbine held', 'carbine dropping')) or pr.startswith('a compact black carbine held')


LEGS = {'pushkick', 'shove', 'slide', 'vault', 'mantle', 'down', 'getup', 'land', 'fall', 'crawl'}   # 다리·몸이 손보다 앞으로 나가는 클립


def drop_small(a, n=40, far=300):
    """n px 미만 조각, 그리고 몸(가장 큰 덩어리) 둘레+4px 밖에 통째로 있는 far px 미만 조각(생성기가 그린 상대 몸 일부 등)을 지운다."""
    al = a[..., 3] > 0
    lab, k = label(al)
    if k > 1:
        sz = np.bincount(lab.ravel()); main = 1 + int(np.argmax(sz[1:]))
        ys, xs = np.nonzero(lab == main); X0, X1, Y0, Y1 = xs.min() - 4, xs.max() + 4, ys.min() - 4, ys.max() + 4
        for j in range(1, k + 1):
            if j == main: continue
            if sz[j] < n: a[lab == j] = 0; continue
            yy, xx = np.nonzero(lab == j)
            if sz[j] < max(far, sz[main] // 1.5) and (xx.min() > X1 or xx.max() < X0 or yy.min() > Y1 or yy.max() < Y0): a[lab == j] = 0
    return a


SKIN_PAL = np.array([[int(h[k:k + 2], 16) for k in (0, 2, 4)] for h in
                     'FFD4BB F7B79D EDA68D E1967F D68A75 C37B68 B26855 A06151 945645'.split()])


def is_skin(a):
    """기준 그림에서 뽑은 피부 팔레트와 가까운 색(거리 20 안)."""
    d = np.abs(a[..., None, :3].astype(int) - SKIN_PAL[None, None]).sum(axis=3).min(axis=2)
    return d < 20


def strip_fx(im, src, i):
    """효과는 게임 코드가 그린다. 몸과 떨어진 작은 조각(40px 미만), 손목보다 앞의 불꽃·빛 픽셀,
    총 클립이면 앞 손목보다 6px 앞에서 총(검고 무채색)이 아닌 픽셀(연기·탄피·불꽃 찌꺼기)을 지운다."""
    # 받은 GPT 씻기 원본은 PixelLab 효과 제거 대상이 아니다. 알파/손가락 보존.
    if src in ('undress', 'showerturn', 'shower', 'bath'):
        return im.copy()
    a = drop_small(np.array(im))
    if src in erig.CLIPS:
        p = pose(src, i)
        wx = max(p['RIGHT ARM'][0], p['LEFT ARM'][0]) + rig.DX
        r, g, b = [a[..., c].astype(int) for c in range(3)]
        cols = np.arange(a.shape[1])[None, :]
        skin = is_skin(a) & (cols <= wx + 12)   # 총을 쥔 손가락(피부색)은 손목 앞 12px까지 남김 — 지우면 총이 손에서 떠 보임. 그 앞 살색 = 연기
        fx = (((r > 170) & (g > 90) & (b < 150) & (r - b > 60)) | ((r > 225) & (g > 225) & (b > 215))) & ~skin
        a[fx & (cols > wx + 3)] = 0
        if erig.CLIPS[src][2] == 'H' or src in ('mantle', 'vault', 'support'):   # 본부 클립 + 먼지·연기가 남는 클립: 손에 생성기가 그린 물건(공구·컵·부품)을 지움 — 머리 높이는 건드리지 않음
            mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
            skin = (r > 140) & (r > g) & (g > b) & (r - b > 40)
            suit = (mx < 110) & (mx - mn < 40)
            rows = np.arange(a.shape[0])[:, None]
            a[(~skin) & (~suit) & (cols > wx + 4) & (rows > p['NECK'][1] + rig.DY + 6) & (a[..., 3] > 0)] = 0
        if is_gun(src) and src not in LEGS and 'pipe' not in src:   # 쇠파이프는 회색이라 총 규칙에서 뺌
            mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
            gunpx = (mx < 110) & (mx - mn < 40)
            a[(~gunpx) & (~skin) & (cols > wx + 6) & (a[..., 3] > 0)] = 0
        a = drop_small(a)
        if is_gun(src):   # 총구 앞에 떨어져 남은 불꽃 테두리·연기 덩어리(몸과 이어지지 않고 손목보다 앞에만 있음)
            lab, k = label(a[..., 3] > 0)
            if k > 1:
                sz = np.bincount(lab.ravel()); main = 1 + int(np.argmax(sz[1:]))
                for j in range(1, k + 1):
                    if j != main and np.nonzero((lab == j).any(axis=0))[0].min() > wx + 4: a[lab == j] = 0
        if erig.CLIPS[src][2] == 'H':   # 몸과 떨어진 덩어리 중 피부·머리색이 없는 것 = 물건
            lab, k = label(a[..., 3] > 0)
            if k > 1:
                sz = np.bincount(lab.ravel()); main = 1 + int(np.argmax(sz[1:]))
                r, g, b = [a[..., c].astype(int) for c in range(3)]
                warm = (r > 140) & (r >= g) & (g > b) & (r - b > 25)
                for j in range(1, k + 1):
                    if j != main and not (warm & (lab == j)).any(): a[lab == j] = 0
    return Image.fromarray(a)


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    if not os.path.isdir(d): return []
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def wrists(src, i):
    p = pose(src, i)
    f = lambda k: (p[k][0] + rig.DX, p[k][1] + rig.DY)
    return f('RIGHT ARM'), f('RIGHT ELBOW'), f('LEFT ARM'), f('LEFT ELBOW'), p


def muzzle_of(im, src, i):
    """총구 끝: 두 손목 중 앞쪽 손목 높이 ±14px 안에서 손목보다 앞에 있는 가장 앞 어두운 픽셀."""
    w, e, w2, e2, _ = wrists(src, i)
    fx, fy = (w if w[0] >= w2[0] else w2)
    a = np.array(im); al = a[..., 3] > 0
    mx = a[..., :3].max(axis=2)
    dark = al & (mx < 90)
    best = None
    for y in range(max(0, int(fy) - 14), min(FH, int(fy) + 15)):
        xs = np.nonzero(dark[y, int(fx) + 2:])[0]
        if len(xs):
            x = int(fx) + 2 + int(xs[-1])
            if best is None or x > best[0]: best = (x, y)
    if not best or best[0] - fx < 14: return None
    back = (w2 if w[0] >= w2[0] else w)
    ang = float(np.degrees(np.arctan2(best[1] - back[1], best[0] - back[0])))
    return [best[0], best[1], round(ang)]


def anchors(src, idx, frames):
    if src not in erig.CLIPS: return None
    gun = is_gun(src)
    out = []
    for n, raw in enumerate(idx):
        s2, raw = raw if isinstance(raw, tuple) else (src, raw)
        w, e, w2, e2, p = wrists(s2, raw)
        ang = float(np.degrees(np.arctan2(w[1] - e[1], w[0] - e[0])))
        hip = [(p['RIGHT HIP'][0] + p['LEFT HIP'][0]) / 2 + rig.DX, (p['RIGHT HIP'][1] + p['LEFT HIP'][1]) / 2 + rig.DY]
        a = {'hand': [round(w[0]), round(w[1])], 'hand2': [round(w2[0]), round(w2[1])], 'angle': round(ang), 'hip': [round(hip[0]), round(hip[1])]}
        if gun:
            m = muzzle_of(frames[n], s2, raw)
            if m: a['muzzle'] = m
        out.append(a)
    return out


def strip(frames, previous_path=None):
    s = Image.new('RGBA', (FW * len(frames), FH), (0, 0, 0, 0))
    for i, f in enumerate(frames): s.paste(f, (i * FW, 0))
    if previous_path and os.path.isfile(previous_path):
        previous = Image.open(previous_path).convert('RGBA')
        if previous.size == s.size and previous.tobytes() == s.tobytes():
            return open(previous_path, 'rb').read()
    b = io.BytesIO(); s.save(b, 'PNG', optimize=True); return b.getvalue()


def defs():
    rows = doc_rows(); out = []
    for k, (grp, desc) in rows.items():
        out.append(dict(key=k, src=k, group=GROUPS.get(grp, grp), label=NAMES.get(k) or short(desc), desc=desc,
                        fps=FPS.get(k, 6 if k in LOOPS else 10), loop=k in LOOPS, hits=SHOTS.get(k, []) + MELEE.get(k, []),
                        shots=SHOTS.get(k, []), adv=0, base=erig.CLIPS[k][2] if k in erig.CLIPS else 'GPT'))
    gpt = {'undress': 'undress', 'showerturn': 'showerturn', 'shower': 'shower', 'bath': 'bath'}
    for k in gpt:
        out.append(dict(key=k, src=k, group=GROUPS['5-10'], label=NAMES[k], desc='GPT 그림(의뢰서_에일린_씻기_GPT.md)', fps=6 if k in LOOPS else 8,
                        loop=k in LOOPS, hits=[], shots=[], adv=0, base='GPT'))
    return out


def processed(src):
    fr = frames_of(src)
    idx = list(range(len(fr)))
    if src in erig.TAIL and len(idx) > 3: idx = idx[:-1]
    return [strip_fx(fr[i], src, i) for i in idx]


def main():
    manifest = {'frameW': FW, 'frameH': FH, 'foot': FOOT, 'anchor': ANCHOR, 'clips': {}}
    strips, missing = {}, []
    final = os.path.join(SRC, 'final'); os.makedirs(final, exist_ok=True)
    for d in defs():
        k = d['key']
        fr = frames_of(d['src'])
        if not fr: missing.append(k); continue
        idx = list(range(len(fr)))
        if k in erig.TAIL and len(idx) > 3: idx = idx[:-1]
        fr = [strip_fx(fr[i], d['src'], i) for i in idx]
        if eileen_fixes: fr, idx = eileen_fixes.apply(k, fr, idx, processed)
        if k == 'precise':
            # Exact PixelLab edits, original raw clips preserved. The Pixen full
            # redraw and rejected transition candidates are never selected here.
            exact = os.path.join(SRC, 'resume', 'live-20261022', 'precise-edit')
            fr[1] = strip_fx(Image.open(os.path.join(exact, 'exact-result.png')).convert('RGBA'), k, 1)
            fr[2] = Image.open(os.path.join(exact, 'exact-02.png')).convert('RGBA')
        transition_anchors = None
        if k == 'transition':
            import resume_transition
            transition_anchors = anchors(d['src'], idx, fr)
            fr, transition_anchors = resume_transition.apply(fr, transition_anchors)
        anchor_frames = fr
        fr, grounding_offsets = resume_grounding.apply(k, fr)
        data = strip(fr, os.path.join(final, k + '.png'))
        strips[k] = base64.b64encode(data).decode()
        open(os.path.join(final, k + '.png'), 'wb').write(data)
        c = {x: d[x] for x in ('label', 'desc', 'group', 'fps', 'loop', 'hits', 'shots', 'adv', 'base')} | {'frames': len(fr), 'bytes': len(data)}
        if k in ('undress', 'showerturn', 'shower', 'bath'):
            c['provenance'] = 'received-gpt-existing'
            c['visualApproval'] = 'pending'
        if k == 'precise':
            c['provenance'] = 'pixellab-exact-pixel-edit-20261022'
            c['editedFrames'] = [1, 2]
            c['editedPixelCounts'] = [19, 18]
            c['visualApproval'] = 'pending'
        if k == 'shower':
            c['loopStart'] = 2  # 0~1 머리끈 풀기는 첫 회만, 의뢰서의 2~5장 반복
        if k == 'transition':
            c['fps'] = 20
            c['provenance'] = 'pixellab-rig-plus-exact-rifle-repair-20261022'
            c['visualApproval'] = 'pending'
            c['reviewNote'] = 'six-frame rifle sling prefix; existing five-frame pistol draw suffix preserved'
        anc = transition_anchors if k == 'transition' else anchors(d['src'], idx, anchor_frames)
        anc = resume_grounding.shift_anchors(anc, grounding_offsets)
        if any(grounding_offsets):
            c['groundingOffsetsY'] = grounding_offsets
            c['visualApproval'] = 'pending'
        if anc:
            c['anchors'] = anc
            if k in ADVK: c['adv'] = anc[-1]['hip'][0] - anc[0]['hip'][0]
        manifest['clips'][k] = c
    json.dump(manifest, open(os.path.join(final, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    hands = {k: [[a['hand'][0], a['hand'][1], (a['angle'] + 90) % 360] for a in v['anchors']] for k, v in manifest['clips'].items() if v.get('anchors')}
    json.dump(hands, open(os.path.join(final, 'hands.json'), 'w'), separators=(',', ':'))
    manifest['missing'] = missing
    cut = base64.b64encode(open(os.path.join(SRC, 'base', 'H.png'), 'rb').read()).decode()
    tpl = open(os.path.join(ROOT, 'tools', 'eileen_full_template.html'), encoding='utf-8').read()
    html = (tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips))
            .replace('__BG__', base64.b64encode(open(BG, 'rb').read()).decode()).replace('__CUTIN__', cut))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(html)
    print('wrote', OUT, len(html) // 1024, 'KB', 'clips', len(strips), 'missing', missing)


if __name__ == '__main__':
    main()
