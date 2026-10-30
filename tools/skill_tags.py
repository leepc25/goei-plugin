"""기술 타격에 꼬리표를 단다(10-30): 판정 형태 form(body·gun·psi)·속성 el(docs/퍽/기술_속성표.json),
부가효과 debuff {k, s}(docs/퍽/기술_부가효과.json — 그 기술의 마지막 타격에만, 원래 있던 표식·묶기는 건너뜀).
코어(fighter/core.ts strike)가 이 꼬리표를 피해 계산(player.ts hurtTarget)으로 넘긴다. 몇 번 돌려도 같다.
사용: python3 tools/skill_tags.py   (game-pack/char-*/char.json 을 고침). build_char_packs.py 도 부른다."""
import glob
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FORM = {"몸": "body", "총·투척": "gun", "이능": "psi"}
DEBUFF = {"출혈": "bleed", "오염": "taint", "두통": "headache", "혼란": "confuse", "공포": "fear", "둔화": "slow", "침묵": "silence", "표식": "mark", "묶기": "bind"}


def _load():
    elems = json.loads((ROOT / "docs/퍽/기술_속성표.json").read_text(encoding="utf-8"))
    fx = json.loads((ROOT / "docs/퍽/기술_부가효과.json").read_text(encoding="utf-8"))
    return elems, fx


def node_of(skills, key):
    if key.startswith("충전"):
        return ((skills.get("charge") or {}).get("lv") or {}).get(key[2:])
    return skills.get({"고유기": "skill", "고유기2": "skill2", "필살": "super"}.get(key, ""))


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


_cache = None


def tag(cfg):
    global _cache
    if _cache is None:
        _cache = _load()
    elems, fx = _cache
    name, sk = cfg.get("name"), cfg.get("skills") or {}
    for r in elems:
        if r["name"] != name:
            continue
        node = node_of(sk, r["skill"])
        if node is None:
            continue
        for h in hits(node, []):
            h["form"] = FORM.get(r["form"], "body")
            h["el"] = r["elem"]
    for r in fx:
        if r["name"] != name or r.get("existing") or r["effect"] not in DEBUFF:
            continue
        node = node_of(sk, r["skill"])
        hs = hits(node, []) if node is not None else []
        for h in hs:
            h.pop("debuff", None)
        if hs:
            hs[-1]["debuff"] = {"k": DEBUFF[r["effect"]], "s": r.get("sec") or 0}


def main():
    for f in sorted(glob.glob(str(ROOT / "game-pack" / "char-*" / "char.json"))):
        d = json.loads(Path(f).read_text(encoding="utf-8"))
        before = json.dumps(d["cfg"], ensure_ascii=False)
        tag(d["cfg"])
        if json.dumps(d["cfg"], ensure_ascii=False) != before:
            Path(f).write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
