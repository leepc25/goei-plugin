# 소라 랜드 괴이 등록 (2026-11-16). create-character-pro-flash, 화풍 = 쟈알디 등록 정면.
import sys,json,time,base64,urllib.request,os
sys.path.insert(0,'tools'); import pixellab_gate as G
API='https://api.pixellab.ai/v2'; H={'Authorization':'Bearer x','Content-Type':'application/json'}
OUT='game-src/action/motion3/_monster'
def req(m,p,b=None):
    r=urllib.request.Request(API+p,data=json.dumps(b).encode() if b else None,headers=H,method=m)
    with urllib.request.urlopen(r,timeout=120) as f: return json.loads(f.read())
def bal(): return req('GET','/balance')
STY={'image':{'type':'base64','base64':base64.b64encode(open('game-src/action/motion3/_reg/1.1_쟈알디/south.png','rb').read()).decode(),'format':'png'},
     'size':{'width':128,'height':256},'usage_description':'match this pixel art style only: pixel size, black outline, shading steps and detail level. Not the character, not the colours.'}
C={
 'mascot':('Sora Land mascot (one-eyed cat)',256,256,'full body, a hulking 2-meter amusement park cat mascot costume, oversized round plush head, faded dirty orange plush fur, only one big button eye, the other eye a bare stitched seam, wide stiff plush body, stubby mitten hands and big plush feet, small bow tie, creepy horror theme park'),
 'factory':('Sora Land Factory',256,256,'full body, a gaunt emaciated humanoid monster with a hunched bent spine, bald head, long hanging jaw, grotesquely swollen chest, several extra human torsos grafted chaotically onto its back and sides with their own thin arms, each grafted segment a different skin tone, long bony arms and legs, horror'),
 'silhouette':('Sora Land black silhouette',128,256,'full body, a featureless pitch-black human-shaped silhouette, smooth matte black body with no face and no clothes, slightly uneven lumpy outline like set tar, adult human proportions, horror'),
}
for k in (sys.argv[1:] or list(C)):
    name,w,h,desc=C[k]; os.makedirs(f'{OUT}/{k}',exist_ok=True)
    b0=bal(); G.spend(f'create-character-pro-flash {k}')
    r=req('POST','/create-character-pro-flash',{'description':desc,'name':name,'view':'low top-down','image_size':{'width':w,'height':h},
        'style_image':STY,'style_options':{'color_palette':False,'outline':True,'detail':True,'shading':True},'n_directions':8,'template_id':'mannequin'})
    json.dump(r,open(f'{OUT}/{k}/create.json','w'),ensure_ascii=False,indent=1); print(k,'->',json.dumps(r)[:300],flush=True)
    jid=r.get('background_job_id') or r.get('job_id'); cid=r.get('character_id')
    t0=time.time()
    while jid and time.time()-t0<900:
        time.sleep(10); j=req('GET',f'/background-jobs/{jid}')
        if j.get('status') in ('completed','failed','error'): break
    json.dump(j,open(f'{OUT}/{k}/job.json','w'),ensure_ascii=False,indent=1)
    print(k,'job',j.get('status'),json.dumps(j.get('usage') or j.get('billing_stages') or '')[:300],flush=True)
    c=req('GET',f'/characters/{cid}'); json.dump(c,open(f'{OUT}/{k}/char.json','w'),ensure_ascii=False,indent=1)
    rots=c.get('rotation_urls') or c.get('rotations') or {}
    for dname,u in (rots.items() if isinstance(rots,dict) else []):
        if isinstance(u,str) and u.startswith('http'):
            urllib.request.urlretrieve(u,f'{OUT}/{k}/{dname}.png')
    b1=bal(); print(k,'cid',cid,'bal',b0,'->',b1,flush=True)
    open(f'{OUT}/spend.log','a').write(f"{time.strftime('%m-%d %H:%M:%S')} {k} {cid} bal {json.dumps(b0)} -> {json.dumps(b1)}\n")
