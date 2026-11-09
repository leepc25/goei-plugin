"""[2차] 켜진 판(bg_plate_fix11_lit_552x414)의 앞쪽(바닥 띠+진열대, y 290~414)만 열어 밝히기 inpaint-v3 1회. 원본 주석:을 넣고 세트 구역만 마스크로 열어 「조명 켜진 같은 세트」로 inpaint-v3 1회. 창 x 40~552(512), 마스크 x 55~540 × y 0~327(진열대 윗면 위). PREVIEW=<png>면 보낼 그림/마스크만."""
import sys,os,json,base64,io,time
sys.path.insert(0,'/home/user/goei-plugin/tools')
from PIL import Image
H='/home/user/goei-plugin/game-src/art/pixellab-test-20261028/homeshop/'
im=Image.open(H+'bg_plate_fix11_lit_552x414.png').convert('RGBA'); WX=20
win=im.crop((WX,0,WX+512,414)); w,h=win.size
mask=Image.new('L',(w,h),0); mask.paste(255,(0,290,512,414))
if os.environ.get('PREVIEW'):
    sh=Image.new('RGB',(w*2+8,h),(255,0,255)); sh.paste(win.convert('RGB'),(0,0)); sh.paste(mask.convert('RGB'),(w+8,0))
    sh.resize((sh.width*2,h*2),Image.NEAREST).save(os.environ['PREVIEW']); sys.exit()
import pixellab_gate as g, requests
g.spend('켜진 판 앞쪽 밝히기 inpaint 1회')
def b64(i):
    b=io.BytesIO(); i.save(b,'PNG'); return base64.b64encode(b.getvalue()).decode()
desc=open(H+'plate_lit_front_prompt.txt',encoding='utf-8').read().strip()
body={"description":desc,
 "inpainting_image":{"image":{"type":"base64","base64":b64(win),"format":"png"},"size":{"width":w,"height":h}},
 "mask_image":{"image":{"type":"base64","base64":b64(mask.convert('RGB')),"format":"png"},"size":{"width":w,"height":h}},
 "no_background":False}
API="https://api.pixellab.ai/v2"; r=requests.post(API+"/inpaint-v3",json=body,timeout=60)
if r.status_code>=300: print('error',r.status_code,r.text[:600]); sys.exit(1)
job=r.json()["background_job_id"]
while True:
    time.sleep(8); j=requests.get(f"{API}/background-jobs/{job}",timeout=30).json()
    if j.get("status") in ("completed","failed"): break
if j["status"]!="completed": print('failed',json.dumps(j)[:600]); sys.exit(1)
lr=j["last_response"]; img=(lr.get("images") or [lr.get("image")])[0]; d=img["base64"] if isinstance(img,dict) else img
res=Image.open(io.BytesIO(base64.b64decode(d.split(",")[-1]))).convert('RGBA'); res.save(H+'bg_plate_fix11_lit2_window.png')
out=im.copy(); out.paste(Image.composite(res,win,mask),(WX,0)); out.save(H+'bg_plate_fix11_lit2_552x414.png')
print(json.dumps({"job":job,"usage":j.get("usage") or lr.get("usage")}))
