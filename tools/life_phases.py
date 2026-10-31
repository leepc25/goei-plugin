"""생활 줄 구간 재기 (10-31 사용자: 책을 펼쳤다 덮었다를 활동 내내 되풀이하면 안 된다).
줄 하나를 「시작(한 번) → 가운데(활동이 끝날 때까지 반복) → 끝(한 번)」으로 나눈다.
  - 장마다 첫 장과 얼마나 다른지 잰다. 가장 많이 다른 장(책을 다 편 장)을 기준으로,
    그 장과 비슷한 장이 이어진 구간 = 가운데. 앞 = 시작, 뒤 = 끝.
  - 되풀이 줄(동작표 끝 장 = 「같은 장 (반복」)만 나눈다. 가운데가 한 장뿐이면 나누지 않는다.
  - 기본 자세로 닫히는 몸짓(끝 장 = 「N번 끝 장」)은 gest 로 표시한다.
결과: game-pack/char-*/char.json 의 cfg.phases[줄] = [가운데 첫 장, 가운데 끝 장] (0부터, 되풀이 줄만),
  cfg.gest = 한 번 하고 기본 자세로 돌아오는 몸짓 줄(커피 한 모금·기지개 등: 다 틀고 잠깐 쉬었다 다시).
사용: python3 tools/life_phases.py [--only 1.1,6.54] [--show 1.1:149]   (build_char_packs.py 도 부른다)"""
import sys, json, io, re
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACKS = ROOT / "game-pack"
# 앉기·눕기 자체(자세로 들어가는 줄)와 화장실 들어가기, 걷기류는 나누지 않는다
SKIP = {"60", "61", "96", "75", "101", "103", "86", "87"}


def life(lid):
    try: return int(lid.split("_")[0]) >= 60 and lid not in SKIP
    except ValueError: return False


def frames(d, meta):
    im = np.asarray(Image.open(d / meta["file"]).convert("RGBA")).astype(np.int16)
    cw = meta["cw"]
    return [im[:, i * cw:(i + 1) * cw] for i in range(meta["n"])]


def diff(a, b):
    """두 장의 모양 차이 = 1 - 겹침 비율(실루엣). 색 차이는 소품이 조금만 움직여도 커서 쓰지 않는다"""
    A, B = a[..., 3] > 0, b[..., 3] > 0
    u = (A | B).sum()
    return float(1 - (A & B).sum() / u) if u else 0.0


def phase(fr):
    n = len(fr)
    if n < 5: return None
    d0 = [diff(f, fr[0]) for f in fr]
    M = max(d0)
    if M < 0.02: return None   # 거의 안 움직이는 줄(숨쉬기)
    ref = int(np.argmax(d0))
    dr = [diff(f, fr[ref]) for f in fr]
    thr = 0.5 * M
    a = b = ref
    while a - 1 > 0 and dr[a - 1] < thr: a -= 1
    while b + 1 < n - 1 and dr[b + 1] < thr: b += 1
    if b - a < 1: return None
    return [a, b]


def spans(num):
    """동작표에서 줄마다 「시작 장 → 끝 장」 칸. 끝이 「같은 장 (반복」이면 되풀이 줄, 「N번 끝 장」으로 닫히면 한 번 하는 몸짓"""
    md = next(iter((ROOT / "docs/동작표_3판").glob(f"{num}_*.md")), None)
    out = {}
    if not md: return out
    for l in md.read_text(encoding="utf-8").splitlines():
        c = [x.strip() for x in l.strip().strip("|").split(" | ")]
        if len(c) >= 5 and re.fullmatch(r"\d+(-\d+)?", c[0]) and "→" in c[4]: out.setdefault(c[0].replace("-", "_"), c[4])
    return out


def run(only=None, show=None):
    out = {}
    for d in sorted(PACKS.glob("char-*")):
        num = d.name[5:]
        if only and num not in only: continue
        p = d / "char.json"
        if not p.exists(): continue
        j = json.loads(p.read_text(encoding="utf-8"))
        ph, gest = {}, []
        sp = spans(num)
        for lid, meta in j["A"].items():
            if not life(lid): continue
            end = sp.get(lid, "").split("→")[-1]
            if "반복" in end or "같은 장" in end:
                r = phase(frames(d, meta))
                if r: ph[lid] = r
            elif "끝 장" in end: gest.append(lid)   # 한 번 하고 기본 자세로 돌아오는 몸짓 → 틀고 잠깐 쉬고 다시
            if show and show == f"{num}:{lid}": print(lid, meta["n"], end, ph.get(lid), lid in gest)
        j["cfg"]["phases"] = ph
        j["cfg"]["gest"] = gest
        p.write_text(json.dumps(j, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        out[num] = len(ph)
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    only = set(a[a.index("--only") + 1].split(",")) if "--only" in a else None
    show = a[a.index("--show") + 1] if "--show" in a else None
    r = run(only, show)
    print(len(r), "명", sum(r.values()), "줄 나눔")
