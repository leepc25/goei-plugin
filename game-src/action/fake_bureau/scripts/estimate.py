# 후보 그림을 대상 캔버스(발바닥 y=135, 몸 가운데 = 기준 x)에 놓고 관절을 추정(REST estimate-skeleton, 0.1회).
# 추정기는 LEFT/RIGHT를 화면 기준으로 붙이므로, 오른쪽을 볼 때 그림에서 앞(x가 큰 쪽) 팔다리를 RIGHT로 다시 붙인다.
import sys,os,json,base64,io,subprocess
from PIL import Image
from rig import BODY,J
from compare import stats
ROOT=os.path.join(os.path.dirname(__file__),'..')
def place(src,who,ax=None):
    W,H,AX,k=BODY[who]; im=Image.open(src).convert('RGBA'); st=stats(im)
    c=Image.new('RGBA',(W,H)); cx=(st['x0']+st['x1'])//2
    c.alpha_composite(im,(AX-cx if ax is None else ax,135-st['bot'])); return c
def estimate(c):
    W,H=c.size; sq=Image.new('RGBA',(256,256)); oy=(256-H)//2; ox=(256-W)//2; sq.alpha_composite(c,(ox,oy))
    b=io.BytesIO(); sq.save(b,'PNG')
    body=json.dumps({'image':{'type':'base64','base64':base64.b64encode(b.getvalue()).decode()}})
    out=subprocess.run(['curl','-s','-X','POST','https://api.pixellab.ai/v2/estimate-skeleton','-H','Content-Type: application/json','-d','@-'],input=body.encode(),capture_output=True).stdout
    r=json.loads(out); kp={d['label']:(d['x']*256-ox,d['y']*256-oy) for d in r['keypoints']}
    # 앞뒤 다시 붙이기: 팔은 손목 x, 다리는 발목 x가 큰 쪽이 앞(RIGHT)
    def swap(a,b,keys):
        if kp[f'LEFT {a}'][0]>kp[f'RIGHT {a}'][0]:
            for k in keys: kp[f'LEFT {k}'],kp[f'RIGHT {k}']=kp[f'RIGHT {k}'],kp[f'LEFT {k}']
    swap('ARM','ARM',['SHOULDER','ELBOW','ARM']); swap('LEG','LEG',['HIP','KNEE','LEG']); swap('EYE','EYE',['EYE','EAR'])
    return kp,r.get('usage')
if __name__=='__main__':
    who,src=sys.argv[1],sys.argv[2]
    c=place(src,who); os.makedirs(f'{ROOT}/base/{who}',exist_ok=True); c.save(f'{ROOT}/base/{who}/ref.png')
    kp,u=estimate(c); W,H,_,_=BODY[who]
    json.dump({k:[round(v[0],1),round(v[1],1)] for k,v in kp.items()},open(f'{ROOT}/base/{who}/ref_kp.json','w'))
    open(f'{ROOT}/spend.log','a').write(f'estimate {who} cost=0.1 {u}\n'); print(who,u,{k:tuple(round(x) for x in kp[k]) for k in ('NOSE','NECK','RIGHT ARM','LEFT ARM','RIGHT LEG','LEFT LEG')})
