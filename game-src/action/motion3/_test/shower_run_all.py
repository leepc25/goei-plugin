"""맨몸 피격 전원 끝까지 (2026-10-31 사용자: 「처음부터 완성될 때까지 멈추지 말고」「전수검사해서 잘못된 거 프롬프트 바꿔서 최대 2번까지만 다시 뽑아」).
1) 샤워 없던 4명 샤워 4줄 중 빠진 것 → 2) 전원 맨몸 피격 7줄 중 빠진 것(GIF 없는 줄, 한 사람 안에서는 차례로, 20명 동시) →
3) shower_check 전수검사 → 걸린 줄을 SHOWER_V=1 문장으로 재뽑기 → 다시 검사 → SHOWER_V=2 → 끝(그래도 걸리면 표시만).
재뽑기 승인 회수는 사용자 지시(최대 2번) 범위에서 걸린 줄 수만큼 .pixellab_ok에 더하고 기록한다.
사용: python3 _test/shower_run_all.py   (motion3 폴더에서). 진행은 _test/_run_all.log"""
import subprocess, json, fcntl, time, sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

HERE = Path(__file__).resolve().parent; M3 = HERE.parent; ROOT = HERE.parents[3]
GATE = ROOT / ".pixellab_ok"; LOG = HERE / "_run_all.log"
LINES = ["G", "H1", "H2", "H6", "H3", "H4", "H5"]   # 의존 순서
NEED = {"G": "A", "H1": "G", "H2": "G", "H6": "G", "H3": "H2", "H4": "H3", "H5": "H3"}
BOYS = ["6.50_학생남1", "6.51_학생남2", "6.7_불량배남1", "6.9_불량배남3"]


def log(*a):
    with open(LOG, "a") as f: print(time.strftime("%H:%M:%S"), *a, file=f, flush=True)


def has(k, n):
    if n in "ABDE": return any((HERE / k / f"샤워2_{n}").glob("[0-9][0-9].png"))
    return (HERE / k / f"샤워2_{n}.gif").exists()


def add_gate(n, why):
    with open(GATE, "r+") as f:
        fcntl.flock(f, fcntl.LOCK_EX); L = f.read().split("\n")
        try: left = int(L[0])
        except ValueError: left = 0
        L[0] = str(left + n); L.insert(1, f"- {time.strftime('%m-%d %H:%M')} {why}: +{n}")
        f.seek(0); f.truncate(); f.write("\n".join(L))


def sh(args, env=None):
    import os
    e = dict(os.environ, **(env or {}))
    r = subprocess.run(args, cwd=M3, capture_output=True, text=True, env=e)
    out = (r.stdout + r.stderr).strip().splitlines()
    return out[-1][:300] if out else ""


def one(k, lines, env=None, redo=False):
    for n in lines:
        if not redo and has(k, n): continue
        if not has(k, NEED[n]) and NEED[n] != "A": log(k, n, "건너뜀(앞 줄 없음)"); continue
        for attempt in range(3):   # 보내기 실패·오류는 같은 문장으로 다시(생성 성공 전에는 회수 안 씀)
            res = sh(["python3", "_test/shower_hit.py", k, n, "--redo"], env)
            log(k, n, (env or {}).get("SHOWER_V", "0"), res)
            if "완료" in res: break
            time.sleep(30)


def main():
    keys = sorted(p.parent.name for p in HERE.glob("*/샤워2_A"))
    keys = sorted(set(keys) | set(BOYS))
    log("시작", len(keys), "명")
    # 1) 4명 샤워 줄
    for k in BOYS:
        miss = [n for n in "ABDE" if not has(k, n)]
        if miss: log(k, "샤워 줄", miss, sh(["python3", "_test/shower_set2.py", k]))
    # 2) 맨몸 피격 빠진 줄
    with ThreadPoolExecutor(20) as ex: list(ex.map(lambda k: one(k, LINES), keys))
    miss = [(k, n) for k in keys for n in LINES if not has(k, n)]
    log("1차 끝, 빠진 줄", len(miss), miss[:40])
    # 3) 전수검사 → 재뽑기 2번
    for v in ("1", "2"):
        sh(["python3", "_test/shower_check.py"] + keys)
        bad = json.load(open(HERE / "_shower_check.json"))
        todo = {k: [n for n in LINES if n in d and d[n] != ["없음"]] for k, d in bad.items()}
        todo = {k: v_ for k, v_ in todo.items() if v_}
        cnt = sum(len(x) for x in todo.values())
        log(f"검사 {v}회차 전: 걸린 줄 {cnt}", json.dumps(todo, ensure_ascii=False)[:2000])
        if not cnt: break
        add_gate(cnt, f"사용자 「전수검사해서 잘못된 거 프롬프트 바꿔서 최대 2번까지만 다시 뽑아」 재뽑기 {v}회차 {cnt}줄")
        with ThreadPoolExecutor(20) as ex: list(ex.map(lambda kv: one(kv[0], kv[1], {"SHOWER_V": v}, redo=True), todo.items()))
    sh(["python3", "_test/shower_check.py"] + keys)
    bad = json.load(open(HERE / "_shower_check.json"))
    log("최종 검사: 걸린 줄", sum(len(d) for d in bad.values()))
    log("전부끝")


if __name__ == "__main__":
    main()
