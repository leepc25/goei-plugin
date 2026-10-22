# 기준 그림 고치기(edit_image_pixen, 1회). 사용: python3 edit.py <kind> <in.png 이름> <out.png 이름> "<지시>" [seed]
import sys,os,time,re,base64
sys.path.insert(0,os.path.dirname(__file__)); import mcp
from base import poll,ROOT
k,src,dst,ins=sys.argv[1:5]; seed=int(sys.argv[5]) if len(sys.argv)>5 else 7
p=f'{ROOT}/{k}/{src}'
a={'description':ins,'image_url':'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode(),'seed':seed}
for i in range(100):
    t=mcp.text(mcp.tool('edit_image_pixen',a))
    if 'rate limit' in t.lower() or 'concurren' in t.lower(): time.sleep(15); continue
    break
open(f'{ROOT}/spend.log','a').write(time.strftime('%Y-%m-%d %H:%M:%S')+f' edit {k} {dst} -> {t[:100]}\n')
j=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t).group(1)
poll({f'{ROOT}/{k}/{dst}':j})
