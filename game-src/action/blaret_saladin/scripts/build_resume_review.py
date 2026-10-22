"""Standalone review only: raw candidate PNGs, preserved old frames, no engine writes."""
import base64,hashlib,io,json,re
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
REPO=ROOT.parents[2]
R=ROOT/'resume'
LABELS={'guns_idle':'쌍권총 준비','stake_finish':'말뚝 내려꽂기','super_ready':'필살 준비','walk':'무장 걷기','run':'무장 달리기','slash1':'첫 내려베기'}

def b64(frames):
    out=Image.new('RGBA',(256*len(frames),176))
    for i,p in enumerate(frames):
        im=Image.open(p).convert('RGBA');assert im.size==(256,176)
        out.alpha_composite(im,(256*i,0))
    b=io.BytesIO();out.save(b,format='PNG')
    return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()

def build():
    data=[];ledger=[]
    reviews=json.loads((R/'review.json').read_text(encoding='utf-8')) if (R/'review.json').exists() else {}
    for folder in sorted(R.iterdir()):
        if not folder.is_dir() or not (folder/'request.json').exists():continue
        req=json.loads((folder/'request.json').read_text(encoding='utf-8'))
        receipt=folder/'receipt.json'
        if receipt.exists():
            obj=json.loads(receipt.read_text(encoding='utf-8')); text=json.dumps(obj)
            job=re.search(r'job_id: ([a-f0-9-]{36})',text);cost=re.search(r'cost: ([0-9.]+) generations',text)
            completion=folder/'result.json'
            charged=re.search(r'charged: ([0-9.]+) generations',completion.read_text(encoding='utf-8')) if completion.exists() else None
            amount=charged or cost
            ledger.append(dict(key=folder.name,job_id=job[1] if job else None,actual_generations=float(amount[1]) if amount else None,estimated_generations=req['estimated_generations'],source='completion_charge' if charged else 'submission_receipt' if cost else 'unconfirmed',input_sha256=req['input_sha256'],request_sha256=req['request_sha256']))
        qa=reviews.get(folder.name,dict(status='검수 대기',notes='사용자 시각 승인 전'))
        if qa.get('exclude_from_demo'):continue
        files=sorted(folder.glob('[0-9][0-9].png'))
        if not files:continue
        assert len(files)==len(req['arguments']['keypoints'])
        old=sorted((ROOT/'clips'/req['character']/req['clip']).glob('*.png'))
        if qa.get('old_source_dir'):old=sorted((R/qa['old_source_dir']).glob('[0-9][0-9].png'))
        if qa.get('source_dir'):
            selected=(R/qa['source_dir']).resolve()
            if not selected.is_relative_to(R.resolve()):raise ValueError('Source outside owner workspace')
            files=sorted(selected.glob('[0-9][0-9].png'))
            assert len(files)==len(req['arguments']['keypoints'])
        order=qa.get('frame_order',list(range(len(files))))
        files=[files[i] for i in order]
        cn=req['character'];c=req['clip'];loop=c in ('guns_idle','walk','run')
        data.append(dict(key=folder.name,name=('블라렛' if cn=='blaret' else '살라딘')+' · '+LABELS[c],frames=len(files),unique_displayed_frames=len({hashlib.sha256(f.read_bytes()).hexdigest() for f in files}),frame_order=order,oldFrames=len(old),img=b64(files),old=b64(old) if old else None,fps=6 if c=='guns_idle' else 10 if c=='walk' else 14,loop=loop,root=qa.get('root_override',req.get('root_motion')),qa=qa,hands=[{p['label']:[round(p['x']*256+qa.get('pixel_dx',[0]*len(req['arguments']['keypoints']))[i],2),round(p['y']*176,2)] for p in req['arguments']['keypoints'][i] if p['label'].endswith(' ARM')} for i in order]))
    manifest={'schema':1,'user_visual_approved':False,'entries':[{**d,'img':None,'old':None} for d in data],'ledger':ledger,'actual_generations':sum(x['actual_generations'] or 0 for x in ledger),'completion_confirmed_generations':sum(x['actual_generations'] or 0 for x in ledger if x['source']=='completion_charge'),'historical_generations':{'reported':171,'per_job_verified':False}}
    (R/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    html=(ROOT/'scripts/resume_review.html').read_text(encoding='utf-8').replace('/*DATA*/[]',json.dumps(data,ensure_ascii=False))
    dest=REPO/'release/demo/blaret-saladin-resume.html';dest.write_text(html,encoding='utf-8')
    print(json.dumps({'html':str(dest),'clips':len(data),'new_frames':sum(d['frames'] for d in data),'actual_generations':manifest['actual_generations'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}))

if __name__=='__main__':build()
