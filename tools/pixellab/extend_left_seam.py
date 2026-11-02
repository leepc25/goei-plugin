"""PixelLab inpaint-v3 왼쪽 잇기: 창 = [새 new | 겹침 ov(옛 그림 지움) | 옛 그림 keep]. 겹침 칸은 줄별 중간값 색으로 지우고 보냄.
붙일 때 섞지 않고 겹침 칸 안에서 옛 그림과 차이가 가장 작은 세로 이음선(DP)으로 자름.
사용: python3 extend_left_seam.py <앞 그림> <요청문.txt> <출력.png> <keep> <ov> <new>"""
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate
_gate.spend(__file__ + " 실행")
import base64, io, json, sys, time
import numpy as np, requests
from PIL import Image
API="https://api.pixellab.ai/v2"
src,pp,outp,keep,ov,new=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4]),int(sys.argv[5]),int(sys.argv[6])
im=Image.open(src).convert("RGBA"); h=im.height; w=new+ov+keep
win=Image.new("RGBA",(w,h),(255,255,255,255))
old=im.crop((0,0,ov+keep,h)); win.paste(old,(new,0))
a=np.array(win); med=np.median(np.array(im.crop((0,0,ov,h)).convert('RGB')),axis=1).astype('uint8')
import os
edge=np.array(im.convert('RGB'))[:,ov,:]   # FILL=edge: 줄마다 지운 칸 바로 오른쪽 옛 픽셀 색으로(벽·바닥 띠 이어짐)
for y in range(h): a[y,new:new+ov,:3]=(edge[y] if os.environ.get('FILL')=='edge' else med[y]); a[y,new:new+ov,3]=255
win=Image.fromarray(a)
mask=Image.new("RGB",(w,h),(0,0,0)); mask.paste((255,255,255),(0,0,new+ov,h))
win.save(outp.replace('.png','_sent_window.png')); mask.save(outp.replace('.png','_sent_mask.png'))
def b64(i):
    b=io.BytesIO(); i.save(b,"PNG"); return base64.b64encode(b.getvalue()).decode()
body={"description":open(pp,encoding="utf-8").read().strip(),
      "inpainting_image":{"image":{"type":"base64","base64":b64(win),"format":"png"},"size":{"width":w,"height":h}},
      "mask_image":{"image":{"type":"base64","base64":b64(mask),"format":"png"},"size":{"width":w,"height":h}},"no_background":False}
t0=time.time(); r=requests.post(API+"/inpaint-v3",json=body,timeout=60)
if r.status_code>=300: print("error",r.status_code,r.text[:800]); sys.exit(1)
job=r.json()["background_job_id"]
while True:
    time.sleep(8); j=requests.get(f"{API}/background-jobs/{job}",timeout=30).json()
    if j.get("status") in ("completed","failed"): break
if j["status"]!="completed": print("failed",json.dumps(j)[:800]); sys.exit(1)
lr=j["last_response"]; img=(lr.get("images") or [lr.get("image")])[0]
data=img["base64"] if isinstance(img,dict) else img
res=Image.open(io.BytesIO(base64.b64decode(data.split(",")[-1]))).convert("RGBA"); res.save(outp.replace('.png','_window.png'))
R=np.array(res.convert('RGB')).astype(int); O=np.array(im.convert('RGB')).astype(int)
# 겹침 칸(res x new..new+ov  ↔  옛 x 0..ov) 세로 이음선: 왼쪽은 새 그림, 오른쪽은 옛 그림
cost=np.abs(R[:,new:new+ov]-O[:,0:ov]).sum(2).astype(float)
dp=cost.copy(); bk=np.zeros_like(dp,dtype=int)
for y in range(1,h):
    for x in range(ov):
        lo,hi=max(0,x-1),min(ov,x+2); k=lo+int(np.argmin(dp[y-1,lo:hi])); dp[y,x]+=dp[y-1,k]; bk[y,x]=k
seam=[0]*h; seam[-1]=int(np.argmin(dp[-1]))
for y in range(h-1,0,-1): seam[y-1]=bk[y,seam[y]]
out=Image.new("RGBA",(new+im.width,h)); out.paste(im,(new,0))
A=np.array(out); RR=np.array(res)
for y in range(h): A[y,:new+seam[y]]=RR[y,:new+seam[y]]
Image.fromarray(A).save(outp)
print(json.dumps({"seconds":round(time.time()-t0,1),"out":[out.width,h],"seam_x_range":[int(min(seam)),int(max(seam))]}))
