"""기계 검사만 하는 자동 검수(2026-10-25 사용자 지시: 다시 뽑기는 멈춤·빈 장 같은 기계적 실패에만).
사용: python3 mech.py <줄...>  예) python3 mech.py 18-1 18-2 18-3 43 44 45
- 줄 결과가 새로 나오면 검사: 장이 비었나(그림 면적이 첫 장의 20% 미만), 멈췄나(어느 장도 첫 장과 거의 같음).
- 통과 → m3 ok. 실패 → 다시 넣음(줄마다 2번까지), 그래도 실패면 기록만.
- 동작이 좋은지 나쁜지는 판정하지 않는다(사용자 몫).
기록: mech.json(키 → 줄 → {checked: 그림 시각, result, tries})"""
import json, subprocess, sys, time
from pathlib import Path
import numpy as np
from PIL import Image
import m3

BASE = Path(__file__).resolve().parent
REC = BASE / "mech.json"
SMALL = {"43", "45", "1", "3", "W_1", "28", "29", "30", "31", "17", "21"}   # 원래 움직임이 작은 줄(대기·끄덕임 등)


def load():
    try: return json.loads(REC.read_text())
    except Exception: return {}


def check(key, f):
    fs = sorted((BASE / key / f).glob("[0-9][0-9].png"))
    if len(fs) < 4: return f"장 수 {len(fs)}"
    ims = [np.array(Image.open(p).convert("RGBA")).astype(int) for p in fs]
    area = [(a[:, :, 3] > 40).sum() for a in ims]
    if min(area) < 0.2 * area[0]: return f"빈 장(그림 면적 {min(area)}/{area[0]})"
    a0 = ims[0]; tot = max(1, (a0[:, :, 3] > 40).sum())
    mv = max((((np.abs(a - a0)[:, :, :3].sum(axis=2) > 60) | ((a[:, :, 3] > 40) != (a0[:, :, 3] > 40))).sum()) / tot for a in ims[1:])
    if mv < (0.04 if f in SMALL else 0.10): return f"멈춤(가장 많이 바뀐 장도 {mv:.0%})"
    return None


def run(rows):
    global REC
    npc = rows == ["--npc"]
    if npc: REC = BASE / "mech_npc.json"   # 두 검사가 같은 기록 파일을 덮지 않게
    keys = [k for k in m3.order() if (k.startswith("6.") if npc else not k.startswith(("6.", "9.")) and k != "1.4_에일린")]
    todo = {(k, r.replace("-", "_")) for k in keys for r in rows} if not npc else set()
    while True:
        if npc:   # NPC: 표에 적힌 줄 전부(표가 쓰이는 중이라 매번 다시 읽음)
            for k in keys:
                try: todo |= {(k, r.replace("-", "_")) for r in m3.table(k)["rows"]}
                except Exception: pass
        rec = load(); busy = {p.name.split("__")[1] + "/" + p.name.split("__")[2].rsplit(".", 1)[0] for s in ("pending", "running") for p in (m3.Q / s).glob("*.json")}
        left = 0
        for k, f in sorted(todo):
            r = rec.setdefault(k, {}).setdefault(f, {"tries": 0})
            if r.get("result") in ("ok", "기계 실패"): continue
            left += 1
            p = BASE / k / f / "00.png"
            if f"{k}/{f}" in busy or not p.exists(): continue
            t = p.stat().st_mtime
            if r.get("checked") == t: continue
            r["checked"] = t
            bad = check(k, f)
            if not bad:
                r["result"] = "ok"; subprocess.run([sys.executable, str(BASE / "m3.py"), "ok", k, f], capture_output=True)
                print(time.strftime("%H:%M:%S"), k, f, "통과", flush=True)
            elif r["tries"] < 2:
                r["tries"] += 1; r["result"] = bad
                subprocess.run([sys.executable, str(BASE / "m3.py"), "enq", k, f.replace("_", "-")], capture_output=True)
                print(time.strftime("%H:%M:%S"), k, f, bad, "→ 다시 넣음", r["tries"], flush=True)
            else:
                r["result"] = "기계 실패"; r["why"] = bad
                if npc: subprocess.run([sys.executable, str(BASE / "m3.py"), "ok", k, f], capture_output=True)   # 뒤 줄 시작 장이 될 수 있어 막히지 않게(판정은 사용자)
                print(time.strftime("%H:%M:%S"), k, f, bad, "→ 기계 실패로 둠", flush=True)
        REC.write_text(json.dumps(rec, ensure_ascii=False, indent=1))
        if left == 0 and (not npc or len({k for k, _ in todo}) == len(keys)): print("모두 끝"); return
        time.sleep(60)


if __name__ == "__main__":
    run(sys.argv[1:])
