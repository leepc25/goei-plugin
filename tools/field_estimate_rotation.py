"""Estimate missing own rotation landmarks; never approve or submit animations."""
import argparse,base64,fcntl,hashlib,json,time,zipfile
from PIL import Image,ImageDraw
from field_character_production import OUT,api,atomic
from field_prepare_character_jumps import EDGES

def main():
 p=argparse.ArgumentParser();p.add_argument('slugs',nargs='+');a=p.parse_args()
 with (OUT/'.rotation-estimate.lock').open('a') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  state=json.loads((OUT/'state.json').read_text());ctl=json.loads((OUT/'control.json').read_text())
  for slug in a.slugs:
   c=state['characters'][slug];assert c['ready'] and c['eight_way_visual_reviewed']
   direction=ctl.get('character_direction_overrides',{}).get(slug,{}).get('movement_and_combat','east')
   detail=json.loads((OUT/'motion-inputs'/slug/'character-before.json').read_text());assert detail['id']==c['character_id']
   assert not detail.get('skeletons',{}).get('2d_references',{}).get(direction),'Existing reference: do not estimate unnecessarily'
   root=OUT/'motion-inputs'/slug/('measured-'+direction+'-reference');root.mkdir(exist_ok=True)
   receipt=root/'estimate-response.json';marker=root/'estimate-started.json'
   if not receipt.exists():
    assert not marker.exists(),'Ambiguous paid estimate: inspect before any retry'
    with zipfile.ZipFile(OUT/slug/'character.zip') as z:im=Image.open(z.open('Idle/rotations/'+direction+'.png')).convert('RGBA')
    assert im.size==(128,256)
    canvas=Image.new('RGBA',(256,256));canvas.paste(im,(64,0));canvas.save(root/'first-frame.png')
    b=(root/'first-frame.png').read_bytes()
    atomic(marker,{'slug':slug,'character_id':c['character_id'],'direction':direction,'image_sha256':hashlib.sha256(b).hexdigest(),'started_epoch':time.time(),'expected_generations':0.1})
    result=api('estimate-skeleton',{'image':{'type':'base64','base64':base64.b64encode(b).decode()}})
    atomic(receipt,result)
   result=json.loads(receipt.read_text());points={v['label']:(v['x']*256,v['y']*256) for v in result['keypoints']};assert len(points)==18
   canvas=Image.new('RGBA',(256,256),'#b0589b');canvas.alpha_composite(Image.open(root/'first-frame.png').convert('RGBA'));d=ImageDraw.Draw(canvas)
   for k,l in EDGES:d.line((*points[k],*points[l]),fill='red',width=1)
   for k,(x,y) in points.items():d.ellipse((x-2,y-2,x+2,y+2),fill='yellow')
   canvas.resize((768,768),Image.Resampling.NEAREST).save(root/'overlay.png')
   with (OUT/'.supplemental-usage.lock').open('a') as ledgerlock:
    fcntl.flock(ledgerlock,fcntl.LOCK_EX)
    ledger=OUT/'supplemental-usage.json';rows=json.loads(ledger.read_text());rid='local-sync:'+slug+'-'+direction+'-rotation-estimate'
    if not any(x['record_id']==rid for x in rows):
     rows.append({'record_id':rid,'slug':slug,'slot':'motion-reference','endpoint':'estimate-skeleton','usage':result['usage'],'receipt':str(receipt.relative_to(OUT)),'server_job_id':None});atomic(ledger,rows)
   print(slug,direction,result['usage'],'UNREVIEWED',flush=True)

if __name__=='__main__':main()
