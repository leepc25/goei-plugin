"""앉기 3판 다시(2026-10-27 밤, 사용자: 책상 없이 의자만 있는 전제로 전부 다시, 인물마다 힘 뺀 자세).
동작표의 앉기 줄(60·61·62·63·64·65·66·67·68·69·70·71·72·73·96·97·98·99·105·106)을 새 문장으로 바꾼다.
3명 시험(에일린·로제몬·김조학)은 이미 뽑은 60·62·65·66·73·96·97·98(+64/99 제외)은 그대로 두고 나머지만 바꾼다.
사용: python3 sit_rewrite.py [--dry]   바꾼 줄 목록은 sit_rewrite.json"""
import re, sys, json
from pathlib import Path
import m3
DOCS = m3.DOCS
TEST = {"1.4_에일린": {"60", "62", "65", "66", "73", "96", "97", "98", "99"},
        "1.11_로제몬": {"60", "62", "64", "65", "66", "73", "96", "97", "98", "99"},
        "2.5_김조학": {"60", "62", "64", "65", "66", "73", "96", "97", "98"}}   # 이미 뽑아 그대로 쓸 줄(에일린 64, 김조학 99는 다시)
TAIL = "Draw only the character{x}; no chair, desk, table, bed, wall, other furniture or background."
FIX = {"1.4_에일린": "sitting upright with the back straight, knees together and both hands resting on the knees",   # 3명 시험에서 정한 자세
       "1.11_로제몬": "sitting with the legs crossed at the knee and both hands resting on the top knee, the back relaxed",
       "2.5_김조학": "leaning back a little with the knees apart and both arms folded across the chest"}
def posture(sub, sty):
    s, t = sub.lower(), sty.lower()
    skirt = bool(re.search(r"skirt|\bdress\b(?! shoes)|habit|gown", s))
    if re.search(r"elegant|graceful|refined|sultry|seductive|languid|aristocratic|haughty", t): return "sitting with the legs crossed at the knee and both hands resting on the top knee, the back relaxed"
    if re.search(r"lazy|sleepy|bored|slouch|tired|weary|drowsy|sluggish|listless", t): return "slouching back in the seat, " + ("knees together" if skirt else "knees apart") + ", both hands resting loosely on the thighs"
    if re.search(r"menacing|intimidat|tough|brutal|thug|arrogant|cocky|swagger|cold|stern|domineering", t) and not skirt: return "leaning back a little with the knees apart and both arms folded across the chest"
    if re.search(r"stiff|disciplined|military|precise|rigid|formal|polite|neat|crisp|strict|dutiful", t): return "sitting upright with the knees together and both hands resting flat on the knees"
    return "sitting relaxed with the back loose, " + ("knees together, both hands resting on the lap" if skirt else "knees a little apart, both hands resting on the thighs")
def build(key, T, rows):
    p60 = rows.get("60", {}).get("prompt", "") or next(iter(rows.values()))["prompt"]
    m = re.search(r"(Move with[^.]*\.)", p60); STY = (m[1] + " ") if m else ""
    P = FIX.get(key) or posture(T["subject"], STY); Pc = P[0].upper() + P[1:]
    sd = rows.get("96", {}).get("dir", "E"); SD = "east" if sd == "E" else "west"
    KEEP = "the hips, legs and feet keep this exact sitting pose in every frame"
    HOLD = "Seated: the hips, thighs, lower legs and feet stay exactly as in the first frame in every frame, and the waist line never moves. Only the head, shoulders, arms and hands move."
    S_POSE = f"sitting on an unseen chair facing the viewer, {P}"
    N_POSE = "sitting with the back to the viewer (facing north) on an unseen seat, shoulders loose, arms hanging down along the sides with the hands on the thighs"
    E_POSE = f"sitting on an unseen chair side-on facing {SD}, thighs level, knees bent at a right angle, lower legs vertical, {P}"
    FS, FN, FE = "Keep the body facing straight toward the viewer.", "Keep the back to the viewer.", f"Keep the body side-on facing {SD}."
    BACK = "Return the hands to the sitting pose at the end."
    R = {
     "60": (None, f"Start standing facing the viewer. Bend the knees and lower the hips onto an unseen chair at knee height and settle into this sitting pose: {P}. The last two frames are identical: seated and relaxed. {FS} {STY}" + TAIL.format(x="")),
     "62": (S_POSE, f"{Pc}; {KEEP}. Chat: the mouth moves, nod twice slowly and tilt the head once, and one hand makes a small gesture at chest height. {BACK} {FS} The last frame matches the first. {STY}" + TAIL.format(x="")),
     "63": (S_POSE, f"{Pc}; {KEEP}. Lift both hands forward to waist height and type on an unseen keyboard, the fingers tapping steadily and the head lowered a little. {FS} {STY}" + TAIL.format(x="")),
     "64": (S_POSE, f"{Pc}; {KEEP}. Lift a rice ball held in one hand to the mouth and take two bites, chewing, then lower it to the lap. {BACK} {FS} The last frame matches the first. {STY}" + TAIL.format(x=" and the rice ball")),
     "65": (S_POSE, f"{Pc}; {KEEP}. Lift one paper cup with one hand to the mouth, take one sip and lower the cup to the lap. {BACK} {FS} The last frame matches the first. {STY}" + TAIL.format(x=" and the paper cup")),
     "66": (S_POSE, f"{Pc}; {KEEP}. Doze: the head sinks very slowly forward a little at a time and the shoulders loosen until the chin is near the chest; in the last frames the head lifts back only slightly with a small start. Small slow movements only. {FS} {STY}" + TAIL.format(x="")),
     "68": (S_POSE, f"{Pc}; {KEEP}. Lift the head to look forward and nod twice, then lower the head a little again. {FS} The last frame matches the first. {STY}" + TAIL.format(x="")),
     "73": (S_POSE, f"Starting from this sitting pose ({P}), slide the hips forward on the seat and slump deeply: the back rounds as if against an unseen backrest, the head tips back, both arms drop and hang limp beside the seat, and the legs stretch out forward. End slumped and still. {FS} {STY}" + TAIL.format(x="")),
     "61": (None, f"Start standing with the back to the viewer (facing north). Bend the knees and lower the hips straight down onto an unseen seat at knee height. Settle relaxed: the back upright or slightly relaxed, the shoulders loose, the arms hanging down along the sides with the hands resting on the thighs. The last two frames are identical: seated with the back to the viewer. The body stays facing away from the viewer in every frame: never turn around, the face is never visible. {FN} {STY}" + TAIL.format(x="")),
     "69": (N_POSE, f"Seated with the back to the viewer, lift both forearms forward to an unseen keyboard at waist height and type: the shoulders and elbows move alternately in small motions, the head bowed a little. {HOLD} {FN} {STY}" + TAIL.format(x="")),
     "96": (None, f"Start standing side-on facing {SD}. Bend the knees and lower the hips straight down onto an unseen chair at knee height: the thighs end level, the knees bent at a right angle, the lower legs vertical and the feet flat. Settle into this sitting pose: {P}. The last two frames are identical: seated. {FE} {STY}" + TAIL.format(x="")),
     "97": (E_POSE, f"{Pc}; {KEEP}. Chat: the mouth moves, nod twice slowly and tilt the head once, and one hand makes a small gesture at chest height. {BACK} {FE} The last frame matches the first. {STY}" + TAIL.format(x="")),
     "98": (E_POSE, f"{Pc}; {KEEP}. Lift a rice ball held in one hand to the mouth and take two bites, chewing, then lower it to the lap. {BACK} {FE} The last frame matches the first. {STY}" + TAIL.format(x=" and the rice ball")),
     "99": (E_POSE, f"{Pc}; {KEEP}. Free only one hand, lift one paper cup with that hand to the mouth, take one sip and lower it to the lap; there is only one cup. {BACK} {FE} The last frame matches the first. {STY}" + TAIL.format(x=" and the one paper cup")),
     "105": (E_POSE, f"{Pc}; {KEEP}. Lift both hands forward to waist height and type on an unseen keyboard, the fingers tapping and the head bowed a little toward the hands. {FE} {STY}" + TAIL.format(x="")),
    }
    POSE_ONLY = {"67": S_POSE, "106": S_POSE, "70": N_POSE, "71": N_POSE, "72": N_POSE}   # 문장은 그대로, 시작 자세만
    return R, POSE_ONLY, P
def main(dry):
    out = {}
    for key in m3.order():
        f = DOCS / f"{key}.md"
        if not f.exists(): continue
        T = m3.table(key); rows = T["rows"]
        if "60" not in rows and "96" not in rows: continue
        R, PO, P = build(key, T, rows)
        keep = TEST.get(key, set())
        text = f.read_text(); lines = text.splitlines(); changed = []
        for i, line in enumerate(lines):
            c = [x.strip() for x in line.strip().strip("|").split(" | ")]
            if len(c) < 8 or c[0] not in rows or c[0] in keep: continue
            n = c[0]
            if n in R:
                pose, pr = R[n]
                if pose: c[5] = pose
                c[6] = pr
            elif n in PO: c[5] = PO[n]
            else: continue
            if len(c[5]) > 300: c[5] = c[5][:297]
            if len(c) > 8: c[8] = (c[8] + " · " if c[8] else "") + "앉기 3판 다시(10-27 밤)"
            lines[i] = "| " + " | ".join(c) + " |"; changed.append(n)
        if changed and not dry: f.write_text("\n".join(lines) + ("\n" if text.endswith("\n") else ""))
        out[key] = {"rows": changed, "posture": P}
    json.dump(out, open(Path(__file__).parent / "sit_rewrite.json", "w"), ensure_ascii=False, indent=1)
    print(len(out), "명", sum(len(v["rows"]) for v in out.values()), "줄")
main("--dry" in sys.argv)
