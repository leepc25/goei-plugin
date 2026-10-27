"""앉은 채 맞고 굴러떨어지기(옆) 169번 줄 추가(2026-10-27 밤, 사용자: 보류한 것 전부 진행). 96번 끝 장 → 19번 끝 장(누운 자세)."""
import re, json, m3
added = []
for key in m3.order():
    f = m3.DOCS / f"{key}.md"
    if not f.exists(): continue
    T = m3.table(key); R = T["rows"]
    if "96" not in R or "19" not in R or "169" in R: continue
    sd = "east" if R["96"]["dir"] == "E" else "west"
    m = re.search(r"(Move with[^.]*\.)", R.get("60", R["96"])["prompt"]); sty = (m[1] + " ") if m else ""
    pose = R.get("97", R["96"])["pose"][:300]
    pr = (f"Seated side-on facing {sd} on an unseen chair, gets hit hard from the front: the upper body snaps back, the arms fly up, "
          f"the feet lift and the body tips backward off the seat, falls to the floor and lands flat on the back. End lying on the back on the floor. "
          f"Keep the body side-on facing {sd}. {sty}Draw only the character; no chair, desk, table, bed, wall, other furniture or background.")
    lines = f.read_text().splitlines(); idx = None
    for i, l in enumerate(lines):
        if l.startswith("| 99 |") or l.startswith("| 98 |") or l.startswith("| 97 |") or l.startswith("| 96 |"): idx = i
    ncol = len([x for x in lines[idx].strip().strip("|").split(" | ")])
    c = ["169", "앉은 채 맞고 굴러떨어지기 (옆)", R["96"]["dir"], "8", "96번 끝 장 → 19번 끝 장", pose, pr] + [""] * (ncol - 7)
    if ncol > 8: c[8] = "10-27 밤 추가(사용자: 보류한 것 전부 진행)"
    lines.insert(idx + 1, "| " + " | ".join(c) + " |")
    f.write_text("\n".join(lines) + "\n"); added.append(key)
json.dump(added, open("fall_add.json", "w"), ensure_ascii=False)
print(len(added), "명")
