"""이펙트 3판 확인 페이지: 인물 전투 자세 그림 + 이펙트를 1배로 겹쳐 반복 재생. 그림은 data URI 대신 파일로(용량).
사용: python3 fx3_review.py → docs/이펙트_시험/3판/index.html + 그림 폴더"""
import json, re, shutil
from pathlib import Path
from PIL import Image
import m3

BASE = Path(__file__).resolve().parent; ROOT = BASE.parents[2]; VFX = BASE.parent / "testroom3" / "vfx"
OUT = ROOT / "docs" / "이펙트_시험" / "3판"
DIRS = {f"{a}_{b}": ("W" if "(W)" in d else "E") for a, b, d in re.findall(r"^\| (\d+\.\d+) \| (\S+) \| ([^|]+) \|", (ROOT / "docs/동작표_3판/00_목록.md").read_text(), re.M)}


def main():
    (OUT / "fx").mkdir(parents=True, exist_ok=True); (OUT / "sp").mkdir(exist_ok=True)
    man = json.loads((BASE / "fx3_manifest.json").read_text())
    st = json.loads((BASE / "fx3_status.json").read_text()) if (BASE / "fx3_status.json").exists() else {}
    items, sprites = [], {}
    for it in man:
        n = it["name"]; js = VFX / f"{n}.json"
        if not js.exists(): continue
        m = json.loads(js.read_text()); key = it["key"]
        if key not in sprites:
            row, fr = m3.state(key)["picks"]["전투 자세 장"]
            sp = Image.open(BASE / key / row / f"{fr - 1:02d}.png").convert("RGBA")
            if DIRS.get(key) == "W": sp = sp.transpose(Image.FLIP_LEFT_RIGHT)   # 이펙트는 동쪽 기준으로 저장됨
            sp = sp.crop(sp.getbbox()); sp.save(OUT / "sp" / f"{key}.png"); sprites[key] = [sp.width, sp.height]
        shutil.copy(VFX / f"{n}.png", OUT / "fx" / f"{n}.png")
        fr = [f["frame"] for f in m["frames"]]
        items.append(dict(n=n, key=key, row=it.get("row", ""), kind=it["kind"], fr=fr, dur=m["frames"][0].get("duration", 70),
                          ax=m["meta"]["anchor"]["x"], ay=m["meta"]["anchor"]["y"], bad=(st.get(n) or {}).get("why") or []))
    tpl = (BASE / "fx3_review.tpl").read_text()
    (OUT / "index.html").write_text(tpl.replace("__D__", json.dumps(dict(items=items, sp=sprites), ensure_ascii=False)))
    print(len(items), "개")


if __name__ == "__main__":
    main()
