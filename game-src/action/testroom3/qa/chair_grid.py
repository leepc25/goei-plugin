"""의자 전수검사용 모음 그림: 한 방향(front|side|back|73)으로 여러 인물의 지금 의자 맞춤을 격자로.
  python3 game-src/action/testroom3/qa/chair_grid.py <view> <out.png> [키,키,…]   (키 없으면 chars/*.json 전부, 한 장에 최대 6명)
  python3 … chair_grid.py front3 <out.png> 키   정면 의자 south·south-east·south-west 나란히(지금 dx·dy)
셀: 2배, 빨간 점선 = 그림 바닥, 회색 격자 10화소. 73은 기대 쉬기(C02 기댄 의자)의 가장 많이 기댄 장.
"""
import sys, json, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "qa"))
MAIN = __name__ == "__main__"   # 다른 도구가 cell() 만 가져다 쓸 수 있게(10-29)
if MAIN: VIEW, OUT = sys.argv[1], sys.argv[2]; KEYS = sys.argv[3].split(",") if len(sys.argv) > 3 else None
sys.argv = sys.argv[:1]
import build, fit_chair as fc
from PIL import Image, ImageDraw
import numpy as np

def cell(im, p, front_layer, label, Z=2, TW=220, TH=280):
    T = Image.new("RGBA", (TW, TH), (92, 86, 78, 255)); g = ImageDraw.Draw(T)
    for x in range(0, TW, 10): g.line([(x, 0), (x, TH)], fill=(100, 94, 86, 255))
    for y in range(0, TH, 10): g.line([(0, y), (TW, y)], fill=(100, 94, 86, 255))
    base = TH - 10
    if im is not None:
        c = Image.open(fc.chair_png(p["img"])).convert("RGBA")
        ox, oy = TW // 2 - im.size[0] // 2, base - (im.size[1] - 4)
        cx, cy = round(TW / 2 + p["dx"] - 100), round(base + p["dy"] - 171)
        if not front_layer: T.alpha_composite(c, (cx, cy)); T.alpha_composite(im, (ox, oy))
        else: T.alpha_composite(im, (ox, oy)); T.alpha_composite(c, (cx, cy))
        for x in range(0, TW, 6): g.point((x, base), fill=(255, 60, 60, 255))
    S = T.convert("RGB").resize((TW * Z, TH * Z), Image.NEAREST)
    d = ImageDraw.Draw(S); d.rectangle([0, 0, TW * Z, 14], fill=(20, 20, 20)); d.text((4, 2), label, fill=(255, 255, 255))
    return S

def frame73(cfg):
    an = cfg["anims"].get("73")
    if not an: return None
    fs = sorted((build.src_dir(cfg, an) / an["folder"]).glob("[0-9][0-9].png"))
    frames = [Image.open(f).convert("RGBA") for f in fs]
    if an.get("mirror"): frames = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in frames]
    ref = fc.last(cfg, "60")
    if ref is not None and ref.size == frames[0].size:
        ra = np.array(ref)[:, :, 3] > 40
        return max(frames, key=lambda f: int(((np.array(f)[:, :, 3] > 40) ^ ra).sum()))
    return frames[-1]

if not MAIN: KEYS = None; VIEW = None
keys = [] if not MAIN else (KEYS or sorted([p.stem for p in (HERE / "chars").glob("*.json")], key=lambda s: [int(x) for x in re.findall(r"\d+", s.split("_")[0])]))
cells = []
for key in keys:
    try: cfg, _ = fc.load(key)
    except Exception as e: print("못 읽음", key, e); continue
    ims, vals = fc.values(cfg); chair = cfg.get("chair") or {}
    if VIEW == "dirs":   # 방향 고르기: 정면 S·SE·SW + 후면 NW·N·NE, 후보마다 그 의자 좌석 가운데를 몸 가운데에
        import chairfit2
        for v, cands in (("front", ("south", "south-east", "south-west")), ("back", ("north-west", "north", "north-east"))):
            im = ims[v]; p = vals[v]
            if im is None: continue
            cx, floor = chairfit2.hip_center(im); W = im.size[0]
            for cn in cands:
                dx = round(cx - W / 2 - (chairfit2.SEAT_CX[cn] - 100), 1)
                cells.append(cell(im, {**p, "img": cn, "dx": dx}, v == "back", f"{key} {v} {cn}{' *' if cn == p['img'] else ''} dx={dx} dy={p['dy']}"))
        continue
    if VIEW == "front3":
        im = ims["front"]; p = vals["front"]
        for cn in ("south", "south-east", "south-west"):
            cells.append(cell(im, {**p, "img": cn}, False, f"{key} front {cn}{' *' if cn == p['img'] else ''} dx={p['dx']} dy={p['dy']}"))
    elif VIEW == "73":
        im = frame73(cfg)
        if im is None: continue
        p = {**vals["front"], **(chair.get("73") or {})}
        cells.append(cell(im, p, False, f"{key} 73 {p['img']} dx={p['dx']} dy={p['dy']}"))
    else:
        im = ims[VIEW]; p = vals[VIEW]
        cells.append(cell(im, p, VIEW == "back", f"{key} {VIEW} {p['img']} dx={p['dx']} dy={p['dy']}"))
if MAIN:
    if not cells: sys.exit("셀 없음")
    cols = 6 if VIEW == "dirs" else 3; rows = (len(cells) + cols - 1) // cols
    cw, ch = cells[0].size
    S = Image.new("RGB", (cw * cols, ch * rows), (30, 30, 30))
    for i, c in enumerate(cells): S.paste(c, ((i % cols) * cw, (i // cols) * ch))
    S.save(OUT); print(OUT, len(cells), "셀")
