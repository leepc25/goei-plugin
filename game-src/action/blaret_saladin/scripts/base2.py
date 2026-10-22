# 살라딘 기준 그림 2차: 1차(256×176 캔버스)는 몸이 캔버스를 채우며 164px까지 커지고 3/4 정면 + 칼을 뽑아 듦 → 반려.
# 쟈알디 대기 장을 96×112로 잘라(발바닥 y=110) 넣어 몸 크기를 캔버스로 묶고, 옆모습·칼집을 못 박음.
import sys; sys.path.insert(0,'.')
from common import *
from PIL import Image
SRC=os.path.join(HERE,'../../jyaldi-v5/full/clips/idle/00.png'); OUT=os.path.join(ROOT,'base')
D=("Make her a huge bearded man, broad shoulders, thick arms and chest. Strict side profile facing right, same pose. "
   "Dark brown skin, short black beard, white wrapped turban, no long hair. "
   "Black suit, white shirt, black tie, black shoes. Ammo pouches strapped across the chest. "
   "Curved scimitar sheathed in a black scabbard at the hip, assault rifle slung on the back. Hands empty.")
if __name__=='__main__':
    im=Image.open(SRC).convert('RGBA').crop((10,26,106,138)); p=os.path.join(OUT,'saladin2-src.png'); im.save(p)
    img=b64url(p); jobs=[]
    for seed in [int(s) for s in sys.argv[1:]] or [71,72,73,74]:
        j,t=submit('edit_image_pixen',{'description':D,'image_url':img,'seed':seed},f'base2 saladin seed{seed}')
        jobs.append((seed,j)); print(seed,t[:60].replace('\n',' '),flush=True)
    for s,j in jobs:
        if j: print('done',s,poll(j,f'{OUT}/saladin2-{s}.png')[:40].replace('\n',' '),flush=True)
    print(bal())
