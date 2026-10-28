"""돌진(dash, 걸리면 멈춤)·끌어당김(pull) 뒤에 오는 앞 판정이 상대를 지나쳐 빗나가는 것 고치기(10-29).
dash 가 상대 70px 앞에서 멈추므로, 같은 기술 안에서 그 뒤에 오는 front/hand 부품(v·melee·blast)은 dx ≤ 70, 판정 반지름(r×scale) ≥ 100 으로."""
import json, glob, sys
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
FW = {}
for js in list((HERE / "vfx").glob("*.json")) + list((HERE.parent / "eileen" / "vfx").glob("*.json")):
    try: FW.setdefault(js.stem, json.loads(js.read_text())["frames"][0]["frame"]["w"])
    except Exception: pass
log = []

def flat(o, out):
    if isinstance(o, dict):
        if "t" in o: out.append(o)
        for k, v in o.items():
            if k != "hit": flat(v, out)
    elif isinstance(o, list):
        for v in o: flat(v, out)
    return out

def fix_seq(parts, key, tag):
    seen = False
    for s in parts:
        t = s.get("t")
        if t in ("dash", "pull"): seen = True; continue
        if t == "teleport": seen = True; continue
        if not seen or not s.get("hit"): continue
        if t == "v" and s.get("at") in (None, "front", "hand"):
            sc = s.get("scale", 1); fw = FW.get(s.get("vfx"), 200); r = s.get("r", fw * 0.4)
            old = (s.get("dx"), r)
            if (s.get("dx") or 150) > 70: s["dx"] = 60 if s.get("at") != "hand" else 20
            if r * sc < 100: s["r"] = round(100 / max(0.2, sc), 1)
            if old != (s.get("dx"), s.get("r", r)): log.append((key, tag, "v", old, (s["dx"], s.get("r"))))
        elif t == "melee" and s.get("range", 170) < 190:
            log.append((key, tag, "melee", s.get("range"), 190)); s["range"] = 190

for p in sorted(glob.glob(str(HERE / "chars" / "*.json"))):
    d = json.loads(Path(p).read_text(encoding="utf-8")); key = d["key"]; sk = d.get("skills") or {}
    before = json.dumps(sk)
    for part in ("skill", "skill2"):
        if sk.get(part): fix_seq(flat(sk[part], []), key, part)
    ch = sk.get("charge")
    if ch:
        for lv, lst in (ch.get("lv") or {}).items(): fix_seq(flat(lst, []), key, "c" + lv)
    if json.dumps(sk) != before: Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
for l in log: print(l)
print("변경", len(log))
