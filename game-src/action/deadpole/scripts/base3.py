# 기준 그림 3차(2026-10-22 01:55): 2차(e821)가 쟈알디 몸·옷 그대로라는 지적 → 옷·머리를 데드폴 기본 그림(Deadpole_default.avif)대로 편집.
# 톤(외곽선·명암·도트)은 그대로, 바꾸는 것: 정장 색(따뜻한 숯빛 갈색 검정), 열린 재킷 앞의 흰 셔츠·검은 넥타이, 어깨 앞으로 내려오는 앞머리 가닥, 더 가는 몸통.
import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import pl
OUT=os.path.join(pl.HERE,'../full/base'); SRC=os.path.join(OUT,'e821.png')
D=("Same girl, same right-facing profile, head and bangs. Suit very dark warm charcoal black, no blue. "
   "Jacket open at the chest showing white shirt collar and black necktie. "
   "A long strand of black hair falls in front of the shoulder over the chest. Slimmer narrower torso and shoulders.")
if __name__=='__main__':
    b0=pl.bal(); pl.log('base3 before '+b0)
    jobs=[]
    for seed in [int(a) for a in sys.argv[1:]] or (931,932,933):
        j,t=pl.submit('edit_image_pixen',dict(description=D,image_url=pl.b64(SRC),seed=seed))
        pl.log(f'base3 edit {seed} -> {t[:100]}'); jobs.append((seed,j)); print(seed,t[:80].replace('\n',' '),flush=True)
    for s,j in jobs:
        if j: print(s,pl.poll(j,f'{OUT}/f{s}.png'),flush=True)
    b1=pl.bal(); pl.log('base3 after '+b1); print(b0,b1)
