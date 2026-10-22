# 고른 후보(3/4 대기)를 192×144에 쟈알디 base-idle-side와 같은 자리(몸 중심 x≈57, 발바닥 y=136)로 옮기고,
# 관절 추정(REST estimate-skeleton, 0.1회) → animate_with_skeleton_v3로 옆모습 대기 4장을 뽑아 옆모습 기준 그림을 얻는다(쟈알디 base-idle-side와 같은 방법).
# 사용: python3 profile.py id:후보번호:목표키 ...   결과 ../base/<id>-pad.png, ../base/<id>-pad.kp.json, ../profile/<id>/NN.png
import sys,os,json,base64,time,re,subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import mcp,rig,npc_rig
from PIL import Image
from base import NPC,log
B=os.path.join(HERE,'../base'); OUT=os.path.join(HERE,'../profile')
def pad(id,n):
    im=Image.open(f'{B}/{id}-{n}.png').convert('RGBA'); a=im.split()[3].point(lambda v:255 if v>=128 else 0); bb=a.getbbox()
    cx=(bb[0]+bb[2])//2; out=Image.new('RGBA',(192,144)); out.alpha_composite(im,(57-cx,136-bb[3]))
    out.save(f'{B}/{id}-pad.png'); return out, bb[3]-bb[1]
def estimate(path):
    body=json.dumps({"image":{"type":"base64","base64":base64.b64encode(open(path,'rb').read()).decode()}})
    tmp=path+'.req.json'; open(tmp,'w').write(body)
    r=subprocess.run(['curl','-sS','--max-time','90','-X','POST','https://api.pixellab.ai/v2/estimate-skeleton','-H','Content-Type: application/json','--data','@'+tmp],capture_output=True,text=True)
    os.remove(tmp); d=json.loads(r.stdout); log(f'estimate {os.path.basename(path)} usage {d.get("usage")}')
    kps=d['keypoints']
    # 추정기는 가까운 쪽을 LEFT(z 큼)로 줌 → 우리 약속(가까운 쪽 = RIGHT, z 8)으로 맞바꿈
    out=[]
    for k in kps:
        lab=k['label']
        if lab.startswith('LEFT'): lab='RIGHT'+lab[4:]
        elif lab.startswith('RIGHT'): lab='LEFT'+lab[5:]
        z=8 if lab.startswith('RIGHT') else 2 if lab.startswith('LEFT') else 5
        out.append({'label':lab,'x':round(k['x'],4),'y':round(k['y'],4),'z_index':z})
    order={l:i for i,l in enumerate(rig.J)}; out.sort(key=lambda k:order[k['label']])
    json.dump(out,open(path.replace('.png','.kp.json'),'w')); return out
def run(id,n,h):
    k=h/93; padim,gh=pad(id,n); kp=estimate(f'{B}/{id}-pad.png')
    poses=[npc_rig.anatomic(npc_rig.scale(rig.STAND(b),k)) for b in (0,0.5,1,0.5)]
    look=NPC[id][1].rsplit('.',2)[0]
    args={'description':look+', side view in strict profile facing right, character only, empty transparent background',
          'action':'standing calmly in strict side profile facing right, arms relaxed at the sides, breathing','direction':'east',
          'first_frame_url':'data:image/png;base64,'+base64.b64encode(open(f'{B}/{id}-pad.png','rb').read()).decode(),
          'first_frame_keypoints':kp,'keypoints':[rig.kp(p) for p in poses],'seed':11}
    import pl; return pl.submit('animate_with_skeleton_v3',args,f'profile {id}-{n} gen_h{gh} target{h}')
def fetch(id,j,nf=4):
    d=f'{OUT}/{id}'; os.makedirs(d,exist_ok=True)
    for _ in range(80):
        txt=mcp.text(mcp.tool('get_image',{'job_id':j})).lower()
        if 'complet' in txt: break
        if 'fail' in txt: return 'FAIL '+txt[:200]
        time.sleep(8)
    for i in range(nf):
        r=mcp.tool('get_image',{'job_id':j,'index':i})
        im=[x for x in r['result']['content'] if x.get('type')=='image']
        if im: open(f'{d}/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
    return 'ok'
if __name__=='__main__':
    b0=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('before',b0,flush=True)
    jobs=[]
    for a in sys.argv[1:]:
        id,n,h=a.split(':'); jobs.append((id,run(id,int(n),int(h))))
    for id,j in jobs: print(id,fetch(id,j) if j else 'nojob',flush=True)
    b1=mcp.text(mcp.tool('get_balance',{})).split('\n')[1]; print('after',b1,flush=True); log(f'profile batch {b0} -> {b1}')
