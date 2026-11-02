"""좌우 반전 전수 검사(10-28 「계속 꼬여서 좌우 반전됨」).
각 줄의 첫 장은 표의 「시작 장」(전투 자세 장 · N번 끝 장 …)에서 이어 그린 그림이라, 테스트룸에 그려지는 방향(뒤집기 적용 뒤)으로
시작 장과 겹쳐 보면 같아야 한다. 뒤집은 쪽이 훨씬 잘 겹치면 그 줄의 mirror가 틀린 것.
  python3 game-src/action/testroom3/qa/check_mirror.py [키…]     → 의심 줄 목록
"""
import sys, json, re
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE)); ARGS = sys.argv[1:]; sys.argv = sys.argv[:1]
import build
import numpy as np
from PIL import Image

ALIAS = {"약1 끝 장": "9", "약2 끝 장": "10", "쓰러지기 끝 장": "19", "날아가 쓰러지기 끝 장": "19", "충전 모으기 끝 장": "23",
         "움츠린 장": "37", "엎드려 기기 끝 장": "38", "주저앉기 끝 장": "39", "웅크려 떨기 끝 장": "41"}


def frames(cfg, lid):
    an = cfg["anims"].get(lid)
    if not an or an.get("frames"): return None
    fs = sorted((build.src_dir(cfg, an) / an["folder"]).glob("[0-9][0-9].png"))
    if not fs: return None
    return fs, an.get("mirror")


def load(f, mir):
    im = Image.open(f).convert("RGBA")
    if mir: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return np.array(im)[:, :, 3] > 40


def spans(key):
    t = (build.DOCS / f"{key}.md").read_text(encoding="utf-8") if (build.DOCS / f"{key}.md").exists() else ""
    out = {}
    for m in re.finditer(r"^\| (\d+(?:-\d+)?|W(?:-1)?) \| [^|]+ \| [A-Z]+ \| \d+ \| ([^|]+?) → ", t, re.M):
        out.setdefault(m[1].replace("-", "_"), m[2].strip())
    return out


def ref_of(cfg, picks, start):
    for name, (f, i) in picks.items():
        if start.startswith(name):
            r = frames(cfg, f.replace("-", "_"))
            return (r[0][i - 1], r[1]) if r and i <= len(r[0]) else None
    for a, lid in ALIAS.items():
        if start.startswith(a): start = f"{lid}번 끝 장"
    m = re.match(r"(\d+(?:-\d+)?|W(?:-\d+)?)(?:_[A-Z]+)?번 (끝 장|(\d+)번째 장)", start)
    if m:
        r = frames(cfg, m[1].replace("-", "_"))
        if not r: return None
        return (r[0][-1], r[1]) if m[2] == "끝 장" else ((r[0][int(m[3]) - 1], r[1]) if int(m[3]) <= len(r[0]) else None)
    return None


def check(ch):
    p = build.CHARS / f"{ch['key']}.json"
    cfg = build.deep_merge(build.auto_cfg(ch), json.loads(p.read_text(encoding="utf-8")) if p.exists() else {})
    pk = build.M3 / ch["key"] / "picks.json"
    picks = json.loads(pk.read_text())["picks"] if pk.exists() else {}
    bad = []
    for lid, start in spans(ch["key"]).items():
        if lid not in cfg["anims"]: continue
        r = frames(cfg, lid); ref = ref_of(cfg, picks, start)
        if not r or not ref: continue
        a = load(r[0][0], r[1]); b = load(*ref)
        if a.shape != b.shape: continue
        same, flip = (a ^ b).sum(), (a[:, ::-1] ^ b).sum()
        if flip < 0.6 * same and same > 400: bad.append((lid, start[:14], int(same), int(flip)))
    return bad


if __name__ == "__main__":
    tot = 0
    for ch in build.roster():
        if ARGS and ch["key"] not in ARGS: continue
        b = check(ch)
        if b: tot += len(b); print(ch["key"], b)
    print("의심 줄", tot)
