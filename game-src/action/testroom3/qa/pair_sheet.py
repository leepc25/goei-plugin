"""두 장 나란히 비교 시트: python3 qa/pair_sheet.py out.png "키:줄A:장A:줄B:장B" ...  (장은 1부터, -1 = 끝 장). 설정의 mirror 적용."""
import sys, json
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / "qa"))
out, specs = sys.argv[1], sys.argv[2:]; sys.argv = sys.argv[:1]
import build, fit_chair as fc
from PIL import Image, ImageDraw
def frame(cfg, lid, i):
    an = cfg["anims"].get(lid)
    if not an: return None
    fs = sorted((build.src_dir(cfg, an) / an["folder"]).glob("[0-9][0-9].png"))
    if not fs: return None
    im = Image.open(fs[i if i >= 0 else len(fs) + i]).convert("RGBA")
    return im.transpose(Image.FLIP_LEFT_RIGHT) if an.get("mirror") else im
cells = []
for sp in specs:
    key, la, ia, lb, ib = sp.split(":"); cfg, _ = fc.load(key)
    a, b = frame(cfg, la, int(ia) - 1 if int(ia) > 0 else int(ia)), frame(cfg, lb, int(ib) - 1 if int(ib) > 0 else int(ib))
    T = Image.new("RGB", (520, 280), (70, 70, 74)); d = ImageDraw.Draw(T)
    for im, x in ((a, 0), (b, 260)):
        if im is not None: im2 = im.resize((256, 256), Image.NEAREST) if im.size != (256, 256) else im; T.paste(im2, (x, 18), im2)
    d.text((4, 3), f"{key} {la}[{ia}] | {lb}[{ib}]", fill=(255, 255, 255)); cells.append(T)
cols = 3; rows = (len(cells) + cols - 1) // cols
S = Image.new("RGB", (520 * cols, 280 * rows), (30, 30, 30))
for i, c in enumerate(cells): S.paste(c, ((i % cols) * 520, (i // cols) * 280))
S.save(out); print(out, len(cells))
