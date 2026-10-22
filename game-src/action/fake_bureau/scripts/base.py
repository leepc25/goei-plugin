# 기준 그림 후보: create_image_pixen, 쟈알디 sheet7 pixen-a와 같은 설정(단색 검정 외곽선, 중간 디테일, 옆모습, 동쪽, 투명).
import sys,os
sys.path.insert(0,os.path.dirname(__file__)); from common import *
STYLE=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body character standing facing right in strict profile. "
       "Black suit rendered as dark charcoal with blue-grey highlights so the body shape reads, crisp clean pixel clusters, single black outline, light from upper left, transparent background, character only. ")
MAN="adult Korean man, black suit jacket and trousers, white shirt, black necktie, black shoes, black sunglasses always on, short black hair, small earpiece wire at the ear. "
C={
 'dohyeong':(104,("Tall broad-shouldered muscular man in his late 40s, about 7 heads tall, white hair slicked back and tied in a short low ponytail, "
   "several old scars across the cheek, black sunglasses, confident grin. Black suit jacket buttoned, white shirt, black necktie, jacket sleeves rolled up to the elbows showing veined forearms, "
   "black trousers and shoes, long Japanese katana in a black scabbard at the waist, left hand resting on the scabbard, right arm relaxed.")),
 'seongju':(128,("Huge massively muscular man in his mid 40s, the largest build, very broad shoulders and thick neck, short spiky black hair, square jaw with stubble, black aviator sunglasses. "
   "Black suit with white shirt and black necktie, blackened steel armor plates bolted over the suit on both shoulders, chest and upper arms, ammunition belts crossed over the chest, small loudspeaker horn mounted on the shoulder plate. "
   "Holding one heavy rotary minigun in each hand, barrels pointing forward and down.")),
 'sword':(96,MAN+"Lean athletic build. Black Japanese katana in a black scabbard at the waist, left hand on the scabbard, right hand near the hilt."),
 'riot':(96,MAN+"Sturdy build. Holding a compact black submachine gun low in both hands, muzzle down."),
 'burn':(96,MAN+"Sturdy build. Two metal fuel tanks strapped on the back, a hose running to a flamethrower nozzle wand held low in both hands."),
}
if __name__=='__main__':
    names=sys.argv[1:] or list(C)
    pend={}
    for n in names:
        size,d=C[n]
        for i,seed in enumerate((901,902,903,904)):
            a=dict(description=STYLE+d,width=size,height=size,no_background=True,view='side',direction='east',
                   outline='single color black outline',detail='medium detail',seed=seed+10*list(C).index(n))
            j,t=submit('create_image_pixen',a,f'base {n}-{i}',1)
            if j: pend[f'{n}-{i}']=(j,n)
    out=os.path.join(ROOT,'base')
    def done(k,j,n):
        r=mcp.tool('get_image',{'job_id':j}); im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{out}/cand-{k}.png','wb').write(base64.b64decode(im[0]['data']))
    wait_all(pend,done,every=8)
    print('spent',spent())
