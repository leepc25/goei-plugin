"""외부도로 배경 1장 + 선 밑그림(투명 바탕 검은 선, reference_images) (generate-image-v2, 632x424, 에일린 화풍 색 끔 — 중림 jr_entry_p1_v1과 같은 설정). 사용: gen_street_guide.py <prompt.txt> <guide.png> <out.png>"""
import base64, io, json, sys, time, requests
from PIL import Image
API="https://api.pixellab.ai/v2"
pp,gp,out=sys.argv[1],sys.argv[2],sys.argv[3]
g=Image.open(gp)
st=Image.open(__file__.rsplit('/',1)[0]+'/specs/style_eileen_256.png').convert('RGBA')
buf=io.BytesIO(); st.save(buf,'PNG')
body={"description":open(pp,encoding='utf-8').read().strip(),"image_size":{"width":632,"height":424},"no_background":False,
 "style_image":{"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode()},"size":{"width":st.width,"height":st.height},
  "usage_description":"pixel size, outline and shading reference only; a character sprite from the same game"},
 "reference_images":[{"image":{"type":"base64","base64":base64.b64encode(open(gp,'rb').read()).decode(),"format":"png"},"size":{"width":g.width,"height":g.height},
  "usage_description":"Layout guide only: black lines on a transparent background. Follow these lines exactly for where the building meets the sidewalk, the curb, the two tall door leaves from the sidewalk up to the letters, the letter band above the doors and the pillars. Do not draw the lines themselves."}],
 "style_options":{"color_palette":False,"outline":True,"detail":True,"shading":True}}
r=requests.post(API+"/generate-image-v2",json=body,timeout=60)
if r.status_code>=300: print("error",r.status_code,r.text[:800]); sys.exit(1)
job=r.json()["background_job_id"]; t0=time.time()
while True:
    time.sleep(8); j=requests.get(f"{API}/background-jobs/{job}",timeout=30).json()
    if j.get("status") in ("completed","failed"): break
if j["status"]!="completed": print("failed",json.dumps(j)[:800]); sys.exit(1)
img=j["last_response"]["images"][0]; d=img["base64"] if isinstance(img,dict) else img
open(out,"wb").write(base64.b64decode(d.split(",")[-1])); print("ok",round(time.time()-t0))
