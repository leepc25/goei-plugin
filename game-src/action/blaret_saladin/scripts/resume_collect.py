"""Download completed known jobs only. No API credentials, submit, cancel or retry."""
import hashlib,io,json,re,sys,urllib.request
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]

def response_text(obj):
    obj=obj.get('response',obj)
    return '\n'.join(c.get('text','') for c in obj.get('content',[]) if c.get('type')=='text')

def identity(text):
    m=re.search(r'^job_id: ([a-f0-9-]{36})$',text,re.M)
    if not m:raise ValueError('Missing authoritative job ID')
    return m[1]

def validate(req,receipt,result):
    before=response_text(receipt);after=response_text(result)
    if receipt.get('request_sha256')!=req['request_sha256']:raise ValueError('Request/receipt mismatch')
    if identity(before)!=identity(after):raise ValueError('Job ID mismatch')
    if not re.search(r'^status: completed$',after,re.M):raise ValueError('Job not complete')
    n=int(re.search(r'^frames: (\d+)$',after,re.M)[1])
    if n!=len(req['arguments']['keypoints']):raise ValueError('Frame count mismatch')
    cost=re.search(r'^cost: ([0-9.]+) generations$',before,re.M)
    charged=re.search(r'^charged: ([0-9.]+) generations$',after,re.M)
    if cost and charged and float(cost[1])!=float(charged[1]):raise ValueError('Cost conflict')
    return identity(before),n,float(charged[1]) if charged else float(cost[1]) if cost else None

def collect(key):
    folder=ROOT/'resume'/key
    req=json.loads((folder/'request.json').read_text(encoding='utf-8'));receipt=json.loads((folder/'receipt.json').read_text(encoding='utf-8'));result=json.loads((folder/'result.json').read_text(encoding='utf-8'))
    job,n,cost=validate(req,receipt,result)
    prior=json.loads((folder/'files.json').read_text()) if (folder/'files.json').exists() else {}
    files={}
    for i in range(n):
        p=folder/f'{i:02}.png'
        if p.exists():
            raw=p.read_bytes()
            if p.name in prior and hashlib.sha256(raw).hexdigest()!=prior[p.name]['sha256']:raise ValueError('Existing frame modified; refuse overwrite')
        else:
            raw=urllib.request.urlopen(f'https://api.pixellab.ai/mcp/images/{job}/download?index={i}',timeout=45).read()
            im=Image.open(io.BytesIO(raw));im.load()
            if im.size!=(256,176):raise ValueError('Unexpected canvas')
            p.write_bytes(raw)
        im=Image.open(io.BytesIO(raw)).convert('RGBA');assert im.size==(256,176)
        files[p.name]={'sha256':hashlib.sha256(raw).hexdigest(),'bbox':im.getbbox(),'size':im.size,'job_id':job,'index':i,'alpha_extrema':im.getchannel('A').getextrema()}
    (folder/'files.json').write_text(json.dumps(files,indent=2)+'\n')
    sheet=Image.new('RGBA',(1024,200*((n+3)//4)),'#465265');draw=ImageDraw.Draw(sheet)
    for i in range(n):
        sheet.alpha_composite(Image.open(folder/f'{i:02}.png').convert('RGBA'),(i%4*256,i//4*200+20));draw.text((i%4*256+5,i//4*200+3),str(i),fill='white')
    sheet.save(folder/'contact.png')
    spend=ROOT/'spend.log';old=spend.read_text(encoding='utf-8')
    if f'charged_generations={cost:g}' not in '\n'.join(l for l in old.splitlines() if job in l):
        with spend.open('a',encoding='utf-8') as f:f.write(f'2026-10-22 resume {key} job_id={job} charged_generations={cost:g} source=submission_and_completion input_sha256={req["input_sha256"]} request_sha256={req["request_sha256"]}\n')
    print(json.dumps(dict(key=key,job_id=job,frames=n,charged_generations=cost)))

if __name__=='__main__':collect(sys.argv[1])
