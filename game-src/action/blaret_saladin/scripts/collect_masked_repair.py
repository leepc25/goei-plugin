"""Verify masked sheet repair, restore four native canvases, never alter raw inputs."""
import hashlib,json,re,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
from resume_collect import identity,response_text
ROOT=Path(__file__).resolve().parents[1]
FOLDER=ROOT/'resume/blaret-guns_idle-inpaint'

def main():
    request=json.loads((FOLDER/'request.json').read_text());rc=json.loads((FOLDER/'receipt.json').read_text());result=json.loads((FOLDER/'result.json').read_text())
    text=response_text(result);job=identity(text)
    assert job==identity(response_text(rc)) and 'status: completed' in text
    assert request['request_sha256']==rc['request_sha256']
    candidate=FOLDER/('sheet-exact.png' if (FOLDER/'sheet-exact.png').exists() else 'sheet.png')
    src=np.array(Image.open(FOLDER/'input.png').convert('RGBA'));mask=np.array(Image.open(FOLDER/'mask.png').convert('L'))>0;new=np.array(Image.open(candidate).convert('RGBA'))
    assert new.shape==src.shape==(256,256,4)
    changed=np.any(new!=src,axis=2)
    visible=(new[:,:,3]>0)|(src[:,:,3]>0)
    audit=dict(job_id=job,outside_mask_raw_changes=int((changed&~mask).sum()),outside_mask_visible_changes=int((changed&~mask&visible).sum()),changed_pixels=int(changed.sum()),input_sha256=hashlib.sha256((FOLDER/'input.png').read_bytes()).hexdigest(),output_sha256=hashlib.sha256((FOLDER/'sheet.png').read_bytes()).hexdigest())
    audit['candidate']=candidate.name
    audit['output_sha256']=hashlib.sha256(candidate.read_bytes()).hexdigest()
    (FOLDER/('exact-mask-audit.json' if candidate.name=='sheet-exact.png' else 'mask-audit.json')).write_text(json.dumps(audit,indent=2)+'\n')
    if audit['outside_mask_visible_changes']:raise ValueError('Visible change outside mask; reject and keep evidence')
    out=FOLDER/'restored';out.mkdir(exist_ok=True);files={};sheet=Image.new('RGBA',(1024,200),'#465265');d=ImageDraw.Draw(sheet)
    for i in range(4):
        old=Image.open(ROOT/'resume/blaret-guns_idle'/f'{i:02}.png').convert('RGBA');bbox=old.getbbox();assert bbox[0]>=64 and bbox[1]>=48 and bbox[2]<=192 and bbox[3]<=176
        im=old.copy();x=i%2*128;y=i//2*128;im.paste(Image.fromarray(new[y:y+128,x:x+128]),(64,48));p=out/f'{i:02}.png';im.save(p)
        files[p.name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source_frame':i,'job_id':job};sheet.alpha_composite(im,(i*256,20));d.text((i*256+5,3),str(i),fill='white')
    (out/'files.json').write_text(json.dumps(files,indent=2)+'\n');sheet.save(FOLDER/'contact.png')
    m=re.search(r'charged: ([0-9.]+) generations',text)
    cost=float(m[1]) if m else None
    if cost is not None:
        spend=ROOT/'spend.log'
        if job not in spend.read_text(encoding='utf-8'):
            with spend.open('a',encoding='utf-8') as f:f.write(f'2026-10-22 masked-repair blaret/guns_idle job_id={job} charged_generations={cost:g} input_sha256={request["input_sha256"]} mask_sha256={request["mask_sha256"]} source=completion_charge\n')
    print(json.dumps({**audit,'charged_generations':cost}))

if __name__=='__main__':main()
