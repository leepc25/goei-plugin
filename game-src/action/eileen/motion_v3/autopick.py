"""사용자 지시(2026-10-24): 고르지 않고 자동으로 정한다.
전투 자세 장 = 3-0 마지막 장, 무기 자세 장 = W 마지막 장, 5번 한 장 = 5에서 폭이 가장 넓은 장(보폭 큰 장),
7번 꼭대기 장 = 7에서 몸 위끝이 가장 높은 장, 7번 하강 장 = 꼭대기 다음다음 장(착지 전)."""
import json, sys
from pathlib import Path
from PIL import Image
OUT = Path(__file__).resolve().parent
P = OUT / "picks.json"
picks = json.loads(P.read_text()) if P.exists() else {}
def fr(n): return [Image.open(f).convert("RGBA") for f in sorted((OUT / n.replace("-", "_")).glob("[0-9][0-9].png"))]
for n in sys.argv[1:]:
    f = fr(n)
    if not f: continue
    if n == "3-0": picks["전투 자세 장"] = ["3-0", len(f) - 1]
    if n == "W": picks["무기 자세 장"] = ["W", len(f) - 1]
    if n == "5":
        w = [im.getbbox()[2] - im.getbbox()[0] for im in f]; picks["5번 한 장"] = ["5", w.index(max(w))]
    if n == "7":
        t = [im.getbbox()[1] for im in f]; i = t.index(min(t))
        picks["7번 꼭대기 장"] = ["7", i]; picks["7번 하강 장"] = ["7", min(i + 2, len(f) - 2)]
P.write_text(json.dumps(picks, ensure_ascii=False, indent=1)); print(picks)
