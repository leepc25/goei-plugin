"""망상홈쇼핑 컷 A 가림 판 만들기 (2026-11-12).
사용자: 「손이 전시판 파고드는」 「가림을 대충 따서 그래」 → 곧은 가로 줄(over 297) 대신 배경 판의 진열대 윤곽 그대로 가린다.
game-src/homeshop/a_plate.webp 의 점을 그대로 떠서 a_over.webp(같은 크기, 가리는 곳만 불투명)를 만든다. 그림은 한 점도 고치지 않는다.
쓰기: python3 -I tools/homeshop/over_mask.py   (build_sheets.py 가 끝에서 부른다)

윤곽을 판의 점에서 읽는 법 (docs/가림_따기_지침.md: 어림 좌표 금지):
 1. 상판 뒤 모서리 = 판을 가로지르는 어두운 윤곽선 한 줄(BACK). 그 줄부터 진열대다 (옛 over 는 한 줄 아래라 윤곽선을 몸이 덮었다).
 2. 상판 앞 모서리 = 그 아래 가운데 진열대의 어두운 윤곽선 한 줄(FRONT). 회전판 밑에서 아래로 내려가며 처음 만나는 긴 어두운 줄.
 3. 진행자 몸통은 진열대 뒤에 서 있으니 뒤 모서리부터 다 가린다.
    진열대 위로 뻗은 팔·손은 상판 윗면(뒤 모서리~앞 모서리 사이)과 회전판 앞에 있으니 가리지 않고, 앞면(앞 모서리부터)만 가린다.
 4. 몸통과 팔을 가르는 자리(SPLIT)는 모든 동작 장에서 잰다: 뒤 모서리 아래 줄에서 몸통 열 묶음의 오른쪽 끝과 팔 열 묶음의 왼쪽 끝 사이
    빈 열의 한가운데. 그 열에는 어느 장에도 진행자 점이 없어야 한다(없으면 멈춘다 — 새 동작이 어기면 여기서 걸린다).
"""
import json, os, sys
from PIL import Image

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'game-src', 'homeshop')
NAME = 'a_over.webp'


def dark(p):
    return p[0] + p[1] + p[2] < 150


def measure(meta=None):
    """판과 동작 장에서 뒤 모서리·앞 모서리·가르는 열을 잰다 → (back, front, (xa, xb), split, 몸통 끝, 팔 시작)"""
    meta = meta or json.load(open(os.path.join(D, 'homeshop.json'), encoding='utf8'))
    a = meta['cuts']['A']
    plate = Image.open(os.path.join(D, a['plate'])).convert('RGB')
    W, H = plate.size
    px = plate.load()
    # 1. 뒤 모서리: 아래 절반에서 가장 위에 있는, 판 너비의 80% 넘게 어두운 줄 (회전판이 걸친 열만 빠진다)
    back = next(y for y in range(H // 2, H) if sum(dark(px[x, y]) for x in range(W)) > W * 0.8)
    # 2. 앞 모서리: 뒤 모서리 아래에서 처음 만나는 그런 줄. 가운데 진열대가 차지하는 열(xa~xb) = 그 줄에서 한가운데를 지나는 어두운 묶음
    front = next(y for y in range(back + 2, H) if sum(dark(px[x, y]) for x in range(W)) > W * 0.8)
    xa = xb = W // 2
    while xa > 0 and dark(px[xa - 1, front]): xa -= 1
    while xb < W - 1 and dark(px[xb + 1, front]): xb += 1
    # 4. 몸통·팔 가르기: 모든 장에서 뒤 모서리부터 아래 줄의 열 묶음을 본다
    box = meta['box']
    torso, arm = 0, W
    used = [False] * W
    sheets = [(a['host'], 1)] + [(c['file'], c['frames']) for c in a['clips']]
    for file, n in sheets:
        im = Image.open(os.path.join(D, file)).convert('RGBA')
        al = im.getchannel('A').load()
        for i in range(n):
            cols = []
            for sx in range(box):
                x = a['x'] + sx
                if not 0 <= x < W: continue
                if any(al[i * box + sx, y - a['y']] for y in range(back, min(H, a['y'] + box))):
                    cols.append(x)
                    used[x] = True
            if not cols: continue
            # 첫 묶음 = 몸통, 그 뒤 묶음 = 팔·손
            end = cols[0]
            for x in cols[1:]:
                if x != end + 1: break
                end = x
            torso = max(torso, end)
            rest = [x for x in cols if x > end]
            if rest: arm = min(arm, rest[0])
    assert torso + 8 < arm, f'몸통({torso})과 팔({arm}) 사이가 붙었다 — 열로 가를 수 없다. 가림 규칙을 다시 정해야 한다'
    split = (torso + arm + 1) // 2
    assert not any(used[torso + 1:arm]), '가르는 틈에 진행자 점이 있다'
    assert xa < split < xb, '가르는 열이 가운데 진열대 밖이다'
    return back, front, (xa, xb), split, torso, arm


def build():
    meta = json.load(open(os.path.join(D, 'homeshop.json'), encoding='utf8'))
    a = meta['cuts']['A']
    back, front, (xa, xb), split, torso, arm = measure(meta)
    plate = Image.open(os.path.join(D, a['plate'])).convert('RGBA')
    W, H = plate.size
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    src, dst = plate.load(), out.load()
    for x in range(W):
        # 몸통 쪽(가르는 열 왼쪽)과 가운데 진열대 밖(옆 날개)은 뒤 모서리부터, 팔이 뻗는 쪽 상판은 앞 모서리부터
        top = front if split <= x <= xb else back
        for y in range(top, H):
            dst[x, y] = src[x, y]
    out.save(os.path.join(D, NAME), 'WEBP', lossless=True, quality=100, method=6, exact=True)
    # 되읽어 판과 한 점도 다르지 않은지 본다
    chk = Image.open(os.path.join(D, NAME)).convert('RGBA').load()
    for x in range(W):
        for y in range(H):
            p = chk[x, y]
            assert p[3] in (0, 255) and (p[3] == 0 or p == src[x, y]), (x, y)
    print(f'{NAME}: 뒤 모서리 y={back}, 앞 모서리 y={front} (x {xa}~{xb}), 몸통 끝 x={torso}, 팔 시작 x={arm}, 가르는 열 x={split}')
    return NAME


if __name__ == '__main__':
    build()
