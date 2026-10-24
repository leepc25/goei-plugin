"""동작표 프롬프트 전수검사(글만, 생성 없음).
에일린 1차 생성(2026-10-24)에서 실패한 동작들의 공통점을 규칙으로 옮겼다."""
import re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "docs/동작표"

RULES = {
    "단계과다": "장 수에 비해 단계가 많음(장 4개당 2단계 넘음)",
    "돌아오기꼬리": "끝에 「자세로 돌아온다」 꼬리 — 생성기가 자주 빼먹음",
    "미세표정": "눈·입·턱·한숨·끄덕임 같은 픽셀에서 안 보이는 움직임",
    "상태부정": "상태·감정 단어나 부정문(dazed, without, barely, no ~ 등)",
    "소품등장": "등록 그림에 없는 무기·소품이 동작 중에 생김",
    "기술용어": "생성기가 모를 기술 용어",
    "전투자세발없음": "전투 대기/싸움 자세인데 발 위치가 없음",
    "견본한단어": "견본(walking/running) 한 단어뿐",
    "가만히": "거의 안 움직이게 시킴(대기·반응이 정지 그림이 됨)",
    "추상꾸밈": "그림이 안 되는 꾸밈말(efficient, compact, sharp 등)",
}
FACE = r"\b(eyes?|narrow\w*|jaw|mouth|lips?|smil\w*|grin\w*|wink\w*|frown\w*|brows?|sigh\w*|nods?|nodd\w*|glanc\w*|blink\w*|expression\w*|teeth|stare\w*|gaze|squint\w*|corner of the mouth|breath\w*)\b"
STATE = r"\b(dazed|unfocused|without|barely|nothing else|perfectly still|motionless|calm\w*|confident\w*|function\w*|as if|no \w+|not |never|neither|utterly still|lazily|casually|nervous\w*|proud\w*)\b"
STILL = r"\b(barely moves?|holds? still|stays? still|utterly still|perfectly still|nothing else moves|only the \w+ (move|shift|sway)s?)\b"
RETURN = r"\b(returns?|back) (in)?to (the|a|his|her) \w*\s*(stance|pose|guard|position)|settles? (back )?into|into the (compact )?stance|resumes?\b"
TERMS = r"\b(butt|feet-first|charging handle|chambers?|draw-cut|iaido|sheathes?|scabbard|parr\w*|feint\w*|sweep\w*|uppercut|hook punch|jab|haymaker|suplex|clinch|counter\w*)\b"
PROPS = r"\b(rifle|pistol|guns?|sword|katana|blade|knife|dagger|baton|minigun|flamethrower|shotgun|axe|bat|pipe|spear|scimitar|glaive|cigarette|phone|cup|mug|tablet|notebook)\b"
FEET = r"\b(feet|foot|legs? apart|step\w* forward|side-on|sideways|lead (leg|foot)|rear (leg|foot)|wide stance|stagger\w*)\b"
ABSTRACT = r"\b(efficient\w*|economical\w*|compact|sharp\w*|minimal\w*|firm\w*|serious\w*|quick\w*|smooth\w*|elegant\w*|power\w*|precise\w*|controlled|graceful\w*|fluid\w*|crisp\w*|neat\w*|tight\w*|brisk\w*|swift\w*|heav\w*|light\w*|slight\w*|subtle\w*|deliberate\w*|steady|relaxed|tense\w*|explosive\w*|fierce\w*|aggressive\w*|dramatic\w*|elaborate\w*|soft\w*|hard|strong\w*|weak\w*|natural\w*|casual\w*|lazy|lazily|slow\w*|fast)\b"
SEP = r"(,? then |; |\. (?=[A-Z])|, and then |, before |, after which )"

BODY = {"knees", "arms", "hands", "feet", "legs", "eyes", "hips", "shoulders", "elbows", "fists", "lips", "brows", "this", "is", "was", "as", "its", "his", "always"}

def steps(p):
    # 「, 」「 and 」「; 」「. 」로 나눈 조각 중 3인칭 동사로 시작하는 것만 센다
    n = 0
    for seg in re.split(r",\s+|;\s+|\.\s+|\s+and\s+|\s+while\s+", p):
        w = re.sub(r"^(then|and|again)\s+", "", seg.strip(), flags=re.I).split(" ")[0].lower()
        if re.fullmatch(r"[a-z]+(s|es)", w) and w not in BODY:
            n += 1
    return max(n, 1)

def lint_file(f):
    t = f.read_text()
    m = re.search(r"Subject: `([^`]+)`", t)
    subject = m.group(1).lower() if m else ""
    out = []
    for line in t.splitlines():
        c = [x.strip() for x in line.strip().strip("|").split("|")]
        if len(c) < 6 or not re.fullmatch(r"\d+(-\d+)?|W", c[0]):
            continue
        frames = next((int(x) for x in c[2:5] if re.fullmatch(r"\d+", x)), None)
        prompt_cell = next((x for x in c if "<br>" in x or x.startswith("(견본")), "")
        if not prompt_cell or "없음" in c[1]:
            continue
        p = prompt_cell.split("<br>")[0]
        pose = c[c.index(prompt_cell) - 1] if prompt_cell in c else ""
        name = c[1]
        flags = []
        if p.startswith("(견본"):
            flags.append("견본한단어")
        else:
            s = steps(p)
            if frames and s > max(2, frames // 2):
                flags.append(f"단계과다({s}단계/{frames}장)")
            if re.search(RETURN, p, re.I): flags.append("돌아오기꼬리")
            face = set(w.lower() for w in re.findall(FACE, p, re.I))
            # 피격·감정 줄은 표정을 쓴다(사용자 결정 2026-10-24)
            if face and not re.search(r"맞기|쓰러지기|스턴|화내기|놀라기|기뻐하기", name): flags.append("미세표정(" + ",".join(sorted(face)) + ")")
            st = set(w.lower().strip() for w in re.findall(STATE, p, re.I))
            if st: flags.append("상태부정(" + ",".join(sorted(st)) + ")")
            if re.search(STILL, p, re.I): flags.append("가만히")
            ab = set(w.lower() for w in re.findall(ABSTRACT, p, re.I))
            if ab: flags.append("추상꾸밈(" + ",".join(sorted(ab)) + ")")
            props = set(w.lower() for w in re.findall(PROPS, p, re.I)) - set(re.findall(PROPS, subject, re.I))
            if props and not ("무기 자세 장" in line): flags.append("소품등장(" + ",".join(sorted(props)) + ")")
            terms = set(w.lower() for w in re.findall(TERMS, p, re.I))
            if terms: flags.append("기술용어(" + ",".join(sorted(terms)) + ")")
        if ("전투 대기" in name or "stance" in pose.lower()) and c[0] == "3" and not re.search(FEET, pose + " " + p, re.I):
            flags.append("전투자세발없음")
        if flags:
            out.append((c[0], name, frames, flags))
    return out

if __name__ == "__main__":
    files = sorted(ROOT.glob("*.md")) + sorted((ROOT / "NPC").glob("*.md"))
    files = [f for f in files if not f.name.startswith("00_목록")]
    total_rows = 0; total_flag = 0; per_rule = {}
    lines = []
    for f in files:
        res = lint_file(f)
        rows = sum(1 for l in f.read_text().splitlines() if re.match(r"\| (\d+(-\d+)?|W) \|", l) and ("<br>" in l or "(견본" in l))
        total_rows += rows; total_flag += len(res)
        if not rows: continue
        lines.append(f"\n## {f.relative_to(ROOT)} — {len(res)}/{rows}줄 걸림\n")
        for n, name, fr, fl in res:
            lines.append(f"- {n} {name} ({fr}장): " + " · ".join(fl))
            for x in fl:
                k = x.split("(")[0]; per_rule[k] = per_rule.get(k, 0) + 1
    head = [f"# 동작표 프롬프트 전수검사\n", f"검사 줄 {total_rows} · 걸린 줄 {total_flag}\n", "| 규칙 | 뜻 | 줄 수 |", "| --- | --- | --- |"]
    head += [f"| {k} | {RULES[k]} | {per_rule.get(k,0)} |" for k in RULES]
    print("\n".join(head + lines))
