"""Vertex AI Gemini 이미지 모델로 한 장 생성. 사용: python3 gen_image.py <프롬프트.txt> <참고그림[,참고그림2]> <출력.png> [비율] [크기] [모델]"""
import base64, json, sys, time
import requests
from vertex_token import get_token

prompt_path, ref_path, out_path = sys.argv[1:4]
aspect = sys.argv[4] if len(sys.argv) > 4 else "4:1"
size = sys.argv[5] if len(sys.argv) > 5 else "2K"
model = sys.argv[6] if len(sys.argv) > 6 else "gemini-3.1-flash-image"

tok, proj = get_token()
url = f"https://aiplatform.googleapis.com/v1/projects/{proj}/locations/global/publishers/google/models/{model}:generateContent"
body = {
    "contents": [{"role": "user", "parts": [
        *[{"inlineData": {"mimeType": "image/png", "data": base64.b64encode(open(p, "rb").read()).decode()}} for p in ref_path.split(",") if p],
        {"text": open(prompt_path, encoding="utf-8").read()},
    ]}],
    "generationConfig": {"responseModalities": ["TEXT", "IMAGE"], "imageConfig": {"aspectRatio": aspect, "imageSize": size}},
}
t0 = time.time()
r = requests.post(url, headers={"Authorization": "Bearer " + tok}, json=body, timeout=600)
dt = time.time() - t0
if r.status_code != 200:
    print("error", r.status_code, r.text[:800]); sys.exit(1)
j = r.json()
saved = False
for p in j["candidates"][0]["content"]["parts"]:
    if "inlineData" in p and not saved:
        open(out_path, "wb").write(base64.b64decode(p["inlineData"]["data"])); saved = True
    elif "text" in p:
        print("text:", p["text"][:300])
print(json.dumps({"seconds": round(dt, 1), "usage": j.get("usageMetadata"), "model": j.get("modelVersion"), "saved": saved}, ensure_ascii=False))
