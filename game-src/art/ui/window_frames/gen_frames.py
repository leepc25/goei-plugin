# --- PixelLab 생성 승인 문 (2026-10-31 사용자: 시키지 않은 생성 금지) — 이 파일의 모든 생성 요청은 .pixellab_ok 회수가 있어야 나간다
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
# ---
# 통합창 틀 3종 (2026-11-01 사용자 「일단 틀부터 진행해봐」). 계획: docs/통합창_PixelLab_생성계획_1101.md
import json, urllib.request, time, base64, sys, os, threading
API = "https://api.pixellab.ai/v2"
PAL = {"colors": ["#0b0d10", "#1b2026", "#2e353c", "#4a525a", "#7a8188", "#b4b8bc", "#e6e4dc"], "max_colors": 7}
OUT = os.path.dirname(os.path.abspath(__file__))
STYLE = "dark gunmetal steel, crisp 1px bevel, small corner rivets, minimal, monochrome"
jobs = {
 "window": ("/create-ui-asset", {
    "description": "status window panel for a modern action game HUD, " + STYLE,
    "image_size": {"width": 640, "height": 360},
    "pieces": [
      {"id": "head", "kind": "rounded_rect", "x": 0, "y": 0, "w": 512, "h": 56, "radius": 2, "label": "header"},
      {"id": "stats", "kind": "rounded_rect", "x": 0, "y": 60, "w": 150, "h": 150, "radius": 2, "label": "stats"},
      {"id": "skills", "kind": "rounded_rect", "x": 154, "y": 60, "w": 180, "h": 150, "radius": 2, "label": "skills"},
      {"id": "perks", "kind": "rounded_rect", "x": 338, "y": 60, "w": 174, "h": 150, "radius": 2, "label": "perks"},
      {"id": "items", "kind": "rounded_rect", "x": 0, "y": 214, "w": 512, "h": 74, "radius": 2, "label": "inventory"}],
    "target_palette": PAL, "no_background": True, "name": "goei status window"}),
 "rim": ("/generate-ui-v2", {
    "description": "round perk badge rim, silver steel, empty transparent center, crisp pixel art, minimal",
    "image_size": {"width": 32, "height": 32}, "target_palette": PAL, "no_background": True}),
 "card": ("/generate-ui-v2", {
    "description": "vertical perk card frame, dark gunmetal steel, crisp bevel, empty transparent center, minimal, monochrome",
    "image_size": {"width": 96, "height": 128}, "target_palette": PAL, "no_background": True}),
}
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p):
    return json.load(urllib.request.urlopen(API + p, timeout=60))
def save_b64(b, path):
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(path, "wb").write(base64.b64decode(b))
def run(k):
    path, body = jobs[k]
    _gate.spend(f"{k} {path}")
    try:
        res = post(path, body)
    except urllib.error.HTTPError as e:
        print(k, "HTTP", e.code, e.read()[:500].decode(errors="replace"), flush=True); return
    print(k, "sent", json.dumps(res)[:300], flush=True)
    json.dump(res, open(f"{OUT}/{k}_sent.json", "w"))
    jid = res.get("background_job_id"); aid = res.get("ui_asset_id")
    for _ in range(240):
        time.sleep(5)
        try:
            r = get(f"/ui-assets/{aid}") if aid else get(f"/background-jobs/{jid}")
        except Exception as e:
            print(k, "poll err", e, flush=True); continue
        st = r.get("status")
        if st in ("completed", "failed", "error"): break
    json.dump(r, open(f"{OUT}/{k}_job.json", "w"))
    n = 0
    if aid:
        url = r.get("image_url")
        if url:
            open(f"{OUT}/{k}_0.png", "wb").write(urllib.request.urlopen(url, timeout=60).read()); n = 1
    else:
        imgs = (r.get("last_response") or {}).get("images") or []
        for i, im in enumerate(imgs):
            b = im.get("base64") if isinstance(im, dict) else im
            if b: save_b64(b, f"{OUT}/{k}_{i}.png"); n += 1
    usage = (r.get("usage") or (r.get("last_response") or {}).get("billing_usage") or {})
    print(k, "DONE", st, "images", n, "usage", json.dumps(usage), flush=True)
    open(f"{OUT}/spend.log", "a").write(f"{time.strftime('%Y-%m-%d %H:%M')} {path} {k} {body['image_size']['width']}x{body['image_size']['height']} images={n} usage={json.dumps(usage)}\n")
ts = [threading.Thread(target=run, args=(k,)) for k in jobs]
[t.start() for t in ts]; [t.join() for t in ts]
