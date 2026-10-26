"""기술 이펙트 3판 생성(2026-10-26): docs/기술_재설계/00_이펙트_목록.md 를 영어 설명으로 옮긴 fx3_manifest.json 을 읽어
그 인물 전투 자세 그림을 넣고(pro + sprite) 이펙트를 뽑고, 캐릭터를 지우고, 기계 검사까지 한다.
사용: python3 gen3.py [동시 개수, 기본 8] [이름 접두 필터]
결과: testroom3/vfx/<이름>.png/.json, fx3_status.json(기계 검사)"""
import json, re, sys, threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import m3, vfx

BASE = Path(__file__).resolve().parent; ROOT = BASE.parents[2]; OUT = vfx.OUT
MAN = BASE / "fx3_manifest.json"; ST = BASE / "fx3_status.json"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 8
PRE = sys.argv[2] if len(sys.argv) > 2 else ""
DIRS = {f"{a}_{b}": ("W" if "(W)" in d else "E") for a, b, d in re.findall(r"^\| (\d+\.\d+) \| (\S+) \| ([^|]+) \|", (ROOT / "docs/동작표_3판/00_목록.md").read_text(), re.M)}
LOCK = threading.Lock()


def sprite_of(key):
    row, fr = m3.state(key)["picks"]["전투 자세 장"]
    return BASE / key / row / f"{fr - 1:02d}.png"


def mech(name):
    """기계 검사: 빈 장, 너무 작음, 캔버스 끝에 잘림"""
    from PIL import Image
    m = json.loads((OUT / f"{name}.json").read_text()); im = Image.open(OUT / f"{name}.png").convert("RGBA")
    bad = []; empty = 0; cut = 0; px = []
    for f in m["frames"]:
        r = f["frame"]; c = im.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])); a = c.getchannel("A")
        n = sum(1 for v in a.getdata() if v); px.append(n)
        if n < 20: empty += 1
        b = a.getbbox()
        if b and (b[0] == 0 or b[1] == 0 or b[2] == r["w"]): cut += 1
    if empty > len(m["frames"]) // 2: bad.append(f"빈 장 {empty}/{len(m['frames'])}")
    if max(px) < 150: bad.append(f"너무 작음 {max(px)}px")
    if cut > len(m["frames"]) // 2: bad.append(f"캔버스 끝 잘림 {cut}장")
    return bad


def save(name, rec):
    with LOCK:
        s = json.loads(ST.read_text()) if ST.exists() else {}
        s[name] = rec; ST.write_text(json.dumps(s, ensure_ascii=False, indent=1))


def one(it):
    name = it["name"]
    if (OUT / f"{name}.json").exists(): return name + " 이미 있음"
    key = it["key"]; d = DIRS.get(key, "E"); side = "left" if d == "W" else "right"
    desc = (it["desc"].rstrip() + f" The character in the reference faces {side}; place the effect where the description says relative to"
            f" this character (forward = toward the {side}). Draw ONLY the effect, never redraw, cover or alter the character,"
            " no other people or creatures. Same pixel size and crisp pixel-art style as the character.")
    bad = ["예외"]
    for attempt in range(2):
        try:
            vfx.main(name, desc[:1950], key, str(sprite_of(key)), "pro", west=(d == "W"))
            vfx.repivot(name, it.get("mode", "bottom"))
        except SystemExit as e:
            save(name, {"ok": False, "why": str(e)[:200], "try": attempt + 1}); continue
        except Exception as e:
            save(name, {"ok": False, "why": repr(e)[:200], "try": attempt + 1}); continue
        bad = mech(name)
        save(name, {"ok": not bad, "why": bad, "try": attempt + 1, "key": key, "row": it.get("row", "")})
        if not bad: return name + " 완료"
        if attempt == 0:   # 기계 불량이면 한 번만 다시
            for ext in (".png", ".json"): (OUT / f"{name}{ext}").unlink(missing_ok=True)
    return name + " 불량 " + str(bad)


if __name__ == "__main__":
    items = [x for x in json.loads(MAN.read_text()) if x["name"].startswith(PRE)]
    print(len(items), "개 시작", flush=True)
    with ThreadPoolExecutor(N) as ex:
        for msg in ex.map(one, items): print(msg, flush=True)
    print("끝", flush=True)
