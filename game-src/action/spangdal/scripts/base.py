# 스팡달 기준 그림 후보: 쟈알디 기준(A, sheet7 pixen-a)과 같은 생성기·캔버스·문장 틀로 톤을 맞춤. 96 캔버스 pixen, 장당 1회.
import sys,time,re,os
sys.path.insert(0,'../../jyaldi-v5/scripts'); import mcp
from sheet import poll
OUT='../base'; os.makedirs(OUT,exist_ok=True)
D=("Side-view pixel art sprite for a 1990s arcade belt-scroll beat-em-up, one full-body low ready stance facing right in strict side profile, we see only the side of her face and body. "
 "Slim adult woman, realistic proportions about 6.5 heads tall, figure about {h} pixels tall, slender light body with narrow shoulders, narrow waist and full chest. "
 "Short wavy nearly black dark purple bob haircut to the jaw, heavy side bangs covering one eye, pale skin, one dull gold eye, faint closed-mouth half smile. "
 "Black fitted skirt suit: hip-length jacket, white shirt, black necktie, knee-length black pencil skirt, black stockings, low black heels, pistol holster on the hip. "
 "Knees slightly bent, weight on the balls of the feet, both empty hands held low in front of the waist with fingers extended straight. "
 "Black suit with blue-grey highlights so the body shape reads, crisp clean pixel clusters, dark outline, transparent background.")
specs=[('i',70,dict(outline='single color black outline',detail='medium detail',seed=731)),
       ('j',70,dict(outline='single color black outline',detail='medium detail',seed=722)),
       ('k',70,dict(outline='single color black outline',detail='medium detail',seed=733)),
       ('l',70,dict(outline='single color black outline',detail='highly detailed',seed=727)),
       ('m',70,dict(outline='single color black outline',detail='medium detail',seed=735)),
       ('n',70,dict(outline='single color black outline',detail='medium detail',seed=736))]
W=88
def log(s): open('../spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' base '+s+'\n')
if __name__=='__main__':
    print('before',mcp.text(mcp.tool('get_balance',{})).split('\n')[1],flush=True)
    jobs=[]
    for n,h,extra in specs:
        a=dict(description=D.format(h=h),width=W,height=W,no_background=True,view='side',direction='east'); a.update(extra)
        t=mcp.text(mcp.tool('create_image_pixen',a)); log(f'{n} h{h} {extra} -> {t[:120]}')
        m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((n,m.group(1) if m else None)); print(n,t[:120].replace('\n',' '),flush=True)
    for n,j in jobs:
        if j: print('done',n,poll(j,f'{OUT}/cand-{n}.png')[:80].replace('\n',' | '),flush=True)
    b=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('after',b); log('after '+b)
