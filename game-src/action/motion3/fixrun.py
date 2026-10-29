"""전수 검사에서 걸린 줄 고쳐 뽑기 준비(2026-10-26 사용자: 원활한 자세로 바꿔서 픽셀랩에 지침 받고 프롬프트 보완한 다음 뽑아).
1) fix_list.json(refine.py 결과)의 걸린 까닭마다 자세·조건을 무리 없게 고친 짧은 동작 설명을 만든다.
2) enhance.py 로 PixelLab 지침(PixMiniMax용 동작 설명)을 받는다(줄당 약 0.05회).
3) 표 프롬프트 = 조건 문장 + PixelLab 설명, 메모에 까닭. 점프가 안 뜨는 줄은 끝 장 고정을 푼다.
사용: python3 fixrun.py prep → fix_actions.json / python3 fixrun.py apply → 표 고침 + 큐 넣기"""
import json, re, subprocess, sys
from pathlib import Path
import m3

BASE = Path(__file__).resolve().parent; DOCS = m3.DOCS
SIDE = {"E": "east (right)", "W": "west (left)", "SE": "south-east", "SW": "south-west", "S": "south"}


def cond(why, r):
    d = SIDE.get(r["dir"], r["dir"]); c = []; no_end = False
    w = " ".join(why)
    if "몸이 커짐" in w or "떨어진 큰 덩어리" in w or "색이 바뀜" in w:
        c.append("Draw only the character's own body and the weapon it already holds: no motion blur, no slash trails, no smears, no flashes or effects. Keep the exact same outfit, colors, body size and proportions in every frame.")
    if "뒤로 뻗음" in w:
        c.append(f"The body stays side-on facing {d} the whole time and never turns around. Keep the backswing short; the strike travels forward toward {d} only, never behind the body.")
    if "점프인데" in w:
        c.append("A real jump: both feet clearly leave the floor and rise high, about half the body height of air under the soles at the top, then land."); no_end = True
    if "캔버스 끝 잘림" in w:
        c.append("Perform the motion in place near the center of the frame: the whole body and weapon stay fully inside the frame, never cut off at the edges.")
    if "멈춤" in w:
        c.append("The motion must be clearly visible from frame to frame, with the whole body moving.")
    if "반복 이음" in w:
        c.append("This is a seamless loop: the last frame returns to exactly the same pose and position as the first frame.")
    if "시작·끝 장 발이 뜸" in w or "바닥 아래" in w:
        c.append("Both feet stay on the same floor line at the start and at the end.")
    return " ".join(c), no_end


def prep():
    L = json.loads((BASE / "fix_list.json").read_text()); items = []
    for o in L:
        T = m3.table(o["key"]); r = T["rows"].get(o["row"])
        if not r: continue
        if o.get("cond"):   # 사람이 정한 자세 바꾸기(동작 설명까지 새로)
            c, no_end = o["cond"], o.get("no_end", False)
            items.append(dict(key=o["key"], row=o["row"], why=o["why"], cond=c, no_end=no_end, end_same=o.get("end_same", False),
                              v3=o.get("v3", False), action=(c + " " + o.get("action", r["prompt"]))[:500])); continue
        c, no_end = cond(o["why"], r)
        if not c: continue
        items.append(dict(key=o["key"], row=o["row"], why=o["why"], cond=c, no_end=no_end,
                          action=(c + " " + r["prompt"])[:500]))
    (BASE / "fix_actions.json").write_text(json.dumps(items, ensure_ascii=False, indent=1)); print(len(items))


def apply():
    items = json.loads((BASE / "fix_actions.json").read_text()); enh = json.loads((BASE / "enhance.json").read_text())
    by = {}
    for it in items:
        e = enh.get(f"{it['key']}/{it['row']}")
        if not e: continue
        by.setdefault(it["key"], []).append((it, e))
    for key, lst in by.items():
        p = DOCS / f"{key}.md"; t = p.read_text().split("\n")
        for it, e in lst:
            for i, line in enumerate(t):
                c = line.split(" | ")
                if line.startswith(f"| {it['row']} | ") and len(c) >= 9:
                    ko = c[6].split("<br>", 1)[1] if "<br>" in c[6] else ""
                    c[6] = (it["cond"] + " " + e.strip()).replace("|", "/") + ("<br>" + ko if ko else "")
                    if it["no_end"] and "→" in c[4]:
                        a = c[4].split("→")[0].strip(); c[4] = f"{a} → (끝 장 없음)"
                    if it.get("end_same") and "→" in c[4]:
                        a = c[4].split("→")[0].strip(); c[4] = f"{a} → {a}"
                    if it.get("v3") and "엔진 v3" not in c[-1]: c[-1] = c[-1].rstrip(" |") + " · 엔진 v3 |"
                    c[-1] = c[-1].rstrip(" |") + f" · 기계 검사({'; '.join(it['why'])[:80]}) → 픽셀랩 지침으로 고침(2026-10-26) |"
                    t[i] = " | ".join(c); break
        p.write_text("\n".join(t))
        rows = [it["row"] for it, _ in lst]
        st = m3.state(key); st["ok"] = [x for x in st["ok"] if x not in {m3.folder(r) for r in rows}]; m3.save_state(key, st)
        subprocess.run([sys.executable, str(BASE / "m3.py"), "enq", key, *rows])


if __name__ == "__main__":
    {"prep": prep, "apply": apply}[sys.argv[1]]()
