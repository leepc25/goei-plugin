"""PixelLab 에일린 캐릭터에서 버린 판을 지운다(사용자 지시 2026-10-24).
남기는 것 = 이 폴더의 현재 결과(<번호>/00.png)와 첫 장이 똑같은 「v3 …」 동작. 나머지는 지운다.
사용: python3 cleanup_old.py        (지울 목록만 보여 줌)
      python3 cleanup_old.py --yes  (실제로 지움)"""
import io, json, re, subprocess, sys, urllib.request
import concurrent.futures as cf
from pathlib import Path
from PIL import Image, ImageChops

API = "https://api.pixellab.ai/v2"
CID = "e38c681f-5063-487e-8965-a324815912eb"
OUT = Path(__file__).resolve().parent

def fetch(u):
    data = subprocess.run(["curl", "-sSf", "--retry", "3", u], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(data)).convert("RGBA")

def keep(a):
    m = re.match(r"v3 (\d+(?:-\d+)?|W) ", a.get("display_name", ""))
    if not m: return False
    loc = OUT / m[1].replace("-", "_") / "00.png"
    if not loc.exists(): return False
    im, L = fetch(a["directions"][0]["frames"][0]), Image.open(loc).convert("RGBA")
    return im.size == L.size and ImageChops.difference(im, L).getbbox() is None

anims = json.load(urllib.request.urlopen(f"{API}/characters/{CID}"))["animations"]
with cf.ThreadPoolExecutor(10) as ex: flags = list(ex.map(keep, anims))
dels = [a for a, k in zip(anims, flags) if not k]
print(f"전체 {len(anims)} · 남김 {len(anims) - len(dels)} · 지울 것 {len(dels)}")
if "--yes" not in sys.argv:
    for a in dels: print("  지울 것:", a.get("display_name"))
    sys.exit()
for a in dels:
    req = urllib.request.Request(f"{API}/characters/{CID}/animations/{a['animation_group_id']}", method="DELETE")
    urllib.request.urlopen(req, timeout=60)
print("남은 동작", len(json.load(urllib.request.urlopen(f"{API}/characters/{CID}"))["animations"]))
