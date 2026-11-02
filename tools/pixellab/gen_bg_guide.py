"""PixelLab generate-image-v2 배경 한 장 + 선 가이드(투명 바탕 선 그림) 하나만 reference_images로.
화풍·참고 그림은 넣지 않는다(사용자 11-01 14:33). 가이드는 사용자가 14:48에 직접 제안한 배치 선 그림.
사용: python3 gen_bg_guide.py <프롬프트.txt> <가이드.png> <출력.png> <가로> <세로>"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
import base64, json, subprocess, sys, time
import requests
from PIL import Image
API = "https://api.pixellab.ai/v2"
prompt_path, guide_path, out_path, w, h = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5])
if subprocess.call([sys.executable, str(_gp.Path(__file__).with_name('prompt_diff.py')), prompt_path]) != 0: sys.exit('요청문이 3층 원본 핵심 문장을 빠뜨림 — 중단')
_gate.spend(__file__ + " " + prompt_path)
USAGE = ("Layout guide only: black lines on a transparent background. Follow these lines exactly for the ceiling line, the line where the back wall meets the floor, "
         "the right side wall with its door, and the two partition walls standing straight out from the back wall. Do not draw the lines themselves.")
import os
USAGE = os.environ.get("GUIDE_USAGE", USAGE)
gw, gh = Image.open(guide_path).size
bal = lambda: requests.get(API + "/balance", timeout=30).json()["subscription"]["generations"]
b0 = bal()
STY = None
if os.environ.get("STYLE"):  # 화풍 그림(에일린 256, 색 끔) 함께 — 11-02 백일몽 로비
    _st = open(os.environ["STYLE"], "rb").read(); _sw, _sh = Image.open(os.environ["STYLE"]).size
    STY = {"image": {"type": "base64", "base64": base64.b64encode(_st).decode(), "format": "png"}, "size": {"width": _sw, "height": _sh}}
body = {"description": open(prompt_path, encoding="utf-8").read().strip(), "image_size": {"width": w, "height": h}, "no_background": False,
        "reference_images": [{"image": {"type": "base64", "base64": base64.b64encode(open(guide_path, 'rb').read()).decode(), "format": "png"},
                              "size": {"width": gw, "height": gh}, "usage_description": USAGE}]}
if STY:
    body["style_image"] = STY; body["style_options"] = {"color_palette": False, "outline": True, "detail": True, "shading": True}
t0 = time.time()
r = requests.post(API + "/generate-image-v2", json=body, timeout=60)
if r.status_code >= 300: print("error", r.status_code, r.text[:800]); sys.exit(1)
job = r.json()["background_job_id"]
while True:
    time.sleep(8)
    j = requests.get(f"{API}/background-jobs/{job}", timeout=30).json()
    if j.get("status") in ("completed", "failed"): break
if j["status"] != "completed": print("failed", json.dumps(j)[:800]); sys.exit(1)
img = j["last_response"]["images"][0]
data = img["base64"] if isinstance(img, dict) else img
open(out_path, "wb").write(base64.b64decode(data.split(",")[-1]))
print(json.dumps({"seconds": round(time.time() - t0, 1), "generations_used": round(b0 - bal(), 2)}))
