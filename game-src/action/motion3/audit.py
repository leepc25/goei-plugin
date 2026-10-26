"""전수 기계 검사(2026-10-26 사용자: 지금 뽑은 이미지 전수검사해서 에러내역 찾아내).
동작(1.x~6.x 표의 모든 줄)과 이펙트 3판(x3-*)을 기계적으로만 검사한다. 좋고 나쁨 판정은 사용자 몫.
사용: python3 audit.py → audit.json + docs/동작표_3판/00_전수검사.md"""
import json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image
import m3

BASE = Path(__file__).resolve().parent; ROOT = BASE.parents[2]; VFX = BASE.parent / "testroom3" / "vfx"
AIR = {"6", "7", "8", "14", "8_1"}                       # 발이 뜨는 줄
LIE = {"18_2", "18_3", "19", "20", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45"}   # 눕거나 엎드리는 줄(바닥 기준 다름)
ATK = {"9", "10", "11", "12", "13", "15", "22", "24"}   # 앞으로 쳐야 하는 줄
SMALL = {"43", "45", "1", "2", "3", "W", "W_1", "28", "29", "30", "31", "33", "34", "35", "17", "21", "39", "41", "3_1"}


def alpha(im): return np.array(im)[:, :, 3] > 40


def comps(a):
    """연결된 덩어리 크기들(4방향). numpy 최소값 퍼뜨리기로 라벨링(scipy 없음), 2배 줄여서 빠르게"""
    a = a[::2, ::2]
    if not a.any(): return []
    big = a.size + 1
    lab = np.where(a, np.arange(a.size).reshape(a.shape), big)
    while True:
        m = lab.copy()
        m[1:] = np.minimum(m[1:], lab[:-1]); m[:-1] = np.minimum(m[:-1], lab[1:])
        m[:, 1:] = np.minimum(m[:, 1:], lab[:, :-1]); m[:, :-1] = np.minimum(m[:, :-1], lab[:, 1:])
        m = np.where(a, m, big)
        if (m == lab).all(): break
        lab = m
    _, n = np.unique(lab[a], return_counts=True)
    return sorted((n * 4).tolist(), reverse=True)


def hist(im):
    a = np.array(im.convert("RGBA")); m = a[:, :, 3] > 40
    if not m.any(): return None
    q = (a[:, :, :3][m] // 64).astype(int); idx = q[:, 0] * 16 + q[:, 1] * 4 + q[:, 2]
    h = np.bincount(idx, minlength=64).astype(float); return h / h.sum()


def bbox(a):
    ys, xs = np.nonzero(a)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None


def check_row(key, rn, r, ref):
    f = m3.folder(rn); d = BASE / key / f
    fs = sorted(d.glob("[0-9][0-9].png")) if d.exists() else []
    if not fs: return ["그림 없음"]
    errs = []
    if len(fs) != r["frames"]: errs.append(f"장 수 {len(fs)}/{r['frames']}")
    ims = [Image.open(p).convert("RGBA") for p in fs]; A = [alpha(i) for i in ims]
    area = [a.sum() for a in A]; H, W = A[0].shape
    if min(area) < 0.2 * max(area): errs.append(f"빈 장(면적 {min(area)}/{max(area)})")
    a0 = np.array(ims[0]).astype(int)
    mv = max((((np.abs(np.array(i).astype(int) - a0)[:, :, :3].sum(axis=2) > 60) | (a != A[0])).sum()) / max(1, area[0]) for i, a in zip(ims[1:], A[1:]))
    if mv < (0.015 if f in SMALL else 0.06): errs.append(f"멈춤({mv:.0%})")
    bbs = [bbox(a) for a in A]
    # 캔버스 끝에 잘림
    cut = sum(1 for b in bbs if b and (b[0] <= 0 or b[1] <= 0 or b[2] >= W))
    if cut: errs.append(f"캔버스 끝 잘림 {cut}장")
    # 크기 튐(기준 몸 면적 대비)
    if ref.get("area"):
        hi = max(area) / ref["area"]; lo = min(area) / ref["area"]
        if hi > 1.9: errs.append(f"몸이 커짐 ×{hi:.1f}")
        if lo < 0.3 and f not in LIE: errs.append(f"몸이 작아짐 ×{lo:.2f}")
    # 바닥(발끝) 높이
    if ref.get("ground") and f not in AIR:
        bots = [b[3] for b in bbs if b]
        if f in LIE:
            if max(bots) > ref["ground"] + 4: errs.append(f"바닥 아래로 꺼짐 {max(bots) - ref['ground']}px")
            if min(bots) < ref["ground"] - 12: errs.append(f"누운 몸이 떠 있음 {ref['ground'] - min(bots)}px")
        else:
            if max(bots) > ref["ground"] + 4: errs.append(f"발이 바닥 아래로 {max(bots) - ref['ground']}px")
            if bots[0] < ref["ground"] - 10 or bots[-1] < ref["ground"] - 10: errs.append(f"시작·끝 장 발이 뜸 {ref['ground'] - min(bots[0], bots[-1])}px")
    if f in {"6", "7", "8"}:
        bots = [b[3] for b in bbs if b]
        if max(bots) - min(bots) < 15: errs.append(f"점프인데 발이 거의 안 뜸 {max(bots) - min(bots)}px")
    # 여러 몸·떨어진 조각
    for i, a in enumerate(A):
        c = comps(a)
        if len(c) > 1 and c[1] > 0.12 * c[0] and c[1] > 150: errs.append(f"떨어진 큰 덩어리 {i + 1}번 장({c[1]}px)"); break
    # 색 바뀜(기준 그림과 색 분포 차이)
    if ref.get("hist") is not None:
        ds = [0.5 * np.abs(hist(i) - ref["hist"]).sum() for i in ims if hist(i) is not None]
        if max(ds) > 0.45: errs.append(f"색이 바뀜({max(ds):.2f})")
    # 방향(동쪽 줄의 공격)
    if f in ATK and r["dir"] in ("E", "W"):
        b0 = bbs[0]; sgn = 1 if r["dir"] == "E" else -1
        fwd = max(((b[2] - b0[2]) if sgn > 0 else (b0[0] - b[0])) for b in bbs if b)
        back = max(((b0[0] - b[0]) if sgn > 0 else (b[2] - b0[2])) for b in bbs if b)
        if back > fwd + 8 and back > 14: errs.append(f"뒤로 뻗음(앞 {fwd} 뒤 {back})")
    # 반복 줄 끊김
    if "반복" in r["span"] and len(ims) > 2:
        dl = (((np.abs(np.array(ims[-1]).astype(int) - a0)[:, :, :3].sum(axis=2) > 60) | (A[-1] != A[0])).sum()) / max(1, area[0])
        dm = max(mv, 1e-6)
        if dl > 0.5 and dl > dm * 0.9: errs.append(f"반복 이음 끊김({dl:.0%})")
    return errs


def ref_of(key, T):
    """기준: 전투 대기(3) 첫 장 — 몸 면적·발끝·색"""
    for f in ("3", "1", "4"):
        p = BASE / key / f / "00.png"
        if p.exists():
            im = Image.open(p).convert("RGBA"); a = alpha(im); b = bbox(a)
            return dict(area=int(a.sum()), ground=int(b[3]), hist=hist(im))
    return {}


def main():
    keys = [k for k in m3.order() if re.match(r"[1-6]\.", k)]
    res = {}; n_rows = 0
    for k in keys:
        try: T = m3.table(k)
        except Exception as e: res[k] = {"표": [f"표 못 읽음 {e}"]}; continue
        ref = ref_of(k, T); out = {}
        for rn, r in T["rows"].items():
            n_rows += 1
            try: e = check_row(k, rn, r, ref)
            except Exception as ex: e = [f"검사 오류 {ex!r}"[:120]]
            if e: out[rn] = e
        if out: res[k] = out
        print(k, len(out), flush=True)
    # 이펙트
    fx = {}
    for js in sorted(VFX.glob("x3-*.json")):
        m = json.loads(js.read_text()); im = np.array(Image.open(js.with_suffix(".png")).convert("RGBA"))
        px = []; edge = 0
        for fr in m["frames"]:
            r = fr["frame"]; a = im[r["y"]:r["y"] + r["h"], r["x"]:r["x"] + r["w"], 3] > 0
            px.append(int(a.sum())); edge = max(edge, int(a[0].sum() + a[:, 0].sum() + a[:, -1].sum()))
        e = []
        empty = sum(p < 20 for p in px)
        if empty: e.append(f"빈 장 {empty}/{len(px)}")
        if max(px) < 60: e.append(f"아주 작음 {max(px)}px")
        if edge > 100: e.append(f"그림판 끝 닿음 {edge}px")
        if e: fx[js.stem] = e
    json.dump(dict(motion=res, fx=fx, rows=n_rows), open(BASE / "audit.json", "w"), ensure_ascii=False, indent=1)
    # 문서
    cnt = {}
    for k, rows in res.items():
        for rn, es in rows.items():
            for e in es: t = re.sub(r"[\d(].*", "", e).strip(); cnt[t] = cnt.get(t, 0) + 1
    L = ["# 전수 기계 검사 (audit.py, 2026-10-26)", "", f"검사한 동작 줄 {n_rows} · 걸린 줄 {sum(len(v) for v in res.values())} · 이펙트 {len(list(VFX.glob('x3-*.json')))}개 중 걸림 {len(fx)}", "",
         "기계 검사만 했다(멈춤·빈 장·잘림·크기·바닥·조각·색·방향·반복 이음). 동작이 좋은지는 판정하지 않았다.", "", "## 종류별", "", "| 종류 | 줄 수 |", "| --- | --- |"]
    L += [f"| {t} | {n} |" for t, n in sorted(cnt.items(), key=lambda x: -x[1])]
    L += ["", "## 동작 (인물 → 줄: 걸린 내용)", ""]
    for k, rows in res.items():
        L.append(f"- **{k}**: " + " · ".join(f"{rn} {', '.join(es)}" for rn, es in rows.items()))
    L += ["", "## 이펙트", ""] + [f"- {n}: {', '.join(e)}" for n, e in fx.items()]
    (ROOT / "docs/동작표_3판/00_전수검사.md").write_text("\n".join(L) + "\n")
    print("끝", sum(len(v) for v in res.values()), "줄 걸림, 이펙트", len(fx))


if __name__ == "__main__":
    main()
