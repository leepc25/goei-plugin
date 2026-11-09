"""켜진 판 512×384(bg_plate_512x384_lit_beams) 전체를 밝은 TV 조명으로 다시 밝히기. inpaint-v3 1회, 창=전체, 마스크=전체(사용자 11-10 01:01 「512만 남기고 잘라」).
사용: python3 homeshop_plate_bright_inpaint.py   PREVIEW=<png>면 보낼 그림/마스크만. 승인 문 각 1회."""
import sys,os,json,base64,io,time
sys.path.insert(0,'/home/user/goei-plugin/tools')
from PIL import Image
H='/home/user/goei-plugin/game-src/art/pixellab-test-20261028/homeshop/'
which=sys.argv[1] if len(sys.argv)>1 else 'pass1'
src=H+'bg_plate_512x384_lit_beams.png'
im=Image.open(src).convert('RGBA'); W,Hh=im.size
WX=0
win=im.copy(); w,h=win.size
mask=Image.new('L',(w,h),255)
if os.environ.get('PREVIEW'):
    sh=Image.new('RGB',(w*2+8,h),(255,0,255)); sh.paste(win.convert('RGB'),(0,0)); sh.paste(mask.convert('RGB'),(w+8,0))
    sh.resize((sh.width*2,h*2),Image.NEAREST).save(os.environ['PREVIEW']); sys.exit()
import pixellab_gate as g, requests
g.spend(f'켜진 판 전체 밝히기 inpaint {which}')
def b64(i):
    b=io.BytesIO(); i.save(b,'PNG'); return base64.b64encode(b.getvalue()).decode()
desc=open(H+'plate_bright_prompt.txt',encoding='utf-8').read().strip()
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
res=Image.open(io.BytesIO(base64.b64decode(d.split(",")[-1]))).convert('RGBA'); res.save(H+'bg_plate_512x384_bright_window.png')
out=im.copy(); out.paste(Image.composite(res,win,mask),(WX,0))
out.save(H+'bg_plate_512x384_bright.png')
print(json.dumps({"job":job,"usage":j.get("usage") or lr.get("usage")}))
