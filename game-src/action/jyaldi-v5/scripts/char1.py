# PixelLab 기본 길 1단계: 정면(south) 기준 그림. 재킷은 엉덩이를 덮는 길이, 앞 열림, 흰 셔츠·검은 넥타이. 차렷에 가까운 바른 자세.
import sys,time,re
sys.path.insert(0,'.'); import mcp
from sheet import poll
OUT='../char'
D=("Front view pixel art sprite for a 1990s arcade beat-em-up, one full-body character standing straight facing the viewer, arms relaxed at the sides, feet slightly apart. "
 "Tall adult woman, realistic proportions about 6.5 heads tall, slim athletic body. Long straight black hair to the waist, pale skin, sharp red eyes, expressionless. "
 "Black suit: long tailored suit jacket that hangs down over the hips to the upper thigh, jacket open at the front showing a white shirt and a black necktie, black trousers, black leather gloves, black shoes, pistol holster on the right hip under the jacket hem. "
 "Black suit with blue-grey highlights so the body shape reads, crisp clean pixel clusters, dark outline, transparent background.")
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' char1 '+s+'\n')
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
jobs=[]
for seed in (711,721):
    a=dict(description=D,width=96,height=96,no_background=True,view='side',direction='south',outline='single color black outline',detail='medium detail',seed=seed)
    t=mcp.text(mcp.tool('create_image_pixen',a)); log(f'south seed{seed} -> {t[:150]}')
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((seed,m.group(1) if m else None)); print(seed,t[:120].replace('\n',' '),flush=True)
for s,j in jobs:
    if j: print('done',s,poll(j,f'{OUT}/south-{s}.png')[:100].replace('\n',' | '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
