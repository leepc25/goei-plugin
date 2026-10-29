"""필살기 전용 이펙트를 차례로 뽑아 인물 설정에 붙인다(docs/필살기_이펙트_설명.json). 잔액이 RESERVE 아래면 멈춤.
사용: python3 supers.py [RESERVE]"""
import json, subprocess, sys, urllib.request
from pathlib import Path
BASE = Path(__file__).resolve().parent; ROOT = BASE.parents[2]
VFX = BASE.parent / "testroom3" / "vfx"; CH = BASE.parent / "testroom3" / "chars"
RESERVE = int(sys.argv[1]) if len(sys.argv) > 1 else 20
def bal():
    with urllib.request.urlopen("https://api.pixellab.ai/v2/balance", timeout=60) as r: return json.load(r)["subscription"]["generations"]
for it in json.loads((ROOT / "docs" / "필살기_이펙트_설명.json").read_text()):
    key = it["key"]; name = "sup-" + key.split("_")[0]
    if not (VFX / f"{name}.json").exists():
        b = bal()
        if b < RESERVE + 8: print("잔액", int(b), "→ 멈춤(남김", RESERVE, ")", flush=True); break
        r = subprocess.run([sys.executable, str(BASE / "vfx.py"), name, it["desc"], key, "--artist", "pro"], capture_output=True, text=True)
        print(key, r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-200:], flush=True)
        if not (VFX / f"{name}.json").exists(): continue
    p = CH / f"{key}.json"; d = json.loads(p.read_text()); ev = d["skills"]["super"]["events"]
    if not any(f.get("t") == "big" for e in ev for f in e.get("fx", [])):
        ev[0].setdefault("fx", []).append({"t": "big", "vfx": name}); p.write_text(json.dumps(d, ensure_ascii=False, indent=1)); print(key, "연결", flush=True)
print("끝", flush=True)
