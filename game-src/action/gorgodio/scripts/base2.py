# 기준 그림 2차: 1차 7장은 전부 3/4 정면에 땅딸막(5등신). 쟈알디 A처럼 옆모습 전투 자세 + 7.5등신으로. 장당 1회.
import sys,time,re,os
sys.path.insert(0,'.'); import mcp
from base import poll,log,pal_png
OUT='../base'
D=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body fighting ready stance facing right, body turned fully sideways in profile so only the near shoulder shows. "
 "Very tall adult man, realistic proportions about 7.5 heads tall with a small head and long legs, figure about 104 pixels tall, muscular wrestler build: broad chest and shoulders, thick arms, narrow waist, not fat. "
 "Completely bald head, thick dark eyebrows, amber eyes, short dark goatee only on the chin, confident face. "
 "Black leather biker jacket with an asymmetric zipper and silver studs, open over a white dress shirt and black necktie, black trousers, black boots. "
 "Knees bent, feet apart front and back, near fist forward at waist height, rear hand open in front of the chest. "
 "Black clothing with blue-grey highlights so the body shape reads, crisp clean pixel clusters, dark outline, transparent background.")
if __name__=='__main__':
    PAL=pal_png()
    specs=[(f'p2-{s}','create_image_pixen',dict(outline='single color black outline',detail='medium detail',seed=s)) for s in (821,822,823,824)]
    specs+=[(f'f2-{s}','create_image_pixflux',dict(outline='single color black outline',shading='medium shading',detail='medium detail',seed=s,color_image_url=PAL)) for s in (831,832)]
    jobs=[]
    for n,tool,extra in specs:
        a=dict(description=D,width=112,height=112,no_background=True,view='side',direction='east'); a.update(extra)
        for k in range(10):
            t=mcp.text(mcp.tool(tool,a))
            if 'rate limit' in t: time.sleep(15); continue
            break
        log(f'{n} {tool} -> {t[:120]}')
        m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((n,m.group(1) if m else None)); print(n,t[:80].replace('\n',' '),flush=True)
    for n,j in jobs:
        if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png'),flush=True)
