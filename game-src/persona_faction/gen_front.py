"""세력별 기본 페르소나 정면 그림 (create-image-pro-flash 128x256, 화풍 = 에일린 정면). 사용: python3 gen_front.py <키…>
승인 문(tools/pixellab_gate.py)을 거친다. 결과: front/<키>.png, front/<키>_job.json"""
import base64, json, sys, time, subprocess, urllib.request, urllib.error
from pathlib import Path
HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "tools")); import pixellab_gate
API = "https://api.pixellab.ai/v2"
P = json.loads((HERE / "prompts_v2.json").read_text())
def call(m, path, body=None):
    r = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as f: return json.loads(f.read())
(HERE / "front").mkdir(exist_ok=True)
for k in sys.argv[1:]:
    pixellab_gate.check("POST", "/create-image-pro-flash", f"persona {k}")
    body = {"description": P[k]["prompt"], "image_size": {"width": 128, "height": 256}, "no_background": True,
            "style_image": {"image": {"type": "base64", "base64": base64.b64encode((HERE / P[k].get("style", "style_eileen_256_crop128.png")).read_bytes()).decode(), "format": "png"}, "size": {"width": 128, "height": 256}, "usage_description": P[k].get("usage", "Style reference only: match its pixel density, outlines and shading. Do not copy this person, hair, face or clothing.")},
            "style_options": P[k].get("opts", {"color_palette": False, "outline": True, "detail": True, "shading": True})}
    if P[k].get("max_colors"): body["target_palette"] = {"max_colors": P[k]["max_colors"]}
    if P[k].get("seed") is not None: body["seed"] = P[k]["seed"]
    try: j = call("POST", "/create-image-pro-flash", body)
    except urllib.error.HTTPError as e: print(k, "HTTP", e.code, e.read().decode()[:1500]); continue
    pixellab_gate.guard("POST", "/create-image-pro-flash", f"persona {k}")
    jid = j.get("background_job_id") or j.get("job_id"); print(k, "job", jid, flush=True)
    while True:
        time.sleep(8); s = call("GET", f"/background-jobs/{jid}")
        if s.get("status") in ("completed", "failed"): break
    (HERE / "front" / f"{k}_job.json").write_text(json.dumps({x: y for x, y in s.items() if x != "last_response"} | {"usage": (s.get("last_response") or {}).get("usage")}, ensure_ascii=False, indent=1))
    lr = s.get("last_response") or {}
    url = lr.get("image_url"); imgs = lr.get("images") or []
    if imgs and isinstance(imgs[0], dict) and imgs[0].get("base64"): (HERE / "front" / f"{k}.png").write_bytes(base64.b64decode(imgs[0]["base64"]))
    elif url: subprocess.run(["curl", "-sSf", "-o", str(HERE / "front" / f"{k}.png"), url], check=True)
    print(k, s.get("status"), flush=True)
