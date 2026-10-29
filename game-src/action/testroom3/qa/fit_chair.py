"""인물마다 의자 손 맞춤 도구(10-28 사용자: 캐릭별로 수작업).
  python3 game-src/action/testroom3/qa/fit_chair.py <키> [out.png]                지금 값으로 3방향(정면·옆·후면) 합성 그림
  python3 game-src/action/testroom3/qa/fit_chair.py <키> out.png set side dx=3 dy=-2   값 고치고(chars/<키>.json "chair") 다시 그림
값: 의자 1배(크기 고정). dx = 앞쪽(오른쪽) +, dy = 아래 +. 기준 = 앉기 끝 장 그림 가운데·바닥(테스트룸과 같음).
값은 testroom3/chairs/<키>.json 에 저장. 의자 방향 img=south|south-east|south-west(정면) · north|north-east|north-west(후면) · east(옆) 도 set 으로 고름(인물이 살짝 비스듬히 앉았으면 그쪽 방향 의자).
그림: 3배 확대, 왼쪽부터 정면(의자 뒤 층)·옆(의자 뒤 층)·후면(의자 앞 층). 빨간 점선 = 그림 바닥(발 기준), 회색 격자 10화소.
"""
import sys, json
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE)); sys.argv, ARGS = sys.argv[:1], sys.argv[1:]
import build, chairfit
from PIL import Image, ImageDraw
import numpy as np

CH = build.ROOT / "game-src/action/objects/C01_사무의자_1배"
CH2 = build.ROOT / "game-src/action/objects/C02_기댄사무의자_1배_2차"   # 등받이 기운 의자(기대 쉬기 73): img=C02:<방향>
def chair_png(name): return (CH2 / f"{name[4:]}.png") if name.startswith("C02:") else (CH / f"{name}.png")
VIEWS = [("front", "60", "south"), ("side", "96", "east"), ("back", "61", "north")]
# 앉은 채 하는 줄: 방향별. 자세가 크게 바뀌는 줄은 줄 번호로 따로 맞춤(set 73 img=north-west dx=.. dy=..)
LINES = {"front": ["62", "63", "64", "65", "66", "73"], "side": ["97", "98", "99", "105"], "back": ["69", "70", "71"]}
LINE_VIEW = {l: v for v, ls in LINES.items() for l in ls}


def load(key):
    ch = [c for c in build.roster() if c["key"] == key][0]
    p = build.CHARS / f"{key}.json"
    cfg = build.deep_merge(build.auto_cfg(ch), json.loads(p.read_text(encoding="utf-8")))
    cp = build.HERE / "chairs" / f"{key}.json"
    if cp.exists(): cfg["chair"] = json.loads(cp.read_text(encoding="utf-8"))
    return cfg, p


def last(cfg, lid):
    an = cfg["anims"].get(lid)
    if not an: return None
    fs = sorted((build.src_dir(cfg, an) / an["folder"]).glob("[0-9][0-9].png"))
    im = Image.open(fs[-1]).convert("RGBA")
    return im.transpose(Image.FLIP_LEFT_RIGHT) if an.get("mirror") else im


def line_base(cfg, lid):
    """방이 그 줄의 끝 장을 땅에 붙이는 기준선 = 그 장의 가장 낮은 점(앉은 줄은 room groundBase 가 장마다 bot, 최대 H-4). 의자 dy 는 이 선 기준(10-29 밤)"""
    im = last(cfg, lid)
    if im is None: return None
    bb = im.getbbox(); H = im.size[1]
    return min(H - 4, (bb[3] - 1) if bb else H - 4)


def values(cfg):
    ims = {v: last(cfg, l) for v, l, _ in VIEWS}
    auto = chairfit.fit(ims["side"], ims["front"], ims["back"])
    out = {}
    for v, _, _ in VIEWS:
        d = {"dx": 0.0, "dy": 0.0, "s": 1.0}; d.update({k: float(x) for k, x in (auto.get(v) or {}).items()}); d.update((cfg.get("chair") or {}).get(v) or {})
        d["s"] = 1.0
        d.setdefault("img", {"front": "south", "side": "east", "back": "north"}[v])
        out[v] = d
    return ims, out


def render(key, outp):
    cfg, _ = load(key)
    ims, vals = values(cfg)
    Z, TW, TH = 3, 220, 280
    S = Image.new("RGB", (TW * Z * 3, TH * Z + 40), (40, 40, 44))
    dr = ImageDraw.Draw(S)
    for i, (v, lid, cn) in enumerate(VIEWS):
        im = ims[v]
        T = Image.new("RGBA", (TW, TH), (92, 86, 78, 255))
        g = ImageDraw.Draw(T)
        for x in range(0, TW, 10): g.line([(x, 0), (x, TH)], fill=(100, 94, 86, 255))
        for y in range(0, TH, 10): g.line([(0, y), (TW, y)], fill=(100, 94, 86, 255))
        if im is not None:
            p = vals[v]; c = Image.open(chair_png(p.get('img', cn))).convert("RGBA")
            base = TH - 10   # 그림 바닥(BASE = h - 4)을 여기 맞춤
            ox, oy = TW // 2 - im.size[0] // 2, base - (im.size[1] - 4)
            cx, cy = round(TW / 2 + p["dx"] - 100), round(base + p["dy"] - 171)
            if v != "back": T.alpha_composite(c, (cx, cy)); T.alpha_composite(im, (ox, oy))
            else: T.alpha_composite(im, (ox, oy)); T.alpha_composite(c, (cx, cy))
            for x in range(0, TW, 6): g.point((x, base), fill=(255, 60, 60, 255))
        S.paste(T.convert("RGB").resize((TW * Z, TH * Z), Image.NEAREST), (i * TW * Z, 40))
        dr.text((i * TW * Z + 8, 8), f"{key} {v} dx={vals[v]['dx']} dy={vals[v]['dy']} img={vals[v].get('img')}", fill=(255, 255, 255))
    S.save(outp)
    return vals


def render_lines(key, outp):
    """앉은 채 하는 줄 전부(각 줄의 가장 많이 움직인 장 = 앉기 끝 장과 가장 다른 장)를 그 줄 의자 값으로"""
    cfg, _ = load(key)
    ims, vals = values(cfg)
    chair = cfg.get("chair") or {}
    Z, TW, TH = 2, 220, 280
    cells = [(l, v) for v, ls in LINES.items() for l in ls if l in cfg["anims"]]
    S = Image.new("RGB", (TW * Z * 5, (TH * Z + 30) * ((len(cells) + 4) // 5)), (40, 40, 44)); dr = ImageDraw.Draw(S)
    out = {}
    for i, (l, v) in enumerate(cells):
        an = cfg["anims"][l]; fs = sorted((build.src_dir(cfg, an) / an["folder"]).glob("[0-9][0-9].png"))
        frames = [Image.open(f).convert("RGBA") for f in fs]
        if an.get("mirror"): frames = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in frames]
        ref = ims[v]
        if ref is not None and ref.size == frames[0].size:
            ra = np.array(ref)[:, :, 3] > 40
            im = max(frames, key=lambda f: int(((np.array(f)[:, :, 3] > 40) ^ ra).sum()))
        else: im = frames[-1]
        p = {**vals[v], **(chair.get(l) or {})}; out[l] = p
        cn = p.get("img")
        T = Image.new("RGBA", (TW, TH), (92, 86, 78, 255)); g = ImageDraw.Draw(T)
        for x in range(0, TW, 10): g.line([(x, 0), (x, TH)], fill=(100, 94, 86, 255))
        for y in range(0, TH, 10): g.line([(0, y), (TW, y)], fill=(100, 94, 86, 255))
        c = Image.open(chair_png(cn)).convert("RGBA"); base = TH - 10
        ox, oy = TW // 2 - im.size[0] // 2, base - (im.size[1] - 4); cx, cy = round(TW / 2 + p["dx"] - 100), round(base + p["dy"] - 171)
        if v != "back": T.alpha_composite(c, (cx, cy)); T.alpha_composite(im, (ox, oy))
        else: T.alpha_composite(im, (ox, oy)); T.alpha_composite(c, (cx, cy))
        X, Y = (i % 5) * TW * Z, (i // 5) * (TH * Z + 30)
        S.paste(T.convert("RGB").resize((TW * Z, TH * Z), Image.NEAREST), (X, Y + 30))
        dr.text((X + 6, Y + 8), f"{l} {an.get('name', '')[:10]} {'따로' if l in chair else v} dx={p['dx']} dy={p['dy']} {cn}", fill=(255, 255, 255))
    S.save(outp)
    return out


def render_back3(key, outp):
    """후면 의자 방향 고르기: 같은 후면 앉기 그림에 north-west·north·north-east 의자를 나란히(지금 dx·dy 그대로)"""
    cfg, _ = load(key)
    ims, vals = values(cfg)
    im = ims["back"]; p = vals["back"]
    Z, TW, TH = 3, 220, 280
    S = Image.new("RGB", (TW * Z * 3, TH * Z + 40), (40, 40, 44)); dr = ImageDraw.Draw(S)
    for i, cn in enumerate(["north-west", "north", "north-east"]):
        T = Image.new("RGBA", (TW, TH), (92, 86, 78, 255)); g = ImageDraw.Draw(T)
        for x in range(0, TW, 10): g.line([(x, 0), (x, TH)], fill=(100, 94, 86, 255))
        for y in range(0, TH, 10): g.line([(0, y), (TW, y)], fill=(100, 94, 86, 255))
        c = Image.open(chair_png(cn)).convert("RGBA"); base = TH - 10
        ox, oy = TW // 2 - im.size[0] // 2, base - (im.size[1] - 4); cx, cy = round(TW / 2 + p["dx"] - 100), round(base + p["dy"] - 171)
        T.alpha_composite(im, (ox, oy)); T.alpha_composite(c, (cx, cy))
        S.paste(T.convert("RGB").resize((TW * Z, TH * Z), Image.NEAREST), (i * TW * Z, 40))
        dr.text((i * TW * Z + 8, 8), f"{key} back img={cn}{' (지금)' if cn == p.get('img') else ''} dx={p['dx']} dy={p['dy']}", fill=(255, 255, 255))
    S.save(outp)
    return p


if __name__ == "__main__":
    key = ARGS[0]; outp = ARGS[1] if len(ARGS) > 1 else f"/tmp/fit_{key}.png"
    if len(ARGS) > 2 and ARGS[2] == "lines":   # fit_chair.py <키> out.png lines  → 앉은 채 하는 줄 전부
        print(json.dumps(render_lines(key, outp), ensure_ascii=False)); sys.exit()
    if len(ARGS) > 2 and ARGS[2] == "back3":   # fit_chair.py <키> out.png back3  → 후면 의자 방향 3가지 나란히
        print(json.dumps(render_back3(key, outp), ensure_ascii=False)); sys.exit()
    if len(ARGS) > 2 and ARGS[2] == "set" and ARGS[3] in LINE_VIEW:   # 줄 하나만 따로: set 73 img=north-west dx=.. dy=..
        cfg, p = load(key); _, vals = values(cfg)
        cur = {**vals[LINE_VIEW[ARGS[3]]], **((cfg.get("chair") or {}).get(ARGS[3]) or {})}
        for kv in ARGS[4:]:
            k, x = kv.split("="); cur[k] = x if k == "img" else float(x)
        cp = build.HERE / "chairs" / f"{key}.json"
        d = json.loads(cp.read_text(encoding="utf-8")) if cp.exists() else {v: {kk: vals[v][kk] for kk in ("dx", "dy", "s", "img")} for v in vals}
        d[ARGS[3]] = {"dx": cur["dx"], "dy": cur["dy"], "s": 1.0, "img": cur["img"]}
        cp.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(json.dumps(render_lines(key, outp), ensure_ascii=False)); sys.exit()
    if len(ARGS) > 2 and ARGS[2] == "set":   # 방향 값: set front|side|back dx=.. dy=.. img=..
        cfg, p = load(key); _, vals = values(cfg)
        view = ARGS[3]
        for kv in ARGS[4:]:
            k, x = kv.split("="); vals[view][k] = x if k == "img" else float(x)
        cp = build.HERE / "chairs" / f"{key}.json"   # 인물마다 따로(여러 작업자가 동시에 고쳐도 안 겹치게). build가 설정 "chair"로 읽음
        cp.parent.mkdir(exist_ok=True)
        old = json.loads(cp.read_text(encoding="utf-8")) if cp.exists() else {}   # 줄마다 따로 맞춘 값은 그대로 둠
        old.update({v: {"dx": vals[v]["dx"], "dy": vals[v]["dy"], "s": 1.0, "img": vals[v]["img"]} for v in vals})
        cp.write_text(json.dumps(old, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(render(key, outp), ensure_ascii=False))
