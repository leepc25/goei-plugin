# 큐라스 기준 그림: 쟈알디 옆모습 기본 대기 장(jyaldi-v5/full/clips/idle/00.png)을 edit_image_pro_flash로 큐라스로 바꿈.
# 자세·캔버스(192×144)·발 바닥선(y=136)·외곽선·음영 단계가 쟈알디와 같게 나오고, 관절 좌표도 쟈알디 idle 첫 장 그대로 쓸 수 있다.
# 사용: python3 base_edit.py <태그> <seed> [ref]   (ref = 기본 이미지 축소본을 참고 그림으로 줌)
import sys,time,base64,re,os,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import mcp
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=os.path.join(ROOT,'..','jyaldi-v5','full','clips','idle','00.png')
REF=os.path.join(ROOT,'base','ref_default_192.png')
b64=lambda p: base64.b64encode(open(p,'rb').read()).decode()
DESC=('Turn this character into a different person, keep the exact same pose, the same side profile facing right, the same size, '
      'the same pixel art style, the same dark outline and the same shading steps. The new person is a thin adult man in his early thirties with a gaunt face '
      'and hollow cheeks, short grey-green hair swept back from the forehead with one loose strand falling over the forehead, short at the sides and back, '
      'nothing on the shoulders or back, a green eye, a faint friendly smile, a black suit with a hip-length single-breasted jacket, white shirt, black necktie, '
      'black trousers, black shoes, bare hands with long fingers, no gloves, no holster, no weapon, nothing in the hands.')
def log(s): open(os.path.join(ROOT,'spend.log'),'a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' base_edit '+s+'\n')
if __name__=='__main__':
    tag,seed=sys.argv[1],int(sys.argv[2]); use_ref='ref' in sys.argv[3:]
    args={'image_base64':b64(SRC),'method':'text','description':DESC,'seed':seed,'no_background':True}
    if use_ref:
        args.update(method='reference',reference_image={'base64':b64(REF),'usage_description':'Appearance of the new man: face, grey-green swept-back hair with one strand on the forehead, black suit, white shirt, black tie, bare hands. Keep the pose and pixel style of the source sprite.'})
    t=mcp.text(mcp.tool('edit_image_pro_flash',args)); log(f'{tag} seed{seed} ref={use_ref} -> {t[:200]}')
    m=re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',t)
    if not m: print('FAIL',t[:500]); sys.exit(1)
    j=m.group(1); print('job',j,flush=True)
    for k in range(80):
        time.sleep(6)
        r=mcp.tool('get_image',{'job_id':j}); txt=mcp.text(r); lo=txt.lower()
        ims=[x for x in r.get('result',{}).get('content',[]) if x.get('type')=='image']
        if ims:
            open(os.path.join(ROOT,'base',f'{tag}.png'),'wb').write(base64.b64decode(ims[0]['data'])); print('saved',tag); log(f'{tag} done'); break
        if 'fail' in lo: print('FAIL',txt[:400]); log(f'{tag} FAIL'); break
