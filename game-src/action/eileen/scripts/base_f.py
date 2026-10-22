# 기준 그림 F(현장): H에 방탄조끼만 얹음(edit_image_pixen, 1회/장). 소총은 클립 설명으로 그림(쟈알디 산탄총과 같은 방식)
import sys; sys.path.insert(0,'.')
from common import *
SRC=os.path.join(HERE,'../base/H.png'); OUT=os.path.join(HERE,'../base')
D=("Add a dark olive-green bulletproof plate carrier vest worn loosely over the suit jacket: covers chest and stomach, "
   "thick shoulder straps, loose side straps, two flat magazine pouches on the front. "
   "Keep everything else exactly the same: pose, blonde ponytail, face, suit, shirt collar, tie knot, trousers, shoes, holster, outline and shading.")
img=b64url(SRC); jobs=[]
for seed in [int(s) for s in (sys.argv[1:] or ['51','52','53'])]:
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':img,'seed':seed}))
    log('base_f',f'seed{seed} -> {t[:150]}'); jobs.append((seed,jobid(t))); print(seed,t[:80].replace('\n',' '),flush=True)
for s,j in jobs:
    if j: print('done',s,poll(j,f'{OUT}/F-{s}.png')[:60].replace('\n',' '),flush=True)
print(bal())
