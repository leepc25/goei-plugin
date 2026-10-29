"""검수용 재생 페이지 만들기: 인물을 고르면 지정한 줄들을 움직이는 그대로 재생.
사용: python3 review_build.py <출력 폴더> <제목> <키 접두(예: 1.,2. 또는 6.)> <줄...>
결과: <출력>/index.html + <출력>/c/<번호>.js(인물별 그림, 고를 때만 불러옴)"""
import base64, json, sys
from pathlib import Path
import m3

BASE = Path(__file__).resolve().parent


def main(out, title, prefixes, rows):
    out = Path(out); (out / "c").mkdir(parents=True, exist_ok=True)
    pre = tuple(prefixes.split(","))
    keys = [k for k in m3.order() if k.startswith(pre) and k != "1.4_에일린"]
    index = []
    for k in keys:
        try: T = m3.table(k)
        except Exception: continue
        mech = {}
        for rf in ("mech.json", "mech_npc.json"):
            try: mech.update(json.loads((BASE / rf).read_text()).get(k, {}))
            except Exception: pass
        items = []
        for r in rows:
            f = r.replace("-", "_"); fs = sorted((BASE / k / f).glob("[0-9][0-9].png"))
            name = T["rows"].get(r, {}).get("name", r)
            m = mech.get(f, {})
            items.append({"row": r, "name": name, "frames": ["data:image/png;base64," + base64.b64encode(p.read_bytes()).decode() for p in fs],
                          "mech": m.get("result") if m.get("result") not in (None, "ok") else ""})
        num = k.split("_")[0]
        (out / "c" / f"{num}.js").write_text("(window.__R=window.__R||{})[" + json.dumps(k, ensure_ascii=False) + "]=" + json.dumps(items, ensure_ascii=False) + ";", encoding="utf-8")
        done = sum(1 for it in items if it["frames"])
        index.append({"key": k, "name": k.split("_", 1)[1], "file": f"c/{num}.js", "done": done, "total": len(items)})
    html = (BASE / "review_page.html").read_text(encoding="utf-8").replace("__TITLE__", title).replace("__INDEX__", json.dumps(index, ensure_ascii=False))
    (out / "index.html").write_text(html, encoding="utf-8")
    print(out / "index.html", len(index), "명")


if __name__ == "__main__":
    a = sys.argv[1:]; main(a[0], a[1], a[2], a[3:])
