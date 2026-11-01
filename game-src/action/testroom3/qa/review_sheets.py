"""review_all.cjs 가 찍은 장들을 동작별 모음 쪽으로: 한 쪽 = 한 동작 × 인물 N명(세로), 가로는 시간 순 장.
  python3 qa/review_sheets.py <찍은 폴더> <출력 폴더> [한 쪽 인물 수=12] [축소=0.5]
출력: <출력>/<동작>_<쪽>.png 와 index.html(동작별 묶음, 인물 이름 표시)."""
import sys, json, base64, io, re, html
from pathlib import Path
from PIL import Image, ImageDraw
SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2]); PER = int(sys.argv[3]) if len(sys.argv) > 3 else 12; SC = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
OUT.mkdir(parents=True, exist_ok=True)
def key_order(s): return [int(x) for x in re.findall(r"\d+", s.split("_")[0])]
chars = sorted([d.name for d in SRC.iterdir() if d.is_dir()], key=key_order)
acts = []
for c in chars:
    for f in (SRC / c).glob("*.png.frames.json"):
        a = f.name.replace(".png.frames.json", "")
        if a not in acts: acts.append(a)
ORDER = ['대기', '걷기', '뛰기', '약공3연', '강공', '돌진공격', '점프', '점프공격', '원거리', '충전0', '충전1', '충전2', '기술', '기술2', '필살기', '방어', '회피', '웅크려기기', '뒷걸음', '도망',
         '맞기', '밀려나기', '띄워지기', '쓰러져눕기', '일어나기', '스턴', '사망서서', '사망누워', '정면앉기', '옆앉기', '후면앉기', '기대쉬기', '앉은채강타', '눕기쉬기', '샤워']
acts.sort(key=lambda a: ORDER.index(a) if a in ORDER else 99)
pages = {}
for a in acts:
    rows = []
    for c in chars:
        f = SRC / c / f"{a}.png.frames.json"
        if not f.exists(): continue
        frames = [Image.open(io.BytesIO(base64.b64decode(s))).convert("RGB") for s in json.loads(f.read_text())]
        rows.append((c, frames))
    if not rows: continue
    fw, fh = rows[0][1][0].size; fw, fh = int(fw * SC), int(fh * SC); n = max(len(r[1]) for r in rows)
    for pi in range(0, len(rows), PER):
        chunk = rows[pi:pi + PER]; W = fw * n + 150; H = fh * len(chunk)
        S = Image.new("RGB", (W, H), (28, 28, 28)); d = ImageDraw.Draw(S)
        for ri, (c, frames) in enumerate(chunk):
            y = ri * fh; d.rectangle([0, y, 150, y + fh], fill=(40, 40, 40)); d.text((4, y + 4), c, fill=(255, 255, 255))
            for fi, im in enumerate(frames): S.paste(im.resize((fw, fh), Image.NEAREST), (150 + fi * fw, y))
            d.line([(0, y + fh - 1), (W, y + fh - 1)], fill=(70, 70, 70))
        name = f"{a}_{pi // PER + 1:02d}.png"; S.save(OUT / name, optimize=True); pages.setdefault(a, []).append((name, [c for c, _ in chunk]))
        print(name, S.size, flush=True)
doc = ["<!doctype html><meta charset=utf-8><title>동작별 전수 검수</title><style>body{background:#1c1c1c;color:#ddd;font:14px sans-serif;margin:0 16px}img{max-width:100%;image-rendering:pixelated;display:block;margin:6px 0 18px}h2{margin:28px 0 4px;position:sticky;top:0;background:#1c1c1c;padding:6px 0}nav a{margin-right:10px;color:#9cf}</style>",
       "<h1>동작별 전수 검수 (테스트룸 실제 화면, 시간 순)</h1><nav>" + " ".join(f'<a href="#{html.escape(a)}">{html.escape(a)}</a>' for a in pages) + "</nav>"]
for a, ps in pages.items():
    doc.append(f'<h2 id="{html.escape(a)}">{html.escape(a)}</h2>')
    for name, cs in ps: doc.append(f'<div>{html.escape(cs[0])} ~ {html.escape(cs[-1])}</div><img loading="lazy" src="{name}">')
(OUT / "index.html").write_text("\n".join(doc), encoding="utf-8"); print("쪽", sum(len(v) for v in pages.values()))
