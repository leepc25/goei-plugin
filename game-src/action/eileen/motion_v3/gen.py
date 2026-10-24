"""에일린 동작표 2판(docs/동작표/1.4_에일린.md, 2026-10-24 새로 쓴 표)을 PixMiniMax로 뽑는다.
시작 장·끝 장은 표의 「시작 장 → 끝 장」 칸대로. 사용자가 고른 장(전투 자세 장 등)은 picks.json.
사용: python3 gen.py 1 2 3-0 ...   (번호를 주면 그 줄만)"""
import base64, io, json, re, subprocess, sys, threading, time, urllib.request, urllib.error
from pathlib import Path
from PIL import Image

API = "https://api.pixellab.ai/v2"
CID = "e38c681f-5063-487e-8965-a324815912eb"
OUT = Path(__file__).resolve().parent
DOC = OUT.parents[3] / "docs/동작표/1.4_에일린.md"
LOG = OUT.parent / "spend.log"
PICKS = OUT / "picks.json"   # {"전투 자세 장": ["3-0", 3], "무기 자세 장": ["W", 3], "5번 한 장": ["5", 2], ...}
MAXQ = 10
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
    c = [x.strip() for x in line.strip().strip("|").split(" | ")]
    if len(c) >= 8 and re.fullmatch(r"\d+(-\d+)?|W", c[0]) and "<br>" in c[6]:
        rows[c[0]] = dict(n=c[0], name=c[1], dir=DIRS[c[2]], frames=int(c[3]), span=c[4],
                          pose=c[5], prompt=c[6].split("<br>")[0].strip())

def load_frames(n):
    d = OUT / n.replace("-", "_")
    fs = sorted(d.glob("[0-9][0-9].png"))
    return [Image.open(f).convert("RGBA") for f in fs] if fs else None

def picked(name):
    picks = json.loads(PICKS.read_text()) if PICKS.exists() else {}
    if name not in picks: raise RuntimeError(f"「{name}」을 아직 안 고름(picks.json)")
    n, i = picks[name]
    fr = load_frames(n)
    if not fr: raise RuntimeError(f"{n} 결과 없음")
    return fr[i]

rot = {}
def registered(d):
    if d not in rot:
        ch = req("GET", f"/characters/{CID}")
        rot[d] = fetch_png(ch["rotation_urls"][d])
    return rot[d]

def frame_ref(ref, r):
    """표의 장 이름 → 그림. None = 그 칸 비움(등록 그림 = API 기본)."""
    ref = ref.replace("*", "").strip()
    if ref.startswith("등록"): return "REG"
    m = re.match(r"(\d+(-\d+)?)번? 끝 장$", ref)
    if m:
        fr = load_frames(m[1])
        if not fr: raise RuntimeError(f"{m[1]} 결과 없음")
        return fr[-1]
    for name in ("전투 자세 장", "무기 자세 장", "5번 한 장", "7번 꼭대기 장", "7번 하강 장"):
        if ref.startswith(name): return picked(name)
    raise RuntimeError(f"장 이름을 모름: {ref}")

def plan(r):
    a, b = [x.strip() for x in r["span"].split("→", 1)]
    start = frame_ref(a, r)
    loop = "(반복)" in b
    end = None
    if loop and "같은 자세" in b or (loop and a.split()[0] == b.split()[0]):
        end = start                       # 반복 = 시작 장으로 닫음
    elif b.startswith("(") or "끝 장 없음" in b or "이 동작이 만듦" in b:
        end = None                        # 끝 장 비움(이 동작이 만드는 장, 유지 자세, 걷기·뛰기)
    else:
        end = frame_ref(b.split("(")[0], r)
    return start, end

def save(n, fr):
    d = OUT / n.replace("-", "_"); d.mkdir(exist_ok=True)
    for i, im in enumerate(fr): im.save(d / f"{i:02d}.png")
    w, h = fr[0].size
    sheet = Image.new("RGBA", (w * len(fr), h))
    for i, im in enumerate(fr): sheet.paste(im, (i * w, 0))
    sheet.save(OUT / f"{n.replace('-', '_')}_sheet.png")

sem = threading.Semaphore(MAXQ)
def run(n, dry=False):
    r = rows[n]
    try:
        start, end = plan(r)
        if start == "REG": start_img = None
        else: start_img = start
        if end == "REG": end = registered(r["dir"])
        body = {"character_id": CID, "mode": "pixminimax", "action_description": r["prompt"],
                "animation_name": f"v3 {n} {r['name']}", "directions": [r["dir"]],
                "frame_count": r["frames"], "subject_description": subject, "initial_pose": r["pose"],
                "keep_first_frame": False, "enhance_prompt": False}
        if start_img is not None: body["custom_start_frame"] = b64(start_img)
        if end is not None: body["end_frame"] = b64(end)
        desc = f"시작={'등록' if start_img is None else '지정'} 끝={'없음' if end is None else '지정'}"
        if dry:
            log(f"[점검] {n} {r['name']} {r['dir']} {r['frames']}장 {desc}"); return
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
            log(f"{n} {r['name']} 보냄 {desc} job={job}")
            while True:
                time.sleep(5)
                j = req("GET", f"/background-jobs/{job}")
                if j.get("status") in ("completed", "failed", "error", "cancelled"): break
            if j.get("status") != "completed": raise RuntimeError(f"job {j.get('status')}: {json.dumps(j)[:300]}")
        ch = req("GET", f"/characters/{CID}")
        anim = next(a for a in ch["animations"] if a.get("animation_group_id") == gid or a.get("id") == gid)
        urls = next(d["frames"] for d in anim["directions"] if d["direction"] == r["dir"])
        fr = [fetch_png(u) for u in urls]
        save(n, fr)
        log(f"{n} {r['name']} 완료 {len(fr)}장")
    except Exception as e:
        log(f"{n} {r['name']} 실패: {e}")

if __name__ == "__main__":
    args = sys.argv[1:]
    dry = "--dry" in args
    only = [a for a in args if a != "--dry"] or list(rows)
    bad = [n for n in only if n not in rows]
    if bad: sys.exit(f"표에 없는 줄: {bad}")
    if not dry: log(f"에일린 v3 시작 {only}, 잔액 {balance():.2f}")
    ts = [threading.Thread(target=run, args=(n, dry)) for n in only]
    for t in ts: t.start()
    for t in ts: t.join()
    if not dry: log(f"에일린 v3 끝, 잔액 {balance():.2f}")
