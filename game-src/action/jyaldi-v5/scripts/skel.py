# 뼈대(animate_with_skeleton_v3) 준비: 기준표 A의 관절 좌표와 동작별 핵심 뼈대. 생성 전 무료 미리보기를 만든다.
# 좌표는 160×112 캔버스 픽셀. 오른쪽(동쪽)을 봄 → RIGHT = 앞쪽(가까운) 팔다리. 그림상 앞에 그려진 앞손·앞발을 RIGHT로 둔다.
import json,sys
from PIL import Image,ImageDraw
W,H=160,112
J=['NOSE','NECK','RIGHT SHOULDER','RIGHT ELBOW','RIGHT ARM','LEFT SHOULDER','LEFT ELBOW','LEFT ARM','RIGHT HIP','RIGHT KNEE','RIGHT LEG','LEFT HIP','LEFT KNEE','LEFT LEG','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
# 기준표 A (전투 자세): 앞손(RIGHT) 머리 높이로 내밀고 뒷손(LEFT) 허리 뒤, 앞발 오른쪽 뒷발 왼쪽
A={'NOSE':(77,30),'NECK':(70,36),'RIGHT SHOULDER':(74,41),'RIGHT ELBOW':(90,46),'RIGHT ARM':(104,40),
   'LEFT SHOULDER':(63,41),'LEFT ELBOW':(48,54),'LEFT ARM':(42,62),
   'RIGHT HIP':(73,62),'RIGHT KNEE':(88,74),'RIGHT LEG':(95,100),'LEFT HIP':(63,62),'LEFT KNEE':(50,84),'LEFT LEG':(37,99),
   'RIGHT EYE':(74,27),'LEFT EYE':(77,26),'RIGHT EAR':(68,28),'LEFT EAR':(70,27)}
def mv(p,**d):  # 관절 덮어쓰기
    q=dict(p); q.update({k.replace('_',' '):v for k,v in d.items()}); return q
def shift(p,dx,dy,keys):
    return {k:((v[0]+dx,v[1]+dy) if k in keys else v) for k,v in p.items()}
HEAD=['NOSE','RIGHT EYE','LEFT EYE','RIGHT EAR','LEFT EAR']
# 강한 스트레이트(3타, 앞손 = RIGHT): 2타(뒷손)에서 손이 바뀜. 낮게 싣기 → 앞발 길게 내딛기 → 앞손이 어깨째 앞으로 끝까지,
# 뒷손(LEFT)은 턱 앞으로 당김, 뒷다리 쭉 펴짐, 상체가 앞무릎 위로
load=shift(mv(A,NECK=(67,39),RIGHT_SHOULDER=(71,44),LEFT_SHOULDER=(60,44),RIGHT_ELBOW=(80,52),RIGHT_ARM=(88,44),LEFT_ELBOW=(56,56),LEFT_ARM=(66,46),
   RIGHT_HIP=(71,66),LEFT_HIP=(61,66),RIGHT_KNEE=(86,78),LEFT_KNEE=(48,86)),-3,4,HEAD)
hit=shift(mv(A,NECK=(97,44),RIGHT_SHOULDER=(104,45),LEFT_SHOULDER=(90,47),RIGHT_ELBOW=(126,43),RIGHT_ARM=(150,42),LEFT_ELBOW=(90,58),LEFT_ARM=(100,46),
   RIGHT_HIP=(86,68),LEFT_HIP=(78,68),RIGHT_KNEE=(112,78),RIGHT_LEG=(122,100),LEFT_KNEE=(60,86),LEFT_LEG=(42,100)),28,10,HEAD)
def lerp(a,b,t): return {k:(round(a[k][0]+(b[k][0]-a[k][0])*t,1),round(a[k][1]+(b[k][1]-a[k][1])*t,1)) for k in J}
CLIPS={'heavy':[load,lerp(load,hit,.35),lerp(load,hit,.75),hit,hit,hit,lerp(hit,A,.25),lerp(hit,A,.5)]}
Z={'LEFT':2,'BODY':5,'RIGHT':8}
def kp(p):
    out=[]
    for k in J:
        z=Z['RIGHT'] if k.startswith('RIGHT') else Z['LEFT'] if k.startswith('LEFT') else Z['BODY']
        out.append({'label':k,'x':round(p[k][0]/W,4),'y':round(p[k][1]/H,4),'z_index':z})
    return out
BONES=[('NECK','NOSE'),('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),
       ('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
def draw(p,base=None,s=4):
    im=Image.new('RGBA',(W*s,H*s),(44,56,62,255))
    if base: im.alpha_composite(base.resize((W*s,H*s),Image.NEAREST))
    d=ImageDraw.Draw(im); d.line([(0,108*s),(W*s,108*s)],fill=(120,130,140,255))
    for a,b in BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([(p[a][0]*s,p[a][1]*s),(p[b][0]*s,p[b][1]*s)],fill=c,width=s)
    for k in J: d.ellipse([p[k][0]*s-s,p[k][1]*s-s,p[k][0]*s+s,p[k][1]*s+s],fill=(255,230,80,255))
    return im
if __name__=='__main__':
    O='../skel'; A_img=Image.open('../keypose/A-pad.png').convert('RGBA')
    draw(A,A_img).save(f'{O}/A-fit.png')
    for n,fr in CLIPS.items():
        strip=Image.new('RGBA',(W*4*(len(fr)+1),H*4))
        strip.alpha_composite(draw(A,A_img),(0,0))
        for i,p in enumerate(fr): strip.alpha_composite(draw(p),((i+1)*W*4,0))
        strip.save(f'{O}/{n}-plan.png')
        json.dump({'first_frame_keypoints':kp(A),'keypoints':[kp(p) for p in fr]},open(f'{O}/{n}-keypoints.json','w'))
    print('ok')
