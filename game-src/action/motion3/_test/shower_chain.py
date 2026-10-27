"""샤워 이어 뽑기 시험(2026-10-27 밤, 사용자: 상태 안 만들고 뽑히나 테스트). 에일린, 뒷모습(N).
앞 줄 끝 장을 다음 줄 시작 장(custom_start_frame)으로 이어서, 캐릭터 상태(25회) 없이 수건·거품 모습을 만든다.
사용: python3 _test/shower_chain.py <단계 1~4>   결과 _test/1.4_에일린/샤워이음_<n>/NN.png"""
import sys, json, time, base64, io
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import m3
from PIL import Image
OUT = Path(__file__).resolve().parent / "1.4_에일린"
CID = "e38c681f-5063-487e-8965-a324815912eb"
SUB = "a short woman in her early twenties with a faded platinum blonde high ponytail and long bangs, seen from behind"
POSE = "standing upright with the back to the viewer, facing north"
DIR = {5: "east", 6: "east"}
POSE_SIDE = "standing upright seen from the side, facing east"
STEPS = {
 1: ("57", "Standing with the back to the viewer in front of a locker. First she wraps a large plain white bath towel around her body under the arms and holds it closed. Then, keeping the towel wrapped the whole time, she takes off the jacket, vest, shirt, trousers and shoes underneath it and lets them drop out of the frame. The towel always covers her from the armpits to the middle of the thighs. Last frame: standing with the back to the viewer, barefoot, wrapped in the white towel from the armpits to mid-thigh, bare shoulders, arms and lower legs, ponytail unchanged."),
 2: ("1", "Standing under a shower with the back to the viewer, wrapped in the white towel. She rubs soap over her shoulders and the towel so that thick white soap foam builds up and covers her body from the armpits to the middle of the thighs. Only once the foam fully covers that area does she pull the towel away and drop it out of the frame. The foam band always covers her from the armpits to mid-thigh. Last frame: standing with the back to the viewer, barefoot, a thick band of white foam from the armpits to mid-thigh, no towel, ponytail unchanged. Draw only the woman, no shower head, wall or water."),
 3: ("2", "Standing under a shower with the back to the viewer, covered by the thick white foam band from the armpits to mid-thigh. Tilt the head back a little and rub both hands through the hair and ponytail, elbows raised, then lower the hands. The foam band stays in place. Draw only the woman, no shower head, wall or water."),
 5: ("1", "Wrapped in the white towel from the armpits to mid-thigh and barefoot, she turns in place from facing away from the viewer to facing right, so that she ends seen exactly from the side, facing east. The towel stays wrapped the whole time. Last frame: standing seen from the side facing east, barefoot, wrapped in the white towel from the armpits to mid-thigh, bare shoulders and arms, ponytail unchanged."),
 6: ("5", "Walking to the right in place, seen from the side, barefoot, one hand holding the top of the white towel closed at the chest, the other arm swinging a little. The towel stays wrapped from the armpits to mid-thigh. Natural relaxed walk cycle, the ponytail swings slightly."),
 7: ("2", "Standing under a shower with the back to the viewer, covered by the thick white foam band from the armpits to mid-thigh. Rub one hand along the opposite upper arm and shoulder, then switch hands and rub the other side. The foam band stays in place. Draw only the woman, no shower head, wall or water."),
 4: ("2", "Standing under a shower with the back to the viewer, covered by the thick white foam band from the armpits to mid-thigh. She picks up a large plain white bath towel and wraps it around her body under the arms while the foam rinses away beneath it. The body is always covered from the armpits to mid-thigh by foam or towel. Last frame: standing with the back to the viewer, barefoot, wrapped in the white towel from the armpits to mid-thigh, no foam, ponytail unchanged. Draw only the woman, no shower head, wall or water."),
}
def last(name):
    d = (OUT.parent.parent / "1.4_에일린" / "57") if name == "57" else (OUT / f"샤워이음_{name}")
    return Image.open(sorted(d.glob("[0-9][0-9].png"))[-1]).convert("RGBA")
def b64(im):
    b = io.BytesIO(); im.save(b, "PNG"); return {"type": "base64", "base64": base64.b64encode(b.getvalue()).decode(), "format": "png"}
n = int(sys.argv[1]); src, prompt = STEPS[n]
start = last(src)
body = {"character_id": CID, "mode": "pixminimax", "action_description": prompt, "animation_name": f"test 샤워이음 {n}",
        "directions": [DIR.get(n, "north")], "frame_count": 8, "subject_description": SUB, "initial_pose": POSE_SIDE if n == 6 else POSE,
        "keep_first_frame": False, "enhance_prompt": False, "custom_start_frame": b64(start)}
if n in (3, 6, 7): body["end_frame"] = b64(start)
r = m3.req("POST", "/characters/animations", body); job = r.get("background_job_id") or (r.get("background_job_ids") or [None])[0]; gid = r.get("animation_group_id")
while True:
    time.sleep(6)
    try: j = m3.req("GET", f"/background-jobs/{job}")
    except Exception: continue
    if j.get("status") in ("completed", "failed", "error", "cancelled"): break
print(n, j.get("status"), json.dumps(j.get("usage") or j.get("billing_usage")))
if j.get("status") != "completed": print(json.dumps(j)[:800]); sys.exit(1)
ch = m3.req("GET", f"/characters/{CID}")
a = next(a for a in ch["animations"] if a.get("animation_group_id") == gid or a.get("id") == gid)
urls = next(x["frames"] for x in a["directions"] if x["direction"] == DIR.get(n, "north"))
o = OUT / f"샤워이음_{n}"; o.mkdir(exist_ok=True)
fr = [m3.fetch_png(u) for u in urls]
for i, im in enumerate(fr): im.save(o / f"{i:02d}.png")
m3.sheet(fr, OUT / f"샤워이음_{n}_sheet.png")
print("saved", len(fr))
