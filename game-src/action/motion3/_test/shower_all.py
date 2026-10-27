"""샤워 세트 2판 전원 돌리기(2026-10-27 밤 사용자 지시). 이미 샤워2_A가 있는 인물은 건너뜀. 동시에 6명.
사용: python3 _test/shower_all.py   기록 _test/shower_all.log"""
import json, subprocess, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
B = Path(__file__).resolve().parent
keys = list(json.load(open(B / "shower_targets.json")))
def one(k):
    if (B / k / "샤워2_E").exists(): return f"{k} 이미 있음"
    r = subprocess.run([sys.executable, str(B / "shower_set2.py"), k], capture_output=True, text=True)
    return (r.stdout + r.stderr[-300:]).strip()
with ThreadPoolExecutor(6) as ex, open(B / "shower_all.log", "a") as log:
    for res in ex.map(one, keys): log.write(res + "\n"); log.flush(); print(res, flush=True)
