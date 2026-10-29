"""PixelLab 캐릭터에 같은 줄 이름(v3 <줄> …)이 둘 이상 남으면, 로컬 결과(<줄>/00.png)와 첫 장이 같은 판만 남기고 지운다.
사용: python3 game-src/action/motion3/cleanup_dup.py [--yes]"""
import io, json, re, subprocess, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageChops
API = "https://api.pixellab.ai/v2"; B = Path(__file__).resolve().parent; D = B.parents[2] / "docs/동작표_3판"
def fetch(u): return Image.open(io.BytesIO(subprocess.run(["curl", "-sSf", "--retry", "3", u], capture_output=True, check=True).stdout)).convert("RGBA")
for f in sorted(D.glob("[0-9]*.md")):
    if f.name.startswith("00"): continue
    cid = re.search(r"PixelLab id `([^`]+)`", f.read_text())[1]
    ch = json.load(urllib.request.urlopen(f"{API}/characters/{cid}", timeout=60))
    groups = {}
    for a in ch["animations"]:
        m = re.match(r"v3 (\S+) ", a.get("display_name", ""))
        if m: groups.setdefault(m[1], []).append(a)
    for k, al in groups.items():
        if len(al) < 2: continue
        loc = B / f.stem / k / "00.png"
        L = Image.open(loc).convert("RGBA") if loc.exists() else None
        keep = None
        for a in al:
            try: im = fetch(a["directions"][0]["frames"][0])
            except Exception: continue
            if L is not None and im.size == L.size and ImageChops.difference(im, L).getbbox() is None: keep = a; break
        for a in al:
            if a is keep: continue
            print(f.stem, k, "지울 것", a["animation_group_id"], "(남길 판 찾음)" if keep else "(남길 판 못 찾음 → 안 지움)")
            if keep and "--yes" in sys.argv:
                urllib.request.urlopen(urllib.request.Request(f"{API}/characters/{cid}/animations/{a['animation_group_id']}", method="DELETE"), timeout=60)
