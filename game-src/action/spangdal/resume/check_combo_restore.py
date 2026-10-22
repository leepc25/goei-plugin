from production_ops import *
import subprocess,io
ROOT=BASE.parents[2];baseline='986d160287a9b6c4c98a5434d86d12507c38f50d'
def old(path):return subprocess.check_output(['git','show',baseline+':'+path],cwd=ROOT)
prefix='game-src/action/spangdal/full/final/'
before=json.loads(old(prefix+'manifest.json'));after=json.loads((BASE/'full/final/manifest.json').read_text(encoding='utf-8'));rows=[]
for clip in ('stab1','slash2','pierce3'):
 a=Image.open(io.BytesIO(old(prefix+clip+'.png'))).convert('RGBA');b=Image.open(BASE/f'full/final/{clip}.png').convert('RGBA');assert a.size==b.size and a.tobytes()==b.tobytes(),clip+' pixels differ'
 for key in ('hands','frames','fps','hits','adv','hold','origin','loop'):assert before['clips'][clip][key]==after['clips'][clip][key],(clip,key)
 assert all('correction' not in s for s in after['clips'][clip]['frameSources'])
 rows.append({'clip':clip,'frames':after['clips'][clip]['frames'],'all_pixels_equal_to_baseline':True,'hands_and_timing_equal':True})
save(BASE/'resume/review/combo-restore-check.json',{'baseline_commit':baseline,'clips':rows,'additional_cost':0,'reason':'User rejected resumed combo; restoration is not a claim of visual improvement.'})
print('All three combo clips match pre-resume pixels, hand metadata and timing')
