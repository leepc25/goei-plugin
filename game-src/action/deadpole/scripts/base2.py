# 기준 그림 2차: 쟈알디 옆모습 대기(base-idle-side.png)를 그대로 편집해 그림체·비율·명암을 물려받음(얼굴·머리만 데드폴로).
import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import pl
OUT=os.path.join(pl.HERE,'../full/base'); SRC=os.path.join(pl.HERE,'../../jyaldi-v5/full/base-idle-side.png')
D=("Keep the head the same size and in the same side profile facing right, only one eye visible. "
   "Add straight-cut bangs over the forehead in profile, change the red eye to a soft round brown eye, add a faint blush on the cheek. "
   "Do not turn the face toward the viewer. Keep the same body, suit, pose, outline, colors and pixel style.")
if __name__=='__main__':
    b0=pl.bal(); pl.log('base2 before '+b0)
    jobs=[]
    for seed in [int(a) for a in sys.argv[1:]] or (811,812):
        j,t=pl.submit('edit_image_pixen',dict(description=D,image_url=pl.b64(SRC),seed=seed))
        pl.log(f'base2 edit {seed} -> {t[:100]}'); jobs.append((seed,j)); print(seed,t[:80].replace('\n',' '),flush=True)
    for s,j in jobs:
        if j: print(s,pl.poll(j,f'{OUT}/e{s}.png'),flush=True)
    b1=pl.bal(); pl.log('base2 after '+b1); print(b0,b1)
