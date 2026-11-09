"""pixflux 요청 JSON 1장 보내기(배경 작업판). 승인 문(.pixellab_ok) 1회 씀. 11-09 망상홈쇼핑 장면.
사용: python3 tools/pixellab/gen_pixflux_req.py <req.json> <out.png>"""
import sys, json, base64, time, requests
sys.path.insert(0, '/home/user/goei-plugin/tools')
import pixellab_gate as g
req, out = sys.argv[1:3]
body = json.load(open(req))
g.spend("pixflux 1장 " + req)
API = "https://api.pixellab.ai/v2"
bal = lambda: requests.get(API + "/balance", timeout=30).json()
b0 = bal()
r = requests.post(API + "/create-image-pixflux-background", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:500]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(6); j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:500]); sys.exit(1)
lr = j["last_response"]; img = lr.get("image") or lr["images"][0]; d = img["base64"] if isinstance(img, dict) else img
open(out, "wb").write(base64.b64decode(d.split(",")[-1]))
b1 = bal()
print("usage", json.dumps(j.get("usage") or lr.get("usage")), "credits", round(b0["credits"]["usd"] - b1["credits"]["usd"], 3), "gens", b0["subscription"]["generations"] - b1["subscription"]["generations"])
