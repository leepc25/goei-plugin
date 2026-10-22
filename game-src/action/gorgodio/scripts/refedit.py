# 옆모습 기준판(pbase 00)에서 셔츠·넥타이·지퍼가 사라짐 → edit_image_pixen으로 앞섶만 살림(자세 그대로). 장당 1회.
import sys,time,re,base64
sys.path.insert(0,'.'); import mcp
from base import poll
SRC='../full/clips/pbase/00.png'; OUT='../base'
D=("Keep the pose, body, face and size exactly the same. The black leather biker jacket hangs open at the front: show a narrow strip of white dress shirt "
   "and the black necktie along the front edge of the chest, a silver zipper line and a few silver studs on the jacket collar and lapel, "
   "subtle blue-grey highlights on the black leather. Bald head, short dark goatee, amber eye.")
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' refedit '+s+'\n')
img='data:image/png;base64,'+base64.b64encode(open(SRC,'rb').read()).decode()
jobs=[]
for seed in (41,42,43):
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':img,'seed':seed}))
    log(f'seed{seed} -> {t[:160]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((seed,m.group(1) if m else None)); print(seed,t[:150].replace('\n',' '),flush=True)
for s,j in jobs:
    if j: print('done',s,poll(j,f'{OUT}/ref-edit-{s}.png'),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
