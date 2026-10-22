# 맘루크 중기병 질주: 말은 사람 뼈대가 안 맞아 animate_image(글 설명) 8장. 192×144×8 → 약 7회.
# 결과 ../clips/horse/gallop/NN.png (get_image 0번 = 입력 그대로라 뺌)
import sys; sys.path.insert(0,'.')
from common import *
from sheet import poll
SRC=os.path.join(ROOT,'base','horse192-92.png')
a=dict(first_frame_url=b64url(SRC),action='horse galloping at full speed to the right in a looping gallop cycle, legs reaching and gathering, mane and tail streaming, rider leaning forward with the lance held level, no dust, no effects',frame_count=8,no_background=True,seed=93)
j,t=submit('animate_image',a,'anim horse cost7')
print(t[:200],flush=True)
d=os.path.join(ROOT,'clips','horse','gallop'); os.makedirs(d,exist_ok=True)
print(poll(j,os.path.join(d,'all.png'))[:80],flush=True)
for i in range(1,9):
    for k in range(6):
        try: r=mcp.tool('get_image',{'job_id':j,'index':i}); break
        except Exception: time.sleep(5)
    im=[x for x in r.get('result',{}).get('content',[]) if x.get('type')=='image']
    if im: open(os.path.join(d,f'{i-1:02d}.png'),'wb').write(base64.b64decode(im[0]['data']))
if os.path.exists(os.path.join(d,'all.png')): os.remove(os.path.join(d,'all.png'))
log('anim','horse/gallop done'); print('done gallop',flush=True)
