"""audit.json 걸린 줄을 더 엄격하게 다시 봄 → 진짜 다시 뽑을 후보만(fix_list.json)"""
import json, re
from pathlib import Path
import numpy as np
from PIL import Image
import m3
BASE = Path(__file__).resolve().parent
a = json.load(open(BASE / "audit.json"))["motion"]
def frames(k, r):
    return [np.array(Image.open(p).convert("RGBA")) for p in sorted((BASE / k / m3.folder(r)).glob("[0-9][0-9].png"))]
def sdiff(x, y):
    best = 1e9; A = x[:, :, 3] > 40
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            ys = np.roll(np.roll(y, dy, 0), dx, 1)
            d = ((np.abs(ys.astype(int) - x.astype(int))[:, :, :3].sum(2) > 80) | ((ys[:, :, 3] > 40) != A)).sum()
            best = min(best, d)
    return best / max(1, A.sum())
out = []
for k, rows in a.items():
    for r, es in rows.items():
        keep = []
        for e in es:
            n = [int(x) for x in re.findall(r"\d+", e)]
            if e.startswith("그림 없음") or e.startswith("표 못"): continue
            if e.startswith(("발이 바닥 아래로", "바닥 아래로 꺼짐")):
                if n[0] > 8: keep.append(e)
            elif e.startswith("캔버스 끝 잘림"):
                fr = frames(k, r); c = 0
                for f in fr:
                    al = f[:, :, 3] > 40; c += int(al[0].sum() + al[:, 0].sum() + al[:, -1].sum() >= 15)
                if c >= 1: keep.append(f"캔버스 끝 잘림 {c}장(15px 이상)")
            elif e.startswith("뒤로 뻗음"):
                if n[0] < 8 and n[1] > 20: keep.append(e)
            elif e.startswith("반복 이음"):
                fr = frames(k, r); d = sdiff(fr[0], fr[-1])
                if d > 0.35: keep.append(f"반복 이음 끊김(위치 맞춰도 {d:.0%})")
            else: keep.append(e)
        if keep: out.append(dict(key=k, row=r, why=keep))
json.dump(out, open(BASE / "fix_list.json", "w"), ensure_ascii=False, indent=1)
import collections
c = collections.Counter(re.sub(r"[\d(].*", "", w).strip() for o in out for w in o["why"])
print(len(out), c)
