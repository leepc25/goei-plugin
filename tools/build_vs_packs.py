# 기다리는 동안 대전(11-08 사용자) 자료 만들기: game-pack/ 원본에서 대전에 쓰는 것만 골라 dist/vs-src/<팩>/ 에 둔다.
#   vs-common  : 이펙트(action-fx 에서 의자 빼고) + 대전 명단(roster.json) + 얼굴판(faces.webp/faces.json) + 전신판(bodies.webp)
#   vs-<번호>  : 인물 한 명의 전투 줄만 (char.json 의 A 도 그 줄만)
# 얼굴판이 있어야 고르기 창이 인물 팩을 하나도 받지 않고 얼굴을 다 보여 줄 수 있다.
# 쓰기: python3 tools/build_vs_packs.py  (scripts/build.mjs 가 dist/vs-src → dist/vs/*.pack 으로 묶는다)
import json, math, os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-pack')
OUT = os.path.join(ROOT, 'dist', 'vs-src')

# 전투 줄 (docs/동작_활용표.md 「게임(전투)」): 누운 채 맞기 43·사망 44/45·옆으로 쓰러짐 169 포함 (11-08 사용자 확인)
COMBAT = set('1 3 3_0 4 5 5_1 7 9 10 11 12 13 14 15 16 16_1 17 18 18_1 18_2 18_3 19 20 21 '
             '22 22_1 23 24 25 36 37 37_1 38 38_1 39 41 42 42_1 43 44 45 169 W W_1'.split())
# 태그매치 대기 인물 동작·판 끝 반응 (11-08 사용자): 개인 대기 2·응대 28·손짓 29·화내기 32·기뻐하기 35·통화 116·커피 142·기지개 143·팔굽혀펴기 144·흡연 145·폰 147·간식 157·구경 168
COMBAT |= set('2 28 29 32 35 116 142 143 144 145 147 157 168'.split())
FACE = 64
# 대전 배경으로 쓰는 필드 장면 (화장실·샤워실 빼고). 이름표는 src/ui/versus.ts VS_BG_NAMES
VS_BGS = ['street', 'f3', 'b2', 'training', 'clinic', 'by_street', 'by_f13', 'sdra_street',
          'jr_entry']   # 관리국 2층·지하 1층·종합대응팀·협회 지하 1층(특색 없음), 휴게실·연구실·백일몽 로비·의무실·관리국 로비(무대 짧음)도 뺌 (11-08 사용자)   # 중림 지하 셋(jr_b1·jr_alley·jr_b2)은 뺌 (11-08 사용자: 이음새 기둥이 3화면 무대에서 시야를 가린다)
# 무대 (11-08 사용자): 도트 1.4배에서 한 화면 = 월드 914. 무대는 2.5~3화면 → 월드 최대 2743 (배경이 짧으면 배경 전체)
VS_LEN = 2743
# 장면마다 손본 값 (사용자에게 보인 미리보기 /mnt/project-files/vs-design/v10 그대로):
#   cx 구간 가운데(그림 x), yF 싸우는 줄(그림 y), yB 대기 줄, bdx 대기 캐릭터 무대 끝에서 떨어진 거리(화면 px, 2배 기준)
#   중림은 가게 한 칸 가운데 (11-08 사용자: 이음새 기둥이 앞을 가려야 이어진다)
VS_CFG = {'street': {'right': 0.91, 'leftmin': 0.068}, 'f3': {'left': 0}, 'clinic': {'right': 1.0, 'yF': 760, 'benchD': [[220, 420], [120, 300]], 'benchBack': (0,)}, 'jr_b1': {'cx': 4424}, 'jr_alley': {'cx': 3160}, 'jr_b2': {'cx': 1896},
          'infirmary': {'yF': 700, 'yB': 600, 'cx': 676}, 'training': {'cx': 1350, 'yF': 770}, 'office': {'yF': 826}}
CHAR_K = 1.28   # src/game/action/art/charPacks.ts CHAR_K

def persp_of(y, lane, far, grow, sizes):
    if sizes:
        if y <= sizes[0][0]: return sizes[0][1]
        for i in range(1, len(sizes)):
            if y <= sizes[i][0]:
                y0, k0 = sizes[i - 1]; y1, k1 = sizes[i]; return k0 + (k1 - k0) * (y - y0) / (y1 - y0)
        return sizes[-1][1]
    a = lane[0]; b = grow if grow and grow > a else lane[1]
    t = max(0, min(1, (y - a) / (b - a))) if b > a else 1
    return far + (1 - far) * t

def _inpoly(x, y, P):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        xi, yi = P[i]; xj, yj = P[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def fit_stage(v, c):
    """싸우는 줄·무대 구간·대기 자리를 필드 바닥(floor)·막힘(holes) 자료로 잡는다 (11-08 사용자: 배경 물건 무시하고 세우지 말 것).
    싸우는 줄은 무대 전체 폭에서 발(좌우 ±14px)이 바닥 위·막힘 밖이어야 한다. 가장 긴 무대(최대 3화면)가 나오는 줄을 고르고, 같으면 앞줄에 가까운 쪽"""
    fl = v['floor']; fl = json.loads(fl) if isinstance(fl, str) else fl
    holes = [json.loads(h) if isinstance(h, str) else h for h in v['holes']]
    # 장면 물건(탁자·볼라드·침대 등, 기둥 9999 빼고): 앞 바닥선(sortY) 바로 뒤 50px 줄은 물건이 서 있는 자리로 본다
    things = [(o['x'], o['x'] + o['w'], o['sortY']) for o in v.get('objects') or [] if 0 < o.get('sortY', 0) < 9000]
    def ok(x, y):
        for d in (-14, 14):
            if not _inpoly(x + d, y, fl) or any(_inpoly(x + d, y, h) for h in holes): return False
            if any(a <= x + d <= b and s - 50 <= y <= s + 6 for a, b, s in things): return False
        return True
    L0, L1 = v['lane']; dotK = v.get('dotK', 1.4292)
    best = None
    ys = [c['yF']] if 'yF' in c else sorted({round(L1 - f * (L1 - L0)) for f in [i / 100 for i in range(8, 56, 2)]})
    for yF in ys:
        s = CHAR_K / (dotK * persp(yF, v))
        xs = list(range(0, v['w'] + 1, 4))
        run, a = None, None
        for x in xs + [None]:
            good = x is not None and ok(x, yF)
            if good and a is None: a = x
            if not good and a is not None:
                b = xs[xs.index(x) - 1] if x is not None else xs[-1]
                if run is None or b - a > run[1] - run[0]: run = (a, b)
                a = None
        if not run: continue
        score = min((run[1] - run[0]) * s, VS_LEN)
        if best is None or score > best[0] + 40: best = (score, yF, s, run)
    if not best: return None
    _, yF, s, (a, b) = best
    seg = min(b - a, VS_LEN / s)
    cx = min(max(c.get('cx', (a + b) / 2), a + seg / 2), b - seg / 2)
    x0, x1 = cx - seg / 2, cx + seg / 2
    # 사용자 지정 (11-08): left=그림 폭 비율 지점부터 오른쪽으로, right=그 지점부터 왼쪽으로 잡고 반대쪽을 자름
    if 'left' in c:
        x0 = c['left'] * v['w']; x1 = min(v['w'], x0 + VS_LEN / s)
    elif 'right' in c:
        x1 = c['right'] * v['w']; x0 = max(c.get('leftmin', 0) * v['w'], x1 - VS_LEN / s)
    pF = persp(yF, v)
    # 대기 자리: 무대 양 끝에서 안쪽으로 220·420(월드), 뒤쪽 줄에서 바닥 위인 가장 뒤 자리 (안 되면 조금씩 앞으로)
    spots = [[], []]
    for side in (0, 1):
        for d in c.get('benchD', [[220, 420]] * 2)[side]:  # 끝에서 떨어뜨리고 둘 사이도 띄움 (11-08 사용자). 장면마다 따로 줄 수 있음
            got = None
            for dd in range(d, d + 101, 10) if 'benchD' not in c else [d]:  # 바닥이 아니면 안쪽으로 조금씩
                xw = dd if side == 0 else (x1 - x0) * s - dd
                xi = x0 + xw / s
                for f in ((0.0, 0.05) if side in c.get('benchBack', ()) else ()) + (0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5):
                    y = L0 + f * (L1 - L0)
                    if y < c.get('benchY', 0): continue  # 사용자 지정: 이보다 뒤에는 세우지 않음(필드 물건 자료 없는 장면)
                    if y < yF - 10 and ok(xi, y):
                        got = {'x': round(xw), 'dy': round((y - yF) * s), 'k': round(persp(y, v) / pF, 3)}; break
                if got: break
            spots[side].append(got or {'x': round(d if side == 0 else (x1 - x0) * s - d), 'dy': -150, 'k': 0.72, 'off': True})
    return yF, s, x0, x1, spots

def persp(y, v):
    """engine/view.ts perspFlat 와 같은 계산 (필드 원근)"""
    lane, far, grow, sizes = v['lane'], v.get('far') or 0.85, v.get('grow') or 0, v.get('sizes') or []
    p = persp_of(y, lane, far, grow, sizes)
    pb, pf = persp_of(lane[0], lane, far, grow, sizes), persp_of(lane[1], lane, far, grow, sizes)
    if not pb > 0 or pf / pb <= 1.4: return p
    pm = persp_of((lane[0] + lane[1]) / 2, lane, far, grow, sizes)
    if p >= pm: return pm * (p / pm) ** (math.log(1.12) / math.log(pf / pm)) if pf > pm else p
    return pm * (p / pm) ** (math.log(0.8) / math.log(pb / pm)) if pb < pm else p

def mapedit_scenes():
    t = open(os.path.join(ROOT, 'src', 'game', 'action', 'hq', 'mapedit.gen.ts'), encoding='utf8').read()
    i = t.index('= {') + 2
    depth = 0
    for j in range(i, len(t)):
        if t[j] == '{': depth += 1
        elif t[j] == '}':
            depth -= 1
            if depth == 0: break
    return json.loads(t[i:j + 1])

def rows_of(cfg):
    keep = set(COMBAT)
    for v in (cfg.get('skills') or {}).values():
        if isinstance(v, dict):
            for f in ('anim', 'hold', 'release'):
                if v.get(f): keep.add(str(v[f]))
    for f in ('gun', 'kick'):
        keep.update(str(x) for x in (cfg.get(f) or []))
    return keep

def face_of(d, A, cfg):
    """charPacks.ts charFace 와 같은 자리: 몸 중심에서 보는 쪽으로 6도트, 머리 꼭대기 조금 아래부터"""
    rid = '31' if '31' in A else '1'
    m = A[rid]
    im = Image.open(os.path.join(d, m['file'])).convert('RGBA')
    fx0 = m['w'] / 2 + (m['cx'][0] if m['cx'] else 0) + (-6 if cfg.get('dir') in ('W', 'SW') else 6) - m['ox']
    top = (m['top'][0] if m['top'] else 14) - m['oy']
    x0, y0 = round(fx0 - FACE / 2), max(0, top + 2)
    out = Image.new('RGBA', (FACE, FACE))
    out.paste(im.crop((x0, y0, x0 + FACE, y0 + FACE)), (0, 0))
    if cfg.get('dir') in ('W', 'SW'): out = out.transpose(Image.FLIP_LEFT_RIGHT)   # 얼굴판은 모두 오른쪽 보기
    return out

def body_of(d, A, cfg):
    m = A['1']
    im = Image.open(os.path.join(d, m['file'])).convert('RGBA').crop((0, 0, m['cw'], m['ch']))
    if cfg.get('dir') in ('W', 'SW'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im, m

def main():
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    roster = json.load(open(os.path.join(SRC, 'action-fx', 'roster.json'), encoding='utf8'))
    com = os.path.join(OUT, 'vs-common')
    os.makedirs(com)
    for f in os.listdir(os.path.join(SRC, 'action-fx')):
        if f.startswith('chair') or f in ('pack.json', 'roster.json'): continue
        shutil.copy(os.path.join(SRC, 'action-fx', f), com)
    # 아나운서 목소리 (11-08 사용자: MR. HAPPY 오락실 처리 + DRAGON 의 K.O.), 출처는 game-pack/vs-voice/LICENSE.txt
    vdir = os.path.join(SRC, 'vs-voice')
    for f in os.listdir(vdir):
        if f.endswith('.ogg'): shutil.copy(os.path.join(vdir, f), os.path.join(com, 'voice-' + f))
    shutil.copy(os.path.join(vdir, 'LICENSE.txt'), os.path.join(com, 'voice-LICENSE.txt'))
    # 배경음악·타격음 (11-08 사용자 선택), 목록 sound.json, 출처 game-pack/vs-sound/LICENSE.txt
    sdir = os.path.join(SRC, 'vs-sound')
    for f in os.listdir(sdir):
        if f.endswith('.ogg') or f == 'sound.json': shutil.copy(os.path.join(sdir, f), com)
    shutil.copy(os.path.join(sdir, 'LICENSE.txt'), os.path.join(com, 'sound-LICENSE.txt'))
    # 배경 (11-08 사용자 「기존에 뽑아 둔 배경을 설정에서 골라 켜고 끄기」): 필드 장면 그림(jr-field/me_*) 그대로 + 장면 값(dotK·lane·크기) bg.json
    sc = mapedit_scenes()
    bgs = {}
    for sid in VS_BGS:
        v = sc.get(sid)
        src = v and os.path.join(SRC, 'jr-field', v['file'] + '.webp')
        if not v or not os.path.exists(src): continue
        shutil.copy(src, os.path.join(com, f'bg-{sid}.webp'))
        # 장면 물건(기둥·상자 등, 필드에서 따로 그리는 조각): 앞줄보다 앞(sortY > 앞줄)이면 사람 앞에 그린다 (11-08 사용자: 중림 기둥으로 가려야 이어진다)
        c = VS_CFG.get(sid, {})
        fit = fit_stage(v, c)
        if not fit: print('대전 배경 뺌 (설 자리 없음):', sid); continue
        yF, s, x0, x1, spots = fit
        # 장면 물건(기둥·상자 등): 깊이선(sortY)이 싸우는 줄보다 앞이면 사람 앞에 그린다 (11-08 사용자: 중림 기둥으로 가려야 이어진다)
        objs = []
        for o in v.get('objects') or []:
            osrc = os.path.join(SRC, 'jr-field', o['file'] + '.webp')
            if not os.path.exists(osrc): continue
            shutil.copy(osrc, os.path.join(com, f"bgo-{o['file']}.webp"))
            objs.append({'file': o['file'], 'x': o['x'], 'y': o['y'], 'w': o['w'], 'h': o['h'], 'front': o.get('sortY', 0) > yF})
        # 무대 = 그림 x0~x1 (월드 0~len). 대기 캐릭터 자리 spots[편][번째] = 무대 x(월드)·뒤로 올라간 높이 dy(월드)·원근 배율 k
        bgs[sid] = {'w': v['w'], 'h': v['h'], 's': s, 'yF': yF, 'len': round((x1 - x0) * s), 'cut': (x0 + x1) / 2, 'bench': {'spots': spots}, 'objs': objs}
    json.dump(bgs, open(os.path.join(com, 'bg.json'), 'w'))
    json.dump({'id': 'vs-common', 'required': False}, open(os.path.join(com, 'pack.json'), 'w'))
    faces, bodies, rows = [], [], []
    total = 0
    for r in roster:
        d = os.path.join(SRC, r['pack'])
        if not os.path.isfile(os.path.join(d, 'char.json')): continue
        data = json.load(open(os.path.join(d, 'char.json'), encoding='utf8'))
        cfg, A = data['cfg'], data['A']
        keep = rows_of(cfg)
        pid = 'vs-' + r['num']
        o = os.path.join(OUT, pid)
        os.makedirs(o)
        A2 = {k: v for k, v in A.items() if k in keep and os.path.isfile(os.path.join(d, v['file']))}
        kb = 0
        for v in A2.values():
            shutil.copy(os.path.join(d, v['file']), o)
            kb += os.path.getsize(os.path.join(d, v['file']))
        json.dump({'cfg': cfg, 'A': A2}, open(os.path.join(o, 'char.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
        json.dump({'id': pid, 'required': False}, open(os.path.join(o, 'pack.json'), 'w'))
        total += kb
        faces.append(face_of(d, A, cfg))
        b, m = body_of(d, A, cfg)
        bodies.append(b)
        rows.append({**r, 'pack': pid, 'kb': round(kb / 1024), 'face': len(faces) - 1})
    # 얼굴판: 16칸씩 줄
    cols = 16
    sheet = Image.new('RGBA', (cols * FACE, ((len(faces) + cols - 1) // cols) * FACE))
    for i, f in enumerate(faces): sheet.paste(f, ((i % cols) * FACE, (i // cols) * FACE))
    sheet.save(os.path.join(com, 'faces.webp'), lossless=True)
    # 전신판: 가로로 이어 붙임 (칸마다 x·w·h 를 명단에)
    bw = sum(b.width for b in bodies); bh = max(b.height for b in bodies)
    bs = Image.new('RGBA', (bw, bh)); x = 0
    for row, b in zip(rows, bodies):
        bs.paste(b, (x, bh - b.height)); row['body'] = [x, bh - b.height, b.width, b.height]; x += b.width
    bs.save(os.path.join(com, 'bodies.webp'), lossless=True)
    json.dump({'face': FACE, 'cols': cols, 'chars': rows}, open(os.path.join(com, 'roster.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    named = [r for r in rows if not r['npc']]
    print(f'인물 {len(rows)}명(이름 있는 {len(named)}) 전투 줄 {total / 1e6:.1f}MB, 공용 {sum(os.path.getsize(os.path.join(com, f)) for f in os.listdir(com)) / 1e6:.1f}MB')

if __name__ == '__main__':
    sys.exit(main())
