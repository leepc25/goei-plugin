# 옆모습으로 나온 생성 장을 기준 그림으로 확정: base.png + 그 장의 뼈대(base_kp.json, 캔버스 픽셀). idle@ref는 idle로 씀.
import sys,os,json,shutil
from rig import to_canvas
from clips import CLIPS
ROOT=os.path.join(os.path.dirname(__file__),'..')
who,clip,i=sys.argv[1],sys.argv[2],int(sys.argv[3])
src=f'{ROOT}/clips/{who}/{clip}@ref/{i:02d}.png'
shutil.copy(src,f'{ROOT}/base/{who}/base.png')
c=to_canvas(CLIPS[who][clip][2][i],who)
json.dump({k:[round(v[0],2),round(v[1],2)] for k,v in c.items()},open(f'{ROOT}/base/{who}/base_kp.json','w'))
if not os.path.exists(f'{ROOT}/clips/{who}/{clip}'): shutil.copytree(f'{ROOT}/clips/{who}/{clip}@ref',f'{ROOT}/clips/{who}/{clip}')
print('base',who,src)
