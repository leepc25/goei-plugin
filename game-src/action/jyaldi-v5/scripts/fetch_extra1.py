import sys,time,base64
sys.path.insert(0,'.'); import mcp
from sheet import poll
J={'talk':'4ea533fe-314b-453d-8715-b5dce606e22b','cutin51':'d463bd6f-b1b0-48e7-8fc2-06c287e6e904','cutin52':'bc7ef353-0b74-4b34-bc35-0099544d8d39'}
for _ in range(60):
    txt=mcp.text(mcp.tool('get_image',{'job_id':J['talk']}))
    if 'complet' in txt.lower() or 'fail' in txt.lower(): break
    time.sleep(8)
print(txt[:200])
for i in range(5):
    r=mcp.tool('get_image',{'job_id':J['talk'],'index':i}); im=[x for x in r['result']['content'] if x.get('type')=='image']
    if im: open(f'../full/clips/talk2/{i:02d}.png','wb').write(base64.b64decode(im[0]['data']))
for n in ('cutin51','cutin52'): print(n,poll(J[n],f'../full/{n}.png')[:120])
