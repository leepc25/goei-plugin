"""PixelLab VFX(/v2/vfx)로 이펙트 그림을 만들어 테스트룸 vfx 폴더에 넣는다.
사용: python3 game-src/action/motion3/vfx.py <이름> "<설명(영어)>" [<키(회수 기록용)>]
결과: game-src/action/testroom3/vfx/<이름>.png + .json (build.py가 읽음)"""
# --- PixelLab 생성 승인 문 (2026-10-31 사용자: 시키지 않은 생성 금지) — 이 파일의 모든 생성 요청은 .pixellab_ok 회수가 있어야 나간다
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
# ---
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


def strip(name, sprite, west=True):
    """캐릭터 그림이 들어간 이펙트에서 캐릭터 화소를 지우고(이펙트만 남김), 서쪽 그림이면 좌우 반전해 동쪽 기준으로 맞춘다.
    pivot은 캐릭터 발(anchor)이라, 게임에서 캐릭터 발 자리에 캐릭터 배율로 그리면 손 위치가 맞는다."""
    from PIL import Image, ImageChops
    js = OUT / f"{name}.json"; meta = json.loads(js.read_text())
    im = Image.open(OUT / f"{name}.png").convert("RGBA"); sp = Image.open(sprite).convert("RGBA")
    bb = sp.getbbox(); sc = sp.crop(bb); an = meta["meta"]["anchor"]
    x0 = an["x"] - (bb[2] - bb[0]) // 2; y0 = an["y"] - (bb[3] - bb[1])
    def frame(f): r = f["frame"]; return im.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))
    best = None
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            c = frame(meta["frames"][-1]).crop((x0 + dx, y0 + dy, x0 + dx + sc.width, y0 + dy + sc.height))
            d = ImageChops.difference(c, sc).convert("L").point(lambda v: 255 if v else 0).histogram()[255]
            if best is None or d < best[0]: best = (d, x0 + dx, y0 + dy)
    _, ox, oy = best
    nsp = sum(1 for v in sc.getchannel("A").getdata() if v)
    if an.get("kind") != "feet" or best[0] > nsp * 0.2:   # 이펙트 안에 캐릭터가 안 그려졌음 → 지우지 않음(이펙트 화소를 지우면 안 됨)
        print(name, "캐릭터 없음(맞춤 차이", best[0], ") → 지우기 건너뜀"); ox = None
    from PIL import ImageFilter
    mask = sc.getchannel("A").point(lambda v: 255 if v else 0).filter(ImageFilter.MaxFilter(3))   # 캐릭터 윤곽(1칸 넓힘): 이펙트 빛을 받은 몸도 지움
    out = im.copy(); sa = mask.load()
    for f in (meta["frames"] if ox is not None else []):
        r = f["frame"]; px = out.load()
        for y in range(sc.height):
            for x in range(sc.width):
                if not sa[x, y]: continue
                if 0 <= ox + x < r["w"] and 0 <= oy + y < r["h"]: px[r["x"] + ox + x, r["y"] + oy + y] = (0, 0, 0, 0)
    if west:
        fl = Image.new("RGBA", out.size)
        for f in meta["frames"]:
            r = f["frame"]; fl.paste(frame_of(out, r).transpose(Image.FLIP_LEFT_RIGHT), (r["x"], r["y"]))
            f["pivot"]["x"] = 1 - f["pivot"]["x"]
        out = fl; meta["meta"]["anchor"]["x"] = meta["frames"][0]["frame"]["w"] - an["x"]
    meta["meta"]["stripped"] = True
    out.save(OUT / f"{name}.png"); js.write_text(json.dumps(meta))
    print(name, "캐릭터 지움, 맞춤 차이", best[0], "반전" if west else "")


def frame_of(im, r): return im.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]))


def main(name, desc, key="vfx", sprite=None, artist="lite", west=True):
    OUT.mkdir(parents=True, exist_ok=True)
    body = {"description": desc, "name": name, "artist": artist}
    if sprite:   # 캐릭터 그림을 넣으면 그 크기·톤에 맞춰 이펙트를 만든다
        import base64
        body["sprite"] = {"type": "base64", "base64": base64.b64encode(Path(sprite).read_bytes()).decode(), "format": "png"}
    res = req("POST", "/vfx", body)
    job = res.get("background_job_id")
    print(name, "보냄, 견적", res.get("quoted_generations"), "job", job, flush=True)
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
    if sprite:
        import shutil; (OUT / "raw").mkdir(exist_ok=True)
        for ext in (".png", ".json"): shutil.copy(OUT / f"{name}{ext}", OUT / "raw" / f"{name}{ext}")   # 지우기 전 원본
        strip(name, sprite, west)


if __name__ == "__main__":
    a = sys.argv[1:]; kw = {}
    if a[0] == "strip": strip(a[1], a[2]); sys.exit()
    for f in ("--sprite", "--artist"):
        if f in a: i = a.index(f); kw[f[2:]] = a[i + 1]; a = a[:i] + a[i + 2:]
    main(*a, **kw)


def repivot(name, mode="bottom"):
    """캐릭터를 지운 뒤 이펙트 자체 기준점으로: bottom(바닥 가운데) | center. meta.native=True(1배로 씀)"""
    from PIL import Image
    js = OUT / f"{name}.json"; m = json.loads(js.read_text()); im = Image.open(OUT / f"{name}.png")
    xs, ys, bots = [], [], []
    for f in m["frames"]:
        r = f["frame"]; b = im.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])).getbbox()
        if b: xs += [b[0], b[2]]; ys += [b[1], b[3]]; bots.append(b[3])
    r = m["frames"][0]["frame"]
    cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2 if mode == "center" else sorted(bots)[len(bots) // 2]
    for f in m["frames"]: f["pivot"] = {"x": cx / r["w"], "y": cy / r["h"]}
    m["meta"]["native"] = True; m["meta"]["box"] = [min(xs), min(ys), max(xs), max(ys)]
    js.write_text(json.dumps(m))
