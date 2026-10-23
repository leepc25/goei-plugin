"""Delete only the user's rejected fake-bureau states after durable backups."""
import json, os, urllib.request, urllib.error, zipfile, io
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game-src/art/field/production'
BACK=OUT/'history/rebuild-20261024/deleted-library'

def call(path, method='GET'):
 req=urllib.request.Request('https://api.pixellab.ai/v2/'+path,method=method,headers={'Authorization':'Bearer '+os.environ['PIXELLAB_API_KEY']})
 with urllib.request.urlopen(req,timeout=60) as r:return r.read()

def main():
 BACK.mkdir(parents=True,exist_ok=True)
 if (BACK/'library-before.json').exists():
  raise SystemExit('Deletion audit already exists. Do not repeat name-based deletion: new accepted registrations may now exist. Reconcile only specific unverified old IDs.')
 manifest=json.loads((OUT/'manifest.json').read_text())
 names={a['name'] for a in manifest if a['group']=='fake-bureau'}
 rows=[];offset=0
 while True:
  page=json.loads(call('characters?limit=100&offset='+str(offset)))
  rows.extend(page['characters']);offset+=len(page['characters'])
  if offset>=page['total'] or not page['characters']:break
 (BACK/'library-before.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 targets=[c for c in rows if c['name'] in names]
 for c in targets:
  cid=c['id'];folder=BACK/cid;folder.mkdir(exist_ok=True)
  # Never delete a same-name unrelated test: the recorded description must match the roster.
  a=next(a for a in manifest if a['name']==c['name'])
  assert a['english'] in c.get('prompt',''), (c['name'],'identity mismatch')
  detail=call('characters/'+cid);(folder/'character.json').write_bytes(detail)
  data=call('characters/'+cid+'/zip');z=zipfile.ZipFile(io.BytesIO(data));assert z.testzip() is None
  (folder/'character.zip').write_bytes(data)
  receipt=call('characters/'+cid,'DELETE');(folder/'delete-receipt.json').write_bytes(receipt)
  try:call('characters/'+cid)
  except urllib.error.HTTPError as e:
   assert e.code==404
   (folder/'verification.json').write_text(json.dumps({'id':cid,'name':c['name'],'get_status':404}))
  else:raise RuntimeError('Deletion not verified: '+cid)
  print(json.dumps({'name':c['name'],'id':cid,'deleted':True,'backup_bytes':len(data)},ensure_ascii=False),flush=True)
 print('Verified deletion count:',len(targets))

if __name__=='__main__':main()
