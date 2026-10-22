# 소환체 기준 그림: 사람 몸 4종은 쟈알디 옆모습 대기 장을 edit_image_pixen으로 바꿈(블라렛과 같은 방식, 256×144 → 위 32 덧대 256×176).
# 맘루크 중기병(말+기수)은 사람 뼈대가 안 맞아 create_image_pixen(256×192, 쟈알디 sheet7 pixen-a 설정)으로.
import sys; sys.path.insert(0,'.')
from common import *
from PIL import Image
SRC=os.path.join(ROOT,'base','blaret-src.png'); OUT=os.path.join(ROOT,'base')
TAIL=' Strict side profile facing right, same pose, size, outline and shading.'
D={'knight':'Make her an armored holy knight: polished silver full plate armor, closed great helm, white tabard with a red cross, longsword in the near hand, kite shield on the far arm.'+TAIL,
   'crusader':'Make her a desert holy warrior man: chainmail under a white robe, white turban wrapped around a pointed helmet, curved sword in the near hand, round shield on the far arm, beard.'+TAIL,
   'highmamluk':'Make her a mamluk elite warrior man: lamellar armor, spiked helmet with mail veil, beard, a bundle of explosive charges strapped to his chest, empty hands.'+TAIL,
   'modernspirit':'Make her a modern soldier man: desert combat fatigues, keffiyeh scarf, bomb vest over the chest, a rocket launcher tube held on the near shoulder with both hands.'+TAIL}
HORSE=('Side-view pixel art sprite for a 1990s arcade belt-scroll game, facing right: a mamluk heavy cavalryman charging on a big armored war horse, '
       'rider in lamellar armor and spiked helmet holding a lance forward, horse with a caparison, galloping pose, whole horse and rider fully visible. '
       'Crisp clean pixel clusters, black outline, transparent background.')
if __name__=='__main__':
    who=sys.argv[1]; seeds=[int(s) for s in sys.argv[2:]] or [81,82,83]
    jobs=[]
    for seed in seeds:
        if who=='horse':
            a=dict(description=HORSE,width=256,height=192,no_background=True,view='side',direction='east',outline='single color black outline',detail='medium detail',seed=seed)
            j,t=submit('create_image_pixen',a,f'base horse seed{seed}')
        else:
            j,t=submit('edit_image_pixen',{'description':D[who],'image_url':b64url(SRC),'seed':seed},f'base {who} seed{seed}')
        jobs.append((seed,j)); print(who,seed,t[:60].replace('\n',' '),flush=True)
    for s,j in jobs:
        if j: print('done',s,poll(j,f'{OUT}/{who}-{s}.png')[:40].replace('\n',' '),flush=True)
