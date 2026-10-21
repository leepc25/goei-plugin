# 심즈식 상황별 옷 기준 그림 (A2를 edit_image_pixen으로 옷만 바꿈) + 말하기 입 벌린 장(기본 대기 0번)
import sys,time,re,base64
sys.path.insert(0,'.'); import mcp
from sheet import poll
KEEP=' Keep the same pose, face, red eyes, body proportions, long black hair and pixel art style.'
O={'pajama':'Change her clothes into loose dark navy pajamas (long-sleeve button shirt and long pants), barefoot, no gloves, no holster, no tie.',
   'workout':'Change her clothes into a black sports tank top and grey training jogger pants with black sneakers, no gloves, no holster, no tie, hair tied in a high ponytail.',
   'towel':'Change her clothes into a white bath towel wrapped around her body from the chest to mid-thigh, bare shoulders, arms and legs, barefoot, no gloves, no holster, no tie, hair damp.'}
def log(s): open('../spend.log','a').write(time.strftime('%H:%M:%S')+' outfits '+s+'\n')
a2='data:image/png;base64,'+base64.b64encode(open('../full/A2.png','rb').read()).decode()
jobs=[]
for k,d in O.items():
    for seed in (61,62):
        t=mcp.text(mcp.tool('edit_image_pixen',{'description':d+KEEP,'image_url':a2,'seed':seed}))
        log(f'{k} seed{seed} -> {t[:120]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append((f'{k}-{seed}',m.group(1) if m else None))
idle='data:image/png;base64,'+base64.b64encode(open('../full/clips/idle/00.png','rb').read()).decode()
t=mcp.text(mcp.tool('edit_image_pixen',{'description':'Her mouth is slightly open as if speaking. Change nothing else: same pose, body, hair, clothes, colors.','image_url':idle,'seed':63}))
log(f'talkopen -> {t[:120]}'); m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t); jobs.append(('talkopen',m.group(1) if m else None))
for s,j in jobs:
    print(s,j,flush=True)
    if j: print('done',s,poll(j,f'../full/outfit-{s}.png')[:80].replace('\n',' '),flush=True)
print(mcp.text(mcp.tool('get_balance',{})).split('\n')[1])
