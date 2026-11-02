# 기준 그림 H(본부 정장): 쟈알디 A2를 edit_image_pixen으로 에일린으로 바꿈 → 자세·외곽선·음영·채도가 쟈알디와 같음(사용자 2026-10-22 "쟈알디와 톤이 맞아야"). 1회/장
import sys; sys.path.insert(0,'.')
from common import *
SRC=os.path.join(HERE,'../../jyaldi-v5/full/A2.png'); OUT=os.path.join(HERE,'../base')
D=("Change her into another woman, same pose, size, outline and shading. "
   "Hair: pale cream platinum blonde in a HIGH PONYTAIL with a black hair tie, ponytail hangs to the shoulder blades, "
   "blunt bangs, two long side locks past the jaw. No long black hair. "
   "Dull grey-blue eyes, expressionless. Bare pale hands, no gloves. "
   "Same black suit, white shirt, black necktie, black trousers, shoes, hip holster.")
img=b64url(SRC); jobs=[]
for seed in [int(s) for s in (sys.argv[1:] or ['41','42','43','44'])]:
    t=mcp.text(mcp.tool('edit_image_pixen',{'description':D,'image_url':img,'seed':seed}))
    log('base_h',f'seed{seed} -> {t[:150]}'); jobs.append((seed,jobid(t))); print(seed,t[:120].replace('\n',' '),flush=True)
for s,j in jobs:
    if j: print('done',s,poll(j,f'{OUT}/H-{s}.png')[:80].replace('\n',' '),flush=True)
print(bal())
