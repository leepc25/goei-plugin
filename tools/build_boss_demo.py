# 보스 시연판: release/demo/goei-boss-demo.html (단일 HTML, 그림은 base64 띠).
# 뼈대 클립 보스는 game-src/action/boss/<폴더>/clips/<클립>/NN.png, 부위 보스는 tools/boss_rigs.js가 부위 그림을 엔진처럼 움직임.
import os,io,json,base64,glob
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B=f'{ROOT}/game-src/action/boss'
def strip(paths):
    ims=[Image.open(p).convert('RGBA') for p in paths]; w,h=ims[0].size
    s=Image.new('RGBA',(w*len(ims),h))
    for i,im in enumerate(ims): s.alpha_composite(im,(i*w,0))
    buf=io.BytesIO(); s.save(buf,'PNG',optimize=True); return 'data:image/png;base64,'+base64.b64encode(buf.getvalue()).decode(),w,h,len(ims)
def img(p):
    return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
# (폴더, 몸 이름, [(단계, 클립, 한글 이름, 반복?)])
SPRITE=[
 ('guard','낡은 제복의 경비원','로비 L3 수호자 · 늘어난 몸 키 약 200',[
   ('2 늘어남','idle','대기',1),('2 늘어남','walk','걷기',1),('2 늘어남','combo','경봉 2연타',0),('2 늘어남','charge','손전등 돌진',1),
   ('2 늘어남','slam','내리치기(충격파)',0),('2 늘어남','reach','긴 팔 잡기',0),('2 늘어남','parry','경봉 돌려 막기',1),('2 늘어남','whistle','호루라기',0),
   ('2 늘어남','push','데스크·회전문 밀기',0),('공통','hit','피격',0),('공통','groggy','그로기',1),
   ('3 팔 넷','quad','4연타',1),('3 팔 넷','cross','교차 원뿔',0),('3 팔 넷','pillar','기둥 휘두르기',0),('3 팔 넷','hangslam','매달려 내려찍기',0),
   ('3 팔 넷','curfew','★통금',1),('공통','death','사망',0)]),
 ('grandma','405호 할머니','재현 아파트 4층 수호자 · 키 약 150',[
   ('1·2','idle','대기',1),('1·2','walk','걷기',1),('1 밥상','invite','밥 권하기',0),('1 밥상','argue','말다툼',1),('2 협공','throw','밥상 던지기',0),
   ('2 협공','spoons','숟가락 세례',1),('2 협공','smack','등짝 스매싱',0),('2 협공','splash','썩은 국 끼얹기',0),('이벤트','freeze','아들딸이 온다(멈춤)',0),
   ('공통','hit','피격',0),('공통','groggy','그로기',1),('전환','lunge','할아버지를 삼킴',0)]),
 ('grandpa','405호 할아버지','재현 아파트 4층 수호자 · 키 약 150',[
   ('1·2','idle','대기',1),('1·2','walk','걷기',1),('1 밥상','argue','말다툼',1),('2 협공','hug','끌어안기',0),('2 협공','squeeze','끌어안은 채 조이기',1),
   ('2 협공','stomp','발 구르기',0),('2 협공','block','문 막기',1),('이벤트','freeze','아들딸이 온다(멈춤)',0),('공통','hit','피격',0),('공통','groggy','그로기',1),('전환','seized','삼켜짐',0)]),
 ('giant','거대 할머니','405호 3단계 · 할아버지를 삼키고 천장에 닿게 커짐',[
   ('3','idle','대기',1),('3','crawl','기어가기',1),('3','slam','식탁째 내려찍기',0),('3','sweep','방 끝까지 쓸기',0),('3','suck','빨아들이기',1),
   ('3','charge','기어 돌진',1),('3','hurl','냉장고 던지기',0),('공통','hit','피격',0),('공통','groggy','그로기',1),('공통','death','사망',0)]),
 ('mom','208호 엄마 · 사람 모습','재현 아파트 2층 · 대화',[('1 부탁','idle','대기',1),('1 부탁','ask','우리 애 못 봤어요?',0),('1 부탁','angry','인내 바닥',1),('끝','happy','받아들임',0)]),
 ('momx','208호 엄마 · 늘어난 모습','턱이 가슴까지 찢어짐 · 키 약 235',[
   ('2','idle','대기',1),('2','walk','걷기',1),('2','bite','턱 찢고 물기',0),('2','pounce','네 발로 달려들기',0),('2','slash','할퀴기',0),
   ('3 검은 벽','breath','숨 참기',1),('공통','hit','피격',0),('공통','groggy','그로기',1)]),
 ('dad','208호 아빠 · 사람 모습','재현 아파트 2층 · 대화',[('1 부탁','idle','대기',1),('1 부탁','ask','애 어디 있어',0),('1 부탁','angry','인내 바닥',1),('끝','happy','받아들임',0)]),
 ('dadx','208호 아빠 · 늘어난 모습','턱이 가슴까지 찢어짐 · 키 약 195',[
   ('2','idle','대기',1),('2','walk','걷기',1),('2','smash','두 주먹 내려치기',0),('2','grabthrow','움켜잡아 던지기',0),('2','block','문 막기',1),
   ('2','stagger','총 맞고 비틀',0),('3 검은 벽','breath','숨 참기',1),('공통','groggy','그로기',1)]),
]
# 소품(그림은 따로, 손목 관절에 붙임). (폴더,클립 또는 '*') → [(부위 폴더, 부위 이름, 손 'RIGHT'=가까운/'LEFT'=먼, 각도 더하기°, 손잡이 x비율, y비율, 배율)]
PROPS={
 ('guard','*'):[('guard','baton','RIGHT',0,.12,.5,1),('guard','flashlight','LEFT',0,.2,.5,1)],
 ('grandma','throw'):[('house','table','RIGHT',90,.5,.2,1)],
 ('giant','slam'):[('house','table','RIGHT',90,.5,.1,1.6)],
 ('giant','hurl'):[('house','fridge','RIGHT',90,.5,.1,1.4)],
}
import sys; sys.path.insert(0,f'{B}/scripts')
def kps(folder,c):
    import importlib
    try: R=importlib.import_module({'guard':'guard_rig','grandma':'grandma_rig','grandpa':'grandpa_rig','giant':'giant_rig','momx':'momx_rig','dadx':'dadx_rig','mom':'mom_rig','dad':'dad_rig'}[folder])
    except Exception: return None
    if c not in R.CLIPS: return None
    out=[]
    for pz in R.CLIPS[c][1]:
        d={k['label']:(round(k['x']*R.B.W,1),round(k['y']*R.B.H,1)) for k in R.B.kp(pz)}
        out.append({k:d[k] for k in ('RIGHT ELBOW','RIGHT WRIST','LEFT ELBOW','LEFT WRIST') if k in d})
    return out
data={'sprites':[], 'jy':img(f'{ROOT}/game-src/action/jyaldi-v5/full/clips/idle/00.png'), 'parts':{}}
missing=[]
for folder,name,sub,clips in SPRITE:
    cs=[]
    for ph,c,kn,loop in clips:
        fs=sorted(glob.glob(f'{B}/{folder}/clips/{c}/*.png'))
        if not fs: missing.append(f'{folder}/{c}'); continue
        u,w,h,n=strip(fs); pr=PROPS.get((folder,c)) or PROPS.get((folder,'*')) or []
        k=kps(folder,c) if pr else None
        cs.append(dict(ph=ph,id=c,name=kn,loop=loop,src=u,w=w,h=h,n=n,props=[list(x) for x in pr] if k else [],kp=k))
    foot=max((Image.open(sorted(glob.glob(f'{B}/{folder}/clips/{c}/*.png'))[0]).getbbox() or (0,0,0,0))[3] for _,c,_,_ in clips if glob.glob(f'{B}/{folder}/clips/{c}/*.png')) if cs else 0
    if cs: data['sprites'].append(dict(id=folder,name=name,sub=sub,clips=cs,foot=foot))
for p in sorted(glob.glob(f'{B}/*/parts/*.png')):
    boss=p.split('/')[-3]; nm=os.path.basename(p)[:-4]
    data['parts'].setdefault(boss,{})[nm]=img(p)
tpl=open(f'{ROOT}/tools/boss_demo_template.html').read()
rigs=open(f'{ROOT}/tools/boss_rigs.js').read() if os.path.exists(f'{ROOT}/tools/boss_rigs.js') else ''
out=tpl.replace('/*DATA*/null',json.dumps(data,ensure_ascii=False)).replace('/*RIGS*/',rigs)
os.makedirs(f'{ROOT}/release/demo',exist_ok=True)
open(f'{ROOT}/release/demo/goei-boss-demo.html','w').write(out)
print('ok',len(out)//1024,'KB; missing',missing)
