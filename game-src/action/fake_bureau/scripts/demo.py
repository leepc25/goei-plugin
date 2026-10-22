# 시연판: release/demo/fake-bureau.html (한 파일, 그림 내장). 대상별 전 클립 재생, 일반 요원은 얼굴 변형 고르기, 쟈알디와 키 비교.
import os,json,base64,glob
from rig import BODY
from clips import CLIPS
ROOT=os.path.join(os.path.dirname(__file__),'..')
REPO=os.path.abspath(os.path.join(ROOT,'../../..'))
NAME={'dohyeong':'이도형 부장','seongju':'곽성주 과장','sword':'검사부대','riot':'진압부대','burn':'소각부대'}
KO={'idle':'대기','smoke':'담배','flick':'꽁초 튕기기·턱짓','walk':'걷기','stance':'발도 자세','run':'달리기','vanish':'사라지기','reappear':'나타나며 칼 닦기',
 'cut1':'1타 발도 베기','cut2':'2타 올려베기','cut3':'3타 내려베기','cut4':'4타 회전베기','thrust':'찌르기','launcher':'띄우기','jump':'점프','aircut':'공중 X베기',
 'dashcut':'돌진 일섬','kanpa':'간파 자세','counter':'받아치기','bulletcut':'총알 쳐내기','hamster':'햄스터 안감','sidestep':'깊이 회피','guard':'가드','kick':'앞차기',
 'grab':'멱살 잡기','grabslam':'내리꽂기','laugh':'웃음','namecall':'틀린 이름 부르기','relight':'담배 다시 물기','super_ready':'필살 준비','super_cut':'필살 건물 가르기',
 'super_end':'필살 납도','hit':'맞기','stagger':'휘청','down':'다운','getup':'일어나기','shake':'칼 털기','flee':'퇴장','flee_hurt':'부상 퇴장',
 'intro':'등장','turn':'방향 전환','raise':'겨누기','spinup':'총열 돌리기','fire':'연사','sweep':'훑어 쏘기','overheat':'과열','reload':'재장전','megaphone':'확성기',
 'wall':'방벽','stomp':'발 구르기','charge':'어깨 돌진','swing':'후려치기','doubleswing':'양손 내리찍기','panzer':'판처파우스트','rage':'2단계 분노','hit_front':'정면 맞음',
 'hit_back':'등 맞음','kneel':'무릎 꿇음','kneel_up':'무릎에서 일어남','shove':'밀쳐내기','super_fire':'필살 전탄 발사',
 'alert':'발견','burstin':'난입','chat':'이미 있음(무전)','salute':'경례','grabbed':'잡힘','die':'사망','zigzag':'지그재그 돌진','iai':'돌진 발도','twocut':'2연베기',
 'deflect':'총알 쳐내기','parry':'받아치기','aim':'조준','burst':'점사','kneelfire':'무릎 쏴','flash':'섬광탄','butt':'개머리판','flame':'분사','toss':'소이탄','vent':'밸브 돌리기','burst_die':'연료통 폭발 사망'}
def b64(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
def main():
    data={}
    for who in CLIPS:
        d=f'{ROOT}/final/{who}'
        if not os.path.exists(d+'/manifest.json'): continue
        man=json.load(open(d+'/manifest.json')); vs={'0':{}}
        for vd in sorted(glob.glob(d+'/v*')):
            vs[os.path.basename(vd)[1:]]={}
        clips={}
        for n in CLIPS[who]:
            if n not in man['clips']: continue
            c=man['clips'][n]; clips[n]={'f':c['frames'],'ko':KO.get(n,n),'img':{'0':b64(f'{d}/{n}.png')}}
            for v in vs:
                if v!='0' and os.path.exists(f'{d}/v{v}/{n}.png'): clips[n]['img'][v]=b64(f'{d}/v{v}/{n}.png')
        vnames=json.load(open(d+'/variants.json')) if os.path.exists(d+'/variants.json') else {}
        data[who]={'name':NAME[who],'w':man['w'],'h':man['h'],'clips':clips,'variants':vnames}
    jy=b64(os.path.join(ROOT,'../jyaldi-v5/full/final/idle.png'))
    html=open(os.path.join(os.path.dirname(__file__),'demo_template.html')).read().replace('/*DATA*/null',json.dumps(data,ensure_ascii=False)).replace('/*JY*/""',json.dumps(jy))
    out=os.path.join(REPO,'release/demo/fake-bureau.html'); open(out,'w').write(html); print(out,os.path.getsize(out)//1024,'KB')
if __name__=='__main__': main()
