# 장갑 기준 그림 후보: 맨몸과 같은 생성기(pixen)·같은 설명 틀·같은 외곽선. 원화 없음 → 위키 서술(근미래 전신 판금, 날개형 부스터, 푸른 분사, 헬멧). 장당 1회.
import sys,time,re,os
sys.path.insert(0,'.'); import mcp
from base import poll,log
OUT='../base'
D=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body fighting ready stance facing right, body turned sideways in profile. "
 "A huge man completely encased in near-future full-body powered plate armor, bulkier than a man, figure about 116 pixels tall, "
 "dark blue-grey steel plates with black joints, thin glowing cyan lines on the chest and arms, a closed rounded helmet with a narrow cyan visor slit and no face visible, "
 "massive gauntlets, heavy armored boots, a large folded wing-shaped booster pack on the back with two thruster nozzles. "
 "Knees bent, feet apart front and back, both gauntlets raised in front. Crisp clean pixel clusters, dark outline, blue-grey highlights, transparent background.")
if __name__=='__main__':
    jobs=[]
    for s in (851,852,853,854,855,856):
        a=dict(description=D,width=128,height=128,no_background=True,view='side',direction='east',outline='single color black outline',detail='medium detail',seed=s)
        for k in range(10):
            t=mcp.text(mcp.tool('create_image_pixen',a))
            if 'rate limit' in t: time.sleep(20); continue
            break
        log(f'armor-{s} -> {t[:120]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((s,m.group(1) if m else None)); print(s,t[:60],flush=True)
    for s,j in jobs:
        if j: print('done',s,poll(j,f'{OUT}/armor-{s}.png'),flush=True)
