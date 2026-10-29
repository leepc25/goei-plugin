import subprocess, sys, time, os
os.chdir('/home/user/goei-plugin/game-src/action/motion3'); sys.path.insert(0, '.')
import m3, mech
from pathlib import Path
KS = sys.argv[1:]; T0 = float(os.environ.get("T0", time.time())); seen = {}; tries = {}
while True:
    for K in KS:
        for d in Path(K).iterdir():
            p = d / '00.png'
            if not d.is_dir() or d.name.startswith('_') or not p.exists() or p.stat().st_mtime < T0: continue
            t = p.stat().st_mtime
            if seen.get((K, d.name)) == t: continue
            seen[(K, d.name)] = t
            bad = mech.check(K, d.name)
            if bad and tries.get((K, d.name), 0) < 1:
                tries[(K, d.name)] = 1; row = d.name.replace('_W', '').replace('_SW', '').replace('_', '-')
                subprocess.run([sys.executable, 'm3.py', 'enq', K, row], capture_output=True); print(K, d.name, bad, '다시', flush=True)
            else:
                subprocess.run([sys.executable, 'm3.py', 'ok', K, d.name], capture_output=True); print(K, d.name, '통과' if not bad else f'통과(기계 실패 {bad})', flush=True)
    if not any(Path('queue/pending').glob('*.json')) and not any(Path('queue/running').glob('*.json')): break
    time.sleep(20)
print('끝')
