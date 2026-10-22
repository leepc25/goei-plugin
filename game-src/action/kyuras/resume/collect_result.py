"""Collect a completed native MCP result, retaining original images and per-frame proof."""
import argparse,hashlib,json,urllib.request,io
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('clip');args=p.parse_args()
receipt=ROOT/'resume'/(args.clip+'-completed.json')
r=json.loads(receipt.read_text(encoding='utf8'));m=r['structuredContent'];job=m['job_id']
req=json.loads((ROOT/'resume/requests'/(args.clip+'.json')).read_text(encoding='utf8'))
assert m['status']=='completed' and m['frames']==len(req['keypoints'])
folder=ROOT/'generated'/job;folder.mkdir(parents=True,exist_ok=True)
rows=[];frames=[]
for i,url in enumerate(m['download_urls']):
 assert url=='https://api.pixellab.ai/mcp/images/'+job+'/download?index='+str(i)
 target=folder/f'{i:02}.png'
 if not target.exists(): target.write_bytes(urllib.request.urlopen(url,timeout=45).read())
 data=target.read_bytes();im=Image.open(io.BytesIO(data)).convert('RGBA');assert im.size==(192,144) and im.getbbox()
 frames.append(im);rows.append(dict(index=i,file=target.name,sha256=hashlib.sha256(data).hexdigest(),bbox=im.getbbox()))
manifest=dict(clip=args.clip,job_id=job,charged_generations=m['charged_generations'],frames=rows,user_visual_approval=False,status='pending_visual_review')
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
sheet=Image.new('RGB',(1536,308*((len(frames)+3)//4)),(70,80,90));d=ImageDraw.Draw(sheet)
for i,im in enumerate(frames):
 x=(i%4)*384;y=(i//4)*308;im=im.resize((384,288),Image.Resampling.NEAREST);sheet.paste(im,(x,y+20),im);d.text((x+5,y+5),str(i),fill='white')
sheet.save(folder/'sheet.png');print(json.dumps(manifest))
