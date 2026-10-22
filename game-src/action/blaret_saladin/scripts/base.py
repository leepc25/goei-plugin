# 기준 그림: 쟈알디 옆모습 대기 장(full/clips/idle/00)을 edit_image_pixen으로 바꿈 → 자세·외곽선·음영·채도가 쟈알디와 같고
# 관절 좌표(rig idle 0번 장)를 그대로 first_frame_keypoints로 쓸 수 있음. 1회/장.
# 캔버스: 블라렛 256×144(발바닥 y=136, 쟈알디 기준 +39 → x≈96), 살라딘 256×176(+39, +32 → 발바닥 y=168)
import sys; sys.path.insert(0,'.')
from common import *
from PIL import Image
SRC=os.path.join(HERE,'../../jyaldi-v5/full/clips/idle/00.png'); OUT=os.path.join(ROOT,'base')
CANVAS={'blaret':((256,144),(39,0)),'saladin':((256,176),(39,32))}
D={'blaret':("Make her a Catholic battle nun, same side pose, size, outline, shading. "
   "Black veil to the shoulders, thin white forehead band, white collar. "
   "Fitted long-sleeved black habit to the ankles, high side slit showing a pale thigh with a black garter holster and silver pistol. "
   "Ash-blonde straight hair, blunt bangs. Green eyes, slight smile. "
   "Thick grey chain with a silver cross on the chest, wooden rosary on the wrist. No suit, tie or gloves."),
 'saladin':("Make her a huge bearded man: much broader shoulders, thick arms and chest, taller. Same side pose, outline, shading. "
   "Dark brown skin, short black beard, white wrapped turban, no long hair. "
   "Black suit, white shirt, black tie, black shoes. "
   "Curved scimitar in a black scabbard at the hip, assault rifle slung on the back, "
   "ammo pouches and explosive packs strapped across the chest. Bare brown hands.")}
def padded(who):
    (w,h),(ox,oy)=CANVAS[who]; im=Image.new('RGBA',(w,h)); im.alpha_composite(Image.open(SRC).convert('RGBA'),(ox,oy))
    p=os.path.join(OUT,f'{who}-src.png'); im.save(p); return p
if __name__=='__main__':
    who=sys.argv[1]; seeds=[int(s) for s in sys.argv[2:]] or [61,62,63,64]
    img=b64url(padded(who)); jobs=[]
    for seed in seeds:
        j,t=submit('edit_image_pixen',{'description':D[who],'image_url':img,'seed':seed},f'base {who} seed{seed}')
        jobs.append((seed,j)); print(who,seed,t[:90].replace('\n',' '),flush=True)
    for s,j in jobs:
        if j: print('done',s,poll(j,f'{OUT}/{who}-{s}.png')[:60].replace('\n',' '),flush=True)
    print(bal())
