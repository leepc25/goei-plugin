# 능력 뱃지 한 판(512x256, 64px 메달 32개)을 1회로 뽑는다. 사용: python3 gen_sheet.py <판번호>
# 그림 목록: docs/퍽/뱃지_그림_문구_1101.md (사용자 결정: 은메달 + 선글라스 요원, 등급 색은 코드로)
import sys, pathlib, json, urllib.request, time, base64, os
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "tools"))
import pixellab_gate as gate
API = "https://api.pixellab.ai/v2"
OUT = os.path.dirname(os.path.abspath(__file__))
SHEETS = {1: [
 "jab with bandaged fist", "arms blurred into three afterimages", "sliding on the floor kicking up dust",
 "punch sending a round air ring forward", "flicking an enemy's forehead, wavy lines above", "a blue shadow copy punching behind him",
 "sliding and tripping an enemy's shoe", "huge cracked fist punch", "wide crescent arc swing",
 "uppercut with up arrow and stars", "chopping down on a staggering enemy", "pinning an enemy into a cracked brick wall",
 "fist smashing the floor, round cracks", "chop with three red drops", "slamming an enemy onto the floor, dust",
 "two enemies bumping heads like billiard balls", "kicking, black shackle on enemy ankle", "aiming a pistol, one eye closed",
 "rapid fire, several muzzle flashes", "crosshair with a near dot and a far dot", "fanning a steaming gun barrel",
 "throwing a ballpoint pen", "aiming at an eye target", "pistol firing a bullet that splits into two",
 "bullet piercing two folders", "bullet bouncing off a wall on a bent path", "sparking explosive bullet",
 "red target mark over an enemy's head", "enemy raising hands in fear at his gun", "thrown pen curving back to his hand",
 "red hot gun bursting steam", "running with winged shoes"]}
n = int(sys.argv[1]); items = SHEETS[n]
lst = "; ".join(f"{i+1} {t}" for i, t in enumerate(items))
desc = ("pixel art icon sheet, 8 columns x 4 rows of 32 round silver medals, each 64x64, evenly spaced. "
        "Every medal shows the same small agent in a black suit, white shirt and sunglasses with a thin white outline, doing one action. "
        f"Left to right, top to bottom: {lst}. No text. Everything else is up to you.")
print(len(desc), desc, flush=True)
body = {"description": desc, "image_size": {"width": 512, "height": 256}, "no_background": True}
def post(p, b):
    r = urllib.request.Request(API + p, data=json.dumps(b).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer x"})
    return json.load(urllib.request.urlopen(r, timeout=90))
def get(p):
    return json.load(urllib.request.urlopen(urllib.request.Request(API + p, headers={"Authorization": "Bearer x"}), timeout=60))
gate.spend(f"능력 뱃지 {n}판 512x256 generate-ui-v2")
res = post("/generate-ui-v2", body); print("sent", json.dumps(res)[:300], flush=True)
jid = res.get("background_job_id")
for _ in range(240):
    time.sleep(5)
    r = get(f"/background-jobs/{jid}")
    if r.get("status") in ("completed", "failed", "error"): break
imgs = (r.get("last_response") or {}).get("images") or []
for i, im in enumerate(imgs):
    b = im.get("base64") if isinstance(im, dict) else im
    if "," in b[:40]: b = b.split(",", 1)[1]
    open(f"{OUT}/sheet{n}_{i}.png", "wb").write(base64.b64decode(b))
for im in imgs:
    if isinstance(im, dict): im.pop("base64", None)
json.dump(r, open(f"{OUT}/sheet{n}_job.json", "w"), ensure_ascii=False)
print("DONE", r.get("status"), len(imgs), json.dumps(r.get("usage") or {}), flush=True)
