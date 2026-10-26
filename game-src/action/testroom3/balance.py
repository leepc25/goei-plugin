"""밸런스 값 계산·적용(사용자 2026-10-25): 인물 설정 chars/<키>.json 에 bal 을 넣고 기술 피해를 예산에 맞춰 다시 맞춘다.
근거·표: docs/밸런스_설계.md. 분류: docs/밸런스_분류.json(이름 있는 인물), NPC 는 아래 NPC 표.
사용: python3 balance.py   → chars/*.json 고침 + docs/밸런스_표.md 씀"""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[2]
M3 = HERE.parent / "motion3"; CH = HERE / "chars"

# 역할별 근접 초당 피해(DPS). 샌드백 HP 400 기준: 보통 인물이 약공 연타로 10초 안팎
DPS = {"striker": 46, "bruiser": 42, "tank": 34, "ranged": 32, "support": 30, "control": 34}
SPEED = {"fast": 0.88, "normal": 1.0, "slow": 1.18}          # 같은 길이라도 굼뜬 인물은 한 대가 더 아프게
ROW = {"9": 1.0, "10": 1.0, "11": 1.15, "12": 1.25, "13": 1.1, "14": 1.6}   # 약1·약2·약3(마무리)·강·돌진·점프(4장으로 짧아 높게)
CD = {"striker": 6, "bruiser": 8, "tank": 10, "ranged": 7, "support": 9, "control": 9}   # 고유기술 쿨타임(초)
SUPER = {"striker": 180, "bruiser": 180, "ranged": 180, "control": 160, "tank": 140, "support": 140}
GUN = {  # 원거리 기본공격: 약한 단발은 쿨타임 없이, 강한 것·연발은 과열이나 쿨타임
    # 사용자 2026-10-26: 연속으로 계속 나가면 안 됨 → 연사(rapid)만 누른 채 연사 + 과열, 나머지는 한 번 누르면 한 발 + 최소 간격(쿨)
    "single": dict(shotDmg=9, cd=0.45), "thrown": dict(shotDmg=7, cd=0.6),
    "rapid": dict(shotDmg=6, heatPer=9), "heavy": dict(shotDmg=30, cd=2.5), "none": dict(shotDmg=10, cd=1.5)}
# NPC(6.x): 종류 → (역할, 원거리, 손 빠르기, 피해 배율, 게임 HP)
NPC = [("가짜관리국진압", "bruiser", "rapid", "normal", 1.1, 140), ("가짜관리국검사", "control", "single", "normal", 1.05, 120),
       ("관리국", "bruiser", "single", "normal", 1.0, 120), ("백일몽", "striker", "single", "fast", 1.0, 110),
       ("협회", "control", "single", "normal", 0.95, 110), ("프리랜서", "striker", "single", "normal", 1.0, 110),
       ("경찰", "bruiser", "single", "normal", 0.9, 100), ("불량배", "bruiser", "none", "normal", 0.8, 90),
       ("상인", "support", "none", "slow", 0.55, 60), ("의사", "support", "none", "slow", 0.5, 60), ("간호사", "support", "none", "normal", 0.5, 60),
       ("청소부", "bruiser", "none", "slow", 0.6, 70), ("학생", "striker", "none", "fast", 0.5, 55), ("시민", "support", "none", "normal", 0.5, 55)]


def frames(key, row):
    return len(list((M3 / key / row).glob("[0-9][0-9].png")))


def dur(n, imp, heavy):
    """room.html atkSeq 와 같은 장 시간 합(초)"""
    if n <= 0: return 0.5
    pre = 0.04 + max(0, imp - 1) * (0.06 if heavy else 0.045)
    return pre + (0.13 if heavy else 0.08) + max(0, n - imp - 1) * (0.06 if heavy else 0.05)


MULT = {"repeat": "n", "barrage": "n", "chain": "n", "lob": "n", "circle": None}


def hits(o, mul=1.0, out=None):
    """기술 안 hit(피해) 목록과 그 반복 배수(대략)"""
    out = [] if out is None else out
    if isinstance(o, dict):
        m = mul * (o.get("n", 1) if o.get("t") in ("repeat", "barrage", "lob") else 1)
        h = o.get("hit")
        if isinstance(h, dict) and "dmg" in h: out.append((h, m * (h.get("n", 1) or 1) * (o.get("n", 1) if o.get("t") == "chain" else 1)))
        for k, v in o.items():
            if k != "hit": hits(v, m, out)
    elif isinstance(o, list):
        for v in o: hits(v, mul, out)
    return out


def rescale(sk, target):
    hs = hits(sk); tot = sum(h["dmg"] * m for h, m in hs)
    if not hs or tot <= 0: return "—"
    k = target / tot
    for h, _ in hs: h["dmg"] = max(1, round(h["dmg"] * k))
    return round(sum(h["dmg"] * m for h, m in hs))


def main():
    cls = {c["key"]: c for c in json.loads((ROOT / "docs" / "밸런스_분류.json").read_text())}
    rows = []
    for p in sorted(CH.glob("*.json"), key=lambda p: [int(x) for x in re.findall(r"\d+", p.stem.split("_")[0])]):
        d = json.loads(p.read_text()); key = d["key"]
        if key.startswith("9."): continue
        if key.startswith("6."):
            nm = key.split("_", 1)[1]; t = next(x for x in NPC if nm.startswith(x[0]))
            role, gun, speed, mul, hp = t[1], t[2], t[3], t[4], t[5]
        elif key in cls:
            c = cls[key]; role, gun, speed, mul, hp = c["role"], c["gun"], c["speed"], 1.0, 100
        else: continue
        dps = DPS[role] * mul; hitf = d.get("hit", {})
        atk = {}
        for r, f in ROW.items():
            n = frames(key, r) or 0
            if not n: continue
            imp = int(hitf.get(r, max(1, n // 2)))
            atk[r] = max(3, round(dps * dur(n, imp, r == "12") * f * SPEED[speed]))
        bal = {"role": role, "speed": speed, "gun": gun, "atk": atk, "cd": {}}
        g = dict(GUN.get(gun, {}))
        if role == "ranged" and "shotDmg" in g: g["shotDmg"] = round(g["shotDmg"] * 1.2)
        if key.startswith("6."): g = {k: (round(v * mul) if k == "shotDmg" else v) for k, v in g.items()}
        if "cd" in g: bal["cd"]["shot"] = g.pop("cd")
        bal.update(g)
        if key == "1.4_에일린": bal["gun"] = "rapid"   # 원래 과열 기믹
        sk = d.get("skills") or {}
        info = {}
        if sk.get("skill"):
            bal["cd"]["skill"] = CD[role]; info["skill"] = rescale(sk["skill"], dps * CD[role] * 0.5)
        if sk.get("skill2"):
            bal["cd"]["skill2"] = CD[role] + 4; info["skill2"] = rescale(sk["skill2"], dps * (CD[role] + 4) * 0.5)
        if sk.get("charge"):
            # 충전기는 쿨타임 없음(사용자 2026-10-26: 모으는 시간이 곧 대가)
            lv = sk["charge"].get("lv", {})
            for k, f in (("0", 1.2), ("1", 2.0), ("2", 3.2)):
                if k in lv: info[f"charge{k}"] = rescale(lv[k], dps * f)
        if sk.get("super"): info["super"] = rescale(sk["super"], SUPER[role] * (mul if key.startswith("6.") else 1))
        if key.startswith("6."): bal["hp"] = hp
        d["bal"] = bal; p.write_text(json.dumps(d, ensure_ascii=False, indent=1))
        rows.append((key, role, speed, gun, atk, bal, info))
    # 표
    L = ["# 밸런스 표 (balance.py 가 씀, 2026-10-25)", "", "| 인물 | 역할 | 손 | 원거리 | 약1/약2/약3 | 강 | 돌진 | 점프 | 원거리 한 발 | 원거리 제한 | 기술(쿨) | 충전 0/1/2 (쿨) | 필살기 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
    for key, role, speed, gun, atk, bal, info in rows:
        lim = "누른 채 연사 · 과열(한 발 +%d)" % bal["heatPer"] if bal.get("heatPer") else ("한 발씩 · 쿨 %.2g초" % bal["cd"]["shot"] if bal["cd"].get("shot") else "—")
        ch = "/".join(str(info.get(f"charge{k}", "—")) for k in "012")
        L.append(f"| {key} | {role} | {speed} | {gun} | {atk.get('9','—')}/{atk.get('10','—')}/{atk.get('11','—')} | {atk.get('12','—')} | {atk.get('13','—')} | {atk.get('14','—')} | {bal.get('shotDmg','—')} | {lim} | {info.get('skill','—')} ({bal['cd'].get('skill','—')}초) | {ch} ({bal['cd'].get('charge','—')}초) | {info.get('super','—')} |" + ("" if not key.startswith("6.") else f" HP {bal['hp']}"))
    (ROOT / "docs" / "밸런스_표.md").write_text("\n".join(L) + "\n")
    print(len(rows), "명")


if __name__ == "__main__":
    main()
