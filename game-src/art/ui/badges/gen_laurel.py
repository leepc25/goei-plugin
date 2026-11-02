# 등급 월계관 한 장(384x192, 96px 칸 4x2)을 1회로 뽑는다. 사용자 11:28 「월계수는 별도로」, 11:31 「뽑아」.
# 윗줄 4칸 = 아래쪽 반 바퀴, 아랫줄 4칸 = 한 바퀴. 은색 한 가지, 동전 없음, 가운데 비움(1판 메달 61px 들어감). 동·금은 코드로.
import sys, pathlib, json, urllib.request, time, base64, os
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "tools"))
import pixellab_gate as gate
API = "https://api.pixellab.ai/v2"; OUT = os.path.dirname(os.path.abspath(__file__))
desc = ("pixel art icon sheet, 4 columns x 2 rows of 8 single-color silver laurel wreaths, each 96x96, evenly spaced. "
        "Each wreath is thick 3D silver with visible shading, all silver, seen from the front. "
        "No coin, no token, the center of every wreath is empty and transparent, about 64 pixels wide. "
        "Top row: 4 laurel wreaths covering only the bottom half, two branches meeting at the bottom, each a little different. "
        "Bottom row: 4 laurel wreaths going all the way around in a full circle, each a little different. "
        "Silver only, no other colors. No text. Everything else is up to you.")
body = {"description": desc, "image_size": {"width": 384, "height": 192}, "no_background": True}
print(len(desc), desc, flush=True)
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer x"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p): return json.load(urllib.request.urlopen(urllib.request.Request(API + p, headers={"Authorization": "Bearer x"}), timeout=60))
gate.spend("등급 월계관 384x192 generate-ui-v2")
res = post("/generate-ui-v2", body); print("sent", json.dumps(res)[:300], flush=True)
jid = res.get("background_job_id")
for _ in range(240):
    time.sleep(5); r = get(f"/background-jobs/{jid}")
    if r.get("status") in ("completed", "failed", "error"): break
imgs = (r.get("last_response") or {}).get("images") or []
for i, im in enumerate(imgs):
    b = im.get("base64") if isinstance(im, dict) else im
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(f"{OUT}/laurel_{i}.png", "wb").write(base64.b64decode(b))
for im in imgs:
    if isinstance(im, dict): im.pop("base64", None)
json.dump(r, open(f"{OUT}/laurel_job.json", "w"), ensure_ascii=False)
print("DONE", r.get("status"), len(imgs), json.dumps(r.get("usage") or {}), flush=True)
