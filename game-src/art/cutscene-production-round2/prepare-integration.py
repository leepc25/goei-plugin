from pathlib import Path
import json,hashlib,zipfile
R=Path(__file__).resolve().parent
m=json.loads((R/'manifest.json').read_text())
out=R/'integration/environment/c1';out.mkdir(parents=True,exist_ok=True)
mapping=[]
for i,f in enumerate(m['frames'],1):
    source=R/f['file'];data=source.read_bytes();assert hashlib.sha256(data).hexdigest()==f['sha256']
    target=out/f'{i:04d}.png';target.write_bytes(data)
    mapping.append(dict(source=f['file'],runtimeFile=f'c1/{i:04d}.png',sha256=f['sha256'],ms=f['ms']))
(out/'timing.json').write_text(json.dumps(dict(ms=m['playback']['ms']))+'\n')
contract=dict(status='environment-only-not-full-c3',deliveryCommit='eda9a6e4c414fa4f4c316cb3d0f0d0265e288f3f',sourceIndexBase=0,runtimeIndexBase=1,runtimeTestBase='integration/environment/',runtimeTestCuts=[2.4],finalTarget='first_day/c3',environmentDurationMs=2400,requiredCharacterDurationMs=3600,fullC3DurationMs=6000,mergeRule='Copy environment files to c3/0001..0017; append new character segment as0018 onward; concatenate ms arrays and require sum6000. Never replace entire6s cut with this2.4s subset.',subtitleCaveat='Current first_day subtitle at8s starts with empty corridor; character segment begins10.4s and next subtitle10.5s. Main integrator must reconcile speech/timing.',mapping=mapping)
(R/'integration/contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
with zipfile.ZipFile(R/'integration/environment-runtime.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
    for p in sorted((R/'integration/environment').rglob('*')):
        if p.is_file():z.write(p,str(p.relative_to(R/'integration/environment')))
    z.write(R/'integration/contract.json','contract.json')
print('Prepared17 one-based runtime frames,2400ms. Original c3 untouched.')
