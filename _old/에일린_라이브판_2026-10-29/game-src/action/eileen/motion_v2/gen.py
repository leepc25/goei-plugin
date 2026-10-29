"""에일린 동작표(docs/동작표/1.4_에일린.md) 35줄을 PixMiniMax로 한 번씩 뽑는다.
동시 20개, 시작 장 연결은 픽셀랩_동작_제작_인계.md 4절 순서."""
import base64, io, json, re, subprocess, sys, threading, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image

API = "https://api.pixellab.ai/v2"
CID = "e38c681f-5063-487e-8965-a324815912eb"
OUT = Path(__file__).resolve().parent
DOC = OUT.parents[3] / "docs/동작표/1.4_에일린.md"
LOG = OUT.parent / "spend.log"
MAXQ = 20
DIRS = {"E": "east", "SE": "south-east"}
lock = threading.Lock()

def log(msg):
    line = time.strftime("%m-%d %H:%M:%S ") + msg
    with lock:
        print(line, flush=True)
        with open(LOG, "a") as f: f.write(line + "\n")

def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as resp:
        return json.load(resp)

def balance():
    return req("GET", "/balance")["subscription"]["generations"]

def fetch_png(url):
    # backblaze는 Python 기본 요청을 막아서 curl로 받는다
    data = subprocess.run(["curl", "-sSf", "--retry", "3", url], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(data)).convert("RGBA")

def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG")
    return {"type": "base64", "base64": base64.b64encode(buf.getvalue()).decode(), "format": "png"}

text = DOC.read_text()
subject = re.search(r"Subject: `([^`]+)`", text).group(1)
rows = {}
for line in text.splitlines():
    m = re.match(r"\| (\d+) \| ([^|]+) \| (E|SE) \| (\d+) \| ([^|]+) \| ([^|]+) \| (\d+) \|", line)
    if m:
        n = int(m[1])
        rows[n] = dict(n=n, name=m[2].strip(), dir=DIRS[m[3]], frames=int(m[4]),
                       pose=m[5].strip(), prompt=m[6].split("<br>")[0].strip())
COMPACT = "compact ready stance"
REGISTERED_POSE = "standing upright, arms relaxed at the sides"

def bbox_top(im): return im.getbbox()[1]
def bbox_w(im): b = im.getbbox(); return b[2] - b[0]

# 시작 장: (의존 동작, 장 고르기)
def first(fr): return fr[0]
def last(fr): return fr[-1]
def top(fr): return min(fr, key=bbox_top)
def stride(fr): return max(fr, key=bbox_w)
START = {10: (9, last), 11: (10, last), 20: (19, last), 24: (23, last), 8: (5, stride), 13: (5, stride), 14: (7, top)}
for n, r in rows.items():
    if n not in START and r["pose"].startswith(COMPACT) and n != 3:
        START[n] = (3, last)
END = {24: (3, last), 25: (3, last)}
TEMPLATE = {4: "walking", 5: "running"}

frames = {}   # n -> list[Image]
done = {}     # n -> threading.Event
for n in rows: done[n] = threading.Event()
sem = threading.Semaphore(MAXQ)

def save(n, fr):
    d = OUT / f"{n:02d}"; d.mkdir(exist_ok=True)
    for i, im in enumerate(fr): im.save(d / f"{i:02d}.png")
    w, h = fr[0].size
    sheet = Image.new("RGBA", (w * len(fr), h))
    for i, im in enumerate(fr): sheet.paste(im, (i * w, 0))
    sheet.save(OUT / f"{n:02d}_sheet.png")

def run(n):
    r = rows[n]
    try:
        deps = [START[n][0]] if n in START else []
        if n in END: deps.append(END[n][0])
        for d in deps:
            done[d].wait()
            if d not in frames: raise RuntimeError(f"의존 {d} 실패")
        body = {"character_id": CID, "mode": "pixminimax",
                "action_description": TEMPLATE.get(n, r["prompt"]),
                "animation_name": f"{n} {r['name']}", "directions": [r["dir"]],
                "frame_count": r["frames"], "subject_description": subject,
                "keep_first_frame": False, "enhance_prompt": False}
        if n not in TEMPLATE and r["pose"] != "—": body["initial_pose"] = r["pose"]
        if n == 3: body["initial_pose"] = REGISTERED_POSE  # 3은 등록 그림(빈손 직립)에서 시작
        if n in START: body["custom_start_frame"] = b64(START[n][1](frames[START[n][0]]))
        if n in END: body["end_frame"] = b64(END[n][1](frames[END[n][0]]))
        with sem:
            while True:
                try:
                    res = req("POST", "/characters/animations", body); break
                except urllib.error.HTTPError as e:
                    msg = e.read().decode()[:300]
                    if e.code in (429, 409, 503) or "wait" in msg.lower() or "concurrent" in msg.lower():
                        time.sleep(15); continue
                    raise RuntimeError(f"HTTP {e.code} {msg}")
            job = res.get("background_job_id") or (res.get("background_job_ids") or [None])[0]
            gid = res.get("animation_group_id")
            log(f"{n} {r['name']} 보냄 job={job} group={gid}")
            while True:
                time.sleep(5)
                j = req("GET", f"/background-jobs/{job}")
                st = j.get("status")
                if st in ("completed", "failed", "error", "cancelled"): break
            if st != "completed": raise RuntimeError(f"job {st}: {json.dumps(j)[:300]}")
        ch = req("GET", f"/characters/{CID}")
        anim = next(a for a in ch["animations"] if a.get("animation_group_id") == gid or a.get("id") == gid)
        urls = next(d["frames"] for d in anim["directions"] if d["direction"] == r["dir"])
        fr = [fetch_png(u) for u in urls]
        frames[n] = fr; save(n, fr)
        log(f"{n} {r['name']} 완료 {len(fr)}장")
    except Exception as e:
        log(f"{n} {r['name']} 실패: {e}")
    finally:
        done[n].set()

if __name__ == "__main__":
    only = [int(x) for x in sys.argv[1:]] or sorted(rows)
    log(f"에일린 v2 시작 {len(only)}개, 잔액 {balance():.2f}")
    ts = [threading.Thread(target=run, args=(n,)) for n in only]
    for n in rows:
        if n not in only: done[n].set()
    for t in ts: t.start()
    for t in ts: t.join()
    log(f"에일린 v2 끝, 잔액 {balance():.2f}")
