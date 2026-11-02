import sys, json, base64, time, requests
sys.path.insert(0, '/home/user/goei-plugin/tools')
import pixellab_gate as g
req, prompt, out = sys.argv[1:4]
import subprocess
if subprocess.call([sys.executable,"/home/user/goei-plugin/tools/pixellab/prompt_diff.py",prompt])!=0: sys.exit("대조 실패")
body = json.load(open(req)); body["description"] = open(prompt).read().strip()
g.spend("배경 1장")
API="https://api.pixellab.ai/v2"
b0=requests.get(API+"/balance",timeout=30).json()["subscription"]["generations"]
r=requests.post(API+"/generate-image-v2",json=body,timeout=60)
if r.status_code>=300: print("error",r.status_code,r.text[:500]); sys.exit(1)
job=r.json()["background_job_id"]
while True:
    time.sleep(8); j=requests.get(f"{API}/background-jobs/{job}",timeout=30).json()
    if j.get("status") in ("completed","failed"): break
if j["status"]!="completed": print("failed",json.dumps(j)[:500]); sys.exit(1)
img=j["last_response"]["images"][0]; d=img["base64"] if isinstance(img,dict) else img
open(out,"wb").write(base64.b64decode(d.split(",")[-1]))
print("used", round(b0-requests.get(API+"/balance",timeout=30).json()["subscription"]["generations"],2))
