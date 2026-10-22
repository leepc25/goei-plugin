# 클립 생성 일감을 runner 상태에 넣음. 사용: python3 gen.py 대상 [클립...] [--ref base/<대상>/ref.png --refkp json | --base 클립/장]
#   기본 기준 = base/<대상>/base.png + base_kp.json (옆모습 확인된 생성 장과 그 뼈대).
import sys,os,json,base64
from rig import BODY,J,kp
from clips import CLIPS
import runner
ROOT=runner.ROOT
DESC={'dohyeong':'tall muscular man in his late 40s, white hair tied back in a short low ponytail, old scars on the cheek, black sunglasses, grinning, black suit with blue-grey highlights, jacket sleeves rolled up to the elbows showing muscular veined forearms, white shirt, black necktie, black trousers and shoes',
      'seongju':'huge massively built man in his mid 40s, short spiky black hair, stubble beard, black sunglasses, black suit with blue-grey highlights, white shirt, black necktie, black trousers and shoes, blackened steel armor plates bolted on the shoulders and upper arms, ammunition belts across the chest',
      'grunt':'adult man, short black hair, black sunglasses, black suit with blue-grey highlights, white shirt, black necktie, black trousers and shoes, small earpiece wire'}
TAIL_G=', seen strictly from the side in profile facing right, character only, plain transparent background, weapon idle and silent'
TAIL=', seen strictly from the side in profile facing right, character only, no background, no floor, no furniture, no visual effects, no muzzle flash, no fire, no smoke, no sparks, no light or glow'
def frac(kpd,who):
    W,H,_,_=BODY[who]
    return [{'label':k,'x':round(kpd[k][0]/W,4),'y':round(kpd[k][1]/H,4),'z_index':8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5} for k in J]
def enqueue(who,names,ref,refkp,tag=''):
    url='data:image/png;base64,'+base64.b64encode(open(ref,'rb').read()).decode()
    d=DESC.get(who,DESC['grunt'])
    for n in names:
        act,prop,ps=CLIPS[who][n]
        cost=2 if len(ps)==3 else 4 if len(ps)==15 else 3
        args={'description':(d+(', '+prop if prop else '')+(TAIL if who in ('dohyeong','seongju') else TAIL_G))[:1000],'action':act[:100],'direction':'east','first_frame_url':url,
              'first_frame_keypoints':refkp,'keypoints':[kp(p,who) for p in ps],'seed':11}
        runner.add(f'{who}:{n}{tag}','animate_with_skeleton_v3',args,cost,len(ps),f'clips/{who}/{n}{tag}')
if __name__=='__main__':
    a=sys.argv[1:]; who=a[0]; names=[x for x in a[1:] if not x.startswith('--') and not x.endswith(('.png','.json'))]
    if '--ref' in a:
        ref=os.path.join(ROOT,f'base/{who}/ref.png'); kpd=json.load(open(os.path.join(ROOT,f'base/{who}/ref_kp.json'))); tag='@ref'
    else:
        ref=os.path.join(ROOT,f'base/{who}/base.png'); kpd=json.load(open(os.path.join(ROOT,f'base/{who}/base_kp.json'))); tag=''
    enqueue(who,names or list(CLIPS[who]),ref,frac(kpd,who),tag)
    print('queued',who,len(names or CLIPS[who]))
