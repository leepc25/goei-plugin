"""chairfit2 로 전원(또는 지정 인물) 정면·옆·후면 의자 값을 다시 씀. 방향(img)은 chairs/<키>.json 에 있던 것을 유지(지정: --img front=south-east 등). 73 등 줄별 값은 그대로.
  python3 game-src/action/testroom3/qa/refit_chairs.py [키…] [--img front=south-east back=north-west]"""
import sys, json, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "qa"))
ARGS = sys.argv[1:]; sys.argv = sys.argv[:1]
import build, chairfit2, fit_chair as fc

imgs_arg = {}
if "--img" in ARGS:
    i = ARGS.index("--img")
    for kv in ARGS[i + 1:]:
        k, v = kv.split("="); imgs_arg[k] = v
    ARGS = ARGS[:i]
keys = ARGS or sorted([p.stem for p in (HERE / "chairs").glob("*.json")], key=lambda s: [int(x) for x in re.findall(r"\d+", s.split("_")[0])])
for key in keys:
    cfg, _ = fc.load(key)
    cp = HERE / "chairs" / f"{key}.json"
    old = json.loads(cp.read_text(encoding="utf-8")) if cp.exists() else {}
    imgs = {v: (old.get(v) or {}).get("img") for v in ("front", "side", "back")}; imgs.update(imgs_arg)
    ims = {v: fc.last(cfg, l) for v, l, _ in fc.VIEWS}
    bases = {v: fc.line_base(cfg, l) for v, l, _ in fc.VIEWS}
    new = chairfit2.fit(ims["side"], ims["front"], ims["back"], imgs, old, bases)
    for v in list(new):   # 눈으로 손본 값(hand)은 dx 만 유지, dy 는 새 기준선으로
        if (old.get(v) or {}).get("hand"): new[v]["dx"] = old[v]["dx"]; new[v]["hand"] = old[v]["hand"]
    old.update(new)
    cp.write_text(json.dumps(old, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(key, {v: (new[v]["dx"], new[v]["dy"], new[v]["img"]) for v in new})
