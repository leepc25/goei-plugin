"""Independent read-only pixel diff of raw generation and free hand edits."""
from pathlib import Path
import hashlib,json
from PIL import Image
import numpy as np
HERE=Path(__file__).resolve().parent
FOLDER=HERE.parents[3]/'art-kyuras-resume/game-src/action/kyuras/generated'
BEFORE=FOLDER/'3b131a96-b98f-4c4f-b220-146ce3706ceb'
AFTER=FOLDER/'e09c29fd-cf1e-4ba5-8d5e-7912990b7d74'
rows=[]
for i in range(5):
    paths=[folder/f'{i:02}.png' for folder in (BEFORE,AFTER)]
    images=[np.asarray(Image.open(p).convert('RGBA')) for p in paths]
    assert images[0].shape==images[1].shape==(144,192,4)
    diff=np.any(images[0]!=images[1],axis=2)
    yy,xx=np.where(diff)
    rows.append({'frame':i,'changed_pixels':int(diff.sum()),'bbox':None if not len(xx) else [int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)],'before_sha256':hashlib.sha256(paths[0].read_bytes()).hexdigest(),'after_sha256':hashlib.sha256(paths[1].read_bytes()).hexdigest()})
result={'raw_job_id':BEFORE.name,'free_edit_asset_id':AFTER.name,'frames':rows,'total_changed_pixels':sum(r['changed_pixels'] for r in rows),'note':'Pixel-diff evidence only, not automatic visual approval.'}
(HERE/'kyuras-hand-pixel-diff.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result))
