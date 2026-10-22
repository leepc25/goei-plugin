# 최종 스트립 빌더: clips/<대상>/<클립>/NN.png → 효과 지우기(clean) → 쟈알디 정장 톤(tone, 대상별 같은 표) → final/<대상>/<클립>.png(가로 한 줄)
# + final/<대상>/manifest.json(장 수·크기·발바닥·손 좌표와 아래팔 각도). 코드 보정은 fixes.py(장 빼기·순서)에서.
import sys,os,json,math,glob
from PIL import Image
from rig import BODY,to_canvas
from clips import CLIPS
from clean import clean,unspray,bodyonly
from tone import tone,lut
ROOT=os.path.join(os.path.dirname(__file__),'..')
try: from fixes import FIX
except Exception: FIX={}
def ang(e,w):  # 아래팔 방향(엔진 약속: 0 = 위로 세움, 시계 방향 +)
    return round((math.degrees(math.atan2(w[0]-e[0],-(w[1]-e[1])))+360)%360,1)
def build(who,names=None):
    W,H,_,_=BODY[who]; base=Image.open(f'{ROOT}/base/{who}/base.png'); f=lut(base)
    from clean import palette
    pal=palette(base)
    out=f'{ROOT}/final/{who}'; os.makedirs(out,exist_ok=True)
    mp=f'{out}/manifest.json'; man=json.load(open(mp)) if os.path.exists(mp) else {'who':who,'w':W,'h':H,'sole':136,'facing':'east','clips':{}}
    for n,(act,prop,ps) in CLIPS[who].items():
        if names and n not in names: continue
        d=f'{ROOT}/clips/{who}/{n}'; fs=sorted(glob.glob(d+'/[0-9][0-9].png'))
        if len(fs)<len(ps): continue
        fx=FIX.get(f'{who}:{n}',{}); order=fx.get('order',list(range(len(ps))))
        frames=[]; hands=[]
        for i in order:
            c=to_canvas(ps[i],who)
            im,_=clean(Image.open(fs[i]),fire=not fx.get('keepfire'),pal=pal,kp=None if fx.get('noskin') else c)
            if fx.get('bodyonly'): im,_=bodyonly(im,c,fx.get('r',11))
            if who=='burn': im,_=unspray(im,max(c['RIGHT ARM'][0],c['LEFT ARM'][0]))
            im=tone(im,f); frames.append(im)
            hands.append([[round(c['RIGHT ARM'][0]),round(c['RIGHT ARM'][1]),ang(c['RIGHT ELBOW'],c['RIGHT ARM'])],
                          [round(c['LEFT ARM'][0]),round(c['LEFT ARM'][1]),ang(c['LEFT ELBOW'],c['LEFT ARM'])]])
        strip=Image.new('RGBA',(W*len(frames),H))
        for i,im in enumerate(frames): strip.alpha_composite(im,(i*W,0))
        strip.save(f'{out}/{n}.png')
        man['clips'][n]={'frames':len(frames),'action':act,'hands':hands,**({'note':fx['note']} if 'note' in fx else {})}
    json.dump(man,open(mp,'w'),ensure_ascii=False,indent=0)
    return man
if __name__=='__main__':
    who=sys.argv[1]; m=build(who,sys.argv[2:] or None); print(who,len(m['clips']),'clips built')
