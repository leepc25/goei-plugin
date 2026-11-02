"""팩 전체 SH_D·SH_E 그려진 샤워기 헤드·물줄기 지우기 (사용자 2026-11-02 「그거 왜 안했어」).
v1(회색 판정으로 몸 찾기)은 흰 머리·옅은 피부를 물로 보고 몸을 지웠다 → 폐기. 지금 규칙(눈으로 전/후 그림 확인하며 다듬음):
 몸 = 물 픽셀을 뺀 알파 기준 가장 큰 덩어리.
 (1) 몸에서 떨어진 조각 중 피부색이 아닌 것(샤워기 헤드·공중 물줄기·물방울)은 지움. 몸에 붙지 않은 물 픽셀도 지움.
 (2) 밝은 회색 덩어리 중 이마(피부 맨 위)보다 위에만 있는 것 = 머리카락에 걸친 샤워기 헤드 → 지움(흰 머리는 얼굴 옆까지 내려오므로 안 걸림).
     GRAY_HEAD_ON_HAIR 에 적은 인물(1.8, 분홍 머리)은 피부에 안 붙은 회색 덩어리도 지움.
 (3) 몸 위의 하늘색·파란 물 픽셀은 양옆 피부색으로 메움. 단 작고 둥글며(높이≤3) 몸 가장자리에 안 닿은 덩어리는 눈·장신구로 보고 남김.
 (4) 피부 위 흰·회색 가는 세로 물줄기(폭≤2·높이≥3, 양옆 피부) 메움.
 (5) 어두운 물줄기 그림자(폭≤4·높이≥8·세로로 길고 몸 가장자리에 안 닿고 양옆이 피부/물) 메움. 근육선·윤곽선은 가장자리·모양 조건으로 뺀다.
 원본은 tools/charpack/orig/ 에(이미 있으면 그것을 원본으로). char.json top 다시 계산. 바뀐 장은 <out>/ 에 전/후 2배 그림.
사용: python3 tools/charpack/strip_painted_shower_all.py <out폴더> [cid ...]"""
import json, sys, os, shutil, glob
import numpy as np
from PIL import Image
from scipy import ndimage
out = sys.argv[1]; only = set(sys.argv[2:]); os.makedirs(out, exist_ok=True)
S8 = np.ones((3, 3))
GRAY_HEAD_ON_HAIR = {'1.8'}   # 머리카락이 회색이 아닌데 회색 헤드·물줄기가 머리카락에 걸친 인물(눈으로 확인한 것만)

def masks(fr):
    r, g, b, al = [fr[..., i].astype(int) for i in range(4)]
    on = al > 0
    blue = on & (b > r + 40) & (b > 140) & (g > 110)
    blue |= on & (b > 120) & (r < b - 60) & (b > g + 20)          # 진한 파란 물방울(1.9)
    white = on & (r > 195) & (g > 210) & (b > 220) & (b >= r - 5)
    blue = blue | (white & ndimage.binary_dilation(blue, iterations=2))
    lum = (r + g + b) / 3
    pale = on & (b > r + 12) & (b > 120) & (lum > np.minimum(np.roll(lum, 1, 1), np.roll(lum, -1, 1)) + 35)   # 머리카락 속 옅은 물 점
    skin = on & (r > g + 15) & (r > b + 25)
    water = blue | pale
    bright = on & (lum > 150) & ~skin & ~water                       # 피부 위 흰·회색 물줄기 후보
    gray = on & (abs(r - g) < 26) & (abs(g - b) < 26) & (lum > 120) & (lum < 245) & ~skin   # 밝은 회색: 샤워기 헤드
    dark = on & ~skin & ((lum < 90) | ((abs(r - g) < 30) & (abs(g - b) < 30) & (lum < 150)))   # 어두운·중간 회색 물줄기 그림자 후보(6.9: 128,120,120)
    return on, water, skin, bright, gray, dark

def sides_ok(comp, side_ok, W, reach):
    ys, xs = np.nonzero(comp); ok = 0
    for y, x in zip(ys, xs):
        l = any(0 <= x - dx < W and side_ok[y, x - dx] and not comp[y, x - dx] for dx in range(1, reach + 1))
        rr = any(x + dx < W and side_ok[y, x + dx] and not comp[y, x + dx] for dx in range(1, reach + 1))
        ok += l and rr
    return ok / len(ys)

def process(cid, anim):
    d = f'game-pack/char-{cid}/'; cj = json.load(open(d + 'char.json'))
    if anim not in cj['A']: return None
    a = cj['A'][anim]; p = d + anim + '.webp'
    if not os.path.exists(p): return None
    orig = f'tools/charpack/orig/char-{cid}_{anim}.webp'; os.makedirs('tools/charpack/orig', exist_ok=True)
    if not os.path.exists(orig): shutil.copy(p, orig)
    sh = np.array(Image.open(orig).convert('RGBA')); before = sh.copy()
    removed = filled = 0; touched = []
    for fi in range(a['n']):
        x0 = fi * a['cw']; fr = sh[:a['ch'], x0:x0 + a['cw']]; W = fr.shape[1]
        on, water, skin, bright, gray, dark = masks(fr)
        # (2) 회색 샤워기 헤드
        skin_top = int(np.nonzero(skin.any(axis=1))[0].min()) if skin.any() else 0
        if skin.any():
            near_skin = ndimage.binary_dilation(skin, iterations=2)
            gl, gn = ndimage.label(gray, structure=S8); gk = np.zeros_like(on)
            for k in range(1, gn + 1):
                comp = gl == k; n = int(comp.sum())
                if n < 15: continue
                if np.nonzero(comp)[0].max() <= skin_top + 4: gk |= comp
                elif cid in GRAY_HEAD_ON_HAIR and (comp & near_skin).sum() / n < 0.5: gk |= comp
            if gk.any(): fr[gk] = 0; on &= ~gk; water &= on; bright &= on; dark &= on; removed += int(gk.sum()); touched.append(fi)
        # (1) 몸 찾기는 물 픽셀을 뺀 알파로
        solid = on & ~water
        lab, nc = ndimage.label(solid, structure=S8)
        if nc == 0: continue
        sizes = ndimage.sum(solid, lab, range(1, nc + 1)); bk = int(np.argmax(sizes)); body = lab == bk + 1
        # 물줄기가 몸을 조각내므로(6.9: 몸통이 몸에서 빠져 물 자리가 구멍이 됐다) 3px 안에 붙은 단단한 조각을 몸에 합친다
        for _ in range(12):
            ids = np.unique(lab[ndimage.binary_dilation(body, iterations=3) & solid]); ids = ids[ids > 0]
            nb = np.isin(lab, ids)
            if nb.sum() == body.sum(): break
            body = nb
        water_on = water & ndimage.binary_dilation(body, iterations=3)      # 몸 위·몸 조각 사이의 물
        kill = np.zeros_like(on)
        for k in range(1, nc + 1):
            comp = lab == k
            if body[comp].any(): continue
            n = int(sizes[k - 1])
            if skin[comp].sum() / n > 0.3: continue          # 떨어진 손·발(6.44 손은 밝은 피부라 0.5로는 지워졌다)
            if n >= 100 and skin[comp].mean() >= 0.15 and np.nonzero(comp)[0].min() > skin_top + 10 and (comp & ndimage.binary_dilation(body, iterations=4)).any(): continue   # 몸 옆 큰 조각에 피부가 섞이고 머리 꼭대기보다 아래(6.44 손; 샤워기 헤드는 위)
            kill |= comp
        kill |= water & ~water_on
        if kill.any(): fr[kill] = 0; removed += int(kill.sum()); (fi in touched) or touched.append(fi)
        body = body | water_on
        # (3) 몸 위 물
        edge = body & ~ndimage.binary_erosion(body, iterations=2)
        fix = np.zeros_like(on)
        wl, wn = ndimage.label(water & body, structure=S8)
        for k in range(1, wn + 1):
            comp = wl == k; ys, xs = np.nonzero(comp); h = ys.max() - ys.min() + 1; w = xs.max() - xs.min() + 1
            if h <= 3 and w >= h and not (comp & edge).any(): continue   # 눈·장신구
            fix |= comp
        # (4) 피부 위 흰·회색 가는 세로 물줄기
        bl, bn = ndimage.label(bright & body, structure=S8)
        for k in range(1, bn + 1):
            comp = bl == k; ys, xs = np.nonzero(comp); h = ys.max() - ys.min() + 1; w = xs.max() - xs.min() + 1
            if h < 3 or w > 2: continue
            if sides_ok(comp, skin, W, 3) >= 0.7: fix |= comp
        # (5) 어두운 물줄기 그림자: 덩어리가 아니라 픽셀 단위 — 윤곽선과 이어져 있어 덩어리로는 못 잡는다.
        #     가로 run 폭≤4, 같은 열에서 세로로 6px 이상 이어지고, 몸 가장자리(2px) 밖, 양옆 6px 안에 피부/물이 있는 픽셀
        side_ok = skin | fix | water
        cand = dark & body & ~edge
        H = cand.shape[0]
        run = np.zeros_like(cand, dtype=int)                      # 가로 run 폭
        for y in range(H):
            row = cand[y]; x = 0
            while x < W:
                if row[x]:
                    x2 = x
                    while x2 < W and row[x2]: x2 += 1
                    run[y, x:x2] = x2 - x; x = x2
                else: x += 1
        thin = cand & (run <= 4)
        vlen = np.zeros_like(thin, dtype=int)                      # 열별 세로 연속 길이
        for x in range(W):
            col = thin[:, x]; y = 0
            while y < H:
                if col[y]:
                    y2 = y
                    while y2 < H and col[y2]: y2 += 1
                    vlen[y:y2, x] = y2 - y; y = y2
                else: y += 1
        strand = thin & (vlen >= 6)
        if strand.any():
            left = np.zeros_like(strand); right = np.zeros_like(strand)
            for dx in range(1, 7):
                left[:, dx:] |= side_ok[:, :-dx]; right[:, :-dx] |= side_ok[:, dx:]
            fix |= strand & left & right
        if fix.any():
            ys, xs = np.nonzero(fix)
            for y, x in zip(ys, xs):
                row = fr[y]; cand = []
                for dx in (-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6):
                    xx = x + dx
                    if 0 <= xx < W and body[y, xx] and skin[y, xx] and not fix[y, xx] and not water[y, xx]: cand.append(row[xx])
                    if len(cand) >= 2: break
                if cand: fr[y, x] = np.mean(np.array(cand), axis=0).astype(np.uint8); filled += 1
            (fi in touched) or touched.append(fi)
        ys = np.nonzero(fr[..., 3] > 0)[0]
        if len(ys): a['top'][fi] = int(ys.min()) + a['oy']
    if removed or filled:
        Image.fromarray(sh).save(p, lossless=True, quality=100)
        json.dump(cj, open(d + 'char.json', 'w'), ensure_ascii=False, separators=(',', ':'))
        cols = []
        for fi in sorted(touched):
            x0 = fi * a['cw']
            for src in (before, sh):
                fr = Image.fromarray(src[:a['ch'], x0:x0 + a['cw']]); bg = Image.new('RGBA', fr.size, (40, 40, 40, 255)); bg.alpha_composite(fr); cols.append(bg)
        Wt = sum(c.width for c in cols); o = Image.new('RGBA', (Wt, a['ch']), (40, 40, 40, 255)); x = 0
        for c in cols: o.paste(c, (x, 0)); x += c.width
        o.resize((Wt * 2, a['ch'] * 2), Image.NEAREST).save(f'{out}/{cid}_{anim}.png')
    return (cid, anim, removed, filled, sorted(touched))

report = []
for d in sorted(glob.glob('game-pack/char-*/')):
    cid = d.split('/')[1][5:]
    if only and cid not in only: continue
    for anim in ('SH_D', 'SH_E'):
        r = process(cid, anim)
        if r: report.append(r); print(*r, flush=True)
json.dump(report, open(f'{out}/report.json', 'w'), ensure_ascii=False)
print('done', sum(1 for r in report if r[2] or r[3]), 'sheets changed of', len(report))
