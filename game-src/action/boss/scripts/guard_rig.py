# 낡은 제복의 경비원 — 늘어난 몸(256×256) 뼈대. 기준 그림 ../guard/base/G1.png (pf11 → tone.py), 관절은 estimate-skeleton 실측에 맞춤.
# 설계 docs/보스_선정안.md 4장 #1. 경봉 = 가까운 손(RIGHT, 생성기가 그렇게 그림), 손전등 = 먼 손(LEFT). 구부정한 장신, 고개가 앞으로 처짐.
import math,brig as R
B=R.Body(thigh=66,shin=58,uarm=40,farm=57,torso=57,G=232,k=2.2,head=R.rot((32,-16),-14.3))
P,lerp,staged,sh,jit=B.P,R.lerp,R.staged,R.sh,R.jit
KNEE_UP,KNEE_FWD,ELB_UP,ELB_OUT,ELB_DOWN=R.KNEE_UP,R.KNEE_FWD,R.ELB_UP,R.ELB_OUT,R.ELB_DOWN
X=97; G=B.G
CLIPS={}
def clip(name,action,poses):
    assert 3<=len(poses)<=15,(name,len(poses)); CLIPS[name]=('side view in profile facing right: '+action,[R.anatomic(p) for p in poses])
# 기준 자세(그림 그대로): 팔 축 늘어뜨림
BASE=P((X,107),14.3,0,0,(105,G),(84,G),('a',124,152),('a',87,134))
def IDLE(b=0,sw=0,tl=0): return P((X+sw,107+b),14.3+sw*.4,0,0,(105,G),(84,G),('a',124+sw,152+b),('a',87+sw,134+b),tilt=tl)
clip('idle','hunched towering guard idles, slow breathing, head sways',[IDLE(0),IDLE(1,1,2),IDLE(2,2,4),IDLE(1,1,2)])
def walkf(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+4,108+2*abs(c)),18,0.1*c,0.2*c,(X+4+30*c,G-10*max(0,-sn)),(X+4-30*c,G-10*max(0,sn)),('r',8-14*c,98),('r',-6+14*c,90),tilt=4)
clip('walk','slow long-legged stalking walk, hunched forward, long arms swaying',[walkf(i/8) for i in range(8)])
# 경봉 2연타: 먼 손 경봉을 뒤로 높이 → 앞으로 내려 벰(1) → 거꾸로 올려 벰(2)
G0=P((X+2,110),16,-0.3,-0.2,(X+26,G),(X-22,G),('r',22,70),('r',16,60))
W1=P((X-6,108),-2,0.8,0.5,(X+26,G),(X-24,G),('r',-30,-40),('r',10,60),le=ELB_UP)
S1=P((X+16,118),34,-0.8,-0.5,(X+44,G),(X-20,G),('r',80,84),('r',-10,70))
W2=P((X+16,118),32,-0.4,-0.3,(X+44,G),(X-20,G),('r',30,100),('r',-10,70))
S2=P((X+18,112),20,0.6,0.4,(X+44,G),(X-20,G),('r',86,-40),('r',-10,66),le=ELB_UP)
clip('combo','two heavy baton strikes with the near hand: huge overhead downward slash, then a rising backhand slash',[G0,staged(G0,W1,.6),W1,S1,W2,S2,lerp(S2,G0,.5),G0])
# 손전등 돌진: 고개 숙여 겨눔 → 크게 내딛는 질주(제자리 순환), 손전등 앞으로 뻗음
def dash(t):
    c=math.cos(2*math.pi*t); sn=math.sin(2*math.pi*t)
    return P((X+8,116+3*abs(c)),34,0.15*c,0.2*c,(X+14+40*c,G-14*max(0,-sn)),(X+14-40*c,G-14*max(0,sn)),('r',-30+20*c,70),('r',92,30),tilt=-8)
AIM=P((X+6,114),26,0.4,0.2,(X+28,G),(X-22,G),('r',-10,70),('r',90,26),tilt=-6)
clip('charge','lowers his head, aims the flashlight forward with the far arm and sprints in huge lunging strides',[G0,AIM,AIM]+[dash(i/6) for i in range(6)])
# 내리치기: 온몸을 위로 늘이며 경봉을 두 손으로 머리 위 → 깊게 쪼그리며 바닥까지 내려찍음
UP=P((X-2,128),-4,0,0,(X+22,G),(X-20,G),('r',10,-60),('r',4,-62),le=ELB_UP,re=ELB_UP,tilt=-10)
DN=P((X+14,150),38,0,0,(X+50,G),(X-24,G),('r',60,96),('r',56,100),lk=KNEE_UP)
clip('slam','stretches his whole body upward lifting the baton overhead with both hands, then smashes it down to the floor in a deep crouch',[G0,staged(G0,UP,.5),UP,UP,staged(UP,DN,.5),DN,DN,lerp(DN,G0,.4),lerp(DN,G0,.75),G0])
# 긴 팔 잡기: 가까운 팔을 끝까지 뻗어 움켜쥐고 가슴으로 끌어당김
RE=P((X+10,112),24,0.8,0.4,(X+34,G),(X-22,G),('r',0,70),('r',98,6))
PU=P((X-2,110),8,0.2,0.1,(X+26,G),(X-22,G),('r',0,70),('r',24,30))
clip('reach','shoots his very long far arm out to full length, grabs, and drags the victim back to his chest',[G0,staged(G0,RE,.5),RE,RE,lerp(RE,PU,.5),PU,PU,G0])
# 경봉 돌려 막기: 먼 손 경봉을 가슴 앞에서 세워 돌림(손목 원)
def tw(a): return P((X,110),12,0.3,0.1,(X+24,G),(X-22,G),('r',30+8*math.cos(a),26+8*math.sin(a)),('r',-6,72),le=('e',8,40))
clip('parry','holds the baton upright in front of his chest and twirls it to deflect blows',[tw(i*math.pi/3) for i in range(6)])
# 호루라기: 가까운 손을 입으로, 고개 젖혀 붊
WH=P((X,108),4,0.3,0,(X+22,G),(X-22,G),('r',-4,74),('r',30,-6),tilt=-14,re=('e',22,30))
clip('whistle','raises the far hand to his mouth and blows a whistle hard, head tilted back',[G0,staged(G0,WH,.5),WH,jit(WH,0,-2,['NOSE','EYE','EAR']),WH,G0])
# 밀기(데스크·회전문): 두 손 낮게 앞으로, 몸을 실어 다리로 밂
PS=P((X+16,124),40,0,0,(X+44,G),(X-30,G),('r',72,40),('r',66,46))
clip('push','leans his whole weight into both hands low in front and shoves forward, legs driving',[G0,staged(G0,PS,.5),PS,sh(PS,6),sh(PS,10),lerp(sh(PS,10),G0,.5)])
HL=P((X-6,108),-6,0.3,0.2,(X+22,G),(X-22,G),('r',10,70),('r',-10,72),tilt=-12)
clip('hit','hit reaction: upper body and head snap back, feet planted',[G0,HL,lerp(HL,G0,.5),G0])
GR=lambda b: P((X+4,150+b),40,0,0,(X+40,G),(X-20,G),('r',40,110),('r',30,110),tilt=10+b,lk=KNEE_UP)
clip('groggy','stunned: dropped to one knee, long arms hanging to the floor, head lolling',[G0,lerp(G0,GR(0),.5),GR(0),GR(2),GR(4),GR(2)])
# ── 3단계(팔 넷): 덧팔 한 쌍은 부위 그림을 엔진이 어깨에 붙임. 뼈대는 원래 두 팔.
def q4(t):
    return P((X+6,112),20,0.6*math.cos(t),0.3*math.cos(t),(X+30,G),(X-22,G),('r',60+20*math.cos(t),30+20*math.sin(t)),('r',60-20*math.cos(t),40-20*math.sin(t)))
clip('quad','furious flurry of alternating overhead baton and flashlight strikes',[q4(i*math.pi/4) for i in range(8)])
CX=lambda a: P((X,114),10,0,0,(X+26,G),(X-22,G),('r',76*math.cos(a),70*math.sin(a)),('r',76*math.cos(-a),70*math.sin(-a)),le=ELB_OUT,re=ELB_OUT)
clip('cross','spreads both long arms and sweeps them across each other in a big X, like scissoring searchlights',[CX(-.9),CX(-.6),CX(-.3),CX(0),CX(.3),CX(.6),CX(.9),G0])
PL=P((X-8,110),-8,0.8,0.5,(X+24,G),(X-26,G),('r',-50,10),('r',-60,0))
PF=P((X+18,116),30,-0.8,-0.5,(X+48,G),(X-20,G),('r',96,10),('r',90,20))
clip('pillar','draws both arms far back over his shoulder, then swings both arms around in a huge horizontal arc',[G0,staged(G0,PL,.5),PL,PL,staged(PL,PF,.4),staged(PL,PF,.8),PF,lerp(PF,G0,.5),G0])
HG=P((X,140),0,0,0,(X+12,G-8),(X-4,G-6),('a',104,8),('a',94,10),le=ELB_UP,re=ELB_UP)
clip('hangslam','hangs from the ceiling by both arms, legs dangling, then drops and smashes down landing in a deep crouch',[HG,sh(HG,0,-3),HG,staged(HG,DN,.5),DN,DN,lerp(DN,G0,.5),G0])
CF=lambda a: P((X,106),2,0,0,(X+24,G),(X-24,G),('r',90*math.cos(a),90*math.sin(a)),('r',-90*math.cos(a),-90*math.sin(a)*.3),le=ELB_OUT,re=ELB_OUT,tilt=-8)
clip('curfew','stands tall with both arms stretched wide, slowly rotating them like a lighthouse beacon',[CF(-.5),CF(-.25),CF(0),CF(.25),CF(.5),CF(.25),CF(0),CF(-.25)])
D1=P((X+4,150),30,0,0,(X+40,G),(X-20,G),('r',40,110),('r',30,110),lk=KNEE_UP,tilt=14)
D2=P((X+20,190),60,0,0,(X+40,G),(X-10,G),('a',200,226),('a',190,228),lk=KNEE_UP,rk=KNEE_UP)
D3=P((130,222),90,0,0,(10,228),(18,230),('a',150,232),('a',140,232))
clip('death','collapses to his knees, then topples face down flat on the floor, long limbs sprawling',[G0,lerp(G0,D1,.5),D1,D1,lerp(D1,D2,.5),D2,lerp(D2,D3,.5),D3,D3])
if __name__=='__main__':
    import sys,os
    from PIL import Image,ImageDraw
    base=Image.open('../guard/base/G1e.png').convert('RGBA'); os.makedirs('../guard/preview',exist_ok=True)
    B.draw(BASE,base,2).save('../guard/preview/base.png')
    rows=[]
    for n,(a,ps) in CLIPS.items():
        row=Image.new('RGBA',(128*(len(ps)+1),128),(30,34,40,255)); row.alpha_composite(B.draw(BASE,base,1).resize((128,128)),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(B.draw(p).resize((128,128)),((i+1)*128,0))
        ImageDraw.Draw(row).text((2,2),n,fill=(255,255,0,255)); rows.append(row)
    w=max(r.width for r in rows); sheet=Image.new('RGBA',(w,128*len(rows)),(20,20,24,255))
    for j,r in enumerate(rows): sheet.alpha_composite(r,(0,j*128))
    sheet.save('../guard/preview/plan.png'); print(len(CLIPS),'clips', sum(len(v[1]) for v in CLIPS.values()),'frames')
# ── 생성 설정 ──
import json as _j,os as _o
_D=_o.path.dirname(_o.path.abspath(__file__))
REF=_o.path.join(_D,'../guard/base/G1e.png')
DESC=('monstrous towering elongated night security guard, faded grey-navy decades-old uniform with brass buttons, peaked cap brim hiding the face in shadow, '
      'pale thin chin, very long thin neck and long arms, both hands empty with long bony pale fingers, black shoes')
_sw={'LEFT':'RIGHT','RIGHT':'LEFT'}
FIRST=[{**k,'label':(_sw[k['label'].split()[0]]+' '+' '.join(k['label'].split()[1:])) if k['label'].split()[0] in _sw else k['label'],
        'z_index':8 if k['label'].startswith('LEFT') else 2 if k['label'].startswith('RIGHT') else 5}
       for k in _j.load(open(_o.path.join(_D,'../guard/base/G1.skel.json')))['keypoints']]
