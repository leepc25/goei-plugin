# animate_with_skeleton_v3 실행: 기준표 A + skel2 핵심 자세. 사용: python3 skel_run.py punchkeys
import sys,time,base64,re,json
sys.path.insert(0,'.'); import mcp,skel,skel2
A=base64.b64encode(open('../keypose/A-pad.png','rb').read()).decode()
DESC='tall slim adult woman agent, long straight black hair to the waist, pale skin, red eyes, black pant suit with white shirt and black tie, black gloves, black pistol holster on the hip'
JOBS={'punchkeys':('boxing stance, jab, cross, lead power straight',['guard','jab','cross','power'])}
# 3연타 전체 15장: 하체·골반이 먼저, 팔은 늦게(staged). 장 이름 = 저장 파일 이름
def staged(a,b,t):
    out={}
    for k in a:
        if 'HIP' in k or 'KNEE' in k or 'LEG' in k: tt=min(1,t*1.5)
        elif 'ELBOW' in k or k.endswith(' ARM'): tt=t**1.6
        else: tt=min(1,t*1.2)
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
K=skel2.KEY;G=K['guard']
COMBO=[('00guard',G),('01jab-a',staged(G,K['jab'],.5)),('02jab',K['jab']),('03jab-back',staged(K['jab'],G,.5)),
 ('04cross-a',staged(G,K['cross'],.35)),('05cross-b',staged(G,K['cross'],.7)),('06cross',K['cross']),('07cross-back',staged(K['cross'],G,.5)),
 ('08guard',G),('09power-a',staged(G,K['power'],.3)),('10power-b',staged(G,K['power'],.65)),('11power',K['power']),('12power-hold',K['power']),
 ('13power-back',staged(K['power'],G,.45)),('14guard',G)]
skel2.KEY.update({n:p for n,p in COMBO})
JOBS['combo']=('three-punch boxing combo: jab, cross, lead power straight',[n for n,_ in COMBO])
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' skel '+s+'\n')
def run(name,seed=7):
    act,keys=JOBS[name]
    args={'description':DESC,'action':act,'direction':'east','view':'side','first_frame_base64':A,
          'first_frame_keypoints':skel.kp(skel.A),'keypoints':[skel.kp(skel2.KEY[k]) for k in keys],'seed':seed,'no_background':True}
    t=mcp.text(mcp.tool('animate_with_skeleton_v3',args)); log(f'{name} {len(keys)}f -> {t[:200]}'); print(t[:300],flush=True)
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); j=m.group(1) if m else None
    if not j: return
    for _ in range(80):
        txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
        if 'complet' in txt.lower(): break
        if 'fail' in txt.lower(): print('FAIL',txt[:400]); return
        time.sleep(10)
    for i in range(len(keys)):
        r=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'../skel/{name}-{keys[i]}.png','wb').write(base64.b64decode(im[0]['data']))
    print('done',txt[:200].replace('\n',' | '),flush=True)
import skel3
skel2.KEY.update({n:p for n,p in skel3.COMBO+skel3.WALK})
JOBS['combo2']=('three-punch boxing combo stepping forward: jab, cross, lead power straight',[n for n,_ in skel3.COMBO])
JOBS['walk']=('boxing footwork step forward in guard: lead foot steps, rear foot follows',[n for n,_ in skel3.WALK])

if __name__=='__main__':
    print('before',mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
    for n in sys.argv[1:]: run(n)
    print('after',mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
