from production_ops import *
p=PROD/'combat-exact-r2';req=json.loads((p/'request.json').read_text(encoding='utf-8'));changes=json.loads(req['argv'][3])[0]['pixels'];a=np.array(Image.open(p/'input.png').convert('RGBA'));b=np.array(Image.open(p/'result-00.png').convert('RGBA'));expected=a.copy()
for x,y,old,new in changes:
 assert '#'+bytes(a[y,x]).hex()==old
 expected[y,x]=list(bytes.fromhex(new[1:]))
assert np.array_equal(expected,b),'service output differs from guarded patch'
manifest=json.loads((BASE/'full/final/manifest.json').read_text(encoding='utf-8'))
hs=manifest['clips']['execute']['hands'];assert len({tuple(hs[i][0]) for i in range(1,6)})==1,'holding hand drift'
g=np.array(Image.open(BASE/'resume/corrected/grabstab/02.png').convert('RGBA'));assert not g[73:80,106:122,3].any(),'third arm remains'
for clip in ('execute','spineup','throw','toss','grabstab','super'):
 meta=manifest['clips'][clip];assert len(meta['hands'])==meta['frames']
 for h in meta['hands']:
  assert all(0<=w[0]<192 and 0<=w[1]<144 for w in h)
save(BASE/'resume/review/combat-check.json',{'exact_patch_pixels':len(changes),'unlisted_pixels_unchanged':True,'execute_holding_hand_fixed_frames':[1,2,3,4,5],'grabstab_third_arm_region_empty':True,'metadata_frames_match':True,'additional_paid_cost':0,'user_visual_approval':False})
print('Exact pixels, fixed holding wrist, removed third arm, hand metadata: passed')
