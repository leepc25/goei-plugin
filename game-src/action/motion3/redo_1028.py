"""10-28 사용자 지적 줄 다시 뽑기용 표 고치기(영문 프롬프트 칸만 바꿈, 메모에 「10-28 다시」).
사용: python3 redo_1028.py <키> <줄> <종류>   종류 = type | clip | 39 | 16 | 85"""
import re, sys
from pathlib import Path
DOCS = Path(__file__).resolve().parents[3] / "docs/동작표_3판"
TYPE_A = re.compile(r"Lift both hands forward to waist height and type on an unseen keyboard")
TYPE_B = re.compile(r"lift both forearms forward to an unseen keyboard at waist height and type")
NEW_A = ("Raise both forearms forward until they are level at the height of the lower chest, the elbows bent at a right angle close beside the ribs "
         "and both hands held high above the lap, as if over a desk at elbow height, and type on an unseen keyboard there")
NEW_B = ("lift both forearms forward until they are level at the height of the lower chest, the elbows bent at a right angle and showing out to the sides, "
         "the hands high above the lap as if over a desk at elbow height, and type")
CLIP = ("work with the hands at lower-chest height in front of the body; any papers, sheet, form, ledger, notebook or chart rest on a clipboard "
        "held firmly in the left hand at lower-chest height and tilted up toward the face, never floating in the air and never turned toward the viewer:")


def fix(key, row, kind):
    p = DOCS / f"{key}.md"; t = p.read_text(encoding="utf-8"); out = []; done = False
    for line in t.splitlines(keepends=True):
        if line.startswith(f"| {row} |") and not done:
            c = line.split(" | ")
            en, *ko = c[6].split("<br>")
            old = en
            if kind == "type":
                en = TYPE_A.sub(NEW_A, en); en = TYPE_B.sub(NEW_B, en)
            elif kind == "clip":
                en = re.sub(r"work with the hands at waist height in front of the body:", CLIP, en)
            elif kind == "39":
                en = en.rstrip() + " Keep facing south-west the whole time; the body never turns toward the south-east or toward the viewer, and the last frames face exactly the same way as the first."
            elif kind == "16":
                en = ("Keeping the low drawing stance side-on facing east with the right hand on the hilt, spring backward in a quick low hop: "
                      "push off the front foot, both feet leave the floor, the upper body leans back and the coat tails flick forward, travel far to the west, "
                      "then land on the rear foot and the front foot with the knees bending deeply and settle into the same drawing stance.")
            elif kind == "85":
                en = ("Standing facing the viewer, grip a large wrench firmly in both hands at waist height in front of the body and turn a bolt on an unseen machine "
                      "in short strong pulls: the shoulders, elbows and the whole upper body pull with each turn and the wrench never leaves the hands. "
                      "Keep the body facing straight toward the viewer. The last frame matches the first. Move with heavy, solid, upright movements of a huge frame. "
                      "Draw only the character and the wrench held in the hands; no chair, desk, table, bed, wall, other furniture or background.")
            if en == old: print("안 바뀜", key, row, kind); return False
            c[6] = "<br>".join([en] + ko)
            if len(c) > 8: c[8] = (c[8].rstrip(" |\n") + " · 10-28 다시(" + kind + ")")
            line = " | ".join(c)
            if not line.endswith("\n"): line += "\n"
            if not line.rstrip().endswith("|"): line = line.rstrip("\n") + " |\n"
            done = True
        out.append(line)
    p.write_text("".join(out), encoding="utf-8"); return done


if __name__ == "__main__":
    print(fix(*sys.argv[1:4]))
