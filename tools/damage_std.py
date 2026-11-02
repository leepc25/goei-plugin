"""기본 피해 표준값(docs/설계_기본피해_표준.md, 10-30)으로 인물 설정(cfg)의 피해를 다시 쓴다.

- 평타 줄(약공 9·10·11, 강공 12, 슬라이딩 13, 점프 14): 피해 = 초당 100 × 그 줄 동작 시간(core.ts atkSeq 와 같은 셈). 역할별 차이는 없앤다.
- 사격(bal.shotDmg): 총 종류별 표준값.
- 충전(단계별)·고유기·두 번째 고유기·필살(광역/단일): 기술 안의 hit.dmg 합이 표준값이 되게 비율을 지켜 다시 나눈다.
- bal.dmgStd = 1 을 남겨 두 번 돌려도 같은 값이 되게 한다.

사용: python3 tools/damage_std.py            (game-pack/char-*/char.json 을 고침)
      build_char_packs.py 가 char.json 을 쓸 때도 normalize() 를 부른다."""
import glob
import json
import sys
from pathlib import Path

DPS = 100
SHOT = {"single": 22, "none": 22, "thrown": 22, "rapid": 18, "heavy": 75}
CHARGE = {"0": 80, "1": 160, "2": 250, "3": 250}
SKILL, SKILL2 = 280, 390
SUPER = {"single": 600, "aoe": 450}
SPEED = {"slow": 1.25, "fast": 0.85}


def line_time(cfg, A, lid, heavy):
    a = A.get(lid)
    if not a:
        return None
    n = a["n"]
    hit = (cfg.get("hit") or {}).get(lid)
    if hit:
        imp = max(0, min(n - 1, hit - 1))
    else:
        reach = a.get("reach") or [0] * n
        imp = 1 if n > 1 else 0
        for f in range(1, n):
            if reach[f] > reach[imp]:
                imp = f
        imp = min(imp, n - 1)
    k = SPEED.get((cfg.get("bal") or {}).get("speed"), 1)
    t = 0.0
    for f in range(n):
        if f < imp:
            t += 0.04 if f == 0 else (0.06 if heavy else 0.045)
        elif f == imp:
            t += 0.13 if heavy else 0.08
        else:
            t += 0.06 if heavy else 0.05
    return t * k


def hits(o, out):
    if isinstance(o, dict):
        h = o.get("hit")
        if isinstance(h, dict) and isinstance(h.get("dmg"), (int, float)):
            out.append(h)
        for v in o.values():
            hits(v, out)
    elif isinstance(o, list):
        for v in o:
            hits(v, out)
    return out


def rescale(node, target):
    hs = hits(node, [])
    total = sum(h["dmg"] for h in hs)
    if not hs or total <= 0:
        return
    f = target / total
    for h in hs:
        h["dmg"] = max(1, round(h["dmg"] * f))


def normalize(cfg, A):
    bal = cfg.setdefault("bal", {})
    if bal.get("dmgStd"):
        return False
    atk = bal.setdefault("atk", {})
    for lid, heavy in (("9", False), ("10", False), ("11", False), ("12", True), ("13", False), ("14", False)):
        t = line_time(cfg, A, lid, heavy)
        if t:
            atk[lid] = round(DPS * t)
    bal["shotDmg"] = SHOT.get(bal.get("gun") or "none", 22)
    sk = cfg.get("skills") or {}
    ch = sk.get("charge") or {}
    for lv, fx in (ch.get("lv") or {}).items():
        if lv in CHARGE:
            rescale(fx, CHARGE[lv])
    if sk.get("skill"):
        rescale(sk["skill"], SKILL)
    if sk.get("skill2"):
        rescale(sk["skill2"], SKILL2)
    if sk.get("super"):
        rescale(sk["super"], SUPER.get(bal.get("superType") or "aoe", 450))
    bal["dmgStd"] = 1
    return True


def main():
    root = Path(__file__).resolve().parents[1]
    n = 0
    for f in sorted(glob.glob(str(root / "game-pack" / "char-*" / "char.json"))):
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        if normalize(d["cfg"], d["A"]):
            Path(f).write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            n += 1
    print(f"고친 인물 {n}명", file=sys.stderr)


if __name__ == "__main__":
    main()
