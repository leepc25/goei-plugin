"""용변·샤워 시험(2026-10-26 사용자: 샤워랑 용변부터 테스트, 에일린으로). 결과: _test/1.4_에일린/<이름>/NN.png"""
import json, sys, time, urllib.error
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import m3
OUT = Path(__file__).resolve().parent / "1.4_에일린"; OUT.mkdir(exist_ok=True)
CID = "e38c681f-5063-487e-8965-a324815912eb"
SUB = "a short woman in her early twenties with a faded platinum blonde high ponytail and long bangs, dull gray eyes, black trouser suit with the jacket open over a thin black ballistic vest and white shirt, black shoes"

def post(path, body):
    for _ in range(60):
        try: return m3.req("POST", path, body, timeout=180)
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(15); continue
            raise RuntimeError(f"HTTP {e.code} {e.read().decode()[:400]}")

def wait(job):
    while True:
        time.sleep(6)
        try: j = m3.req("GET", f"/background-jobs/{job}")
        except Exception: continue
        if j.get("status") in ("completed", "failed", "error", "cancelled"): return j

def anim(cid, name, d, frames, pose, prompt, sub=SUB):
    body = {"character_id": cid, "mode": "pixminimax", "action_description": prompt, "animation_name": name, "directions": [d],
            "frame_count": frames, "subject_description": sub, "initial_pose": pose, "keep_first_frame": False, "enhance_prompt": False}
    r = post("/characters/animations", body); job = r.get("background_job_id") or (r.get("background_job_ids") or [None])[0]; gid = r.get("animation_group_id")
    j = wait(job)
    if j.get("status") != "completed": return name, "실패 " + json.dumps(j)[:400]
    ch = m3.req("GET", f"/characters/{cid}")
    a = next(a for a in ch["animations"] if a.get("animation_group_id") == gid or a.get("id") == gid)
    urls = next(x["frames"] for x in a["directions"] if x["direction"] == d)
    o = OUT / name; o.mkdir(exist_ok=True)
    for i, u in enumerate(urls): m3.fetch_png(u).save(o / f"{i:02d}.png")
    return name, f"완료 {len(urls)}장"

if __name__ == "__main__":
    step = sys.argv[1]
    if step == "toilet":
        print(anim(CID, "변기_앉기_정면", "south", 8, "standing upright facing south toward the viewer, feet together, arms relaxed at the sides",
            "Facing the viewer the whole time. Unbutton the trousers and push the trousers and underwear down to just above the knees, then sit down straight onto an invisible toilet seat at knee height, thighs level and knees together. Hold a folded wad of white toilet paper with both hands in the lap so that it fully covers the groin; nothing private is visible. End seated, leaning forward a little. Draw only the woman and the toilet paper, no toilet, stall or wall."))
    elif step == "state":
        r = post("/create-character-state", {"character_id": CID, "edit_description": "the same woman undressed for a shower: no clothes, no shoes, hair still in the high ponytail; same body, face and proportions", "state_name": "shower", "use_color_palette_from_reference": False})
        print(json.dumps(r)[:400]); j = wait(r.get("background_job_id")); print(j.get("status"), json.dumps(j)[:600])
        json.dump(r, open(OUT / "state.json", "w"))
    elif step == "shower":
        sid = sys.argv[2]; tag = sys.argv[3]
        from concurrent.futures import ThreadPoolExecutor
        pose = {"north": "standing upright with the back to the viewer, facing north", "north-west": "standing upright seen from behind at an angle, facing north-west", "north-east": "standing upright seen from behind at an angle, facing north-east"}
        def one(d):
            try: return anim(sid, f"샤워_{tag}_{d}", d, 8, pose[d], "Standing under a shower with the back to the viewer: tilt the head back a little and run both hands through the hair and the ponytail, then rub the shoulders and the back of the neck, the elbows raised. Draw only the woman, no shower head, booth, wall or water.", sub=f"the same short young woman with a platinum blonde high ponytail, {tag} in the shower, seen from behind")
            except Exception as e: return d, repr(e)[:300]
        with ThreadPoolExecutor(3) as ex:
            for x in ex.map(one, ["north", "north-west", "north-east"]): print(x)
