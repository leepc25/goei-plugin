"""Read-only PixelLab MCP calls over the documented HTTP transport."""
import argparse,json,os,urllib.request

def call(name,args):
 assert name in {'list_jobs','wait_for_jobs'}
 req=urllib.request.Request('https://api.pixellab.ai/mcp',data=json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':args}}).encode(),headers={'Authorization':'Bearer '+os.environ['PIXELLAB_API_KEY'],'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
 with urllib.request.urlopen(req,timeout=65) as r:raw=r.read().decode()
 if raw.lstrip().startswith('{'):return json.loads(raw)
 return json.loads(next(line[6:] for line in raw.splitlines() if line.startswith('data: ')))

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('name',choices=['list_jobs','wait_for_jobs']);p.add_argument('--output');a=p.parse_args()
 d=call(a.name,{'include_recent':True} if a.name=='list_jobs' else {'timeout_seconds':45})
 text=json.dumps(d,ensure_ascii=False,indent=2)
 if a.output:
  from pathlib import Path
  Path(a.output).write_text(text+'\n')
 print(text)
