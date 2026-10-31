"""샤워 중 피격 세트 시험(2026-10-31 사용자: 샤워장에서도 전투, 맨몸으로는 공격 못 함, 몸 가린 채 캐비닛으로 도망 → 옷 입기).
S1 맨몸 맞기 · S2 몸 가린 채 뛰기(반복) · S3 맨몸 날아가 쓰러지기 · S4 맨몸 일어나기 · S5 몸 가린 채 웅크리기 · S6 가린 채 소리치기(이성이 잘못 들어왔을 때). 시작 장 = 샤워 A(옷 벗기) 끝 장(정리본).
사용: python3 _test/shower_hit.py <키>   결과 _test/<키>/샤워2_S1… (아래는 샤워 세트 2판 설명)
샤워 세트 2판(수건 없음, 옆모습, 상태 없이 이어 뽑기). 2026-10-27 밤 사용자: 남녀 각 2명.
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
# 가리는 자세: 남자는 아래만(10-31 사용자: 남자는 위를 가릴 필요가 없다), 여자는 가슴과 아래
COVER = "one hand covering the groin" if g == "man" else "one forearm pressed across the chest and the other hand covering the groin"
FREE = "the other hand waves sharply toward the door, telling the intruder to get out" if g == "man" else "the head jerks toward the door, telling the intruder to get out"
# 성향(docs/샤워_반응_성향표.md, 위키 근거): 당당·수줍·화냄·무심 → 가리는 정도·소리치는 모습이 다르다 (10-31 사용자: 인물마다 달라야)
import re as _re
_tbl = (Path(__file__).resolve().parents[4] / "docs/샤워_반응_성향표.md").read_text(encoding="utf-8")
_m = _re.search(r"^\| " + _re.escape(key) + r" \| [^|]+ \| ([^|]+?) \| ([^|]+?) \|", _tbl, _re.M)
TYPE, MANNER = (_m.group(1).strip(), _m.group(2).strip()) if _m else ("수줍", "")
LOOSE = "one hand loosely covering the groin" if g == "man" else "one arm loosely across the chest and the other hand covering the groin"
SHOUT = {
 "당당": f"standing tall, {LOOSE}, not hiding much, glaring coldly at the intruder and saying firmly to get out, one finger pointing at the door",
 "수줍": f"{COVER}, hunching and turning the body away from the intruder, the face flushed, crying out in embarrassment and shrinking back",
 "화냄": f"{COVER}, leaning forward angrily and yelling at the intruder with the mouth wide open, jabbing toward the door again and again",
 "무심": f"{LOOSE}, giving the intruder one flat look, then calmly turning the back to them",
}[TYPE] + (f", {MANNER}" if MANNER else "")
# S1~S5도 성향마다 다르게 (10-31 사용자: 여섯 가지 전부 달라야)
_C = {"당당": LOOSE, "무심": LOOSE}.get(TYPE, COVER)
_M = f", {MANNER}" if MANNER else ""
HIT = {"당당": f"{pro} grunts and staggers half a step back, {_C}, then straightens up glaring",
       "수줍": f"{pro} cries out, curls up and turns the shoulders away, {_C}, staggering back",
       "화냄": f"{pro} yelps and staggers back, {_C}, then snarls back furiously",
       "무심": f"{pro} staggers half a step back with a flat face, {_C}, then stands still again"}[TYPE] + _M
RUN = {"당당": f"running {side} in place with long, steady strides, {_C}, the head up",
       "수줍": f"running {side} in place hunched forward with short panicked steps, {_C}, the face flushed",
       "화냄": f"running {side} in place with stomping steps, {_C}, shouting over the shoulder",
       "무심": f"jogging {side} in place at an even pace, {_C}, the face calm"}[TYPE] + _M
FALL = {"당당": "lands on the back, then props up on one elbow glaring", "수줍": "lands on the back and curls up tight",
        "화냄": "lands on the back and shouts in pain and anger", "무심": "lands on the back and lies still with a blank face"}[TYPE]
RISE = {"당당": "gets up briskly", "수줍": "gets up slowly and timidly, hunching", "화냄": "scrambles up furiously", "무심": "gets up without hurry"}[TYPE]
CROUCH = {"당당": "drops into a low crouch on one knee, glaring up at the attacker", "수줍": "drops into a low crouch hugging the knees to the chest, the head ducked, trembling",
          "화냄": "drops into a low crouch, hugging the knees and yelling", "무심": "squats down low, arms around the knees, the face calm"}[TYPE]
STEPS = {
 "S1": ("A", 8, "back", f"Standing bare {side}, struck hard from the front: {HIT}. No towel, no effect lines. {DRAW}"),
 "S2": ("A", 8, "loop", f"Barefoot and bare, {RUN}, the whole time. No towel, no effect lines. {DRAW}"),
 "S3": ("A", 8, None, f"Standing bare {side}, hit by a heavy blow: {pro} is thrown backward off the feet, {FALL}, {_C}. Last frame: lying on the floor, covering. No towel, no effect lines. {DRAW}"),
 "S4": ("S3", 8, "back", f"Lying bare on the floor {side}, {_C}: {pro} {RISE}, rolling to one side, onto the knees and then to the feet, still covering{_M}. No towel, no effect lines. {DRAW}"),
 "S6": ("A", 8, "loop", f"Standing bare {side}, reacting to someone who walked in by mistake: {SHOUT}. The feet stay planted. No towel, no effect lines. {DRAW}"),
 "S5": ("A", 8, None, f"Standing bare {side}, cornered: {pro} {CROUCH}{_M}. Last frame: crouched low, knees to the chest, covering. No towel, no effect lines. {DRAW}"),
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
REDO = "--redo" in sys.argv
def run(n):
    d = OUT / f"샤워2_{n}"
    if any(d.glob("[0-9][0-9].png")):
        if not REDO: return n, "이미 있음(덮어쓰지 않음)"
        k = 1   # 다시 뽑기: 이전 판은 _old/ 로 옮긴다(지우지 않음)
        while (OUT / "_old" / f"샤워2_{n}_{k}").exists(): k += 1
        old = OUT / "_old" / f"샤워2_{n}_{k}"; old.parent.mkdir(exist_ok=True); d.rename(old)
        sh = OUT / f"샤워2_{n}_sheet.png"
        if sh.exists(): sh.rename(old / "sheet.png")
    src, frames, opt, prompt = STEPS[n]; start = last(src)
    body = {"character_id": CID, "mode": "pixminimax", "action_description": prompt, "animation_name": f"test 샤워피격 {n}",
            "directions": [D], "frame_count": frames, "subject_description": SUB, "initial_pose": f"standing upright {side}",
            "keep_first_frame": False, "enhance_prompt": False, "custom_start_frame": b64(start)}
    if opt == "loop": body["end_frame"] = b64(start)
    if opt == "back":
        end = last("A")
        if end.size != start.size:   # 시작·끝 장 크기를 맞춘다 (PixelLab 422)
            size = (max(end.width, start.width), max(end.height, start.height))
            start, end = m3.pad(start, size), m3.pad(end, size)
            body["custom_start_frame"] = b64(start)
        body["end_frame"] = b64(end)
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
from concurrent.futures import ThreadPoolExecutor as _E
_one = [a for a in sys.argv[2:] if a.startswith("S")]
if _one:   # 줄만: python3 _test/shower_hit.py <키> S4 [S6 …] [--redo]
    for s in _one: print(key, run(s), flush=True)
    sys.exit()
with _E(3) as ex: print(key, list(ex.map(run, ["S1", "S2", "S3", "S5", "S6"])), flush=True)
print(key, run("S4"), flush=True)
