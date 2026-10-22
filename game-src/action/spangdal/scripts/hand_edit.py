# 재생성 뒤에도 주먹으로 남은 장(위로 든 손)을 edit_image_pixen으로 손만 편 손으로 고침. 1회/장, 동시 2개.
# 사용: python3 hand_edit.py execute:1,2,3 spineup:2 ...   원본은 ../full/clips_fist/<클립>/NN.png로 보관 후 덮어씀
import sys,time,re,base64,os,shutil
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
D=("Change only her hands: each hand open with the fingers straight and pressed together, fingertips pointing the same way the forearm points, "
   "like a blade, thumb tucked, clear black outline. They must not be fists. Everything else stays exactly the same, no weapon, no effects.")
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def log(s): open('../spend.log','a').write(time.strftime('%F %T')+' hand_edit '+s+'\n')
todo=[(a.split(':')[0],int(i)) for a in sys.argv[1:] for i in a.split(':')[1].split(',')]
pend=[]
def run(k,i):
    p=f'../full/clips/{k}/{i:02d}.png'; keep=f'../full/clips_fist/{k}/{i:02d}.png'; os.makedirs(os.path.dirname(keep),exist_ok=True)
    if not os.path.exists(keep): shutil.copy(p,keep)
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':b64(keep),'seed':930+i}))
    log(f'{k}:{i} -> {t[:100]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t)
    return (k,i,m.group(1) if m else None)
while todo:
    batch=[run(*todo.pop(0)) for _ in range(min(2,len(todo)))]
    for k,i,j in batch:
        r=poll(j,f'../full/clips/{k}/{i:02d}.png') if j else 'SUBFAIL'
        print(k,i,r[:40].replace('\n',' '),flush=True)
