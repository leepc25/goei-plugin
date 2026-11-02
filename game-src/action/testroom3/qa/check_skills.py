"""chars/<키>.json 의 skills 검사: 부품 이름(t)·동작 줄(anim/hold/release)·이펙트 그림(vfx) 이름이 실제로 있는지.

사용(저장소 맨 위): python3 game-src/action/testroom3/qa/check_skills.py [키…]   (키 없으면 전부)
"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
sys.argv = sys.argv[:1] + [a for a in sys.argv[1:]]
import build  # noqa: E402

# 부품 목록은 게임 엔진(src/game/action/fighter/core.ts, 2026-10-29부터 원본)에서 읽는다
room = (HERE.parents[2] / "src/game/action/fighter/core.ts").read_text(encoding="utf-8")
blk = room.split("const FX = {", 1)[1].split("\nfunction runFx", 1)[0]
PARTS = set(re.findall(r"^  (\w+)\(s\??(?:: \w+)?(?:, c\??(?:: \w+)?)?\)", blk, re.M))
VFXN = {p.stem for d in (build.EIL / "vfx", HERE / "vfx") for p in d.glob("*.json") if p.with_suffix(".png").exists()}
KINDS = {"light", "heavy", "launch", "blow", "down", "stun", "spike", "pull", "turn"}


def walk(fx, path, errs, anims):
    for i, s in enumerate(fx or []):
        p = f"{path}[{i}]"
        if not isinstance(s, dict) or "t" not in s: errs.append(f"{p}: 부품이 아님"); continue
        if s["t"] not in PARTS: errs.append(f"{p}: 없는 부품 t={s['t']}")
        for k in ("vfx",):
            if k in s and s[k] not in VFXN: errs.append(f"{p}: 없는 그림 {s[k]}")
        for hk in ("hit",):
            h = s.get(hk)
            if h:
                if h.get("kind") and h["kind"] not in KINDS: errs.append(f"{p}.hit: 없는 kind {h['kind']}")
                if h.get("mid") and h["mid"] not in KINDS: errs.append(f"{p}.hit: 없는 mid {h['mid']}")
                if h.get("vfx") and h["vfx"] not in VFXN: errs.append(f"{p}.hit: 없는 그림 {h['vfx']}")
        for sub in ("each", "fx", "end", "after", "yes", "no"):
            if sub in s: walk(s[sub], f"{p}.{sub}", errs, anims)
        if "tick" in s: walk(s["tick"].get("fx"), f"{p}.tick", errs, anims)
        if s["t"] == "summon" and s.get("anim") and s["anim"] not in anims: errs.append(f"{p}: 없는 줄 anim={s['anim']}")


def check_sp(sp, path, errs, anims):
    steps = sp.get("steps") or [sp]
    for j, st in enumerate(steps):
        q = f"{path}.steps[{j}]" if sp.get("steps") else path
        if "anim" in st and st["anim"] not in anims: errs.append(f"{q}: 없는 줄 anim={st['anim']}")
        n = None
        for e in st.get("events", []):
            if "f" not in e: errs.append(f"{q}: 장(f) 없는 이벤트")
            walk(e.get("fx"), f"{q}.f{e.get('f')}", errs, anims)


def main():
    keys = sys.argv[1:]
    bad = 0
    for ch in build.roster():
        key = ch["key"]
        if keys and key not in keys: continue
        p = build.CHARS / f"{key}.json"
        if not p.exists(): continue
        if key != build.EILEEN_KEY and not (build.M3 / key).exists(): continue
        cfg = build.deep_merge(build.auto_cfg(ch), json.loads(p.read_text(encoding="utf-8")))
        anims = set(cfg["anims"])
        sk = cfg.get("skills") or {}
        errs = []
        for name in ("skill", "skill2", "super"):
            if sk.get(name): check_sp(sk[name], name, errs, anims)
        alt = (sk.get("skill") or {}).get("alt")
        if alt and alt not in sk: errs.append(f"skill.alt: 없는 기술 {alt}")
        c = sk.get("charge")
        if c:
            for k in ("hold", "release"):
                if c.get(k) and c[k] not in anims: errs.append(f"charge.{k}: 없는 줄 {c[k]}")
            for lv, rl in (c.get("releaseLv") or {}).items():
                if rl not in anims: errs.append(f"charge.releaseLv[{lv}]: 없는 줄 {rl}")
            for lv, fx in (c.get("lv") or {}).items(): walk(fx, f"charge.lv{lv}", errs, anims)
        if errs:
            bad += 1
            print(f"✗ {key}"); [print("   ", e) for e in errs]
        else:
            print(f"✓ {key}  {', '.join(k for k in ('skill', 'charge', 'super', 'skill2') if sk.get(k))}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
