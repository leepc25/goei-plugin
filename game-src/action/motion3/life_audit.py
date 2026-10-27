"""생활·직무 줄(60번 이상) 기계 검사: 멈춤·빈 장·장 수·잘림(15px 이상)·몸 크기 튐. 색·덩어리는 도구·옷 변화가 정상이라 뺌."""
import json, re, sys
from multiprocessing import Pool
from pathlib import Path
import numpy as np
from PIL import Image
import audit, m3
BASE = Path(__file__).resolve().parent

def one(k):
    T = m3.table(k); ref = audit.ref_of(k, T); out = []
    for rn, r in T["rows"].items():
        if not re.fullmatch(r"\d+", rn.split("-")[0]) or int(rn.split("-")[0]) < 60: continue
        try: es = audit.check_row(k, rn, r, ref)
        except Exception as e: es = [f"검사 오류 {e!r}"[:100]]
        keep = []
        for e in es:
            if e.startswith(("색이", "떨어진", "발이", "바닥", "시작·끝", "뒤로", "몸이 작아짐")): continue
            if e.startswith("몸이 커짐") and float(re.findall(r"[\d.]+", e)[0]) < 2.2: continue
            if e.startswith("캔버스 끝 잘림"):
                fs = sorted((BASE / k / m3.folder(rn)).glob("[0-9][0-9].png"))
                c = sum(int(((a := np.array(Image.open(p))[:, :, 3] > 40)[0].sum() + a[:, 0].sum() + a[:, -1].sum()) >= 15) for p in fs)
                if not c: continue
                e = f"잘림 {c}장"
            if e.startswith("반복 이음"): continue   # 반복은 왕복 재생으로
            keep.append(e)
        if keep: out.append(dict(key=k, row=rn, name=r["name"], why=keep))
    return out

if __name__ == "__main__":
    keys = [k for k in m3.order() if re.match(r"[1-6]\.", k) and (m3.DOCS / f"{k}.md").exists()]
    with Pool(4) as p: res = [x for l in p.map(one, keys) for x in l]
    json.dump(res, open(BASE / "life_audit.json", "w"), ensure_ascii=False, indent=1)
    import collections
    print(len(res), collections.Counter(re.sub(r"[\d(].*", "", w).strip() for o in res for w in o["why"]))
