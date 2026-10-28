"""밸런스 값 계산·적용(사용자 2026-10-25): 인물 설정 chars/<키>.json 에 bal 을 넣고 기술 피해를 예산에 맞춰 다시 맞춘다.
근거·표: docs/밸런스_설계.md. 분류: docs/밸런스_분류.json(이름 있는 인물), NPC 는 아래 NPC 표.
사용: python3 balance.py   → chars/*.json 고침 + docs/밸런스_표.md 씀"""
import json, re
from pathlib import Path

HERE = Path(__file__).resolve().parent; ROOT = HERE.parents[2]
M3 = HERE.parent / "motion3"; CH = HERE / "chars"

# 역할별 근접 초당 피해(DPS). 샌드백 HP 400 기준: 보통 인물이 약공 연타로 10초 안팎
DPS = {"striker": 46, "bruiser": 42, "tank": 34, "ranged": 32, "support": 30, "control": 34}
SPEED = {"fast": 0.9, "normal": 1.0, "slow": 1.1}   # 10-29: 차이 좁힘(굼뜬 인물 평타가 특출나던 것)          # 같은 길이라도 굼뜬 인물은 한 대가 더 아프게
ROW = {"9": 1.0, "10": 1.0, "11": 1.15, "12": 1.25, "13": 1.1, "14": 1.6}   # 약1·약2·약3(마무리)·강·돌진·점프(4장으로 짧아 높게)
SKILL_CD = 2   # 고유기술 실제 쿨타임(초, 10-28 사용자: 연사만 안 되게 짧게 + 위력 올림)
ATK_BASE = {"9": 15, "10": 16, "11": 19, "12": 26, "13": 20, "14": 22}   # 약1·약2·약3·강·돌진·점프 기준 피해(10-28)
ROLE_MUL = {"striker": 1.0, "bruiser": 1.03, "tank": 1.05, "ranged": 0.88, "support": 0.88, "control": 0.92}   # 10-29: 좁힘
CD = {"striker": 6, "bruiser": 8, "tank": 10, "ranged": 7, "support": 9, "control": 9}   # 고유기술 쿨타임(초)
# 10-29 사용자: 기술 총량은 인물마다 엇비슷하게(역할로 벌리지 않음) · 계층(평타 한 대 15~26 < 0단 < 고유기 < 1단 < 2단 < 필살기) · 필살기는 한 대상 막대(단일형) 또는 광역(광역형)
BUDGET = {"skill": 130, "c0": 75, "c1": 150, "c2": 240}
SUPER_SINGLE, SUPER_AOE = 420, 320   # 샌드백 한 대상 기준: 단일형은 더 세게, 광역형은 화면 전체에 뿌리는 대신 한 대상엔 조금 덜
SUPER = {r: SUPER_AOE for r in ("striker", "bruiser", "ranged", "control", "tank", "support")}
SKILL_SEC = 3.0   # 고유기 피해 = 평타 몇 초분(10-28: 쿨 2초인데 예산이 옛 쿨 6~10초 기준이라 필살기보다 셌음)
CHARGE_F = {"0": 1.2, "1": 2.4, "2": 4.0}   # 충전 단계: 반드시 0 < 1 < 2
GUN = {  # 원거리 기본공격: 약한 단발은 쿨타임 없이, 강한 것·연발은 과열이나 쿨타임
    # 사용자 2026-10-26: 연속으로 계속 나가면 안 됨 → 연사(rapid)만 누른 채 연사 + 과열, 나머지는 한 번 누르면 한 발 + 최소 간격(쿨)
    # 사용자 2026-10-28: 단발은 쿨타임 넣지 말 것 → 단발(single·thrown·heavy·none)은 쿨타임 없이 한 번 누르면 한 발(동작 길이가 곧 간격)
    "single": dict(shotDmg=9), "thrown": dict(shotDmg=7),
    # 사용자 2026-10-29: 연타·강력한 원거리는 과열이나 쿨 필수, 단발인데 쿨 있는 건 쿨 제거 → heavy(30)만 쿨 2.5초, single·thrown·none은 쿨 없음
    "rapid": dict(shotDmg=6, heatPer=9), "heavy": dict(shotDmg=30, cd=2.5), "none": dict(shotDmg=10)}
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


EFF = {}   # 실측 보정: {(키, 기술): 실제로 들어간 피해 / 계산 피해}. qa/dmg 측정 결과(--measured 파일)로 채움


def rescale(sk, target, eff=1.0):
    target = target / max(0.3, min(2.5, eff))   # 실제로 덜(더) 들어가는 기술은 계산 예산을 그만큼 올림(내림)
    hs = hits(sk); tot = sum(h["dmg"] * m for h, m in hs)
    if not hs or tot <= 0: return "—"
    k = target / tot
    for h, _ in hs: h["dmg"] = max(1, round(h["dmg"] * k))
    return round(sum(h["dmg"] * m for h, m in hs))


def load_eff(path):
    """측정 파일 {키: {skill, c0, c1, c2, super: 실제 피해}} 과 지금 설정의 계산 피해로 효율을 구함(측정은 지금 설정으로 한 것이어야 함)"""
    m = json.loads(Path(path).read_text())
    for p in CH.glob("*.json"):
        d = json.loads(p.read_text()); key = d["key"]; sk = d.get("skills") or {}
        if key not in m: continue
        parts = {"skill": sk.get("skill"), "super": sk.get("super"), **{"c" + k: v for k, v in ((sk.get("charge") or {}).get("lv") or {}).items()}}
        for n, o in parts.items():
            if not o or n not in m[key]: continue
            est = sum(h["dmg"] * mm for h, mm in hits(o))
            if est > 0 and m[key][n] > 0: EFF[(key, n)] = m[key][n] / est


def super_type(o):
    """필살기 갈래: 화면 전체·휩쓸기·쏟아짐·넓은 고리 판정이 있으면 광역(aoe), 아니면 단일(single)"""
    acc = []
    def walk(x):
        if isinstance(x, dict):
            t = x.get("t")
            if t in ("screen", "sweep", "rain", "barrage", "wave") or (t in ("v", "firewall") and x.get("at") == "screen" and x.get("hit")) \
               or (t == "circle" and x.get("r", 260) >= 300) or (t == "v" and x.get("hit") and (x.get("w", 0) >= 0.8 or x.get("r", 0) >= 300)):
                acc.append(t)
            for v in x.values(): walk(v)
        elif isinstance(x, list):
            for v in x: walk(v)
    walk(o)
    return "aoe" if acc else "single"


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
        dps = DPS[role] * mul; hitf = d.get("hit", {}); nm = mul if key.startswith("6.") else 1   # NPC 는 피해 배율
        atk = {}
        for r, f in ROW.items():
            n = frames(key, r) or 0
            if not n: continue
            imp = int(hitf.get(r, max(1, n // 2)))
            # 10-28 사용자: 고르고디오 평타가 남들 두 배 → 동작 길이에 비례시키지 않고 줄마다 정한 기준 피해 × 역할·손 빠르기(차이를 좁게)
            atk[r] = max(3, round(ATK_BASE[r] * ROLE_MUL[role] * SPEED[speed] * (mul if key.startswith("6.") else 1)))
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
            # 사용자 2026-10-28: 평타 몇 번 수준 기술에 5~10초 쿨은 아무도 안 씀 → 쿨타임은 라이브 고유기(75틱 = 2.5초)에 가깝게 3초, 피해 예산은 그대로
            bal["cd"]["skill"] = SKILL_CD; info["skill"] = rescale(sk["skill"], BUDGET["skill"] * nm, EFF.get((key, "skill"), 1))
        if sk.get("skill2"):
            bal["cd"]["skill2"] = SKILL_CD + 2; info["skill2"] = rescale(sk["skill2"], BUDGET["skill"] * 1.2 * nm)
        if sk.get("charge"):
            # 충전기는 쿨타임 없음(사용자 2026-10-26: 모으는 시간이 곧 대가)
            lv = sk["charge"].get("lv", {})
            for k, f in CHARGE_F.items():
                if k in lv: info[f"charge{k}"] = rescale(lv[k], BUDGET["c" + k] * nm, EFF.get((key, "c" + k), 1))
        if sk.get("super"): bal["superType"] = super_type(sk["super"]); info["super"] = rescale(sk["super"], (SUPER_AOE if bal["superType"] == "aoe" else SUPER_SINGLE) * nm, EFF.get((key, "super"), 1))
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
    import sys
    if "--measured" in sys.argv: load_eff(sys.argv[sys.argv.index("--measured") + 1])
    main()
