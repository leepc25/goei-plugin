# 대표 자세 시안: 새 기준표 A(Pixen, 160×112로 여백 패딩)에서 animate_image로 짧은 동작. 끝 장 고정 없이 열린 생성.
# 원칙: 동작은 크게·확실하게, 디딤발→허리→어깨→팔, 발은 같은 바닥선. 사용: python3 keypose.py jab [walk ...]
import sys,time,base64,re,os,json
sys.path.insert(0,'.'); import mcp
OUT='../keypose'; A=base64.b64encode(open(f'{OUT}/A-pad.png','rb').read()).decode()
M={
 'jab':(8,'Beat-em-up jab, big and snappy: from the fighting stance she pushes off the back foot and takes a quick half step forward with the front foot, hips turn slightly, the lead shoulder drives forward and the lead fist shoots straight out to full arm extension at head height, upper body leaning into it, then snaps back to the fighting stance. Clear, large motion, not arm-only. Feet stay on the same ground line.'),
 'straight':(8,'Beat-em-up rear straight punch, deeper than a jab: the back foot pushes hard off the floor and pivots, hips rotate strongly, the rear shoulder drives far forward past the lead shoulder, the rear fist extends straight out to full reach, she takes a full step forward with the whole body leaning in, then returns to the fighting stance. Big, decisive motion. Feet stay on the same ground line.'),
 'heavy':(8,'Beat-em-up heavy finishing straight punch with full body weight: she crouches a little to load up, then explodes one long step forward, back foot driving off the floor, hips and shoulders rotating hard, the rear fist driving straight forward with the whole body stretched behind it, front knee deeply bent, holds the extended pose, then recovers. Very big, heavy motion. Feet stay on the same ground line.'),
 'walk':(8,'Walk cycle facing right, one full stride that loops: legs swing clearly forward and back with visible knee bend, arms swing at the shoulders opposite to the legs, upper body upright and steady, hair sways one beat behind, feet stay on the same ground line.'),
 'run':(8,'Hard combat sprint, one full stride that loops: upper body leaning far forward, long powerful strides with knees lifting high, arms bent and pumping strongly opposite to the legs, hair streaming behind, feet on the same ground line.'),
 'jump':(8,'Powerful jump: deep crouch with arms swinging back, explosive push-off with legs fully extended and arms thrown up, then knees tucked high at the top, hair whipping. Big, athletic motion.'),
 'draw':(8,'Draws the pistol from the holster on her right hip with her RIGHT hand in one fast motion and raises it to a one-handed level aim pointing right, body turning side-on, left fist stays up near the chest, ends holding the aim.'),
}
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' keypose '+s+'\n')
def run(n,seed=21):
    c,d=M[n]; t=mcp.text(mcp.tool('animate_image',{'first_frame_base64':A,'frame_count':c,'seed':seed,'action':d}))
    log(f'{n} animate_image {c}f 160x112 -> {t[:200]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); j=m.group(1) if m else None; print(n,t[:200].replace('\n',' '),flush=True)
    if not j: return
    for _ in range(200):
        txt=mcp.text(mcp.tool('get_image',{'job_id':j}))
        if 'complet' in txt.lower(): break
        if 'fail' in txt.lower(): print('FAIL',txt[:300]); return
        time.sleep(8)
    for i in range(c+1):
        r=mcp.tool('get_image',{'job_id':j,'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{OUT}/{n}-{i}.png','wb').write(base64.b64decode(im[0]['data']))
    print('done',n,txt[:150].replace('\n',' | '),flush=True)
if __name__=='__main__':
    b0=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('before',b0)
    for n in sys.argv[1:]: run(n)
    print('after',mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
