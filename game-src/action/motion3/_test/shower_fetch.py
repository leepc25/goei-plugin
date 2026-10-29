"""사용자가 PixelLab 웹에서 직접 뽑아 둔 샤워 세트 2판을 서버에서 내려받아 _test/<키>/샤워2_<단계>/ 에 둔다(10-29: 콘쥬스·불량배여2·학생여1·학생여2).
같은 단계 후보가 여럿이면 목록 마지막(가장 나중) 것을 쓰고 나머지는 샤워2_<단계>_후보N/ 에 그대로 둔다(지우지 않음).
사용: python3 _test/shower_fetch.py <키> [...]"""
import sys, json
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import m3
HERE = Path(__file__).resolve().parent
PRE = {"A": "custom-Seen from the side facing", "B": "custom-Walking seen from the side", "D": "custom-Standing bare under a warm", "E": "custom-Standing bare under a shower"}
for key in sys.argv[1:]:
    T = m3.table(key); ch = m3.req("GET", f"/characters/{T['cid']}"); out = HERE / key; out.mkdir(exist_ok=True)
    for st, pre in PRE.items():
        cands = [a for a in ch["animations"] if (a.get("animation_type") or "").startswith(pre) and not (a.get("display_name") or "").startswith("v3")]
        if not cands: print(key, st, "서버에 없음"); continue
        for i, a in enumerate(reversed(cands)):
            o = out / (f"샤워2_{st}" if i == 0 else f"샤워2_{st}_후보{i}")
            if any(o.glob("[0-9][0-9].png")): print(key, st, "이미 있음", o.name); continue
            d = a["directions"][0]; o.mkdir(exist_ok=True); fr = [m3.fetch_png(u) for u in d["frames"]]
            for j, im in enumerate(fr): im.save(o / f"{j:02d}.png")
            m3.sheet(fr, out / f"{o.name}_sheet.png")
            m3.log(key, f"샤워2_{st} 서버에서 내려받음({o.name}) {len(fr)}장 {d['direction']} group={a.get('animation_group_id')}")
            print(key, st, o.name, len(fr), d["direction"])
