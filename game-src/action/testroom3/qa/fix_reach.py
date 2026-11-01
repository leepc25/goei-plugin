"""기술 판정 사거리 고치기(10-29 사용자: 피격 판정이 이상해 잘 안 맞음).
기준: 평타(melee 170)가 닿는 거리 ≈ 234px. 부품마다 「앞으로 닿는 거리」를 계산해 235 미만이면 설정을 고친다(그림 자리 dx를 앞으로, 모자라면 판정 반지름 r·scale).
  v(hit): at front → dx + (r ?? fw*0.4)*scale + 20 · at hand → 50 + dx + … · at self → (r ?? fw*0.4)*scale + 20 (scale도 키워 그림이 닿게)
  blast: hand 50 + dx + (r||110) · circle: r(260) · spikes: dx(150) + spread(70) + 30 · slash: dx(150) + size(160)
  dash(hit 없음) 뒤에 앞 판정이 오면 stop:true(상대에 걸리면 멈춤 — 지나쳐 버려 빗나감 방지)
사용: python3 qa/fix_reach.py [--dry]"""
import json, sys, glob, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
DRY = "--dry" in sys.argv
R = 235
FW = {}
for js in (HERE / "vfx").glob("*.json"):
    try: FW[js.stem] = json.loads(js.read_text())["frames"][0]["frame"]["w"]
    except Exception: pass
for js in (HERE.parent / "eileen" / "vfx").glob("*.json"):
    try: FW.setdefault(js.stem, json.loads(js.read_text())["frames"][0]["frame"]["w"])
    except Exception: pass
log = []

def fix_part(s, key, path):
    t = s.get("t")
    if t == "v" and s.get("hit") and s.get("at") in (None, "front", "hand", "self"):
        fw = FW.get(s.get("vfx"), 200); sc = s.get("scale", 1); rr = (s["r"] if "r" in s else fw * 0.4) * sc
        base = 50 if s.get("at") == "hand" else 0
        dx = s.get("dx", 150 if s.get("at") in (None, "front") else 0) if s.get("at") != "self" else s.get("dx", 0)
        reach = base + dx + rr + 20
        if reach >= R: return
        if s.get("at") == "self" and dx != 0: return   # 지나친 뒤 뒤쪽에 남기는 베기 등(검사 c2)은 따로
        old = dict(s)
        if s.get("at") == "self":
            # 둘레 그림: 그림이 닿게 scale 키우고 판정은 그 그림 폭에
            need = R - 20
            if fw * sc / 2 < need: s["scale"] = round(min(1.6, need * 2 / fw), 2); sc = s["scale"]
            s["r"] = round(need / sc, 1)
        else:
            want_dx = R - 20 - rr - base
            s["dx"] = int(min(170, max(dx, want_dx)))
            if base + s["dx"] + rr + 20 < R: s["r"] = round((R - 20 - base - s["dx"]) / max(0.2, sc), 1)
        log.append((key, path, "v", {k: old.get(k) for k in ("at", "dx", "r", "scale")}, {k: s.get(k) for k in ("at", "dx", "r", "scale")}))
    elif t == "blast" and s.get("hit") and s.get("at") in (None, "hand", "front", "self"):
        base = 50 if s.get("at") in (None, "hand") else 0; dx = s.get("dx", 150 if s.get("at") == "front" else 0); r = s.get("r", 110)
        if base + dx + r < R:
            old = dict(s); s["r"] = int(R - base - dx); log.append((key, path, "blast", {"dx": dx, "r": r}, {"dx": dx, "r": s["r"]}))
    elif t == "circle" and s.get("hit"):
        if s.get("r", 260) < R: old = s.get("r"); s["r"] = R; log.append((key, path, "circle", old, R))
    elif t == "spikes" and s.get("hit"):
        dx = s.get("dx", 150); sp = s.get("spread", 70)
        if dx + sp + 30 < R: old = dx; s["dx"] = int(R - sp - 30); log.append((key, path, "spikes", old, s["dx"]))
    elif t == "slash" and s.get("hit") and s.get("at") != "center":
        dx = s.get("dx", 150); size = s.get("size", 160)
        if dx + size < R: old = dx; s["dx"] = int(R - size); log.append((key, path, "slash", old, s["dx"]))

def walk(o, key, path, seq_parent=None):
    if isinstance(o, list):
        for i, s in enumerate(o):
            if isinstance(s, dict) and s.get("t") == "dash" and not s.get("hit") and not s.get("stop"):
                # 같은 목록 뒤(또는 later 안)에 앞 판정 부품이 있으면 걸리면 멈춤
                rest = json.dumps(o[i + 1:], ensure_ascii=False)
                if re.search(r'"t": ?"(v|melee|blast|slash|spikes)"', rest) and '"at": "target"' not in rest:
                    s["stop"] = True; log.append((key, path, "dash.stop", None, True))
            walk(s, key, f"{path}[{i}]")
    elif isinstance(o, dict):
        if "t" in o: fix_part(o, key, path)
        for k, v in o.items():
            if k != "hit": walk(v, key, f"{path}.{k}")

n = 0
for p in sorted(glob.glob(str(HERE / "chars" / "*.json"))):
    d = json.loads(Path(p).read_text(encoding="utf-8")); key = d["key"]; sk = d.get("skills") or {}
    before = json.dumps(sk, ensure_ascii=False)
    for part in ("skill", "skill2", "super", "charge"):
        if sk.get(part): walk(sk[part], key, part)
    if json.dumps(sk, ensure_ascii=False) != before:
        n += 1
        if not DRY: Path(p).write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
for l in log: print(l)
print("고친 인물", n, "변경", len(log), "(dry)" if DRY else "")
