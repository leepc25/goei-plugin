# 장갑 후보 851(가장 묵직·옆모습)의 등짐을 위키 「날개 모양 부스터」로 바꿈. 자세·몸 그대로. 장당 1회.
import sys,time,re,base64
sys.path.insert(0,'.'); import mcp
from base import poll,log
SRC='../base/armor-851.png'
D=("Keep the pose, armor body, helmet, colors and size exactly the same. Replace the boxy backpack with a folded wing-shaped booster pack: "
   "two angular steel wing fins folded back along the shoulders and two round thruster nozzles pointing down behind the back, dark blue-grey steel with thin cyan lines, no orange.")
img='data:image/png;base64,'+base64.b64encode(open(SRC,'rb').read()).decode()
jobs=[]
for seed in (61,62,63):
    for k in range(10):
        t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':img,'seed':seed}))
        if 'rate limit' in t: time.sleep(20); continue
        break
    log(f'armor_edit seed{seed} -> {t[:120]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((seed,m.group(1) if m else None))
for s,j in jobs:
    if j: print('done',s,poll(j,f'../base/armor-edit-{s}.png'),flush=True)
