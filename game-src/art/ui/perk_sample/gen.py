# 퍽 뱃지 견본 (픽토그램 그림체, 2026-10-30). PixelLab generate-image-v2. 결과는 지우지 않는다.
import json,urllib.request,time,base64,sys
API="https://api.pixellab.ai/v2"
STYLE=("pixel art game perk badge icon, safety sign pictogram style: a simple faceless white stick-figure person "
       "drawn like an ISO safety symbol, flat colors, thick dark outline, centered on a round badge with a {rim} metal rim, "
       "dark navy badge background, no text, crisp clean pixels")
jobs={
 'backstab':("silver","the figure sneaks behind another figure and stabs its back with a knife, motion lines"),
 'undying':("gold","the figure rising up from lying on the ground, a counter-clockwise rewind arrow around it"),
 'triplejump':("silver","the figure jumping upward with three small arc trails under its feet stacked in steps"),
 'extrashot':("silver","the figure aiming a pistol, two bullets flying side by side from the muzzle"),
 'vitality':("silver","the figure standing proud with a big plus-shaped heart on its chest"),
 'reckless':("half silver half red","the figure charging forward with a cracked shield, sweat drops, aggressive pose"),
}
def post(p,b):
  r=urllib.request.Request(API+p,data=json.dumps(b).encode(),headers={"Content-Type":"application/json"})
  return json.load(urllib.request.urlopen(r,timeout=60))
def get(p): return json.load(urllib.request.urlopen(API+p,timeout=60))
ids={}
for k,(rim,d) in jobs.items():
  try:
    res=post('/generate-image-v2',{"description":STYLE.format(rim=rim)+". "+d,"image_size":{"width":64,"height":64},"no_background":True})
    ids[k]=res.get('background_job_id') or res.get('job_id') or res.get('id'); print(k,json.dumps(res)[:200],flush=True)
  except urllib.error.HTTPError as e: print(k,e.code,e.read()[:400],flush=True)
json.dump(ids,open('jobs.json','w'))
for k,j in ids.items():
  for _ in range(60):
    r=get(f'/background-jobs/{j}')
    st=r.get('status')
    if st in('completed','failed','error'): break
    time.sleep(5)
  json.dump(r,open(f'{k}.json','w'))
  imgs=(r.get('last_response') or r.get('result') or r).get('images') or []
  print(k,st,len(imgs),list(r.keys()),flush=True)
  for i,im in enumerate(imgs):
    b=im.get('base64') if isinstance(im,dict) else im
    if b and ',' in b[:40]: b=b.split(',',1)[1]
    if b: open(f'{k}_{i}.png','wb').write(base64.b64decode(b))
