# 기준표 A 재킷 길이만 edit_image_pixen으로 고침 (사용자 2026-10-21 전체 완성 지시, 1회/장)
import sys,time,re,base64
sys.path.insert(0,'.'); import mcp
from sheet import poll
SRC='../sheet7/jyaldi-base-pixen-a.png'; OUT='../full'
D=("Make the black suit jacket longer: the jacket hem now hangs down over the hips and buttocks to the upper thigh, like a normal tailored women's suit jacket, "
   "open at the front below the button. Keep everything else exactly the same: pose, face, red eyes, long black hair, white shirt, black tie, gloves, trousers, shoes, colors and blue-grey shading. "
   "The pistol grip of the hip holster peeks out under the jacket hem.")
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' jacket_pixen '+s+'\n')
img='data:image/png;base64,'+base64.b64encode(open(SRC,'rb').read()).decode()
jobs=[]
for seed in (31,32,33):
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':img,'seed':seed}))
    log(f'seed{seed} -> {t[:160]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((seed,m.group(1) if m else None)); print(seed,t[:150].replace('\n',' '),flush=True)
for s,j in jobs:
    if j: print('done',s,poll(j,f'{OUT}/A-jacket-{s}.png')[:80].replace('\n',' '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
