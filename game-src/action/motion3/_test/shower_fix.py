"""맨몸 피격 뽑은 뒤 코드 보정 (2026-10-31 사용자: 「쓰러지거나 일어날 때 발 위치가 아닌 허공에 쓰러지는 거, 이런 건 코드로 조정해」).
- 바닥 붙이기(H3·H4·H5): 장마다 몸 맨 아래 줄을 그 인물 바닥선(G 첫 장의 발 끝, 없으면 그 줄 첫 장)에 맞춰 위아래로 옮긴다.
- 이펙트 지우기(H1·H2·H3): 맞을 때 생기는 줄기(빨강·흰색 등, 그 인물 G 그림에 없는 색 덩어리)를 지운다 (10-31 사용자 지적: H2 이펙트).
원본은 샤워2_<줄>/_원본/ 에 그대로 두고(지우지 않음), 보정본을 그 자리(00.png…)에 쓴다. 여러 번 돌려도 _원본에서 다시 만든다.
사용: python3 _test/shower_fix.py <키> [줄…]   (줄 없으면 H1~H5)"""
import sys, shutil
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
GROUND = {"H3", "H4", "H5"}
DERED = {"H1", "H2", "H3"}


def bottom(a):
    ys = np.nonzero(a[..., 3] > 0)[0]
    return ys.max() if len(ys) else None


def floor_of(k, n):
    g = sorted((HERE / k / "샤워2_G").glob("[0-9][0-9].png"))
    src = g[0] if g else None
    if src is None:
        o = HERE / k / f"샤워2_{n}" / "_원본"
        fs = sorted(o.glob("[0-9][0-9].png")) or sorted((HERE / k / f"샤워2_{n}").glob("[0-9][0-9].png"))
        src = fs[0]
    return bottom(np.array(Image.open(src).convert("RGBA")))


def palette(k):   # 그 인물 G 그림에 쓰인 색(12단계로 묶음)
    s = set()
    for f in sorted((HERE / k / "샤워2_G").glob("[0-9][0-9].png")):
        a = np.array(Image.open(f).convert("RGBA")); m = a[..., 3] > 0
        s |= set(map(tuple, (a[m][:, :3] // 12).astype(int)))
    return s


def dered(a, P):
    """이펙트 지우기: G에 없는 색으로 된 큰 덩어리(40px 이상)와 그 뒤 떨어져 남은 작은 조각(30px 미만)을 지운다.
    G 팔레트가 없으면 진한 빨강만 지운다."""
    from scipy import ndimage
    al = a[..., 3] > 0
    if P:
        q = (a[..., :3] // 12).astype(int)
        key = q[..., 0] * 10000 + q[..., 1] * 100 + q[..., 2]
        pk = np.array([x * 10000 + y * 100 + z for x, y, z in P])
        off = al & ~np.isin(key, pk)
    else:
        r, g, b = [a[..., i].astype(int) for i in range(3)]
        off = al & (r > 170) & (g < 90) & (b < 90)
    lab, n = ndimage.label(off, np.ones((3, 3)))
    sz = ndimage.sum(off, lab, range(1, n + 1)) if n else []
    kill = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v >= 40])
    a = a.copy(); a[kill] = 0
    lab2, n2 = ndimage.label(a[..., 3] > 0, np.ones((3, 3)))
    if n2 > 1:
        sz2 = ndimage.sum(a[..., 3] > 0, lab2, range(1, n2 + 1))
        small = np.isin(lab2, [i + 1 for i, v in enumerate(sz2) if v < 30])
        a[small] = 0; kill |= small
    return a, int(kill.sum())


def shift(a, dy):
    if dy == 0: return a
    o = np.zeros_like(a)
    if dy > 0: o[dy:] = a[:-dy]
    else: o[:dy] = a[-dy:]
    return o


def fix(k, n):
    d = HERE / k / f"샤워2_{n}"
    if not any(d.glob("[0-9][0-9].png")): return f"{k} {n}: 없음"
    orig = d / "_원본"
    if not orig.exists():
        orig.mkdir()
        for f in d.glob("[0-9][0-9].png"): shutil.copy2(f, orig / f.name)
    fs = sorted(orig.glob("[0-9][0-9].png"))
    fl = floor_of(k, n) if n in GROUND else None
    out, moved, red = [], [], 0
    P = palette(k) if n in DERED else None
    for f in fs:
        a = np.array(Image.open(f).convert("RGBA"))
        if n in DERED: a, c = dered(a, P); red += c
        if fl is not None:
            b = bottom(a)
            if b is not None:
                dy = int(fl - b); a = shift(a, dy); moved.append(dy)
        Image.fromarray(a).save(d / f.name); out.append(Image.fromarray(a))
    # 시트·GIF 다시
    sys.path.insert(0, str(HERE.parent)); import m3
    m3.sheet(out, HERE / k / f"샤워2_{n}_sheet.png")
    gif = []
    for im in out:
        b = Image.new("RGBA", im.size, (60, 60, 70, 255)); b.alpha_composite(im); gif.append(b.convert("RGB"))
    gif[0].save(HERE / k / f"샤워2_{n}.gif", save_all=True, append_images=gif[1:], duration=120, loop=0)
    return f"{k} {n}: 바닥 이동 {moved if moved else '-'} 이펙트 {red}px 지움"


if __name__ == "__main__":
    k = sys.argv[1]; lines = sys.argv[2:] or ["H1", "H2", "H3", "H4", "H5"]
    for n in lines: print(fix(k, n))
