"""기술 그림 바꿔 끼우기(판정 반지름은 그대로): python3 qa/swap_vfx.py <키> <부분 c0|c1|c2|skill|super> <옛 그림(쉼표)> <새 그림> <새 scale>
판정 반지름 = (r ?? 그림 폭×0.4) × scale 이 바뀌지 않게 r 을 다시 적는다."""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
key, part, olds, new, nsc = sys.argv[1], sys.argv[2], sys.argv[3].split(","), sys.argv[4], float(sys.argv[5])
FW = {}
for js in list((HERE / "vfx").glob("*.json")) + list((HERE.parent / "eileen" / "vfx").glob("*.json")):
    try: FW.setdefault(js.stem, json.loads(js.read_text())["frames"][0]["frame"]["w"])
    except Exception: pass
p = HERE / "chars" / f"{key}.json"; d = json.loads(p.read_text(encoding="utf-8")); sk = d["skills"]
root = sk["charge"]["lv"][part[1]] if part.startswith("c") else sk[part]
n = 0
def walk(o):
    global n
    if isinstance(o, dict):
        if o.get("t") == "v" and o.get("vfx") in olds:
            sc = o.get("scale", 1); rr = (o["r"] if "r" in o else FW.get(o["vfx"], 200) * 0.4) * sc
            o["vfx"] = new; o["scale"] = nsc; o.pop("tint", None)
            if o.get("hit"): o["r"] = round(rr / nsc, 1)
            n += 1
        for v in o.values(): walk(v)
    elif isinstance(o, list):
        for v in o: walk(v)
walk(root)
p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8"); print(key, part, "바꿈", n)
