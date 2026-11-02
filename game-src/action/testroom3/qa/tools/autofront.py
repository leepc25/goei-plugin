import sys,json,glob,os; sys.path.insert(0,'qa'); sys.path.insert(0,os.path.dirname(sys.argv[0])); sys.argv=sys.argv[:1]
import meas as M, fit_chair as F
from pathlib import Path
for f in sorted(glob.glob('chairs/*.json')):
    k=Path(f).stem; d=json.load(open(f))
    if (d.get('front') or {}).get('img','south')!='south': print('skip',k); continue
    try: m=M.meas(k)
    except Exception as e: print('err',k,e); continue
    dy=m['dy']-(m['ctop_minus_sh']+20); dx=m['dx']-(m['chair_c_minus_torso']-10)
    d['front']={**d['front'],'dx':round(dx),'dy':round(dy),'s':1.0,'img':'south'}
    json.dump(d,open(f,'w'),ensure_ascii=False,indent=1); open(f,'a').write('\n')
    print(k,m['dx'],m['dy'],'->',round(dx),round(dy))
