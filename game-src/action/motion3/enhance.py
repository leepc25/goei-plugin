"""다시 뽑기 전 PixelLab 지침 받기(2026-10-26 사용자: 냅다 뽑지 말고 원활한 자세로 바꿔서 픽셀랩에 지침 받고 프롬프트 보완한 다음 뽑아).
/v2/enhance-animation-v3-prompt(engine=pixminimax)에 그 줄의 실제 시작 장·끝 장과 동작 설명을 보내, PixelLab이 고쳐 쓴 동작 설명을 받는다(약 0.05회).
사용: python3 enhance.py <목록.json>   목록 = [{"key":…, "row":…, "action": "<고친 짧은 동작 설명(영어)>"}]
결과: enhance.json(키/줄 → 받은 설명)"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import m3

BASE = Path(__file__).resolve().parent; OUT = BASE / "enhance.json"


def one(it):
    key, n = it["key"], it["row"]
    T = m3.table(key); r = T["rows"][n]; st = m3.state(key)
    start, end = m3.plan(key, r, st)
    d = m3.DIRS[r["dir"]]
    if start == "REG" or end == "REG":
        ch = m3.req("GET", f"/characters/{T['cid']}"); reg = m3.fetch_png(ch["rotation_urls"][d])
        if start == "REG": start = reg
        if end == "REG": end = reg
    if it.get("no_end"): end = None
    body = {"first_frame": m3.b64(start), "action": it["action"][:500], "engine": "pixminimax", "frame_count": r["frames"]}
    if end is not None: body["last_frame"] = m3.b64(end)
    res = m3.req("POST", "/enhance-animation-v3-prompt", body, timeout=180)
    txt = res.get("enhanced_prompt") or res.get("prompt") or res.get("description") or json.dumps(res)[:800]
    return f"{key}/{n}", txt


if __name__ == "__main__":
    items = json.loads(Path(sys.argv[1]).read_text())
    got = json.loads(OUT.read_text()) if OUT.exists() else {}
    with ThreadPoolExecutor(6) as ex:
        for k, v in ex.map(lambda it: (lambda: one(it))() if True else None, items):
            got[k] = v; print(k, "|", v[:160].replace("\n", " "), flush=True)
            OUT.write_text(json.dumps(got, ensure_ascii=False, indent=1))
