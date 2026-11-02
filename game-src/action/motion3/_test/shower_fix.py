"""맨몸 피격 뽑은 뒤 코드 보정 (2026-10-31 사용자: 「쓰러지거나 일어날 때 발 위치가 아닌 허공에 쓰러지는 거, 이런 건 코드로 조정해」).
- 바닥 붙이기(H3·H4·H5): 장마다 몸 맨 아래 줄을 그 인물 바닥선(G 첫 장의 발 끝, 없으면 그 줄 첫 장)에 맞춰 위아래로 옮긴다.
- 이펙트 지우기(H1·H2·H3): 맞을 때 생기는 줄기(빨강·흰색 등, 그 인물 G 그림에 없는 색 덩어리)를 지운다 (10-31 사용자 지적: H2 이펙트).
- (11-01 전수점검) H2도 바닥 붙이기(이성해·이병진 H2 뜸). 맞는 첫 두 장(H1·H2·H3)에서 다음 장 몸 밖으로 삐져나온 가는 줄기 지우기(몸에 붙은 타격 줄기).
  모든 줄(G·H1~H6)에서 몸과 떨어진 작은 점(30px 미만) 지우기. H1~H3 첫 장은 시작 장으로 바꾸고, 둘째 장에 큰 이펙트가 있었으면 셋째 장으로 바꾼다(몸에 붙은 찌꺼기).
원본은 샤워2_<줄>/_원본/ 에 그대로 두고(지우지 않음), 보정본을 그 자리(00.png…)에 쓴다. 여러 번 돌려도 _원본에서 다시 만든다.
사용: python3 _test/shower_fix.py <키> [줄…]   (줄 없으면 H1~H5)"""
import sys, shutil
from pathlib import Path
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
GROUND = {"H2", "H3", "H4", "H5"}
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
    # 흰·검은 줄기(10-31 점검: 색이 G 팔레트에도 있어 위에서 안 걸림) → 아주 밝거나 아주 어두운 픽셀 덩어리 중 가로로 긴 것(폭 > 높이×3, 40px 이상)
    rgb = a[..., :3].astype(int); lum = rgb.sum(-1)
    ext = al & ((rgb.max(-1) - rgb.min(-1) < 28) | (lum < 90) | (rgb.min(-1) > 215))   # 무채색(검정·회색·흰색)
    le, ne = ndimage.label(ext, np.ones((3, 3)))
    for i, sl in enumerate(ndimage.find_objects(le)):
        if sl is None: continue
        h = sl[0].stop - sl[0].start; w = sl[1].stop - sl[1].start
        if w > 3 * h and w >= 20 and (le[sl] == i + 1).sum() >= 40: kill |= le == i + 1
    a = a.copy(); a[kill] = 0
    lab2, n2 = ndimage.label(a[..., 3] > 0, np.ones((3, 3)))
    if n2 > 1:
        sz2 = ndimage.sum(a[..., 3] > 0, lab2, range(1, n2 + 1))
        small = np.isin(lab2, [i + 1 for i, v in enumerate(sz2) if v < 300])
        a[small] = 0; kill |= small
    return a, int(kill.sum())


def thin_extra(a, ref):
    """맞는 순간 장의 가는 줄기(11-01): 다음 장 몸(6px 넓힘) 밖에 있는 픽셀 덩어리 중 두께가 얇은 것(가장 안쪽 픽셀도 테두리에서 2px 이내)을 지운다."""
    from scipy import ndimage
    al = a[..., 3] > 0
    near = ndimage.binary_dilation(ref[..., 3] > 0, np.ones((3, 3)), iterations=6)
    out = al & ~near
    lab, n = ndimage.label(out, np.ones((3, 3)))
    kill = np.zeros_like(al)
    if n:
        dist = ndimage.distance_transform_edt(al)
        for i, sl in enumerate(ndimage.find_objects(lab)):
            m = lab[sl] == i + 1
            if m.sum() >= 12 and dist[sl][m].max() <= 2.5: kill[sl] |= m
    a = a.copy(); a[kill] = 0
    return a, int(kill.sum())


def specks(a, lim=30):
    """몸과 떨어진 작은 점(lim px 미만) 지우기"""
    from scipy import ndimage
    al = a[..., 3] > 0
    lab, n = ndimage.label(al, np.ones((3, 3)))
    if n <= 1: return a, 0
    sz = ndimage.sum(al, lab, range(1, n + 1)); big = int(np.argmax(sz)) + 1
    small = np.isin(lab, [i + 1 for i, v in enumerate(sz) if v < lim and i + 1 != big])
    a = a.copy(); a[small] = 0
    return a, int(small.sum())


def biggest(a):
    from scipy import ndimage
    al = a[..., 3] > 0
    lab, n = ndimage.label(al, np.ones((3, 3)))
    if n <= 1: return a
    sz = ndimage.sum(al, lab, range(1, n + 1)); a = a.copy(); a[lab != int(np.argmax(sz)) + 1] = 0
    return a


def start_frame(k, n):
    """그 줄의 시작 장(뽑을 때 custom_start_frame으로 준 그림): H1·H2 = 지금 G 마지막 장(가장 큰 덩어리만), H3 = H2 가장 밀린 장 정리본"""
    if n in ("H1", "H2"):
        g = sorted((HERE / k / "샤워2_G").glob("[0-9][0-9].png"))
        return biggest(np.array(Image.open(g[-1]).convert("RGBA"))) if g else None
    if n == "H3":
        f = HERE / k / "샤워2_H2_가장밀림_정리.png"
        return np.array(Image.open(f).convert("RGBA")) if f.exists() else None
    return None


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
    arrs = [np.array(Image.open(f).convert("RGBA")) for f in fs]
    start = start_frame(k, n) if n in DERED else None
    for i, f in enumerate(fs):
        a = arrs[i]
        if n in DERED and i == 0 and start is not None:
            # 11-01 점검: 첫 장은 시작 장(G 끝 장·H2 가장 밀린 장)과 같은 자세인데 이펙트가 몸에 붙어 다 안 지워짐 → 시작 장 그대로 쓴다(이음새 1.0)
            a = start.copy(); red += int((arrs[0][..., 3] > 0).sum() - (a[..., 3] > 0).sum())
        elif n in DERED:
            a, c = dered(a, P); red += c
            if i == 1 and c >= 150 and len(arrs) > 2:   # 11-01: 둘째 장에 큰 이펙트가 있었으면(몸에 붙은 찌꺼기 남음) 셋째 장으로 바꾼다
                b, c2 = dered(arrs[2], P)
                if c2 < 150: a = b
            # 맞는 순간 장(첫 두 장)에 이펙트가 있었으면 이펙트 없는 다음 장으로 바꿈(10-31 점검: 몸에 붙은 흰 줄기는 다 안 지워짐)
            if c > 0 and i < 2 and n == "H3" and len(arrs) > i + 1:
                b, c2 = dered(arrs[i + 1], P)
                if c2 == 0: a = b
            if i < 2 and len(arrs) > i + 1:
                a, c3 = thin_extra(a, arrs[i + 1]); red += c3
        a, c4 = specks(a); red += c4
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
    k = sys.argv[1]; lines = sys.argv[2:] or ["G", "H1", "H2", "H3", "H4", "H5", "H6"]
    for n in lines: print(fix(k, n))
