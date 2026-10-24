"""PixelLab generate-image-v2로 배경 한 장. 인증은 프록시가 넣는다.
사용: python3 gen_bg.py <프롬프트.txt> <화풍그림> <출력.png> <가로> <세로> [화풍그림 축소배율]"""
import base64, io, json, sys, time
import requests
from PIL import Image

API = "https://api.pixellab.ai/v2"
prompt_path, style_path, out_path, w, h = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
scale = float(sys.argv[6]) if len(sys.argv) > 6 else 0.5

st = Image.open(style_path).convert("RGB")
st = st.resize((int(st.width * scale), int(st.height * scale)), Image.NEAREST)
buf = io.BytesIO(); st.save(buf, "PNG")
style = {"image": {"type": "base64", "base64": base64.b64encode(buf.getvalue()).decode(), "format": "png"},
         "size": {"width": st.width, "height": st.height}}

def balance():
    return requests.get(API + "/balance", timeout=30).json()["subscription"]["generations"]

b0 = balance()
body = {"description": open(prompt_path, encoding="utf-8").read().strip(), "image_size": {"width": w, "height": h},
        "no_background": False, "style_image": style}
t0 = time.time()
r = requests.post(API + "/generate-image-v2", json=body, timeout=60)
if r.status_code >= 300:
    print("error", r.status_code, r.text[:800]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8)
    j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"):
        break
dt = time.time() - t0
if j["status"] != "completed":
    print("failed", json.dumps(j)[:800]); sys.exit(1)
imgs = j["last_response"]["images"]
img = imgs[0]
data = img["base64"] if isinstance(img, dict) else img
open(out_path, "wb").write(base64.b64decode(data.split(",")[-1]))
print(json.dumps({"seconds": round(dt, 1), "images": len(imgs), "generations_used": round(b0 - balance(), 2)}))
