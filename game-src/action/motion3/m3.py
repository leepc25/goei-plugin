"""동작표 3판 공용 생성기 (2026-10-25). 인물 구분 없이 PixelLab 큐 최대 20개를 늘 채워 돌린다.

표: docs/동작표_3판/<키>.md (키 = 파일 이름, 예: 1.1_쟈알디)
결과: game-src/action/motion3/<키>/<줄>/NN.png, <줄>_sheet.png, picks.json, spend.log
큐: game-src/action/motion3/queue/{pending,running,done,failed}/*.json

사용 (저장소 맨 위에서):
  python3 game-src/action/motion3/m3.py daemon            큐 일꾼(백그라운드로 하나만)
  python3 game-src/action/motion3/m3.py enq <키> <줄…> [--dir SW]   줄을 큐에 넣음(all = 표 전부)
  python3 game-src/action/motion3/m3.py st [<키>]          상태
  python3 game-src/action/motion3/m3.py wait <키> [초]      그 인물의 새 결과가 나올 때까지 기다림(기본 540초)
  python3 game-src/action/motion3/m3.py pick <키> <이름> <줄> <장(1부터)>   기준 장 고르기(전투 자세 장 등)
  python3 game-src/action/motion3/m3.py ok <키> <줄…>       검수 통과(이 줄에서 시작하는 줄이 풀림)
  python3 game-src/action/motion3/m3.py fail <키> <줄> <까닭>   세 번 실패, 건너뜀 기록

장 이름(표의 「시작 장 → 끝 장」 칸):
  등록 옆 / 등록 비스듬 → 등록 그림(API 기본)
  picks.json에 있는 이름(전투 자세 장, 무기 자세 장, 뛰기 한 장, 방향 점프 꼭대기 장, 네발로 기기 한 장 …)
  <줄>번 끝 장, <줄>번 N번째 장 → 그 줄 결과(검수 통과(ok) 뒤에만 풀림)
  약1 끝 장 = 9번 끝 장 등 별칭(ALIAS)
  같은 장 / 반복 → 시작 장으로 닫음, 괄호로 시작 → 끝 장 없음
"""
import base64, io, json, os, re, subprocess, sys, threading, time, urllib.request, urllib.error, traceback
from pathlib import Path
from PIL import Image, ImageDraw

API = "https://api.pixellab.ai/v2"
ROOT = Path(__file__).resolve().parents[3]
BASE = Path(__file__).resolve().parent
DOCS = ROOT / "docs/동작표_3판"
Q = BASE / "queue"
MAXQ = 20
DIRS = {"E": "east", "W": "west", "SE": "south-east", "SW": "south-west", "S": "south",
        "NE": "north-east", "NW": "north-west", "N": "north"}
ALIAS = {"약1 끝 장": "9", "약2 끝 장": "10", "쓰러지기 끝 장": "19", "날아가 쓰러지기 끝 장": "19",
         "충전 모으기 끝 장": "23", "움츠린 장": "37", "엎드려 기기 끝 장": "38", "주저앉기 끝 장": "39",
         "웅크려 떨기 끝 장": "41"}
lock = threading.Lock()
for s in ("pending", "running", "done", "failed"): (Q / s).mkdir(parents=True, exist_ok=True)


def order():
    t = (DOCS / "00_목록.md").read_text()
    return [m[0] + "_" + m[1] for m in re.findall(r"^\| (\d+\.\d+) \| (\S+) \|", t, re.M)]


def cdir(key):
    d = BASE / key; d.mkdir(exist_ok=True); return d


def log(key, msg):
    line = time.strftime("%m-%d %H:%M:%S ") + msg
    with lock:
        print(f"[{key}] {line}", flush=True)
        with open(cdir(key) / "spend.log", "a") as f: f.write(line + "\n")


def req(method, path, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        raw = resp.read()
        return json.loads(raw) if raw.strip() else {}


def fetch_png(url):
    data = subprocess.run(["curl", "-sSf", "--retry", "3", url], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(data)).convert("RGBA")


def pad(img, size):
    if img.size == size: return img
    c = Image.new("RGBA", size, (0, 0, 0, 0))
    c.paste(img, ((size[0] - img.width) // 2, size[1] - img.height))
    return c


def b64(img):
    buf = io.BytesIO(); img.save(buf, "PNG")
    return {"type": "base64", "base64": base64.b64encode(buf.getvalue()).decode(), "format": "png"}


# ---------- 표 읽기 ----------
def table(key):
    text = (DOCS / f"{key}.md").read_text()
    cid = re.search(r"PixelLab id `([^`]+)`", text)[1]
    subject = re.search(r"Subject: `([^`]+)`", text)[1]
    rows = {}
    for line in text.splitlines():
        c = [x.strip() for x in line.strip().strip("|").split(" | ")]
        if len(c) >= 8 and re.fullmatch(r"\d+(-\d+)?|W(-\d+)?", c[0]) and c[6]:
            rows[c[0]] = dict(n=c[0], name=c[1], dir=c[2], frames=int(c[3]), span=c[4], pose=c[5],
                              prompt=c[6].split("<br>")[0].strip(), memo=c[8] if len(c) > 8 else "")
    return dict(cid=cid, subject=subject, rows=rows)


def state(key):
    p = cdir(key) / "picks.json"
    s = json.loads(p.read_text()) if p.exists() else {}
    s.setdefault("picks", {}); s.setdefault("ok", []); s.setdefault("fail", {})
    return s


def save_state(key, s):
    (cdir(key) / "picks.json").write_text(json.dumps(s, ensure_ascii=False, indent=1))


def folder(n, dsuf=""):
    return n.replace("-", "_") + (f"_{dsuf}" if dsuf else "")


def load_frames(key, f):
    fs = sorted((cdir(key) / f).glob("[0-9][0-9].png"))
    return [Image.open(x).convert("RGBA") for x in fs] if fs else None


class NotReady(Exception): pass


def frame_ref(key, ref, st):
    ref = ref.replace("*", "").strip()
    if ref.startswith("등록"): return "REG"
    for a, n in ALIAS.items():
        if ref.startswith(a): ref = f"{n}번 끝 장"; break
    for name, (f, i) in st["picks"].items():
        if ref.startswith(name):
            fr = load_frames(key, f)
            if not fr: raise NotReady(f"{name}: {f} 결과 없음")
            return fr[i - 1]
    m = re.match(r"(\d+(?:-\d+)?|W(?:-\d+)?)(?:_([A-Z]+))?번 (끝 장|(\d+)번째 장)", ref)
    if m:
        f = folder(m[1], m[2] or "")
        if f not in st["ok"]: raise NotReady(f"{f} 검수 전")
        fr = load_frames(key, f)
        return fr[-1] if m[3] == "끝 장" else fr[int(m[4]) - 1]
    if re.match(r"(전투 자세 장|무기 자세 장|뛰기 한 장|방향 점프 꼭대기 장|네발로 기기 한 장)", ref):
        raise NotReady(f"{ref} 아직 안 고름")
    raise RuntimeError(f"장 이름을 모름: {ref}")


def plan(key, r, st):
    a, b = [x.strip() for x in r["span"].split("→", 1)]
    start = frame_ref(key, a, st)
    if b.startswith("같은") or "(반복" in b and not b.startswith("("):
        end = start
    elif b.startswith("(") or "끝 장 없음" in b or "이 동작이 만듦" in b:
        end = None
    else:
        end = frame_ref(key, b.split("(")[0], st)
    return start, end


# ---------- 결과 저장 ----------
def sheet(frames, path, label=True):
    w, h = frames[0].size
    S = Image.new("RGBA", (w * len(frames), h + (12 if label else 0)), (190, 190, 190, 255))
    d = ImageDraw.Draw(S)
    for i, im in enumerate(frames):
        S.paste(im, (i * w, 12 if label else 0), im)
        if label: d.text((i * w + 3, 0), str(i + 1), fill=(0, 0, 0, 255))
        d.line([(i * w, 0), (i * w, S.height)], fill=(150, 150, 150, 255))
    S.save(path)


def save(key, f, fr):
    d = cdir(key) / f
    if d.exists() and any(d.glob("[0-9][0-9].png")):
        k = 1
        while (cdir(key) / "_old" / f"{f}_{k}").exists(): k += 1
        old = cdir(key) / "_old" / f"{f}_{k}"; old.mkdir(parents=True)
        for x in d.glob("*.png"): x.rename(old / x.name)
        sh = cdir(key) / f"{f}_sheet.png"
        if sh.exists(): sh.rename(old / "sheet.png")
    d.mkdir(exist_ok=True)
    for i, im in enumerate(fr): im.save(d / f"{i:02d}.png")
    sheet(fr, cdir(key) / f"{f}_sheet.png")


# ---------- 일꾼 ----------
def run_job(path):
    j = json.loads(path.read_text())
    key, n, dsuf = j["key"], j["row"], j.get("dir", "")
    f = folder(n, dsuf)
    try:
        T = table(key); r = T["rows"][n]; st = state(key)
        start, end = plan(key, r, st)
        d = DIRS[dsuf or r["dir"]]
        reg = None
        if start == "REG" or end == "REG":
            ch = req("GET", f"/characters/{T['cid']}")
            reg = fetch_png(ch["rotation_urls"][d])
        start_img = None if start == "REG" else start
        if end == "REG": end = reg
        if end is not None:
            base = start_img if start_img is not None else reg
            if end.size != base.size:
                size = (max(end.width, base.width), max(end.height, base.height))
                start_img, end = pad(base, size), pad(end, size)
        name = f"v3 {f} {r['name']}"
        body = {"character_id": T["cid"], "mode": "pixminimax", "action_description": r["prompt"],
                "animation_name": name, "directions": [d], "frame_count": r["frames"],
                "subject_description": T["subject"], "initial_pose": r["pose"],
                "keep_first_frame": "첫 장 유지" in r["memo"] or "첫 장 유지" in r["span"],
                "enhance_prompt": False}
        if start_img is not None: body["custom_start_frame"] = b64(start_img)
        if end is not None: body["end_frame"] = b64(end)
        ch = req("GET", f"/characters/{T['cid']}")
        for a in ch["animations"]:
            if a.get("display_name", "").startswith(f"v3 {f} "):
                req("DELETE", f"/characters/{T['cid']}/animations/{a['animation_group_id']}")
                log(key, f"이전 판 지움: {a.get('display_name')}")
        while True:
            try:
                res = req("POST", "/characters/animations", body); break
            except urllib.error.HTTPError as e:
                msg = e.read().decode()[:300]
                if e.code in (429, 409, 503, 502) or "wait" in msg.lower() or "concurrent" in msg.lower():
                    time.sleep(20); continue
                raise RuntimeError(f"HTTP {e.code} {msg}")
        job = res.get("background_job_id") or (res.get("background_job_ids") or [None])[0]
        gid = res.get("animation_group_id")
        cost = 1 if r["frames"] <= 8 else 2
        log(key, f"{f} {r['name']} 보냄 {d} {r['frames']}장 시작={'등록' if start_img is None else '지정'} "
                 f"끝={'없음' if end is None else '지정'} 약 {cost}회")
        t0 = time.time()
        while True:
            time.sleep(6)
            try: jj = req("GET", f"/background-jobs/{job}")
            except Exception: continue
            if jj.get("status") in ("completed", "failed", "error", "cancelled"): break
            if time.time() - t0 > 1800: raise RuntimeError("30분 넘음")
        if jj.get("status") != "completed": raise RuntimeError(f"job {jj.get('status')}: {json.dumps(jj)[:300]}")
        for _ in range(6):
            try:
                ch = req("GET", f"/characters/{T['cid']}"); break
            except Exception: time.sleep(10)
        anim = next(a for a in ch["animations"] if a.get("animation_group_id") == gid or a.get("id") == gid)
        urls = next(x["frames"] for x in anim["directions"] if x["direction"] == d)
        fr = [fetch_png(u) for u in urls]
        save(key, f, fr)
        if f in st["ok"]:
            st = state(key); st["ok"].remove(f); save_state(key, st)
        log(key, f"{f} {r['name']} 완료 {len(fr)}장 ({int(time.time() - t0)}초)")
        j.update(status="done", frames=len(fr), t=time.time()); dest = "done"
    except NotReady as e:
        j["wait"] = str(e); path.write_text(json.dumps(j, ensure_ascii=False))
        path.rename(Q / "pending" / path.name); return
    except Exception as e:
        log(key, f"{f} 오류: {e}")
        j.update(status="failed", err=str(e)[:500], t=time.time()); dest = "failed"
    (Q / dest / path.name).write_text(json.dumps(j, ensure_ascii=False))
    path.unlink(missing_ok=True)


def ready(path):
    j = json.loads(path.read_text())
    try:
        T = table(j["key"]); r = T["rows"][j["row"]]
        plan(j["key"], r, state(j["key"]))
        return True
    except NotReady:
        return False
    except Exception as e:
        j.update(status="failed", err=f"준비 오류: {e}", t=time.time())
        (Q / "failed" / path.name).write_text(json.dumps(j, ensure_ascii=False)); path.unlink(); return False


def daemon():
    for p in (Q / "running").glob("*.json"): p.rename(Q / "pending" / p.name)   # 다시 켜면 이어서
    threads = {}; nocheck = {}
    print("일꾼 시작", time.strftime("%H:%M:%S"), flush=True)
    while True:
        for k in [k for k, t in threads.items() if not t.is_alive()]: del threads[k]
        if len(threads) < MAXQ:
            for p in sorted((Q / "pending").glob("*.json")):
                if len(threads) >= MAXQ: break
                if nocheck.get(p.name, 0) > time.time(): continue
                if not ready(p):
                    nocheck[p.name] = time.time() + 20; continue
                dst = Q / "running" / p.name
                p.rename(dst)
                t = threading.Thread(target=run_job, args=(dst,), daemon=True); t.start()
                threads[p.name] = t
        (Q / "heartbeat").write_text(f"{time.time()} {len(threads)}")
        time.sleep(4)


def enq(key, rows, dsuf=""):
    T = table(key)
    if rows == ["all"]: rows = list(T["rows"])
    pr = order().index(key)
    for n in rows:
        if n not in T["rows"]: print("표에 없음/프롬프트 없음:", n); continue
        f = folder(n, dsuf)
        for s in ("pending", "running"):
            if any(Q.glob(f"{s}/*__{key}__{f}.json")): print("이미 큐에 있음:", f); break
        else:
            name = f"P{pr:03d}_{time.time():.3f}__{key}__{f}.json"
            (Q / "pending" / name).write_text(json.dumps(dict(key=key, row=n, dir=dsuf, t=time.time()), ensure_ascii=False))
            print("넣음:", key, f)


def status(key=None):
    hb = Q / "heartbeat"
    if hb.exists():
        t, n = hb.read_text().split(); print(f"일꾼 {int(time.time() - float(t))}초 전 살아 있음, 도는 중 {n}")
    for s in ("running", "pending", "failed"):
        fs = sorted(Q.glob(f"{s}/*.json"))
        if key: fs = [p for p in fs if f"__{key}__" in p.name]
        items = []
        for p in fs:
            j = json.loads(p.read_text())
            items.append(p.name.split("__")[-1][:-5] + (f"({j['wait']})" if s == "pending" and j.get("wait") else "")
                         if key else p.name.split("__", 1)[1][:-5].replace("__", ":"))
        print(f"{s} {len(fs)}: {' '.join(items[:80])}")
    if key:
        st = state(key); print("picks", st["picks"]); print("ok", " ".join(st["ok"])); print("fail", st["fail"])


def wait(key, secs=540):
    seen = {p.name: p.stat().st_mtime for p in Q.glob(f"done/*__{key}__*.json")}
    seen.update({p.name: p.stat().st_mtime for p in Q.glob(f"failed/*__{key}__*.json")})
    t0 = time.time()
    while time.time() - t0 < secs:
        new = [p for p in list(Q.glob(f"done/*__{key}__*.json")) + list(Q.glob(f"failed/*__{key}__*.json"))
               if seen.get(p.name) != p.stat().st_mtime]
        if new:
            time.sleep(3)
            for p in new:
                j = json.loads(p.read_text())
                f = p.name.split("__")[-1][:-5]
                print(("완료 " + f + f" {j.get('frames')}장 → game-src/action/motion3/{key}/{f}_sheet.png")
                      if j["status"] == "done" else f"실패 {f}: {j.get('err')}")
            return
        if not any(Q.glob(f"pending/*__{key}__*.json")) and not any(Q.glob(f"running/*__{key}__*.json")):
            print("이 인물 큐가 비었음"); return
        time.sleep(5)
    print("시간 다 됨(새 결과 없음)")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "daemon": daemon()
    elif a[0] == "enq":
        d = ""
        if "--dir" in a: i = a.index("--dir"); d = a[i + 1]; a = a[:i] + a[i + 2:]
        enq(a[1], a[2:], d)
    elif a[0] == "st": status(a[1] if len(a) > 1 else None)
    elif a[0] == "wait": wait(a[1], int(a[2]) if len(a) > 2 else 540)
    elif a[0] == "pick":
        st = state(a[1]); f = a[3] if "_" in a[3] else folder(a[3]); st["picks"][a[2]] = [f, int(a[4])]
        if f not in st["ok"]: st["ok"].append(f)
        save_state(a[1], st); print("고름", st["picks"])
    elif a[0] == "ok":
        st = state(a[1])
        for n in a[2:]:
            f = n if "_" in n else folder(n)
            if f not in st["ok"]: st["ok"].append(f)
        save_state(a[1], st); print("ok", st["ok"])
    elif a[0] == "fail":
        st = state(a[1]); st["fail"][a[2]] = " ".join(a[3:]); save_state(a[1], st); print("기록", st["fail"])
