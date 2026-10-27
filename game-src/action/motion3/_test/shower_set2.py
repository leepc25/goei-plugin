"""샤워 세트 2판(수건 없음, 옆모습, 상태 없이 이어 뽑기). 2026-10-27 밤 사용자: 남녀 각 2명.
A 옷 벗기 16장(손 동작 순서, 35번 문장) → B 맨몸 걷기(반복) · D 물 맞으며 쉬기(반복) · E 몸 씻기(반복). 옷 입기 = A 거꾸로.
A 끝 장의 떨어진 조각(옷 더미 등)은 다음 줄 시작 장에서만 지운다(원본 A는 그대로 둠).
사용: python3 _test/shower_set2.py <키>   결과 _test/<키>/샤워2_<단계>/"""
import sys, json, time, base64, io
from pathlib import Path
from collections import deque
from concurrent.futures import ThreadPoolExecutor
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import m3
from PIL import Image
C = {  # 키: (옆 방향, 성별, 몸 묘사(옷 없이), 벗는 순서)
 "1.6_큐라스": ("east", "man", "a lean wiry man in his early thirties with pale sage-green hair swept back, hollow cheeks",
   "he grips the jacket lapels with both hands, pushes the jacket back off his shoulders, pulls each arm out of the sleeves and drops it. He loosens and pulls off the necktie and drops it. He unbuttons the shirt down the front with his fingers, opens it, slides it off his shoulders, pulls his arms out and drops it. He bends forward, unbuckles the belt, pushes the trousers and underwear down to the ankles, then lifts one foot and then the other to step out of them, taking the shoes off with them"),
 "3.2_호유원": ("east", "man", "a lean young-looking Korean man with thick tousled dark brown hair and long curtain bangs, amber eyes",
   "he pushes the open jacket back off his shoulders, pulls each arm out of the sleeves and drops it. He pulls off the loose tie and drops it. He unbuttons the shirt down the front with his fingers, opens it, slides it off his shoulders, pulls his arms out and drops it. He bends forward, pushes the trousers and underwear down to the ankles, then lifts one foot and then the other to step out of them, taking the shoes off with them"),
 "1.3_잼트리": ("east", "woman", "a curvy woman in her late twenties with long wavy chestnut brown hair down to the waist, green eyes",
   "she grips the jacket lapels with both hands, pushes the jacket back off her shoulders, pulls each arm out of the sleeves and drops it. She pulls off the necktie and drops it. She unbuttons the shirt down the front with her fingers, opens it, slides it off her shoulders, pulls her arms out and drops it, then unhooks the bra and drops it. She unzips the pencil skirt at the side and pushes it down with the underwear to the ankles, then lifts one foot and then the other to step out of them, taking the high heels off with them"),
 "1.10_게슈간": ("east", "woman", "an athletic woman in her mid twenties with a chin-length snow-white bob with bangs, cold blue eyes, an impassive face",
   "she unbuttons the loose white shirt down the front with her fingers, opens it, slides it off her shoulders, pulls her arms out and drops it, then unhooks the bra and drops it. She bends forward, unbuttons the high-waisted trousers, pushes them down with the underwear to the ankles, then lifts one foot and then the other to step out of them, taking the shoes off with them"),
}
key = sys.argv[1]
if key in C: D, g, SUB, SEQ = C[key]
else:   # 목록 전원: shower_targets.json(옷 뺀 몸 묘사) + 일반 벗는 순서
    _t = json.load(open(Path(__file__).resolve().parent / "shower_targets.json"))[key]
    D, g, SUB = _t["dir"], _t["g"], _t["body"]
    _p = "he" if g == "man" else "she"; _P = _p.capitalize(); _h = "his" if g == "man" else "her"
    SEQ = (f"{_p} takes off the clothes one piece at a time with clear hand movements: first any outer layer such as a jacket, coat, cardigan or vest, pushing it back off {_h} shoulders, pulling the arms out of the sleeves and dropping it; then any necktie, scarf or accessory on the body; then the top, unbuttoning it or pulling it off over the head and dropping it"
           + (", then unhooks the bra and drops it" if g == "woman" else "")
           + f". {_P} bends forward, pushes the trousers or skirt down together with the underwear to the ankles, then lifts one foot and then the other to step out of them, taking the shoes or socks off with them")
T = m3.table(key); CID = T["cid"]
OUT = Path(__file__).resolve().parent / key; OUT.mkdir(exist_ok=True)
side = f"seen from the side facing {D}"
pro = "he" if g == "man" else ("it" if g == "creature" else "she"); Pro = pro.capitalize()
DRAW = f"Draw only the {g}, no locker, furniture, shower head, wall or water."
REL = "hands stay in front of the body or at the head and face, elbows never go behind the back"
STEPS = {
 "A": ("REG", 16, None, f"Seen from the side facing {D}, {pro} undresses for a shower with clear body movements, in this order: {SEQ}. {Pro} straightens up and stands bare, relaxed, arms at the sides. No towel. Last frame: standing {side}, barefoot, no clothes. {DRAW}"),
 "B": ("A", 8, "loop", f"Walking {side} in place, barefoot, bare, no clothes, no towel. Natural relaxed walk cycle, arms swinging a little. {DRAW}"),
 "D": ("A", 8, "loop", f"Standing bare under a warm shower {side}, relaxed: tilts the head back with the eyes closed, letting the water run over the face, slowly smooths both hands down over the face and the back of the neck, breathes out and relaxes the shoulders. {REL}. No towel, no soap. {DRAW}"),
 "E": ("A", 8, "loop", f"Standing bare under a shower {side}, relaxed, the head slightly lowered: rubs one hand along the opposite upper arm and shoulder, then switches hands, then rubs the chest and stomach lightly. {REL}. No towel, no soap. {DRAW}"),
}
def b64(im):
    b = io.BytesIO(); im.save(b, "PNG"); return {"type": "base64", "base64": base64.b64encode(b.getvalue()).decode(), "format": "png"}
def biggest(im):   # 가장 큰 덩어리(몸)만 남긴 사본 — 시작 장용
    a = np.array(im.convert("RGBA")); m = a[..., 3] > 0; H, W = m.shape; lab = np.zeros((H, W), int); n = 0; sz = []
    for y in range(H):
        for x in range(W):
            if m[y, x] and not lab[y, x]:
                n += 1; q = deque([(y, x)]); lab[y, x] = n; c = 0
                while q:
                    cy, cx = q.popleft(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = cy + dy, cx + dx
                            if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
                sz.append(c)
    if n > 1: a[(lab != 1 + int(np.argmax(sz))) & m] = 0
    return Image.fromarray(a)
def last(n):
    if n == "REG": return m3.fetch_png(m3.req("GET", f"/characters/{CID}")["rotation_urls"][D]).convert("RGBA")
    im = Image.open(sorted((OUT / f"샤워2_{n}").glob("[0-9][0-9].png"))[-1]).convert("RGBA")
    clean = biggest(im); clean.save(OUT / f"샤워2_{n}_끝장_정리.png"); return clean
def run(n):
    src, frames, opt, prompt = STEPS[n]; start = last(src)
    body = {"character_id": CID, "mode": "pixminimax", "action_description": prompt, "animation_name": f"test 샤워2 {n}",
            "directions": [D], "frame_count": frames, "subject_description": SUB, "initial_pose": f"standing upright {side}",
            "keep_first_frame": False, "enhance_prompt": False, "custom_start_frame": b64(start)}
    if opt == "loop": body["end_frame"] = b64(start)
    for _ in range(40):
        try: r = m3.req("POST", "/characters/animations", body); break
        except Exception as e:
            msg = str(e)
            if hasattr(e, "read"): msg += e.read().decode()[:300]
            if "429" in msg or "409" in msg: time.sleep(15); continue
            return n, "보내기 실패 " + msg[:300]
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
    o = OUT / f"샤워2_{n}"; o.mkdir(exist_ok=True)
    fr = [m3.fetch_png(u) for u in urls]
    for i, im in enumerate(fr): im.save(o / f"{i:02d}.png")
    m3.sheet(fr, OUT / f"샤워2_{n}_sheet.png")
    return n, f"완료 {len(fr)}장 {json.dumps(j.get('usage'))}"
if g == "creature":   # 옷이 없는 괴물: 옷 벗기 없이 등록 옆모습에서 씻기만
    STEPS["D"] = ("REG",) + STEPS["D"][1:]; STEPS["E"] = ("REG",) + STEPS["E"][1:]
    with ThreadPoolExecutor(2) as ex: print(key, list(ex.map(run, ["D", "E"])), flush=True)
    sys.exit()
print(key, run("A"), flush=True)
with ThreadPoolExecutor(3) as ex: print(key, list(ex.map(run, ["B", "D", "E"])), flush=True)
