"""필살기 전용 이펙트 2판(2026-10-26): 그 인물 전투 자세 그림을 넣어 크기·톤을 맞추고(pro + sprite), 캐릭터를 지우고, 1배로 쓴다.
설명: docs/필살기_이펙트_설명.json. 이름 sup2-<번호>. 끝나면 인물 설정 super 첫 이벤트의 big 을 sup2 로 바꿈.
사용: python3 supers2.py [동시에 몇 개, 기본 6]"""
import json, subprocess, sys, re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import m3

BASE = Path(__file__).resolve().parent; ROOT = BASE.parents[2]
VFX = BASE.parent / "testroom3" / "vfx"; CH = BASE.parent / "testroom3" / "chars"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 6
DIRS = {f"{a}_{b}": ("W" if "(W)" in d else "E") for a, b, d in re.findall(r"^\| (\d+\.\d+) \| (\S+) \| ([^|]+) \|", (ROOT / "docs/동작표_3판/00_목록.md").read_text(), re.M)}


def one(it):
    key = it["key"]; name = "sup2-" + key.split("_")[0]
    if (VFX / f"{name}.json").exists(): return key + " 이미 있음"
    row, fr = m3.state(key)["picks"]["전투 자세 장"]
    sprite = BASE / key / row / f"{fr - 1:02d}.png"
    d = DIRS.get(key, "E"); side = "left" if d == "W" else "right"
    desc = (it["desc"].replace("no characters, no people", "no other characters").replace("No characters, no people", "No other characters")
            + f" The whole effect happens in front of the character toward the {side}, much larger than the character and filling the space ahead,"
            " never covering or touching the character. Same pixel size and crisp pixel-art style as the character.")
    r = subprocess.run([sys.executable, str(BASE / "vfx2.py"), name, desc[:1900], str(sprite), d, "bottom", key], capture_output=True, text=True)
    return key + " " + (r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-300:])


def link(key):
    name = "sup2-" + key.split("_")[0]
    if not (VFX / f"{name}.json").exists(): return
    p = CH / f"{key}.json"; d = json.loads(p.read_text()); ev = d["skills"]["super"]["events"]
    for e in ev:
        for f in e.get("fx", []):
            if f.get("t") == "big": f["vfx"] = name
    if not any(f.get("t") == "big" for e in ev for f in e.get("fx", [])): ev[0].setdefault("fx", []).append({"t": "big", "vfx": name})
    p.write_text(json.dumps(d, ensure_ascii=False, indent=1))


items = json.loads((ROOT / "docs" / "필살기_이펙트_설명.json").read_text())
with ThreadPoolExecutor(N) as ex:
    for msg in ex.map(one, items): print(msg, flush=True)
for it in items: link(it["key"])
print("끝", flush=True)
