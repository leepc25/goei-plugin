"""맨몸 피격 7줄 자동 전수검사 (docs/샤워_뽑기_지침.md 5-3, 2026-10-31 사용자: 전수검사해서 잘못된 것 프롬프트 바꿔 최대 2번 다시 뽑기).
검사: 뜸(발이 바닥에서 떨어짐) · 잘림(캔버스 가장자리) · 넓이 튐(이웃 장 면적 급변) · 움직임 약함 · 반복 이음새(G·H6) · 끝 자세(H3·H4 누움, H5·G 섬/웅크림).
사용: python3 _test/shower_check.py [키…]   결과 _test/_shower_check.json, 걸린 줄 표시 시트 _test/_shower_check/<줄>_<n>.png"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
LINES = ["G", "H1", "H2", "H3", "H4", "H5", "H6"]
LOOP = {"G", "H6"}


def frames(k, n):
    fs = sorted((HERE / k / f"샤워2_{n}").glob("[0-9][0-9].png"))
    return [np.array(Image.open(f).convert("RGBA"))[..., 3] > 0 for f in fs], fs


def box(m):
    ys, xs = np.nonzero(m)
    return (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None


def iou_diff(a, b):
    u = (a | b).sum()
    return 1 - (a & b).sum() / u if u else 0


def check(k, n):
    ms, fs = frames(k, n)
    if not ms: return ["없음"]
    errs = []
    H, W = ms[0].shape
    bs = [box(m) for m in ms]
    if any(b is None for b in bs): return ["빈 장"]
    # 잘림: 가장자리에 닿음
    if any(b[0] <= 0 or b[2] >= W - 1 or b[3] >= H - 1 or b[1] <= 0 for b in bs): errs.append("잘림")
    # 뜸: 서 있는 줄은 바닥(발 끝 y)이 시작 장보다 6px 넘게 올라가면 안 됨. 누운 줄 끝은 시작 바닥 근처
    floor = bs[0][3]
    if n in ("G", "H1", "H2"):
        if max(floor - b[3] for b in bs) > 6: errs.append("뜸")
    if n == "H6" and max(floor - b[3] for b in bs) > 20: errs.append("뜸")   # 달리기는 발이 잠깐 뜨는 게 정상(10-31 눈 확인)
    if n == "H3":
        mid = bs[len(bs) // 3: -1]
        if bs[-1][3] < floor - 8 or any(floor - b[3] > 14 for b in mid): errs.append("뜸")
    if n in ("H4", "H5") and max(floor - b[3] for b in bs) > 10: errs.append("뜸")
    # 넓이 튐
    ar = [m.sum() for m in ms]
    if any(abs(ar[i + 1] - ar[i]) / max(ar[i], 1) > 0.35 for i in range(len(ar) - 1)): errs.append("넓이 튐")
    # 움직임 약함
    mv = max(iou_diff(ms[0], m) for m in ms)
    if mv < (0.12 if n not in LOOP else 0.06): errs.append(f"움직임 약함({mv:.2f})")
    # 반복 이음새
    if n == "G" and iou_diff(ms[-1], ms[0]) > 0.35: errs.append("이음새")   # H6 달리기는 끝·첫 장이 한 걸음 차이라 제외(10-31 눈 확인: 19명 모두 정상)
    # 앞 줄과 이음새(10-31 사용자: 앞 줄을 다시 뽑아 이질감이 심하면 뒤 줄도 다시): 이 줄 첫 장 ↔ 앞 줄 끝 장
    prev = {"H1": "G", "H2": "G", "H6": "G", "H4": "H3", "H5": "H3"}.get(n)
    if prev:
        pm, _ = frames(k, prev)
        if pm and iou_diff(pm[-1], ms[0]) > 0.45: errs.append(f"앞 줄({prev})과 안 이어짐")
    # 끝 자세
    x0, y0, x1, y1 = bs[-1]; w, h = x1 - x0, y1 - y0
    if n in ("H3", "H4") and w < h: errs.append("끝이 누운 자세 아님")
    if n in ("H5", "G") and w > h * 1.1: errs.append("끝이 선/웅크린 자세 아님")
    return errs


def mark_sheet(k, n, errs):
    _, fs = frames(k, n)
    if not fs: return
    ims = [Image.open(f).convert("RGBA") for f in fs]
    w, h = ims[0].size; c = Image.new("RGBA", (w * len(ims), h + 20), (60, 60, 70, 255))
    for i, im in enumerate(ims): c.alpha_composite(im, (i * w, 20))
    ImageDraw.Draw(c).text((4, 4), f"{k} {n}: {', '.join(errs)}", fill=(255, 90, 90, 255))
    d = HERE / "_shower_check"; d.mkdir(exist_ok=True); c.save(d / f"{n}_{k}.png")


if __name__ == "__main__":
    keys = sys.argv[1:] or sorted(p.parent.name for p in HERE.glob("*/샤워2_A"))
    out = {}
    for k in keys:
        for n in LINES:
            e = check(k, n)
            if e:
                out.setdefault(k, {})[n] = e
                if e != ["없음"]: mark_sheet(k, n, e)
    json.dump(out, open(HERE / "_shower_check.json", "w"), ensure_ascii=False, indent=1)
    from collections import Counter
    c = Counter((n, x.split("(")[0]) for k in out for n, es in out[k].items() for x in es)
    print(len(keys), "명 검사 / 걸린 줄", sum(len(v) for v in out.values()))
    for (n, x), v in sorted(c.items()): print(f"  {n} {x}: {v}")
