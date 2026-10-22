# 기준 그림 후보: 쟈알디 기준표 A와 같은 생성기(pixen)·같은 문장 틀·같은 외곽선 설정. 캔버스를 줄여(84·88) 키를 쟈알디(96 캔버스 93px)의 약 0.88~0.92로.
import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import pl
OUT=os.path.join(pl.HERE,'../full/base')
D=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body standing pose facing right, seen strictly from the side in profile. "
 "Petite young adult woman, realistic proportions about 6.5 heads tall, small slim body with narrow shoulders. "
 "Long straight black hair down to the waist with blunt straight-cut bangs across the forehead, pale skin with a faint blush, large round soft brown eyes, gentle shy smile. "
 "Black fitted pant suit with hip-length jacket, white shirt, black necktie, black gloves, black shoes. "
 "Both hands clasped together in front of her stomach, head tilted slightly down. "
 "Black suit with blue-grey highlights so the body shape reads, crisp clean pixel clusters, dark outline, transparent background.")
specs=[('p84a',84,801),('p84b',84,802),('p88a',88,803),('p88b',88,804)]
if __name__=='__main__':
    b0=pl.bal(); pl.log('base before '+b0); print('before',b0,flush=True)
    jobs=[]
    for n,s,seed in specs:
        j,t=pl.submit('create_image_pixen',dict(description=D,width=s,height=s,no_background=True,view='side',direction='east',outline='single color black outline',detail='medium detail',seed=seed))
        pl.log(f'base {n} -> {t[:120]}'); jobs.append((n,j)); print(n,j,t[:100].replace('\n',' '),flush=True)
    for n,j in jobs:
        if j: print(n,pl.poll(j,f'{OUT}/{n}.png'),flush=True)
    b1=pl.bal(); pl.log('base after '+b1); print('after',b1)
