"""소지품 그림 1회(16칸) 뽑기: create-1-direction-object, size 85, item_descriptions.
사용: python3 tools/pixellab/item_icons_batch.py <회차 1부터>
목록 = game-src/items/icon_list.json, 결과 = game-src/items/raw/batch_NN/"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
import json, sys, time, pathlib, requests
ROOT = pathlib.Path(__file__).resolve().parents[2]
API = "https://api.pixellab.ai/v2"
n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
items = json.load(open(ROOT / "game-src/items/icon_list.json", encoding="utf-8"))["items"][(n - 1) * 16:n * 16]
COMMON = "pixel art item icon, single object, centered, dark modern Korean urban horror setting, clean outline"
out = ROOT / f"game-src/items/raw/batch_{n:02d}"; out.mkdir(parents=True, exist_ok=True)
body = {"description": COMMON, "size": 85, "view": "sidescroller",
        "item_descriptions": [f"{it['en']}, {COMMON}" for it in items]}
json.dump({"body": body, "items": items}, open(out / "request.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
bal = lambda: requests.get(API + "/balance", timeout=30).json()
b0 = bal(); print("before", json.dumps(b0), flush=True)
_gate.spend(f"item_icons_batch {n}회")
t0 = time.time()
r = requests.post(API + "/create-1-direction-object", json=body, timeout=60)
print("post", r.status_code, r.text[:600], flush=True)
if r.status_code >= 300: sys.exit(1)
oid = r.json()["object_id"]
while True:
    time.sleep(10)
    o = requests.get(f"{API}/objects/{oid}", timeout=30).json()
    st = o.get("status"); print("status", st, flush=True)
    if st in ("review", "completed", "failed") or o.get("frame_urls"): break
json.dump(o, open(out / "object.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
urls = o.get("frame_urls") or list((o.get("rotation_urls") or {}).values())
for i, u in enumerate(urls):
    if not u: continue
    open(out / f"{i + 1:02d}.png", "wb").write(requests.get(u, timeout=60).content)
b1 = bal()
print(json.dumps({"seconds": round(time.time() - t0, 1), "frames": len(urls), "object_id": oid,
                  "usd_used": round(b0["credits"]["usd"] - b1["credits"]["usd"], 4),
                  "gens_used": b0["subscription"]["generations"] - b1["subscription"]["generations"]}))
