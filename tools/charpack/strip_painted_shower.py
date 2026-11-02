"""캐릭터 팩 샤워 시트에 그려진 샤워기 헤드·공중 물줄기 지우기(사용자 2026-11-01 17:10 「캐릭터 찐빠, 코드로 지워야」).
방법: 회색(헤드)·하늘색(물) 픽셀을 빼고 남는 가장 큰 덩어리 = 몸. 몸(1px 넓힘) 밖의 회색·하늘색 = 지움(투명).
몸 안쪽 하늘색(머리카락·피부 위 물줄기)은 --inpaint 를 줄 때만 양옆 몸 픽셀로 메운다.
사용: python3 tools/charpack/strip_painted_shower.py 1.2 SH_D [--inpaint] [--frames 1-6] → 원본은 tools/charpack/orig/ 에 남기고 덮어쓴다. char.json top 다시 계산."""
import json, sys, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
cid, anim = sys.argv[1], sys.argv[2]
inpaint = '--inpaint' in sys.argv
frames = None
if '--frames' in sys.argv:
    s, e = sys.argv[sys.argv.index('--frames') + 1].split('-'); frames = range(int(s), int(e) + 1)
d = f'game-pack/char-{cid}/'; cj = json.load(open(d + 'char.json')); a = cj['A'][anim]
p = d + anim + '.webp'; os.makedirs('tools/charpack/orig', exist_ok=True); orig = f'tools/charpack/orig/char-{cid}_{anim}.webp'   # 원본 보관(팩 밖)
if not os.path.exists(orig): shutil.copy(p, orig)
sh = np.array(Image.open(orig).convert('RGBA'))
def masks(fr):
    r, g, b, al = [fr[..., i].astype(int) for i in range(4)]
    on = al > 0
    gray = on & (abs(r - g) < 26) & (abs(g - b) < 26) & (r > 60) & (r < 240)
    blue = on & (b > r + 40) & (b > 140) & (g > 110)
    white = on & (r > 195) & (g > 210) & (b > 220) & (b >= r - 5)          # 물줄기 하이라이트(흰 점): 하늘색 옆에 붙은 것만
    blue = blue | (white & ndimage.binary_dilation(blue, iterations=2))
    # 머리카락 속 옅은 물 점: 푸른 기운이 있고 양옆보다 확 밝은 픽셀(1~2px)
    lum = (r + g + b) / 3
    left = np.roll(lum, 1, axis=1); right = np.roll(lum, -1, axis=1)
    pale = on & (b > r + 12) & (b > 120) & (lum > np.minimum(left, right) + 35)
    blue = blue | pale
    return on, gray, blue
removed = 0
for fi in (frames if frames is not None else range(a['n'])):
    x0 = fi * a['cw']; fr = sh[:a['ch'], x0:x0 + a['cw']]
    on, gray, blue = masks(fr)
    body0 = on & ~gray & ~blue
    lab, nc = ndimage.label(body0, structure=np.ones((3, 3)))
    if nc == 0: continue
    sizes = ndimage.sum(body0, lab, range(1, nc + 1)); body = lab == (int(np.argmax(sizes)) + 1)
    bodyd = ndimage.binary_dilation(body, iterations=1)
    kill = on & ~bodyd   # 몸에 안 붙은 것(헤드 윤곽·공중 물줄기)은 색과 상관없이 지움
    fr[kill] = 0; removed += int(kill.sum())
    if inpaint:
        fix = blue & bodyd
        ys, xs = np.nonzero(fix)
        for y, x in zip(ys, xs):
            row = fr[y]; cand = []
            for dx in (-1, 1, -2, 2, -3, 3):
                xx = x + dx
                if 0 <= xx < fr.shape[1] and body[y, xx] and not blue[y, xx]: cand.append(row[xx]); 
                if len(cand) >= 2: break
            if cand: fr[y, x] = np.mean(np.array(cand), axis=0).astype(np.uint8)
    # top 다시 계산
    ys = np.nonzero(fr[..., 3] > 0)[0]
    if len(ys): a['top'][fi] = int(ys.min()) + a['oy']   # top 은 전체 칸(w×h) 기준
Image.fromarray(sh).save(p, lossless=True, quality=100)
json.dump(cj, open(d + 'char.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('removed px', removed, 'top', a['top'])
