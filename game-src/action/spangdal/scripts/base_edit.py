# 고른 후보 j(필요시 l)에 앞머리(한쪽 눈 덮음) + 빈 손만 edit_image_pixen으로 고침. 1회/장.
import sys,time,re,base64
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
D=("Make her wavy dark purple bangs longer so they hang down over her eye and hide it like a curtain, only the gold eye on the far side may peek out. "
   "Her near hand is empty and relaxed in front of her hip with fingers straight, not holding the pistol; the pistol stays in the holster. Everything else stays exactly the same.")
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open('../spend.log','a').write(time.strftime('%F %T')+' base_edit '+s+'\n')
jobs=[]
for src,seed in [('j',741),('j',742),('j',743),('l',744),('l',745)]:
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':b64(f'../base/cand-{src}.png'),'seed':seed}))
    log(f'{src} seed{seed} -> {t[:100]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((f'{src}{seed}',m.group(1) if m else None))
for n,j in jobs:
    if j: print(n,poll(j,f'../base/edit-{n}.png')[:40].replace('\n',' '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
