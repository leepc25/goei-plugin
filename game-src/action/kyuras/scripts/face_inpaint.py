# 기준 그림 얼굴만 다시 그림(inpaint_image_pro_flash, 마스크 밖은 그대로). 사용: python3 face_inpaint.py 입력 태그 seed
import sys,os,time,base64,re
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import mcp
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src,tag,seed=sys.argv[1],sys.argv[2],int(sys.argv[3])
def log(s): open(os.path.join(ROOT,'spend.log'),'a').write(time.strftime('%Y-%m-%d %H:%M:%S')+' face_inpaint '+s+'\n')
args={'image_base64':base64.b64encode(open(src,'rb').read()).decode(),'mask_x':52,'mask_y':40,'mask_width':16,'mask_height':16,
      'description':'pixel art side profile face of a young man in his early thirties facing right, wide friendly grin with the mouth corner turned up, one green eye, smooth skin, thin face, grey-green hair strand on the forehead, same dark outline and shading as the rest of the sprite',
      'seed':seed,'no_background':True}
t=mcp.text(mcp.tool('inpaint_image_pro_flash',args)); log(f'{tag} -> {t[:200]}')
m=re.search(r'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})',t)
if not m: print('FAIL',t[:600]); sys.exit(1)
j=m.group(1)
for k in range(80):
    time.sleep(6); r=mcp.tool('get_image',{'job_id':j}); txt=mcp.text(r)
    ims=[x for x in r.get('result',{}).get('content',[]) if x.get('type')=='image']
    if ims: open(os.path.join(ROOT,'base',tag+'.png'),'wb').write(base64.b64decode(ims[0]['data'])); print('saved',tag); log(tag+' done'); break
    if 'fail' in txt.lower(): print('FAIL',txt[:300]); break
