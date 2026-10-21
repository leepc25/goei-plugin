# 근거 기반 뼈대(동작근거_쟈알디_무술.md): 뼈 길이를 기준표 A에서 재어 고정하고, 발·손 목표점을 2관절 IK로 푼다.
# 좌표 160×112 픽셀, 오른쪽을 봄. 그림상 앞에 그려진 앞손·앞발 = RIGHT(가까운 쪽), 뒷손·뒷발 = LEFT.
import math,json
from PIL import Image,ImageDraw
import skel
THIGH,SHIN,UARM,FARM,TORSO=22.4,23.4,17,14,26
GROUND=100
def ik(root,target,a,b,pick):
    """두 해 중 pick(mid)이 큰 쪽: 무릎은 앞(x 큰 쪽), 팔꿈치는 아래(y 큰 쪽)"""
    s=[_ik(root,target,a,b,+1),_ik(root,target,a,b,-1)]
    return max(s,key=lambda r:pick(r[0]))
def _ik(root,target,a,b,bend):
    dx,dy=target[0]-root[0],target[1]-root[1]; d=min(math.hypot(dx,dy),a+b-0.01); base=math.atan2(dy,dx)
    c=max(-1,min(1,(a*a+d*d-b*b)/(2*a*d))); ang=base+bend*math.acos(c)
    mid=(root[0]+a*math.cos(ang),root[1]+a*math.sin(ang))
    ex=mid[0]+b*math.cos(math.atan2(target[1]-mid[1],target[0]-mid[0])); ey=mid[1]+b*math.sin(math.atan2(target[1]-mid[1],target[0]-mid[0]))
    return mid,(ex,ey)
def pose(H,lean,s,h,lead_ankle,rear_ankle,lead_hand,rear_hand,head=(5,-7)):
    """H 골반 중심, lean 몸통 앞기울기(도), s 어깨 회전(-1 앞손쪽 앞 ~ +1 뒷손쪽 앞), h 골반 회전, 손 목표: ('chin'|'out'|(dx,dy) 목에서)"""
    r=math.radians(lean); N=(H[0]+TORSO*math.sin(r),H[1]-TORSO*math.cos(r))
    p={'NECK':N}
    p['RIGHT SHOULDER']=(N[0]-6*s+1,N[1]+4); p['LEFT SHOULDER']=(N[0]+6*s-1,N[1]+4)
    p['RIGHT HIP']=(H[0]-5*h,H[1]); p['LEFT HIP']=(H[0]+5*h,H[1])
    nose=(N[0]+head[0],N[1]+head[1]); p['NOSE']=nose
    p['RIGHT EYE']=(nose[0]-3,nose[1]-3); p['LEFT EYE']=(nose[0],nose[1]-4); p['RIGHT EAR']=(nose[0]-8,nose[1]-2); p['LEFT EAR']=(nose[0]-6,nose[1]-3)
    chin=(nose[0]+1,nose[1]+4)
    def hand(side,t):
        sh=p[f'{side} SHOULDER']
        if t=='chin': tgt=chin
        elif t=='out': tgt=(sh[0]+60,sh[1]-1)
        else: tgt=(N[0]+t[0],N[1]+t[1])
        e,w=ik(sh,tgt,UARM,FARM,lambda m:m[1]-0.8*m[0]); p[f'{side} ELBOW']=e; p[f'{side} ARM']=w
    hand('RIGHT',lead_hand); hand('LEFT',rear_hand)
    for side,an in (('RIGHT',lead_ankle),('LEFT',rear_ankle)):
        k,a=ik(p[f'{side} HIP'],an,THIGH,SHIN,lambda m:m[0]); p[f'{side} KNEE']=k; p[f'{side} LEG']=a
    return {k:(round(v[0],1),round(v[1],1)) for k,v in p.items()}
# 전투 대기(스탠스): 발 앞뒤 간격 약 어깨너비(26px), 무릎 살짝, 몸통 곧게(5도), 두 손 얼굴 앞, 뒷발 뒤꿈치 듦(발목 2px 위)
GUARD=pose((69,60),5,-0.8,-0.5,(82,GROUND),(56,GROUND-2),(19,1),'chin')
# 잽 타격: 앞발 6px 내딛음(착지 순간 주먹 닿음), 골반 조금, 앞어깨 앞으로, 뒷손 턱
JAB=pose((73,60),8,-1.2,-0.6,(88,GROUND),(56,GROUND-2),'out','chin')
# 스트레이트 타격: 뒷발 뒤꿈치 크게 들림(발목 4px 위)·무릎 앞으로, 골반·어깨 크게 돌아 뒷어깨가 앞, 몸무게 앞 60%, 머리 앞무릎 위, 앞손 턱
CROSS=pose((76,61),12,1.3,1.0,(86,GROUND),(58,GROUND-4),'chin','out',head=(6,-6))
# 3타 앞손 강한 직선(파워 잽): 앞발 크게 내딛고(20px) 뒷발은 아직 뒤, 골반 되감기, 몸무게 앞발, 골반 낮춤, 뒷손 턱
POWER=pose((84,64),15,-1.4,-0.9,(102,GROUND),(58,GROUND-2),'out','chin',head=(6,-6))
KEY={'guard':GUARD,'jab':JAB,'cross':CROSS,'power':POWER}
if __name__=='__main__':
    O='../skel'; A_img=Image.open('../keypose/A-pad.png').convert('RGBA'); W,H=160,112; s=4
    names=['A']+list(KEY)
    strip=Image.new('RGBA',(W*s*len(names),H*s))
    strip.alpha_composite(skel.draw(skel.A,A_img),(0,0))
    for i,n in enumerate(KEY): strip.alpha_composite(skel.draw(KEY[n]),((i+1)*W*s,0))
    strip.save(f'{O}/punch-keys.png')
    json.dump({k:skel.kp(v) for k,v in KEY.items()}|{'A':skel.kp(skel.A)},open(f'{O}/punch-keys.json','w'))
    import math as m
    for n,p in KEY.items():
        print(n,'thigh',round(m.dist(p['RIGHT HIP'],p['RIGHT KNEE']),1),'reach',round(p['RIGHT ARM'][0]-p['NECK'][0]),round(p['LEFT ARM'][0]-p['NECK'][0]),'top',round(p['LEFT EYE'][1]))
