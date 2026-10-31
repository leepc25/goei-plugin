"""PixelLab Pro Flash 물건 생성(낮은 탑다운, 캐릭터 화풍 참조). 사용: python3 obj_gen.py <이름> <폭> <높이> "<설명>" [방향수 1|8] [정면 png 경로]
정면 1장(6회)만 먼저 뽑아 크기를 재고, 맞으면 그 정면 png를 주고 8방향(회전 5회만)을 뽑는다.
결과: game-src/action/objects/<이름>/{south,...}.png, meta.json, spend.log"""
import sys, json, time, base64, io, subprocess, urllib.request, urllib.error
from pathlib import Path
from PIL import Image
API="https://api.pixellab.ai/v2"; BASE=Path(__file__).resolve().parent
import sys as _s, pathlib as _pl
_s.path.insert(0, str(_pl.Path(__file__).resolve().parents[3] / "tools"))
import pixellab_gate  # noqa: E402  (10-31 사용자 승인 없는 생성 막기)
def req(m,p,b=None):
    pixellab_gate.guard(m, p)
    r=urllib.request.Request(API+p,data=json.dumps(b).encode() if b is not None else None,method=m,headers={"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(r,timeout=180) as x: t=x.read(); return json.loads(t) if t.strip() else {}
    except urllib.error.HTTPError as e: sys.exit(f"HTTP {e.code} {e.read().decode()[:800]}")
def png(url): return Image.open(io.BytesIO(subprocess.run(["curl","-sSf","--retry","3",url],capture_output=True,check=True).stdout)).convert("RGBA")
name,w,h,desc=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
ndir=int(sys.argv[5]) if len(sys.argv)>5 else 8; src=sys.argv[6] if len(sys.argv)>6 else None
EIL="e38c681f-5063-487e-8965-a324815912eb"
import os
REF=os.environ.get("STYLE_REF")   # 화풍·크기 참조를 다른 그림으로(예: C01 1배 의자). 없으면 에일린
ref=Image.open(REF).convert("RGBA") if REF else png(req("GET",f"/characters/{EIL}")["rotation_urls"]["south"])
if REF: ref=ref.crop(ref.getbbox())
if ref.width>w or ref.height>h:   # 화풍 참조는 캔버스보다 크면 안 됨 → 몸통 부분을 잘라 씀(크기 바꾸지 않음)
    bb=ref.getbbox(); cx=(bb[0]+bb[2])//2; top=bb[1]+20
    ref=ref.crop((max(0,cx-w//2),top,max(0,cx-w//2)+min(w,ref.width),top+min(h,ref.height-top)))
buf=io.BytesIO(); ref.save(buf,"PNG")
body={"description":desc,"name":name,"view":"low top-down","image_size":{"width":w,"height":h},"n_directions":ndir,
      "style_image":{"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode(),"format":"png"},"size":{"width":ref.width,"height":ref.height},
                     "usage_description":"style reference only: copy the pixel density, outline and shading of this character sprite; do not draw the character"},
      "style_options":{"color_palette":False,"outline":True,"detail":True,"shading":True}}
if src:   # 정면 재사용 시 크기·화풍 설정은 넣으면 422
    body["first_frame"]={"type":"base64","base64":base64.b64encode(Path(src).read_bytes()).decode(),"format":"png"}
    for k in ("image_size","style_image","style_options"): body.pop(k)
r=req("POST","/create-object-pro-flash",body); print(r)
job=r.get("background_job_id"); oid=r.get("object_id")
while True:
    time.sleep(8); j=req("GET",f"/background-jobs/{job}")
    if j.get("status") in ("completed","failed","error","cancelled"): break
print(j.get("status"), json.dumps(j)[:600])
o=req("GET",f"/objects/{oid}"); d=BASE/name; d.mkdir(exist_ok=True)
(d/"meta.json").write_text(json.dumps({"object_id":oid,"job":j,"object":o},ensure_ascii=False,indent=1)[:200000])
for k,u in ({**(o.get("storage_urls") or {}),**(o.get("rotation_urls") or {})}).items():
    if u: png(u).save(d/f"{k}.png")
with open(BASE/"spend.log","a") as f: f.write(time.strftime("%m-%d %H:%M ")+f"{name} {w}x{h} {ndir}방향 src={src} object_id={oid} {j.get('status')} usage={json.dumps(j.get('usage') or j.get('billing_stages'))}\n")
print(sorted(p.name for p in d.glob('*.png')))
