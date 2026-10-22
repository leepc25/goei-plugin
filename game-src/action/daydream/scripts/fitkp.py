# 기준 그림에 서 있는 자세(A_KP)를 맞춰 ref-kp.json 저장 + 겹친 확인 그림. 사용: python3 fitkp.py <id> [dx] [dy]
import sys,json,os,importlib
from PIL import Image
CID=sys.argv[1]
if CID.startswith('grunt'): os.environ['GRUNT']=CID[-1]; importlib.import_module('rig_grunt')
else: importlib.import_module('rig_'+CID)
import common as c
im=Image.open(f'../base/{CID}/ref-pad.png').convert('RGBA'); bb=im.split()[-1].getbbox()
p=c.A_KP(); dx=float(sys.argv[2]) if len(sys.argv)>2 else 0; dy=float(sys.argv[3]) if len(sys.argv)>3 else 0
# 골반 x를 그림 몸통 가운데(아래 절반 bbox 가운데)에 맞춤
low=im.crop((0,(bb[1]+bb[3])//2,192,bb[3])).split()[-1].getbbox(); cx=(low[0]+low[2])/2
hx=(p['RIGHT HIP'][0]+p['LEFT HIP'][0])/2+c.DX
# 머리 꼭대기: 코 y - 0.6*머리 크기
top=p['NOSE'][1]+c.DY-12*c.K
sy=(136-bb[1])/(136-top)
q={k:(v[0]+cx-hx+dx,136-(136-(v[1]+c.DY))*sy+dy-c.DY) for k,v in p.items()}
c.set_akp(q)
json.dump(c.kp(q),open(f'../base/{CID}/ref-kp.json','w'))
c.draw(q,im,4).save(f'../base/{CID}/ref-kp.png'); print(CID,'scale',round(sy,3),'shift',round(cx-hx,1))
