"""통합 테스트룸(인물을 바꿔 가며 시연) 빌드.

사용(저장소 맨 위에서):
  python3 game-src/action/testroom3/build.py            새로 생긴·바뀐 인물만 다시 만듦
  python3 game-src/action/testroom3/build.py --all      전부 다시 만듦
  python3 game-src/action/testroom3/build.py --reset 1.1_쟈알디   그 인물 설정(chars/<키>.json)을 자동값으로 다시 씀

읽는 것
  docs/동작표_3판/00_목록.md        인물 목록·방향·상태(「뽑음」인 인물만 넣음) + 에일린
  docs/동작표_3판/00_베이스.md      줄 목록(옆/비스듬)
  docs/동작표_3판/<키>.md           줄 표의 방향 칸, 맨 아래 「테스트룸」 절(반복 구간·타격 장·좌우 반전)
  game-src/action/motion3/<키>/     <줄 폴더>/NN.png, picks.json(고른 장·통과 목록)
  docs/요원_기술안.md               요원 색, 기술 이름, 필살기 글씨, (설정이 없을 때) 기술 효과 초안
  game-src/action/eileen/vfx/, testroom3/vfx/   이펙트 그림
  game-src/action/eileen/testroom/audio.js       소리
만드는 것
  testroom3/chars/<키>.json  인물 설정(없을 때만 자동으로 만듦, 사람이 고친 값이 늘 이김)
  testroom3/out/index.html, out/chars/<키>.js
"""
import base64, hashlib, io, json, math, re, sys
from pathlib import Path
from PIL import Image
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DOCS = ROOT / "docs/동작표_3판"
M3 = ROOT / "game-src/action/motion3"
EIL = ROOT / "game-src/action/eileen"
OUT = HERE / "out"
CHARS = HERE / "chars"
SKILLDOC = ROOT / "docs/요원_기술안.md"
EILEEN_KEY = "1.4_에일린"
VERSION = "3"   # 그림 처리 방식이 바뀌면 올림(캐시 무효)

# ───────────────────────── 문서 읽기 ─────────────────────────
def roster():
    t = (DOCS / "00_목록.md").read_text(encoding="utf-8")
    out = []
    for num, name, dirs, state in re.findall(r"^\| (\d+\.\d+) \| (\S+) \| ([^|]+) \| ([^|]+) \|", t, re.M):
        d = "W" if "(W)" in dirs else "E"
        out.append(dict(key=f"{num}_{name}", num=num, name=name, dir=d, state=state.strip()))
    return out


def base_lines():
    """00_베이스 3장 줄 목록: id(폴더 꼴) → (이름, '옆'|'비스듬')"""
    t = (DOCS / "00_베이스.md").read_text(encoding="utf-8")
    sec = t.split("## 3.", 1)[1].split("## 4.", 1)[0]
    out = {}
    for lid, name, kind in re.findall(r"^\| (\d+(?:-\d+)?|W(?:-1)?) \| ([^|]+?) \| (옆|비스듬) \|", sec, re.M):
        out[lid.replace("-", "_")] = (name.strip(), kind)
    return out


def md_rows(key):
    """인물 표: 줄 → (이름, 방향)"""
    p = DOCS / f"{key}.md"
    if not p.exists(): return {}, ""
    t = p.read_text(encoding="utf-8")
    rows = {}
    for lid, name, d in re.findall(r"^\| (\d+(?:-\d+)?|W(?:-1)?) \| ([^|]+?) \| (E|W|SE|SW|S|N|NE|NW) \|", t, re.M):
        rows.setdefault(lid.replace("-", "_"), (name.strip(), d))
    tr = t.split("## 테스트룸", 1)[1] if "## 테스트룸" in t else ""
    return rows, tr


LID = r"(?:W-1|W|3-0|\d+(?:-\d+)?)"
NAME2LINE = {"약1": "9", "약2": "10", "약3": "11", "강": "12", "돌진": "13", "점프 공격": "14", "원거리": "15",
             "고유기술": "22", "방출": "24", "필살기": "25", "맞기": "18", "막기": "17"}


def bullet(tr, head):
    m = re.search(r"^- " + head + r"[^:：]*[:：](.*)$", tr, re.M)
    return m.group(1) if m else ""


def frames_of(s):
    """'3~8' → [3..8] (1부터)"""
    m = re.search(r"(\d+)\s*~\s*(\d+)", s)
    if m: a, b = int(m.group(1)), int(m.group(2)); return list(range(a, b + 1))
    m = re.search(r"(\d+)\s*장", s)
    return [int(m.group(1))] if m else None


def parse_loops(tr):
    out = {}
    b = bullet(tr, "반복 구간")
    for seg in re.split(r" · | / |, ", re.sub(r"\([^)]*\)", "", b)):
        seg = seg.strip(" .")
        m = re.match(r"(" + LID + r"(?:·" + LID + r")*)\s*(.*)$", seg)
        if not m: continue
        ids = [x.replace("-", "_") for x in m.group(1).split("·")]
        rest = m.group(2)
        if "뒤" in rest: continue
        if "전체" in rest: fr = "all"
        else:
            r = re.search(r"(\d+)\s*~\s*(\d+)", rest)
            if not r: continue
            fr = list(range(int(r.group(1)), int(r.group(2)) + 1))
        for i in ids: out[i] = fr
    return out


def parse_hits(tr):
    out = {}
    b = re.sub(r"\([^)]*\)", "", bullet(tr, "타격 장"))
    for seg in b.split(" · "):
        seg = seg.strip(" .")
        m = re.match(r"(" + LID + r")\s", seg)
        lid = m.group(1).replace("-", "_") if m else None
        if not lid:
            for nm, l in sorted(NAME2LINE.items(), key=lambda x: -len(x[0])):
                if seg.startswith(nm): lid = l; break
        if not lid: continue
        rngs = re.findall(r"(\d+)(?:\s*~\s*(\d+))?\s*장", seg)
        if rngs: out[lid] = int(rngs[-1][0])
    return out


def parse_flips(tr):
    """「좌우 반전」이 적힌 문장의 줄 번호"""
    out = set()
    for line in tr.splitlines():
        for sent in re.split(r"(?<=[.。])\s", line):
            if "반전" in sent:
                sent = re.sub(r"(동|서|남동|남서)?\(?(E|W|SE|SW)?\)?판", " ", re.sub(r"\([^)]*\)", "", sent))
                for lid in re.findall(r"(?<![\d~.])(" + LID + r")(?![\d~장])", sent):
                    out.add(lid.replace("-", "_"))
    return out


def parse_variant(tr):
    """'38 엎드려 기기 = W판' / '38·38-1은 서(W)판' → {줄: 방향}"""
    out = {}
    for sent in re.split(r"[.\n]", tr):
        m = re.search(r"(동|서|남동|남서)?\(?(E|W|SE|SW)?\)?판", sent)
        if not m or not (m.group(1) or m.group(2)): continue
        d = m.group(2) or {"동": "E", "서": "W", "남동": "SE", "남서": "SW"}[m.group(1)]
        head = re.sub(r"(동|서|남동|남서)?\(?(E|W|SE|SW)?\)?판.*", "", sent)
        for lid in re.findall(r"(?<![\d~])(" + LID + r")(?![\d~장_])", head):
            out[lid.replace("-", "_")] = d
    return out


def skill_doc(name):
    """요원_기술안.md에서 그 인물 절 → 색, 기술 이름·효과, 필살기 글씨"""
    t = SKILLDOC.read_text(encoding="utf-8")
    m = re.search(r"^### \d+\.\d+ " + re.escape(name) + r"\b.*?(?=^### |\Z)", t, re.M | re.S)
    if not m: return {}
    s = m.group(0)
    col = re.search(r"요원 색[^#]*(#[0-9A-Fa-f]{6})", s)
    res = dict(color=col.group(1) if col else "#cfc7a6")
    for k, lab in (("skill", "고유기술"), ("charge", "충전기"), ("super", "필살기")):
        mm = re.search(r"\*\*" + lab + r" 「([^」]+)」\*\*(.*?)(?=\n\*\*(?:고유기술|충전기|필살기) |\Z)", s, re.S)
        if not mm: continue
        eff = re.search(r"- 효과:(.*)", mm.group(2))
        res[k] = dict(name=mm.group(1), text=eff.group(1).strip() if eff else "")
        if k == "super":
            g = re.search(r"\*\*도트 글씨\*\*:\s*(.+?)\s*/\s*(.+)", mm.group(2))
            if g: res[k]["sub"] = g.group(2).strip()
    return res


# ───────────────────────── 기술 초안(설정이 없을 때) ─────────────────────────
def draft_fx(text, kind):
    """기술안 효과 글 → 공용 부품 조합 초안. 사람이 chars/<키>.json에서 고친다."""
    T = text
    hit = {"dmg": 30 if kind == "skill" else 45, "kind": "launch" if "띄" in T else "blow" if ("날아" in T or "다운" in T) else "heavy"}
    fx = []
    if "회복" in T: fx.append({"t": "heal", "on": "self", "v": 30})
    if "폭발" in T or "폭파" in T:
        if "일직선" in T or "연쇄" in T: fx.append({"t": "chain", "n": 3, "from": 90, "step": 120, "every": 0.12, "hit": hit})
        elif "원형" in T or "둘레" in T or "반지름" in T: fx.append({"t": "circle", "r": 260, "n": 8, "hit": hit})
        else: fx.append({"t": "blast", "at": "hand", "dx": 30, "hit": hit})
    if "가시" in T: fx.append({"t": "spikes", "at": "front", "dx": 160, "n": 5, "hit": hit})
    if "구속" in T or "고정" in T or "묶" in T: fx.append({"t": "bind", "time": 2.5})
    if "끌어" in T or "당겨" in T or "당김" in T: fx.append({"t": "pull", "dist": 220})
    if "표식" in T or "표시" in T: fx.append({"t": "mark", "time": 6})
    if any(w in T for w in ("소환", "부하", "설치", "호출")): fx.append({"t": "summon", "icon": "box", "dx": 140, "time": 4})
    if any(w in T for w in ("던", "쏨", "발사", "사격", "탄")) and not any(f["t"] in ("blast", "chain") for f in fx):
        fx.append({"t": "proj", "kind": "orb", "speed": 1400, "hit": hit})
    if any(w in T for w in ("공격력", "속도 +", "피해 -", "감소", "증가", "+%")): fx.append({"t": "buff", "time": 4, "label": "강화"})
    if not any(f["t"] in ("blast", "chain", "circle", "spikes", "proj") for f in fx) and "피해 없음" not in T:
        fx.append({"t": "melee", "range": 170, "hit": hit})
    if kind == "super" and ("화면" in T or "전원" in T or "모든 적" in T):
        each = [f for f in fx if f["t"] not in ("heal", "buff")]
        rest = [f for f in fx if f["t"] in ("heal", "buff")]
        fx = rest + [{"t": "screen", "spots": 6, "each": each or [{"t": "pillar", "hit": {"dmg": 60, "kind": "launch"}}]}]
    return fx


def draft_skills(sd, has, hits, color):
    sk = {}
    def ev_frame(line, default):
        if line in hits: return hits[line]
        return default
    if sd.get("skill"):
        sk["skill"] = {"name": sd["skill"]["name"], "anim": "22" if has("22") else "3", "fps": 11,
                       "events": [{"f": ev_frame("22", 4), "fx": draft_fx(sd["skill"]["text"], "skill")}]}
    if sd.get("charge"):
        tx = sd["charge"]["text"]
        lv = re.split(r"2단", tx, maxsplit=1)
        sk["charge"] = {"name": sd["charge"]["name"], "hold": "23" if has("23") else "3", "release": "24" if has("24") else "3",
                        "levels": [0.5, 1.2], "fire": ev_frame("24", 2),
                        "lv": {"1": draft_fx(lv[0], "charge"), "2": draft_fx("2단" + lv[1] if len(lv) > 1 else tx, "charge")}}
    if sd.get("super"):
        sk["super"] = {"name": sd["super"]["name"], "sub": sd["super"].get("sub", ""), "anim": "25" if has("25") else "3", "fps": 9,
                       "events": [{"f": ev_frame("25", 6), "fx": [{"t": "flash", "v": 0.1}] + draft_fx(sd["super"]["text"], "super")}]}
    return sk


# ───────────────────────── 자동 설정 ─────────────────────────
BASE = base_lines()
DIAG = {k for k, (n, kind) in BASE.items() if kind == "비스듬"}
BASE_NAME = {k: n for k, (n, kind) in BASE.items()}


def folder_dir(folder, rows, cdir):
    m = re.match(r"^(.*?)_(E|W|SE|SW|S|N|NE|NW)$", folder)
    if m: return m.group(2)
    if folder in rows: return rows[folder][1]
    return ("SW" if cdir == "W" else "SE") if folder in DIAG else cdir


def auto_cfg(ch):
    key = ch["key"]
    if key == EILEEN_KEY: return eileen_cfg(ch)
    d = M3 / key
    picks = json.loads((d / "picks.json").read_text()) if (d / "picks.json").exists() else {}
    ok = set(picks.get("ok", []))
    rows, tr = md_rows(key)
    loops, hits, flips, variants = parse_loops(tr), parse_hits(tr), parse_flips(tr), parse_variant(tr)
    folders = sorted(p.name for p in d.iterdir() if p.is_dir() and not p.name.startswith("_") and any(p.glob("[0-9][0-9].png")))
    anims = {}
    order = list(BASE)
    for lid in sorted({re.sub(r"_(E|W|SE|SW|S|N|NE|NW)$", "", f) for f in folders}, key=lambda s: (order.index(s) if s in order else 999, s)):
        cands = [f for f in folders if re.sub(r"_(E|W|SE|SW|S|N|NE|NW)$", "", f) == lid]
        good = [f for f in cands if f in ok] if ok else cands
        if not good: continue
        want = variants.get(lid)
        pick = next((f for f in good if want and folder_dir(f, rows, ch["dir"]) == want and f != lid), None) or (lid if lid in good else good[0])
        fd = folder_dir(pick, rows, ch["dir"])
        west = fd in ("W", "SW", "NW")
        # 「좌우 반전」이 적힌 줄: 인물 기본 방향 그대로 뽑은 판인데 실제로는 반대쪽을 봄 → 반대로
        if lid in flips and pick == lid and fd in (ch["dir"], "SW" if ch["dir"] == "W" else "SE"): west = not west
        anims[lid] = {"folder": pick, "mirror": west, "name": (rows.get(lid) or (BASE_NAME.get(lid, lid),))[0]}
    pk = picks.get("picks", {})
    def pidx(name, line, default):
        v = pk.get(name)
        return v[1] if v and v[0].replace("-", "_") == line else default
    sd = skill_doc(ch["name"])
    has = lambda l: l in anims
    cfg = {
        "key": key, "name": ch["name"], "dir": ch["dir"], "color": sd.get("color", "#cfc7a6"),
        "armed": has("W"),
        "anims": anims,
        "picks": {"combat": pidx("전투 자세 장", "3_0", 4), "weapon": pidx("무기 자세 장", "W", 4), "apex": pidx("방향 점프 꼭대기 장", "7", 4),
                  "run": pidx("뛰기 한 장", "5", 2), "crawl4": pidx("네발로 기기 한 장", "42", 6)},
        "loops": {k: v for k, v in loops.items() if v != "all"},
        "hit": hits,
        "gun": ["W", "W_1", "15"] if has("W") else [],
        "kick": [l for l in ("11", "12", "13", "14") if l in rows and re.search(r"차기|kick|knee|무릎|발", rows[l][0])],
        "ranged": {"proj": {"t": "proj", "kind": "bullet" if has("W") else "orb", "hit": {"dmg": 7, "kind": "light"}}, "heat": has("W")},
        "skills": draft_skills(sd, has, hits, sd.get("color")),
        "_note": "자동 생성. 값을 고치면 build가 그대로 씀. 다시 자동으로: build.py --reset " + key,
    }
    return cfg


EILEEN_LIST = [
 ("1","1","SE","평상 대기"),("2","2","SE","개인 대기"),("3_0","3_0","E","전투 자세 잡기"),("3","3","E","전투 대기"),
 ("W","W","E","무기 꺼내기"),("4","4","E","걷기"),("5","5","E","뛰기"),("6","6","SE","제자리 점프"),("7","7","E","방향 점프"),
 ("8","8","E","달리다 점프"),("9","9","E","약1 손바닥 올려치기"),("10","10","E","약2 팔뚝 밀치기"),("11","11","E","약3 밀어차기"),
 ("12","12","E","강 뒷발 돌려차기"),("13","13","E","돌진 슬라이딩"),("14","14","E","점프 공격"),("15","15","E","원거리 공격"),
 ("16","16","E","뒤 회피"),("16_1","16_1","E","앞 회피"),("17","17","E","막기"),("18","18","E","맞기"),("19","19_1","E","날아가 쓰러지기"),
 ("20","20","E","일어나기"),("21","21","E","스턴"),("22","22","E","판독"),("23","23","E","충전 모으기"),("24","24","E","충전 방출"),
 ("25","25","E","무릎 쏴 난사"),("26","26","SE","섭취"),("27","27","SE","줍기"),("28","28","SE","응대"),("29","29","SE","말하며 손짓"),
 ("30","30","SE","끄덕이기"),("31","31","SE","고개 젓기"),("32","32","SE","화내기"),("33","33","E","발견 반응"),("34","34","SE","놀라기"),
 ("35","35","SE","기뻐하기"),("36","36","E","도망"),("37","37","E","뒷걸음질"),("37_1","37_1","E","뒷걸음질 반복"),("38","38_SW","SW","엎드려 기기"),("38_1","38_1","SW","엎드려 기기 반복"),("39","39","SE","주저앉기"),
 ("40","40","SE","주저앉아 뒤로 기어나가기"),("41","41","SE","웅크려 떨기"),("42","42","E","네발로 기기"),("42_1","42_1","E","네발로 기기 반복"),
 ("W_1","W_1","E","무기 대기"),("22_1","22_1","E","제압사격"),
]


def eileen_cfg(ch):
    anims = {lid: {"folder": f, "mirror": d in ("W", "SW"), "name": n} for lid, f, d, n in EILEEN_LIST if any((EIL / "motion_v3" / f).glob("[0-9][0-9].png"))}
    return {"key": EILEEN_KEY, "name": "에일린", "dir": "E", "color": "#CFC7A6", "src": "eileen", "armed": True, "anims": anims,
            "picks": {"combat": 4, "weapon": 4, "apex": 4, "run": 4, "crawl4": 6},
            "loops": {"1": [1, 2], "19": [9, 11], "21": [2, 3, 4, 5, 6, 7, 8], "23": [5, 6, 7, 8], "39": [8, 9, 10, 11, 12], "41": [5, 6, 7, 8], "42": [5, 6, 7, 8, 9, 10, 11, 12], "15": [4, 5]},
            "arc": {"19": [0, 4, 16, 34, 44, 38, 22, 6, 0, 0, 0, 0]},
            "hit": {}, "gun": ["W", "15", "22", "23", "24", "25", "W_1", "22_1"], "kick": ["11", "12", "13", "14"],
            "ranged": {"proj": {"t": "proj", "kind": "bullet", "hit": {"dmg": 7, "kind": "light"}}, "heat": True},
            "skills": {}, "_note": "에일린: motion_v3를 씀. 기술은 손으로 적음."}


def dump_cfg(cfg):
    """사람이 읽고 고치기 쉽게: 숫자·짧은 목록과 작은 사전은 한 줄로"""
    def enc(v, ind):
        sp = " " * ind
        one = json.dumps(v, ensure_ascii=False)
        if not isinstance(v, (dict, list)) or len(one) + ind < 110: return one
        if isinstance(v, list): return "[\n" + ",\n".join(sp + "  " + enc(x, ind + 2) for x in v) + "\n" + sp + "]"
        return "{\n" + ",\n".join(sp + "  " + json.dumps(k, ensure_ascii=False) + ": " + enc(x, ind + 2) for k, x in v.items()) + "\n" + sp + "}"
    return enc(cfg, 0) + "\n"


def deep_merge(a, b):
    if isinstance(a, dict) and isinstance(b, dict):
        r = dict(a)
        for k, v in b.items(): r[k] = deep_merge(a.get(k), v) if k in a else v
        return r
    return b


# ───────────────────────── 그림 처리 ─────────────────────────
def drop_specks(im, minpx=15, keep_main=False):
    a = np.array(im)
    m = a[:, :, 3] > 40
    H, W = m.shape
    seen = np.zeros_like(m)
    ys, xs = np.nonzero(m)
    comps = []
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if seen[y0, x0]: continue
        comp = [(y0, x0)]; seen[y0, x0] = True; i = 0
        while i < len(comp):
            y, x = comp[i]; i += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; comp.append((ny, nx))
        comps.append(comp)
    big = max(comps, key=len) if comps else None
    for comp in comps:
        if len(comp) < minpx and comp is not big:
            for y, x in comp: a[y, x] = 0
    return Image.fromarray(a, "RGBA")


def is_dark(c): return c[3] > 40 and max(c[:3]) - min(c[:3]) < 40 and sum(c[:3]) < 330


def find_muzzle(im):
    """에일린 build의 총구 찾기(오른쪽을 보는 그림): 어두운 큰 덩어리의 가는 앞 끝 + 불꽃 줄기 각도"""
    px = im.load(); w, h = im.size
    bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bb: return None
    y0, y1 = bb[1] + int((bb[3] - bb[1]) * 0.05), bb[1] + int((bb[3] - bb[1]) * 0.48)
    D = {(x, y) for y in range(y0, y1) for x in range(int(w * 0.3), w) if is_dark(px[x, y])}
    seen = set(); big = set()
    for p in D:
        if p in seen: continue
        comp = []; st = [p]; seen.add(p)
        while st:
            q = st.pop(); comp.append(q)
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (q[0] + dx, q[1] + dy)
                    if n in D and n not in seen: seen.add(n); st.append(n)
        if len(comp) > 150: big |= set(comp)
    if not big: return None
    def run(x, y):
        a = b = y
        while (x, a - 1) in big: a -= 1
        while (x, b + 1) in big: b += 1
        return a, b
    def thin(x, y):
        cy = y
        for xx in range(x, x - 6, -1):
            col = [yy for yy in range(int(cy) - 3, int(cy) + 4) if (xx, yy) in big]
            if not col: return False
            a, b = run(xx, min(col, key=lambda v: abs(v - cy)))
            if b - a > 10: return False
            cy = (a + b) / 2
        return True
    tip = max((p for p in big if thin(*p)), key=lambda p: p[0], default=None) or max(big, key=lambda p: p[0])
    tx = tip[0]
    a, b = run(tx, tip[1])
    ty = (a + b) / 2
    F = [(x, y) for y in range(max(0, int(ty) - 60), min(h, int(ty) + 60)) for x in range(tx + 6, w)
         if px[x, y][3] > 40 and px[x, y][0] > 200 and px[x, y][1] > 150 and px[x, y][2] < 140 and abs(y - ty) < (x - tx)]
    if len(F) > 40:
        num = sum((x - tx) * (y - ty) for x, y in F); den = sum((x - tx) ** 2 for x, y in F)
        return tx, ty, math.atan(num / den), True
    return tx, ty, 0.0, False


def hand_tip(im, bb):
    """맨손 인물의 앞손 끝: 몸 높이 8~60% 띠에서 가장 앞(오른쪽) 픽셀"""
    a = np.array(im)[:, :, 3] > 40
    y0, y1 = bb[1] + int((bb[3] - bb[1]) * 0.08), bb[1] + int((bb[3] - bb[1]) * 0.6)
    band = a[y0:y1]
    cols = np.nonzero(band.any(axis=0))[0]
    if not len(cols): return [0, (bb[1] + bb[3]) / 2]
    x = int(cols.max()); ys = np.nonzero(band[:, x])[0] + y0
    return [x, float(ys.mean())]


def is_flash(c): return c[3] > 0 and c[0] > 200 and c[1] > 130 and c[2] < 100


def process(frames, aid, gun):
    """프레임 목록 → 시트 PNG(잘라 낸 공통 상자, 팔레트) + 장별 수치"""
    w, h = frames[0].size
    if any(f.size != (w, h) for f in frames):   # 캔버스가 다르면 가운데 맞춤
        W_, H_ = max(f.size[0] for f in frames), max(f.size[1] for f in frames)
        nf = []
        for f in frames:
            c = Image.new("RGBA", (W_, H_)); c.paste(f, ((W_ - f.size[0]) // 2, H_ - f.size[1])); nf.append(c)
        frames, w, h = nf, W_, H_
    bot, reach, top, mz, foot, cx, flash, ang = [], [], [], [], [], [], [], []
    for im in frames:
        bb = im.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0, w, h)
        bot.append(bb[3]); top.append(bb[1]); reach.append(bb[2] - w // 2); cx.append((bb[0] + bb[2]) // 2 - w // 2)
        arr = np.array(im)[:, :, 3] > 40
        lo = max(0, bb[3] - 26)
        xs = np.nonzero(arr[lo:bb[3]].any(axis=0))[0]
        if len(xs):
            x0, x1 = int(xs.min()), int(xs.max()); span = max(1, x1 - x0)
            def low(c0, c1):
                sub = arr[lo:bb[3], c0:c1 + 1]; ys = np.nonzero(sub.any(axis=1))[0]
                return lo + int(ys.max()) if len(ys) else bb[3] - 1
            yl, yr = low(x0, x0 + span // 3), low(x1 - span // 3, x1)
            foot.append([(x0 + x1) // 2 - w // 2, span, bb[3] - (yl + yr) / 2, abs(yl - yr) / 2])
        else: foot.append([0, 40, 0, 0])
        g = aid in gun
        if g:
            px = im.load()
            flash.append(sum(1 for y in range(h) for x in range(w // 2, w) if is_flash(px[x, y])) > 20)
            r = find_muzzle(im)
            if r: mz.append([r[0] - w // 2, round(r[1], 1)]); ang.append(round(r[2], 3))
            else: t = hand_tip(im, bb); mz.append([t[0] - w // 2, round(t[1], 1)]); ang.append(0)
        else:
            flash.append(False)
            t = hand_tip(im, bb); mz.append([t[0] - w // 2, round(t[1], 1)]); ang.append(0)
    # 공통 상자로 잘라 이어 붙임
    U = None
    for im in frames:
        b = im.getchannel("A").getbbox()
        if b: U = b if U is None else (min(U[0], b[0]), min(U[1], b[1]), max(U[2], b[2]), max(U[3], b[3]))
    U = U or (0, 0, 1, 1)
    cw, chh = U[2] - U[0], U[3] - U[1]
    sheet = Image.new("RGBA", (cw * len(frames), chh))
    for i, im in enumerate(frames): sheet.paste(im.crop(U), (i * cw, 0))
    src = encode(sheet)
    return dict(n=len(frames), w=w, h=h, ox=U[0], oy=U[1], cw=cw, ch=chh, bot=bot, top=top, reach=reach, foot=foot, mz=mz, cx=cx,
                flash=flash, ang=ang, floor=max(bot), src=src)


def encode(sheet):
    """투명 1색 + 255색 팔레트 PNG(색이 적으면 그대로, 많으면 줄임)"""
    a = np.array(sheet)
    alpha = a[:, :, 3] > 40
    rgb = Image.fromarray(a[:, :, :3], "RGB")
    a[~alpha, :3] = a[alpha, :3][0] if alpha.any() else 0   # 투명 칸 색이 팔레트 자리를 먹지 않게
    rgb = Image.fromarray(a[:, :, :3], "RGB")
    cols = rgb.getcolors(1 << 16)
    q =rgb.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE) if (cols is None or len(cols) > 255) else rgb.convert("P", palette=Image.ADAPTIVE, colors=255)
    idx = np.array(q).astype(np.uint8) + 1
    idx[~alpha] = 0
    pal = [0, 0, 0] + q.getpalette()[:255 * 3]
    p = Image.fromarray(idx, "P"); p.putpalette(pal + [0] * (768 - len(pal)))
    buf = io.BytesIO(); p.save(buf, "PNG", optimize=True, transparency=0)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def src_dir(cfg):
    return EIL / "motion_v3" if cfg.get("src") == "eileen" else M3 / cfg["key"]


def signature(cfg):
    """그림 쪽 서명: 그림 파일·뒤집기·총 줄·지울 칸이 같으면 그림 처리를 건너뜀"""
    h = hashlib.sha1((VERSION + json.dumps([cfg["anims"], cfg.get("gun"), cfg.get("clean")], sort_keys=True, ensure_ascii=False)).encode())
    d = src_dir(cfg)
    for lid, an in sorted(cfg["anims"].items()):
        for f in sorted((d / an["folder"]).glob("[0-9][0-9].png")):
            st = f.stat(); h.update(f"{f.name}{st.st_size}{st.st_mtime_ns}".encode())
    return h.hexdigest()


def build_char(cfg, force=False):
    key = cfg["key"]
    js = OUT / "chars" / f"{key}.js"
    cache = HERE / ".cache" / f"{key}.json"
    cache.parent.mkdir(exist_ok=True)
    sig = signature(cfg)
    A = None
    if not force and cache.exists():
        c = json.loads(cache.read_text())
        if c.get("sig") == sig: A = c["A"]
    rebuilt = A is None
    if rebuilt:
        d = src_dir(cfg)
        A = {}
        gun = set(cfg.get("gun", []))
        for lid, an in cfg["anims"].items():
            fs = sorted((d / an["folder"]).glob("[0-9][0-9].png"))
            if an.get("frames"):   # 고른 장만(1부터, 되풀이 가능). "3_0:4" = 다른 폴더의 장(끝 장을 전투 자세 장으로 닫을 때)
                sel = []
                for i in an["frames"]:
                    if isinstance(i, str) and ":" in i:
                        fd, fi = i.split(":"); other = sorted((d / fd).glob("[0-9][0-9].png"))
                        if 1 <= int(fi) <= len(other): sel.append(other[int(fi) - 1])
                    elif 1 <= i <= len(fs): sel.append(fs[i - 1])
                fs = sel
            if not fs: continue
            ims = [Image.open(f).convert("RGBA") for f in fs]
            if an.get("mirror"): ims = [im.transpose(Image.FLIP_LEFT_RIGHT) for im in ims]
            ims = [drop_specks(im) for im in ims]
            # 손으로 지울 것: [장(1부터), 숫자] = 몸에서 떨어진 덩어리 중 그 픽셀 수보다 작은 것 / [장, [x0,y0,x1,y1]] = 그 칸(뒤집은 뒤 좌표)
            for fi, box in (cfg.get("clean", {}).get(lid) or []):
                if 1 <= fi <= len(ims):
                    if isinstance(box, (int, float)): ims[fi - 1] = drop_specks(ims[fi - 1], int(box), keep_main=True)
                    else: a = np.array(ims[fi - 1]); a[box[1]:box[3], box[0]:box[2]] = 0; ims[fi - 1] = Image.fromarray(a, "RGBA")
            A[lid] = dict(name=an.get("name", lid), **process(ims, lid, gun))
        cache.write_text(json.dumps({"sig": sig, "A": A}, ensure_ascii=False))
    for lid, an in cfg["anims"].items():   # 이름은 설정 것을 씀
        if lid in A: A[lid]["name"] = an.get("name", lid)
    payload = {k: v for k, v in cfg.items() if k not in ("anims",)}
    js.write_text("(window.__C=window.__C||{})[" + json.dumps(key, ensure_ascii=False) + "]=" +
                  json.dumps({"cfg": payload, "A": A}, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    return js.stat().st_size, rebuilt


def load_vfx():
    VFX = {}
    for folder in (EIL / "vfx", HERE / "vfx"):
        if not folder.exists(): continue
        for js in sorted(folder.glob("*.json")):
            if not js.with_suffix(".png").exists(): continue
            meta = json.loads(js.read_text())
            fr0 = meta["frames"][0]
            piv = lambda v, n: v / n if v > 1 else v
            VFX[js.stem] = dict(frames=[[f["frame"]["x"], f["frame"]["y"], f["frame"]["w"], f["frame"]["h"], f["duration"]] for f in meta["frames"]],
                                pivot=[piv(fr0["pivot"]["x"], fr0["frame"]["w"]), piv(fr0["pivot"]["y"], fr0["frame"]["h"])],
                                src="data:image/png;base64," + base64.b64encode(js.with_suffix(".png").read_bytes()).decode())
    return VFX


def main():
    args = sys.argv[1:]
    force = "--all" in args
    reset = set(args[args.index("--reset") + 1:]) if "--reset" in args else set()
    CHARS.mkdir(exist_ok=True); (OUT / "chars").mkdir(parents=True, exist_ok=True)
    index = []
    for ch in roster():
        if ch["key"] != EILEEN_KEY and not ch["state"].startswith("뽑음") and not ch["state"].startswith("완료"): continue
        if ch["key"] != EILEEN_KEY and not (M3 / ch["key"]).exists(): continue
        auto = auto_cfg(ch)
        if not auto["anims"]: continue
        p = CHARS / f"{ch['key']}.json"
        if not p.exists() or ch["key"] in reset:
            p.write_text(dump_cfg(auto), encoding="utf-8")
            cfg = auto
        else:
            cfg = deep_merge(auto, json.loads(p.read_text(encoding="utf-8")))
            # 사람이 지운 줄은 지운 채로, 새로 생긴 줄은 자동값으로
        size, rebuilt = build_char(cfg, force)
        index.append(dict(key=cfg["key"], name=cfg["name"], num=ch["num"], color=cfg.get("color"), dir=cfg["dir"], armed=cfg.get("armed"), kb=size // 1024))
        print(f"{'만듦' if rebuilt else '그대로'} {cfg['key']:<14} 줄 {len(cfg['anims']):>2} · {size / 1024 / 1024:.2f} MB")
    for old in (OUT / "chars").glob("*.js"):   # 목록에서 빠진 인물 파일 정리
        if old.stem not in {c["key"] for c in index}: old.unlink()
    room = (HERE / "room.html").read_text(encoding="utf-8")
    audio = (EIL / "testroom" / "audio.js").read_text(encoding="utf-8")
    html = room.replace("/*__INDEX__*/null", json.dumps(index, ensure_ascii=False)).replace("/*__VFX__*/null", json.dumps(load_vfx())).replace("/*__AUDIO__*/", audio)
    (OUT / "index.html").write_text(html, encoding="utf-8")
    print(OUT / "index.html", (OUT / "index.html").stat().st_size // 1024, "KB ·", len(index), "명")


if __name__ == "__main__":
    main()
