# 기다리는 동안 대전(11-08 사용자) 자료 만들기: game-pack/ 원본에서 대전에 쓰는 것만 골라 dist/vs-src/<팩>/ 에 둔다.
#   vs-common  : 이펙트(action-fx 에서 의자 빼고) + 대전 명단(roster.json) + 얼굴판(faces.webp/faces.json) + 전신판(bodies.webp)
#   vs-<번호>  : 인물 한 명의 전투 줄만 (char.json 의 A 도 그 줄만)
# 얼굴판이 있어야 고르기 창이 인물 팩을 하나도 받지 않고 얼굴을 다 보여 줄 수 있다.
# 쓰기: python3 tools/build_vs_packs.py  (scripts/build.mjs 가 dist/vs-src → dist/vs/*.pack 으로 묶는다)
import json, os, shutil, sys
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
