# 31·33(코트 길이)을 넣고 "엉덩이 길이로 줄이기" 편집. 1회/장
import sys,time,re,base64
sys.path.insert(0,'.'); import mcp
from sheet import poll
D=("Shorten the long coat into a normal hip-length suit jacket: the jacket hem ends just below the buttocks at the top of the thighs; "
   "both legs in black trousers fully visible below the hem from the upper thigh down to the shoes. Keep pose, face, hair, shirt, tie, gloves, holster, colors and shading the same.")
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' jacket_pixen2 '+s+'\n')
jobs=[]
for src,seed in ((31,41),(31,42),(33,43)):
    img='data:image/png;base64,'+base64.b64encode(open(f'../full/A-jacket-{src}.png','rb').read()).decode()
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':img,'seed':seed}))
    log(f'src{src} seed{seed} -> {t[:120]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((f'{src}-{seed}',m.group(1) if m else None))
for s,j in jobs:
    if j: print('done',s,poll(j,f'../full/A-short-{s}.png')[:60].replace('\n',' '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
