# 뱃지 판 v2: 1판을 본보기(concept_image)·색 강제(target_palette)·같은 seed로 주고, 배경 지우기 끔. 사용: python3 gen_sheet2.py <판번호>
# 머리말은 1판(sheet1_token.log) 글자 그대로. 칸 설명은 3~5낱말, 색을 부르는 낱말(피·불·얼음·심장) 없음.
import sys, pathlib, json, urllib.request, time, base64, os, io
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "tools"))
import pixellab_gate as gate
from PIL import Image
API = "https://api.pixellab.ai/v2"; OUT = os.path.dirname(os.path.abspath(__file__))
SHORT = {2: [
 "dodging, three afterimages", "rolling, circular arrow", "punch passing through him", "sliding, speed lines",
 "jumping on spring shoes", "dodging, bomb left behind", "enemy punching his empty outline", "dashing through enemy",
 "rolling up, bent arrow", "shoulder charge", "blocking with folder shield", "fist stopped on shield",
 "batting bullet with tray", "sunglasses flash, counterpunch", "spiked shield", "shield shattering",
 "dizzy enemy, he holds shield", "reading manual, pressing button", "double burst from hand", "hand with filling bar",
 "big charged ring", "star gauge on chest", "huge star burst", "entering door, star gauge",
 "staggering, stars burst", "pressing two buttons", "magnet pulling enemies", "pointing, spiral over enemy",
 "beam, ball and chain on enemy", "finger to lips, taped enemy", "bowing, shadow copy behind", "hand blade, long cut"]}
n = int(sys.argv[1]); items = SHORT[n]; assert len(items) == 32
lst = "; ".join(f"{i+1} {t}" for i, t in enumerate(items))
desc = ("pixel art icon sheet, 8 columns x 4 rows of 32 single-color silver tokens, each 64x64, evenly spaced. "
        "Each token is a thick 3D silver coin seen from the front with a visible beveled rim and shading, all silver. "
        "The same small agent with sunglasses is embossed in silver relief on each token, doing one action. "
        f"Silver only, no other colors. Left to right, top to bottom: {lst}. No text. Everything else is up to you.")
assert len(desc) <= 2000
ref = Image.open(f"{OUT}/sheet1_token_0.png").convert("RGBA")
flat = Image.new("RGBA", ref.size, (40, 44, 60, 255)); flat.alpha_composite(ref)
buf = io.BytesIO(); flat.convert("RGB").save(buf, "PNG"); b64 = base64.b64encode(buf.getvalue()).decode()
pal = ref.convert("RGB").quantize(colors=24, method=Image.Quantize.MEDIANCUT).getpalette()[:24*3]
colors = ["#%02x%02x%02x" % tuple(pal[i:i+3]) for i in range(0, len(pal), 3)] + ["#282c3c"]
body = {"description": desc, "image_size": {"width": 512, "height": 256}, "no_background": False, "seed": 1363891489,
        "concept_image": {"image": {"base64": "data:image/png;base64," + b64}, "size": {"width": 512, "height": 256}},
        "target_palette": {"colors": colors}}
print(len(desc), colors, flush=True)
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer x"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p): return json.load(urllib.request.urlopen(urllib.request.Request(API + p, headers={"Authorization": "Bearer x"}), timeout=60))
gate.spend(f"능력 뱃지 {n}판 v2 512x256 generate-ui-v2 (본보기·팔레트·seed)")
res = post("/generate-ui-v2", body); print("sent", json.dumps(res)[:300], flush=True)
jid = res.get("background_job_id")
for _ in range(240):
    time.sleep(5); r = get(f"/background-jobs/{jid}")
    if r.get("status") in ("completed", "failed", "error"): break
imgs = (r.get("last_response") or {}).get("images") or []
for i, im in enumerate(imgs):
    b = im.get("base64") if isinstance(im, dict) else im
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(f"{OUT}/sheet{n}_v2_{i}.png", "wb").write(base64.b64decode(b))
for im in imgs:
    if isinstance(im, dict): im.pop("base64", None)
json.dump(r, open(f"{OUT}/sheet{n}_v2_job.json", "w"), ensure_ascii=False)
print("DONE", r.get("status"), len(imgs), json.dumps(r.get("usage") or {}), flush=True)
