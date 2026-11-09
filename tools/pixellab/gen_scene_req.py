"""새 장면(앞 판 없음) 요청 JSON 그대로 1장 보내기. gen_from_req.py의 prompt_diff는 엘리베이터 홀 앞 판과 대조하므로 새 장면엔 맞지 않음(11-09 망상홈쇼핑).
사용: python3 tools/pixellab/gen_scene_req.py <req.json> <out.png>  — 승인 문(.pixellab_ok) 1회 씀"""
import sys, json, base64, time, requests
sys.path.insert(0, '/home/user/goei-plugin/tools')
import pixellab_gate as g
req, out = sys.argv[1:3]
body = json.load(open(req))
g.spend("장면 1장 " + req)
API = "https://api.pixellab.ai/v2"
c0 = requests.get(API + "/balance", timeout=30).json()["credits"]["usd"]
r = requests.post(API + "/generate-image-v2", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:500]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8); j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:500]); sys.exit(1)
img = j["last_response"]["images"][0]; d = img["base64"] if isinstance(img, dict) else img
open(out, "wb").write(base64.b64decode(d.split(",")[-1]))
print("usage", json.dumps(j.get("usage") or j["last_response"].get("usage")), "credits used", round(c0 - requests.get(API + "/balance", timeout=30).json()["credits"]["usd"], 3))
