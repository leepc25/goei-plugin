"""PixelLab VFX(/v2/vfx)로 이펙트 그림을 만들어 테스트룸 vfx 폴더에 넣는다.
사용: python3 game-src/action/motion3/vfx.py <이름> "<설명(영어)>" [<키(회수 기록용)>]
결과: game-src/action/testroom3/vfx/<이름>.png + .json (build.py가 읽음)"""
import json, subprocess, sys, time, urllib.request
from pathlib import Path

API = "https://api.pixellab.ai/v2"
BASE = Path(__file__).resolve().parent
OUT = BASE.parent / "testroom3" / "vfx"


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.loads(resp.read() or b"{}")


def main(name, desc, key="vfx"):
    OUT.mkdir(parents=True, exist_ok=True)
    res = req("POST", "/vfx", {"description": desc, "name": name, "artist": "lite"})
    job = res.get("background_job_id")
    print(name, "보냄, 견적", res.get("quoted_generations"), flush=True)
    while True:
        time.sleep(8)
        try: j = req("GET", f"/background-jobs/{job}")
        except Exception: continue
        if j.get("status") in ("completed", "failed", "error", "cancelled"): break
    if j.get("status") != "completed": sys.exit(f"{name} 실패: {json.dumps(j)[:300]}")
    lr = j["last_response"]; files = lr["files"]
    urls = [u if isinstance(u, str) else u.get("url", "") for u in (files.values() if isinstance(files, dict) else files)]
    for ext in (".png", ".json"):
        u = next(x for x in urls if x.split("?")[0].endswith(ext) and "normals" not in x and "-game" not in x)
        data = subprocess.run(["curl", "-sSf", "--retry", "3", u], capture_output=True, check=True).stdout
        (OUT / f"{name}{ext}").write_bytes(data)
    line = time.strftime("%m-%d %H:%M:%S ") + f"VFX {name} 완료 {lr.get('canvas')} {lr.get('frames')}장 effect_id={lr.get('effect_id')}"
    print(line)
    log = BASE / key / "spend.log" if (BASE / key).exists() else BASE / "vfx_spend.log"
    with open(log, "a") as f: f.write(line + "\n")


if __name__ == "__main__":
    main(*sys.argv[1:])
