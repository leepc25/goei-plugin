# 7차 시안: 80px 키, 6~6.5등신, 장당 1회 생성기(PixFlux·Pixen) 4장씩. 96 캔버스.
import sys,time,re,os,json
sys.path.insert(0,'.'); import mcp
from sheet import poll
OUT='../sheet7'; os.makedirs(OUT,exist_ok=True)
D=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body fighting ready stance facing right. "
 "Tall adult woman, realistic proportions about 6.5 heads tall, figure about 80 pixels tall, slim athletic body with narrow waist and full hips. "
 "Long straight black hair to the waist, pale skin, sharp red eyes, expressionless. Black fitted pant suit with hip-length jacket, white shirt, black necktie, black leather gloves, black shoes, pistol holster on the right hip. "
 "Black suit with blue-grey highlights so the body shape reads, crisp clean pixel clusters, dark outline, transparent background.")
specs=[('flux-a','create_image_pixflux',dict(outline='single color black outline',shading='medium shading',detail='medium detail',seed=701)),
       ('flux-b','create_image_pixflux',dict(outline='single color outline',shading='detailed shading',detail='highly detailed',seed=702)),
       ('flux-c','create_image_pixflux',dict(outline='selective outline',shading='basic shading',detail='medium detail',seed=703)),
       ('flux-d','create_image_pixflux',dict(outline='single color black outline',shading='detailed shading',detail='medium detail',seed=704)),
       ('pixen-a','create_image_pixen',dict(outline='single color black outline',detail='medium detail',seed=711)),
       ('pixen-b','create_image_pixen',dict(outline='single color outline',detail='highly detailed',seed=712)),
       ('pixen-c','create_image_pixen',dict(outline='selective outline',detail='medium detail',seed=713)),
       ('pixen-d','create_image_pixen',dict(outline='single color black outline',detail='highly detailed',seed=714))]
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' sheet7 '+s+'\n')
jobs=[]
for n,tool,extra in specs:
    a=dict(description=D,width=96,height=96,no_background=True,view='side',direction='east'); a.update(extra)
    t=mcp.text(mcp.tool(tool,a)); log(f'{n} {tool} -> {t[:150]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((n,m.group(1) if m else None)); print(n,t[:150].replace('\n',' '),flush=True)
for n,j in jobs:
    if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png')[:100].replace('\n',' | '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
