"""이펙트 3판 확인 페이지(스크립트 없이 움직이는 그림): 이펙트마다 인물 그림과 1배로 합성한 움직이는 WebP를 만들어 한 HTML에 넣는다.
사용: python3 fx3_page.py → docs/이펙트_시험/기술이펙트_3판.html"""
import base64, io, json, re, html
from pathlib import Path
from PIL import Image
import m3

BASE = Path(__file__).resolve().parent; ROOT = BASE.parents[2]; VFX = BASE.parent / "testroom3" / "vfx"
OUT = ROOT / "docs" / "이펙트_시험" / "기술이펙트_3판.html"
DIRS = {f"{a}_{b}": ("W" if "(W)" in d else "E") for a, b, d in re.findall(r"^\| (\d+\.\d+) \| (\S+) \| ([^|]+) \|", (ROOT / "docs/동작표_3판/00_목록.md").read_text(), re.M)}
W, H, GY, FX0 = 640, 360, 340, 110
BG = (95, 110, 96, 255)


def sprite(key, cache={}):
    if key not in cache:
        row, fr = m3.state(key)["picks"]["전투 자세 장"]
        sp = Image.open(BASE / key / row / f"{fr - 1:02d}.png").convert("RGBA")
        if DIRS.get(key) == "W": sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        cache[key] = sp.crop(sp.getbbox())
    return cache[key]


def anim(it, nochar):
    n = it["name"]; m = json.loads((VFX / f"{n}.json").read_text()); sh = Image.open(VFX / f"{n}.png").convert("RGBA")
    sp = sprite(it["key"]); a = m["meta"]["anchor"]
    frs = [f["frame"] for f in m["frames"]]; b = m["meta"].get("box") or [0, 0, frs[0]["w"], frs[0]["h"]]
    bw, bh = b[2] - b[0], b[3] - b[1]
    if it["kind"] == "obj": ox, oy = W / 2 - (b[0] + bw / 2), H / 2 - (b[1] + bh / 2)
    elif a.get("kind") == "feet" and m["meta"].get("stripped") and n not in nochar: ox, oy = FX0 - a["x"], GY - a["y"]
    else:
        cx = W / 2 if it["kind"] == "common" else min(W - bw / 2, FX0 + sp.width / 2 + bw / 2)
        ox = cx - (b[0] + bw / 2); oy = GY - sp.height * 0.55 - (b[1] + bh / 2) if it.get("mode") == "center" else GY - b[3]
    base = Image.new("RGBA", (W, H), BG)
    for x in range(W): base.putpixel((x, GY), (70, 80, 70, 255))
    if it["kind"] != "obj":
        s = sp.copy()
        if it["kind"] == "common": s.putalpha(s.getchannel("A").point(lambda v: v * 90 // 255))
        base.alpha_composite(s, (int(FX0 - sp.width / 2), GY - sp.height))
    out = []
    for r in frs + [None] * 6:
        c = base.copy()
        if r: c.alpha_composite(sh.crop((r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])), (int(ox), int(oy)))
        out.append(c)
    buf = io.BytesIO(); out[0].save(buf, "WEBP", save_all=True, append_images=out[1:], duration=m["frames"][0].get("duration", 70), loop=0, lossless=True)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    man = json.loads((BASE / "fx3_manifest.json").read_text())
    st = json.loads((BASE / "fx3_status.json").read_text())
    log = (BASE / "queue" / "gen3.log").read_text()
    nochar = set(re.findall(r"^(\S+) 캐릭터 없음", log, re.M))
    groups = {}
    for it in man:
        if not (VFX / f"{it['name']}.json").exists(): continue
        g = "공용" if it["kind"] == "common" else "물건" if it["kind"] == "obj" else it["key"]
        groups.setdefault(g, []).append(it)
    sec = []; nb = 0
    for g, its in groups.items():
        cards = []
        for it in its:
            bad = (st.get(it["name"]) or {}).get("why") or []; nb += bool(bad)
            cards.append(f'<figure><img src="{anim(it, nochar)}" alt="{html.escape(it["row"])}"><figcaption><b>{html.escape(it["row"])}</b><span>{it["name"]}</span>'
                         + (f'<em>기계 검사: {html.escape(", ".join(bad))}</em>' if bad else "") + "</figcaption></figure>")
        sec.append(f'<details{" open" if not sec else ""}><summary>{html.escape(g)} <small>{len(its)}</small></summary><div class="grid">{"".join(cards)}</div></details>')
    total = sum(len(v) for v in groups.values())
    page = f"""<title>기술 이펙트 3판</title><meta name="claude:viewport-fit-sides" content="cover">
<style>
/* 인물별 접는 칸, 카드마다 움직이는 그림. 한 가지 어두운 화면 */
:root{{--bg:#191b20;--fg:#e7e9ee;--muted:#9aa1ac;--card:#23262d;--bad:#ff8a7a;color-scheme:dark}}
body{{background:var(--bg);color:var(--fg);font-family:system-ui,sans-serif;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
h1{{font-size:18px;margin:0 0 4px}}p.sum{{color:var(--muted);font-size:13px;margin:0 0 12px}}
details{{background:var(--card);border-radius:6px;margin:0 0 8px;padding:6px 10px}}summary{{cursor:pointer;font-size:14px;padding:4px 0}}summary small{{color:var(--muted)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;padding:8px 0}}
figure{{margin:0;min-width:0}}img{{display:block;width:100%;height:auto;image-rendering:pixelated;border-radius:4px}}
figcaption{{font-size:12px;padding:4px 0;display:flex;flex-direction:column;gap:2px}}figcaption span{{color:var(--muted);word-break:break-all}}figcaption em{{color:var(--bad);font-style:normal}}
</style>
<h1>기술 이펙트 3판</h1><p class="sum">{total}개 · 기계 검사 걸림 {nb}개 · 인물 그림과 이펙트 모두 1배. 칸 이름을 누르면 펼쳐집니다.</p>
{"".join(sec)}"""
    OUT.write_text(page); print(total, "개", round(len(page) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
