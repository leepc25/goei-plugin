# 공격 클립 재생성용 기준 장: stab1 2장(앞손 뻗음)을 edit_image_pixen으로 손만 '손끝 편 관수 손'으로 고침. 1회/장, 동시 2개.
# 결과 ../base/hand-<seed>.png (192×144, 뼈대 = rig stab1:2)
import sys,time,re,base64
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
D=("Change only her extended near hand into an open spear hand: four fingers straight and pressed together pointing forward like a blade, "
   "thumb tucked along the side, clear black outline around each finger. It must not be a fist. The far hand stays open and relaxed. "
   "Everything else stays exactly the same, no weapon, no effects.")
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open('../spend.log','a').write(time.strftime('%F %T')+' ref_edit '+s+'\n')
seeds=[int(a) for a in sys.argv[1:]] or [901,902]
jobs=[]
for seed in seeds:
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':b64('../full/clips/stab1/02.png'),'seed':seed}))
    log(f'stab1:2 seed{seed} -> {t[:100]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((seed,m.group(1) if m else None))
for s,j in jobs:
    if j: print(s,poll(j,f'../base/hand-{s}.png')[:60].replace('\n',' '),flush=True)
    else: print('SUBFAIL',s)
