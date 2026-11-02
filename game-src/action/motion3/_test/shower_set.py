"""샤워 한 세트(옆모습, 상태 없이 이어 뽑기). 2026-10-27 밤 사용자: 남·여 각 1명.
사용: python3 _test/shower_set.py <키> <east|west> <m|f>   결과 _test/<키>/샤워세트_<단계>/NN.png
단계: A 옷 벗기(등록 옆→수건) · B 수건 걷기(반복) · C 수건 벗기(거품 없음) · D 물 맞으며 쉬기(반복) · E 몸 씻기(반복) · F 헹구며 수건 두르기(끝 장 = A 끝 장)"""
import sys, json, time, base64, io
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import m3
from PIL import Image
SUBJ = {"2.5_김조학": "a middle-aged man of ordinary build with short dark brown hair combed back and black sunglasses",
        "1.11_로제몬": "a petite young woman in her early twenties with long wavy lavender purple hair down to the waist and bangs, violet eyes"}
key, D, g = sys.argv[1], sys.argv[2], sys.argv[3]
T = m3.table(key); CID = T["cid"]; SUB = SUBJ[key]
OUT = Path(__file__).resolve().parent / key; OUT.mkdir(exist_ok=True)
side = f"seen from the side facing {D}"
TOW = "wrapped in a large plain white bath towel around the waist from the hips to the knees, bare chest" if g == "m" else "wrapped in a large plain white bath towel from the armpits to mid-thigh, bare shoulders"
CLO = "suit jacket, shirt, tie, trousers and shoes" if g == "m" else "jacket, shirt, tie, skirt and shoes"
DRAW = "Draw only the person, no shower head, wall or water."
REL = "hands stay in front of the body or at the head and face, elbows never go behind the back"
STEPS = {
 "A": ("REG", f"Standing {side} in front of a locker. First wraps a large plain white bath towel around the body and holds it closed. Then, keeping the towel wrapped the whole time, takes off the {CLO} underneath it and lets them drop out of the frame. Last frame: standing {side}, barefoot, {TOW}."),
 "B": ("A", f"Walking {side} in place, barefoot, {TOW}, one hand holding the towel closed, the other arm swinging a little. Natural relaxed walk cycle.", "loop"),
 "C": ("A", f"Standing under a shower {side}, barefoot, {TOW}. Unwraps the towel and pulls it off; the towel vanishes as it comes off. Stands bare under the shower with no towel and no soap, relaxed. Last frame: standing {side}, barefoot, no towel, no soap. {DRAW}"),
 "D": ("C", f"Standing bare under a warm shower {side}, relaxed: tilts the head back with the eyes closed, letting the water run over the face, slowly smooths both hands down over the face and the back of the neck, breathes out and relaxes the shoulders. {REL}. No towel, no soap. {DRAW}", "loop"),
 "E": ("C", f"Standing bare under a shower {side}, relaxed, the head slightly lowered: rubs one hand along the opposite upper arm and shoulder, then switches hands, then rubs the chest and stomach lightly. {REL}. No towel, no soap. {DRAW}", "loop"),
 "F": ("C", f"Standing under a shower {side}, bare. Picks up a large plain white bath towel and wraps it around the body. Last frame: standing {side}, barefoot, {TOW}. {DRAW}", "end"),
}
def b64(im):
    b = io.BytesIO(); im.save(b, "PNG"); return {"type": "base64", "base64": base64.b64encode(b.getvalue()).decode(), "format": "png"}
def last(n):
    if n == "REG": return m3.fetch_png(m3.req("GET", f"/characters/{CID}")["rotation_urls"][D]).convert("RGBA")
    return Image.open(sorted((OUT / f"샤워세트_{n}").glob("[0-9][0-9].png"))[-1]).convert("RGBA")
def run(n):
    src, prompt, *opt = STEPS[n]; start = last(src)
    body = {"character_id": CID, "mode": "pixminimax", "action_description": prompt, "animation_name": f"test 샤워세트 {n}",
            "directions": [D], "frame_count": 8, "subject_description": SUB, "initial_pose": f"standing upright {side}",
            "keep_first_frame": False, "enhance_prompt": False, "custom_start_frame": b64(start)}
    if opt and opt[0] == "loop": body["end_frame"] = b64(start)
    if opt and opt[0] == "end":
        e = last("A")
        if e.size != start.size:   # 크기 다르면 둘 다 큰 쪽에 맞춰 여백
            sz = (max(e.width, start.width), max(e.height, start.height)); start, e = m3.pad(start, sz), m3.pad(e, sz)
            body["custom_start_frame"] = b64(start)
        body["end_frame"] = b64(e)
    while True:
        try: r = m3.req("POST", "/characters/animations", body); break
        except Exception as e:
            if "429" in str(e) or "409" in str(e): time.sleep(15); continue
            raise
    job = r.get("background_job_id") or (r.get("background_job_ids") or [None])[0]; gid = r.get("animation_group_id")
    while True:
        time.sleep(6)
        try: j = m3.req("GET", f"/background-jobs/{job}")
        except Exception: continue
        if j.get("status") in ("completed", "failed", "error", "cancelled"): break
    if j.get("status") != "completed": return n, "실패 " + json.dumps(j)[:300]
    ch = m3.req("GET", f"/characters/{CID}")
    a = next(a for a in ch["animations"] if a.get("animation_group_id") == gid or a.get("id") == gid)
    urls = next(x["frames"] for x in a["directions"] if x["direction"] == D)
    o = OUT / f"샤워세트_{n}"; o.mkdir(exist_ok=True)
    fr = [m3.fetch_png(u) for u in urls]
    for i, im in enumerate(fr): im.save(o / f"{i:02d}.png")
    m3.sheet(fr, OUT / f"샤워세트_{n}_sheet.png")
    return n, f"완료 {len(fr)}장 {json.dumps(j.get('usage'))}"
if len(sys.argv) > 4:   # 단계만 골라 다시: ... <단계…>
    import urllib.error
    for n in sys.argv[4:]:
        try: print(run(n), flush=True)
        except urllib.error.HTTPError as e: print(n, "HTTP", e.code, e.read().decode()[:600])
    sys.exit()
print(run("A"), flush=True)
with ThreadPoolExecutor(2) as ex: print(list(ex.map(run, ["B", "C"])), flush=True)
with ThreadPoolExecutor(3) as ex: print(list(ex.map(run, ["D", "E", "F"])), flush=True)
