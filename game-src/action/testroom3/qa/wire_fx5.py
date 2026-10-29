"""prompts5.json 이펙트 21종 연결(10-29 사용자: 공용 이펙트 남은 곳 없애기).
요원 충전 2단 17명 → charge.hitVfx["2"](타격 자리에 전용 그림, 판정은 그대로). 에일린 고유기 D·충전 2단. NPC 진압(고유기 개머리판)·협회(떼어내기).
크기: 그림 폭이 허수아비 기준 약 220px(center) / 320px(bottom) 되게 hitScale 계산.
사용: python3 qa/wire_fx5.py   (있는 그림만 연결, 없는 건 건너뜀)"""
import json, sys
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
P = json.loads((HERE.parent / "motion3" / "_super_fx" / (sys.argv[1] if len(sys.argv) > 1 else "prompts5.json")).read_text())
def fw(name):
    js = HERE / "vfx" / f"{name}.json"
    if not js.exists(): return None
    return json.loads(js.read_text())["frames"][0]["frame"]["w"]
done = []
for e in P:
    key, name, mode = e["key"], e["name"], e["mode"]
    w = fw(name)
    if not w: print(name, "그림 없음, 건너뜀"); continue
    sc = round(min(1.6, max(0.4, (320 if mode == "bottom" else 220) / w)), 2)
    p = HERE / "chars" / f"{key}.json"; d = json.loads(p.read_text(encoding="utf-8")); sk = d["skills"]
    part = "skill" if "-D-" in name or name in ("x3-npc-riot-butt", "x3-npc-tear-off") else "charge"   # 사용: python3 qa/wire_fx5.py [prompts6.json]
    targets = [key]
    if key == "6.4_가짜관리국진압A": targets = ["6.4_가짜관리국진압A", "6.5_가짜관리국진압B", "6.6_가짜관리국진압C"]
    if key == "6.25_협회남1": targets = ["6.25_협회남1", "6.26_협회남2", "6.27_협회여1", "6.28_협회여2", "6.29_협회여3"]
    for k in targets:
        p = HERE / "chars" / f"{k}.json"; d = json.loads(p.read_text(encoding="utf-8")); sk = d["skills"]
        if part == "skill":
            sk["skill"]["hitVfx"] = name; sk["skill"]["hitScale"] = sc
        else:
            c = sk["charge"]; hv = c.get("hitVfx") if isinstance(c.get("hitVfx"), dict) else {}; hs = c.get("hitScale") if isinstance(c.get("hitScale"), dict) else {}
            hv["2"] = name; hs["2"] = sc; c["hitVfx"] = hv; c["hitScale"] = hs
        p.write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8"); done.append((k, part, name, sc))
for x in done: print(*x)
print("연결", len(done))
