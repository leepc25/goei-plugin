# 기준 그림 4차: 3차 f931(따뜻한 숯빛 정장)에 기본 그림의 어깨 앞 머리 가닥·넥타이를 더함.
import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import pl
OUT=os.path.join(pl.HERE,'../full/base'); SRC=os.path.join(OUT,'f931.png')
D=("Keep everything the same. Add a long straight strand of black hair hanging from beside the face down in front of the shoulder to the chest. "
   "Show a narrow black necktie on the white shirt at the open jacket front.")
if __name__=='__main__':
    b0=pl.bal(); pl.log('base4 before '+b0)
    jobs=[]
    for seed in [int(a) for a in sys.argv[1:]] or (941,942):
        j,t=pl.submit('edit_image_pixen',dict(description=D,image_url=pl.b64(SRC),seed=seed))
        pl.log(f'base4 edit {seed} -> {t[:100]}'); jobs.append((seed,j))
    for s,j in jobs:
        if j: print(s,pl.poll(j,f'{OUT}/g{s}.png'),flush=True)
