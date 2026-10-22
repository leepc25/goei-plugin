# 기준 장 고치기(edit_image_pixen, 1회/장). 생성기가 못 그리는 자세·소품(권총+등에 멘 소총, 개머리판 치기)을 장 하나로 먼저 만들고
# 그 장을 animate의 첫 장(기준 그림)으로 씀. 사용: python3 keyframe.py 이름 원본.png 시드...   결과 ../base/kf/<이름>-<시드>.png
import sys; sys.path.insert(0,'.')
from common import *
D={
 'Q':("Add a compact black carbine rifle slung diagonally across her back, its stock behind her shoulder and muzzle pointing down behind her hips. "
      "Keep everything else exactly the same: pose, both hands gripping the black pistol, face, blonde ponytail, vest, suit, shoes, outline and shading."),
 'B':("Change only the rifle and arms: she has spun the black carbine around so its shoulder stock smashes forward at chin height in front of her, "
      "the barrel points back and down past her near hip, both hands grip it. Keep face, ponytail, vest, suit, legs, outline and shading."),
}
name,src=sys.argv[1],sys.argv[2]; seeds=[int(s) for s in sys.argv[3:]]
img=b64url(src); OUT=os.path.join(HERE,'../base/kf')
for i in range(0,len(seeds),2):   # 동시 2개까지
    jobs=[]
    for seed in seeds[i:i+2]:
        t=mcp.text(mcp.tool('edit_image_pixen',{'description':D[name],'image_url':img,'seed':seed}))
        log('keyframe',f'{name} seed{seed} -> {t[:150]}'); jobs.append((seed,jobid(t))); print(seed,t[:80].replace('\n',' '),flush=True)
    for s,j in jobs:
        if j: print('done',s,poll(j,f'{OUT}/{name}-{s}.png')[:60].replace('\n',' '),flush=True)
print(bal())
