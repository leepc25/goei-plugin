"""샤워 이어 뽑기 시험(2026-10-27 밤, 사용자: 상태 안 만들고 뽑히나 테스트). 에일린, 뒷모습(N).
앞 줄 끝 장을 다음 줄 시작 장(custom_start_frame)으로 이어서, 캐릭터 상태(25회) 없이 수건·거품 모습을 만든다.
12(옆 고운 거품)은 10-27 실패: 거품이 선으로만 그려져 맨몸 노출 → 결과 지움. 옆모습 샤워는 쓰지 않음.
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
DIR = {5: "east", 6: "east", 12: "east", 13: "east", 17: "east", 14: "east", 18: "east"}
END = {18: "5"}
DIR[20] = "east"
DIR[21] = "south"
DIR[30] = "east"
DIR[31] = "east"
for _n in (32, 33, 34): DIR[_n] = "east"   # 끝 장 지정: 18 = 14를 돌아서기 끝 장(수건 두른 옆모습)으로 끝나게 다시
POSE_SIDE = "standing upright seen from the side, facing east"
STEPS = {
 1: ("57", "Standing with the back to the viewer in front of a locker. First she wraps a large plain white bath towel around her body under the arms and holds it closed. Then, keeping the towel wrapped the whole time, she takes off the jacket, vest, shirt, trousers and shoes underneath it and lets them drop out of the frame. The towel always covers her from the armpits to the middle of the thighs. Last frame: standing with the back to the viewer, barefoot, wrapped in the white towel from the armpits to mid-thigh, bare shoulders, arms and lower legs, ponytail unchanged."),
 2: ("1", "Standing under a shower with the back to the viewer, wrapped in the white towel. She rubs soap over her shoulders and the towel so that thick white soap foam builds up and covers her body from the armpits to the middle of the thighs. Only once the foam fully covers that area does she pull the towel away and drop it out of the frame. The foam band always covers her from the armpits to mid-thigh. Last frame: standing with the back to the viewer, barefoot, a thick band of white foam from the armpits to mid-thigh, no towel, ponytail unchanged. Draw only the woman, no shower head, wall or water."),
 3: ("2", "Standing under a shower with the back to the viewer, covered by the thick white foam band from the armpits to mid-thigh. Tilt the head back a little and rub both hands through the hair and ponytail, elbows raised, then lower the hands. The foam band stays in place. Draw only the woman, no shower head, wall or water."),
 5: ("1", "Wrapped in the white towel from the armpits to mid-thigh and barefoot, she turns in place from facing away from the viewer to facing right, so that she ends seen exactly from the side, facing east. The towel stays wrapped the whole time. Last frame: standing seen from the side facing east, barefoot, wrapped in the white towel from the armpits to mid-thigh, bare shoulders and arms, ponytail unchanged."),
 6: ("5", "Walking to the right in place, seen from the side, barefoot, one hand holding the top of the white towel closed at the chest, the other arm swinging a little. The towel stays wrapped from the armpits to mid-thigh. Natural relaxed walk cycle, the ponytail swings slightly."),
 7: ("2", "Standing under a shower with the back to the viewer, covered by the thick white foam band from the armpits to mid-thigh. Rub one hand along the opposite upper arm and shoulder, then switch hands and rub the other side. The foam band stays in place. Draw only the woman, no shower head, wall or water."),
 12: ("5", "Standing under a shower seen from the side facing east, wrapped in the white towel, barefoot. She rubs soap over her arms and shoulders and over the towel; a thin smooth layer of fine soap lather spread flat over the skin like cream, made of tiny fine suds, no large round bubbles, that covers the chest, belly, hips and thighs down to mid-thigh on the front and the back builds up. Only once the lather fully covers the chest to mid-thigh does she pull the towel away and drop it out of the frame. The chest, belly, hips and thighs to mid-thigh are always covered by the towel or the lather. Last frame: standing seen from the side facing east, a thin smooth layer of fine soap lather spread flat over the skin like cream, made of tiny fine suds, no large round bubbles, that covers the chest, belly, hips and thighs down to mid-thigh on the front and the back, no towel, ponytail unchanged. Draw only the woman, no shower head, wall, water or towel on the floor."),
 13: ("12", "Standing under a shower seen from the side facing east, covered by a thin smooth layer of fine soap lather spread flat over the skin like cream, made of tiny fine suds, no large round bubbles, that covers the chest, belly, hips and thighs down to mid-thigh on the front and the back. Tilt the head back a little and rub both hands through the hair and ponytail, elbows raised, then lower the hands. The lather stays in place. Draw only the woman, no shower head, wall or water."),
 17: ("12", "Standing under a shower seen from the side facing east, covered by a thin smooth layer of fine soap lather spread flat over the skin like cream, made of tiny fine suds, no large round bubbles, that covers the chest, belly, hips and thighs down to mid-thigh on the front and the back. Rub one hand along the opposite upper arm and shoulder, then switch hands and rub the other side. The lather stays in place. Draw only the woman, no shower head, wall or water."),
 14: ("12", "Standing under a shower seen from the side facing east, covered by a thin smooth layer of fine soap lather spread flat over the skin like cream, made of tiny fine suds, no large round bubbles, that covers the chest, belly, hips and thighs down to mid-thigh on the front and the back. She picks up a large plain white bath towel and wraps it around her body under the arms while the lather rinses away beneath it. The chest, belly, hips and thighs to mid-thigh are always covered by lather or towel. Last frame: standing seen from the side facing east, barefoot, wrapped in the white towel from the armpits to mid-thigh, no lather, ponytail unchanged. Draw only the woman, no shower head, wall or water."),
 4: ("2", "Standing under a shower with the back to the viewer, covered by the thick white foam band from the armpits to mid-thigh. She picks up a large plain white bath towel and wraps it around her body under the arms while the foam rinses away beneath it. The body is always covered from the armpits to mid-thigh by foam or towel. Last frame: standing with the back to the viewer, barefoot, wrapped in the white towel from the armpits to mid-thigh, no foam, ponytail unchanged. Draw only the woman, no shower head, wall or water."),
}
def last(name):
    if name == "REG_E":   # 등록 옆모습(동)
        return m3.fetch_png(m3.req("GET", f"/characters/{CID}")["rotation_urls"]["east"]).convert("RGBA")
    d = (OUT.parent.parent / "1.4_에일린" / "57") if name == "57" else (OUT / f"샤워이음_{name}")
    return Image.open(sorted(d.glob("[0-9][0-9].png"))[-1]).convert("RGBA")
def b64(im):
    b = io.BytesIO(); im.save(b, "PNG"); return {"type": "base64", "base64": base64.b64encode(b.getvalue()).decode(), "format": "png"}
STEPS[18] = STEPS[14]
STEPS[32] = ("REG_E", "Standing still seen from the side facing east, relaxed, arms at the sides. Her clothes and shoes simply disappear from her body little by little without any effect, sparkle, smoke or flash, until she stands bare, barefoot, no clothes. She does not move. Last frame: standing seen from the side facing east, barefoot, no clothes, ponytail unchanged. Draw only the woman, nothing else.")   # 옷이 그냥 사라지기
STEPS[33] = ("REG_E", "Standing seen from the side facing east, getting undressed for a shower. She takes off the jacket, then the vest, then the shirt, then the shoes, then the trousers, one piece at a time, each piece clearly sliding off the body and dropping out of the frame, until she stands bare, relaxed, arms at the sides. No towel. Last frame: standing seen from the side facing east, barefoot, no clothes, ponytail unchanged. Draw only the woman, no locker, furniture, shower or wall.")   # 12장 옷 벗기
STEPS[34] = STEPS[33]   # 16장 옷 벗기
FRAMES = {33: 12, 34: 16}

STEPS[31] = ("REG_E", "Standing seen from the side facing east in front of a locker, getting undressed for a shower. She takes off the jacket, vest, shirt, trousers and shoes one by one and drops them out of the frame, until she stands bare, relaxed, arms at the sides. No towel. Last frame: standing seen from the side facing east, barefoot, no clothes, ponytail unchanged.")   # 수건 없이 바로 옷 벗기 시험
STEPS[30] = ("REG_E", "Standing seen from the side facing east in front of a locker. First she wraps a large plain white bath towel around her body under the arms and holds it closed. Then, keeping the towel wrapped the whole time, she takes off the jacket, vest, shirt, trousers and shoes underneath it and lets them drop out of the frame. The towel always covers her from the armpits to the middle of the thighs. Last frame: standing seen from the side facing east, barefoot, wrapped in the white towel from the armpits to mid-thigh, bare shoulders, arms and lower legs, ponytail unchanged.")   # 옆모습 옷 벗기
STEPS[21] = ("5", "Wrapped in the white towel and barefoot, she turns in place from facing right to facing straight toward the viewer. Then she unwraps the towel and pulls it off to the side; the towel vanishes as it comes off, nothing falls to the floor. She stands bare facing the viewer with no towel and no soap, relaxed, arms at the sides. Last frame: standing facing the viewer (south), barefoot, no towel, no soap foam, ponytail unchanged. Draw only the woman, no shower head, wall, water or towel.")   # 앞모습 거품 없이 시험
STEPS[20] = ("5", "Standing under a shower seen from the side facing east, wrapped in the white towel, barefoot. She unwraps the towel and pulls it off; the towel vanishes from her hands as it comes off and is gone, nothing falls to the floor. She stands bare under the shower with no towel and no soap, relaxed, arms at the sides. Last frame: standing seen from the side facing east, barefoot, no towel, no soap foam, ponytail unchanged. Draw only the woman, no shower head, wall, water or towel.")   # 거품 없이 시험
n = int(sys.argv[1]); src, prompt = STEPS[n]
start = last(src)
body = {"character_id": CID, "mode": "pixminimax", "action_description": prompt, "animation_name": f"test 샤워이음 {n}",
        "directions": [DIR.get(n, "north")], "frame_count": FRAMES.get(n, 8), "subject_description": SUB, "initial_pose": POSE_SIDE if DIR.get(n) == "east" and n != 5 else ("standing upright seen from the side, facing east" if n == 21 else POSE),
        "keep_first_frame": False, "enhance_prompt": False, "custom_start_frame": b64(start)}
if n in (3, 6, 7, 13, 17): body["end_frame"] = b64(start)
if n in END: body["end_frame"] = b64(last(END[n]))
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
