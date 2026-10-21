"""Preserve untracked cut candidates when another worker has published that path.

Only files below our cutscene frames directory can move, and only into our
explicit output backup directory. No tracked file or source reference is moved.
"""
from pathlib import Path
import subprocess,time
ROOT=Path(__file__).resolve().parents[1]
allowed=(ROOT/'game-src/art/cutscene/frames').resolve()
backup=(ROOT/'output/preserved-main-overlaps'/str(time.time_ns())).resolve()
tracked=set(subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0'))
names=subprocess.check_output(['git','ls-tree','-r','-z','--name-only','origin/main','--','game-src/art/cutscene/frames'],cwd=ROOT).decode().split('\0')
saved=[]
for name in names:
    if not name or name in tracked:continue
    source=(ROOT/name).resolve()
    if not source.is_file():continue
    assert source.is_relative_to(allowed)
    target=(backup/name).resolve()
    assert target.is_relative_to(backup)
    target.parent.mkdir(parents=True,exist_ok=True)
    source.rename(target)
    saved.append(name)
print('Preserved '+str(len(saved))+' untracked candidate files at '+str(backup))
