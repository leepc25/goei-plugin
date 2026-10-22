# 클립 장마다 가면 기준점(가까운 눈) 계산 → ../<id>/anchors.json  {클립: [[x,y,확신],...]}
# 출발점 = 뼈대 RIGHT EYE + 인물별 보정(기준 그림에서 잰 실제 눈 - 뼈대 눈), 그 둘레 6px에서 얼굴을 찾아 다듬는다.
# 확신 1 = 그림에서 찾음, 0 = 뼈대만(검수 때 눈으로 확인).
# 사용: python3 anchors.py <id>
import sys,os,json,importlib
from PIL import Image
CID=sys.argv[1]
if CID.startswith('grunt'): os.environ['GRUNT']=CID[-1]; importlib.import_module('rig_grunt')
else: importlib.import_module('rig_'+CID)
import common as c, face
# 기준 그림 위 실제 눈(가까운 쪽) 좌표, 손으로 잼
EYE={'jaheon':(79,43),'haje':(81,59.5),'nasol':(78,61),'minseong':(84,47),'seonghae':(82,62),'grunt_m':(81,53),'grunt_f':(83,60)}
def kpxy(p,k): return p[k][0]+c.DX,p[k][1]+c.DY
ref=json.load(open(f'../base/{CID}/ref-kp.json')); re_=[q for q in ref if q['label']=='RIGHT EYE'][0]
off=(EYE[CID][0]-re_['x']*c.W, EYE[CID][1]-re_['y']*c.H) if CID in EYE else (0,3)
out={}
for n,(_,_,ps) in c.CLIPS.items():
    d=f'../{CID}/clips/{n}'
    if not os.path.isdir(d): continue
    row=[]
    for i,p in enumerate(ps):
        f=f'{d}/{i:02d}.png'
        hx,hy=kpxy(p,'RIGHT EYE'); hx+=off[0]; hy+=off[1]
        r=face.find(Image.open(f).convert('RGBA'),(round(hx),round(hy)),6) if os.path.exists(f) else None
        if r and abs(r[0]-hx)<=4 and abs(r[1]-hy)<=4: row.append([r[0],r[1],1])
        else: row.append([round(hx),round(hy),0])
    out[n]=row
json.dump(out,open(f'../{CID}/anchors.json','w'))
tot=sum(len(v) for v in out.values()); ok=sum(x[2] for v in out.values() for x in v)
print(CID,'clips',len(out),'frames',tot,'found',ok,'offset',[round(o,1) for o in off])
