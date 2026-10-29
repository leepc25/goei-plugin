"""motion_v3 결과 보기 화면(에일린_동작_2판.html)을 만든다. 그림은 base64로 넣어 한 파일로."""
import base64, re
from pathlib import Path
OUT = Path(__file__).resolve().parent
DOC = OUT.parents[3] / "docs/동작표/1.4_에일린.md"
names = {}
for line in DOC.read_text().splitlines():
    c = [x.strip() for x in line.strip().strip("|").split(" | ")]
    if len(c) >= 8 and re.fullmatch(r"\d+(-\d+)?|W", c[0]): names[c[0]] = (c[1], c[3], c[4])
cards = []
for n, (name, fr, span) in names.items():
    d = OUT / n.replace("-", "_")
    fs = sorted(d.glob("[0-9][0-9].png")) if d.exists() else []
    if not fs:
        cards.append(f'<div class="c none"><b>{n} {name}</b><div class="m">아직 안 뽑음</div></div>'); continue
    srcs = [ "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode() for f in fs]
    strip = "".join(f'<img src="{s}" title="{i}">' for i, s in enumerate(srcs))
    js = ",".join(f'"{s}"' for s in srcs)
    cards.append(f'<div class="c"><b>{n} {name}</b> <span class="m">{len(fs)}장 · {span}</span>'
                 f'<div class="row"><img class="play" data-f=\'[{js}]\'><div class="strip">{strip}</div></div></div>')
html = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>에일린 동작 2판</title><style>
:root{{--bg:#f4f4f2;--fg:#222;--card:#fff;--line:#ddd}}
@media (prefers-color-scheme:dark){{:root{{--bg:#1c1c1c;--fg:#eee;--card:#2a2a2a;--line:#444}}}}
body{{background:var(--bg);color:var(--fg);font-family:sans-serif;margin:0;padding:16px}}
.c{{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:12px}}
.none{{opacity:.5}} .m{{font-size:12px;opacity:.7}}
.row{{display:flex;gap:12px;align-items:flex-end;overflow-x:auto}}
img{{image-rendering:pixelated;background:repeating-conic-gradient(#0001 0 25%,#0000 0 50%) 0 0/16px 16px}}
.play{{width:128px;height:256px;flex:none}} .strip img{{width:64px;height:128px}}
</style><body><h1>에일린 동작 2판 · 검수 전</h1><p class="m">새 프롬프트(2026-10-24). 판정은 사용자가 함. 왼쪽 = 재생(초당 8장), 오른쪽 = 장마다.</p>
{''.join(cards)}
<script>document.querySelectorAll('.play').forEach(el=>{{const f=JSON.parse(el.dataset.f);let i=0;el.src=f[0];setInterval(()=>{{i=(i+1)%f.length;el.src=f[i]}},125)}})</script></body></html>"""
(OUT / "에일린_동작_2판.html").write_text(html)
print("ok")
