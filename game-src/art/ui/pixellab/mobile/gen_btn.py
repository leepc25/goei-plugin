# --- PixelLab 생성 승인 문 (2026-10-31 사용자: 시키지 않은 생성 금지) — 이 파일의 모든 생성 요청은 .pixellab_ok 회수가 있어야 나간다
import sys as _gs, pathlib as _gp
_gs.path.insert(0, str(next(p for p in _gp.Path(__file__).resolve().parents if (p / "tools" / "pixellab_gate.py").exists()) / "tools"))
import pixellab_gate as _gate  # noqa: E402
_gate.spend(__file__ + " 실행")
# ---
import json,base64,urllib.request,time,io,sys
from PIL import Image
def bal(): return json.load(urllib.request.urlopen("https://api.pixellab.ai/v2/balance"))['subscription']['generations']
def gen(name, desc, concept, size=96):
    b0=bal()
    im=Image.open(concept).convert('RGBA'); im=im.resize((im.width*2,im.height*2),Image.NEAREST)
    buf=io.BytesIO(); im.save(buf,'PNG')
    body={"description":desc,"image_size":{"width":size,"height":size},"no_background":True,
     "concept_image":{"image":{"type":"base64","base64":base64.b64encode(buf.getvalue()).decode()},"size":{"width":im.width,"height":im.height}}}
    r=urllib.request.Request("https://api.pixellab.ai/v2/generate-ui-v2",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    try: res=json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: print(e.code,e.read()[:600]); return None
    jid=res.get('background_job_id')
    for i in range(80):
        time.sleep(6)
        j=json.load(urllib.request.urlopen(f"https://api.pixellab.ai/v2/background-jobs/{jid}"))
        if j.get('status') in ('completed','failed'): break
    json.dump(j,open(f'job_{name}.json','w'))
    imgs=(j.get('last_response') or {}).get('images') or []
    for n,x in enumerate(imgs):
        b=x.get('base64') if isinstance(x,dict) else x
        if b and ',' in b[:40]: b=b.split(',',1)[1]
        if b: open(f'{name}_{n}.png','wb').write(base64.b64decode(b))
    b1=bal(); spent=round(b0-b1,3)
    print(name,'status',j.get('status'),'images',len(imgs),'spent',spent,'left',round(b1,1))
    with open('/home/user/goei-plugin/game-src/art/ui/pixellab/spend.log','a') as f: f.write(f"{time.strftime('%Y-%m-%d %H:%M')} generate-ui-v2 {name} {size}x{size} images={len(imgs)} spent={spent} left={round(b1,1)}\n")
    return j
if __name__=='__main__':
    gen(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv)>4 else 96)
