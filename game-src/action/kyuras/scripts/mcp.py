import json,sys,urllib.request,ssl,os
URL='https://api.pixellab.ai/mcp'
def call(method,params=None,id=1):
    body=json.dumps({"jsonrpc":"2.0","id":id,"method":method,"params":params or {}}).encode()
    req=urllib.request.Request(URL,data=body,headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
    ctx=ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt')
    with urllib.request.urlopen(req,context=ctx,timeout=300) as r:
        txt=r.read().decode()
    out=None
    for line in txt.splitlines():
        if line.startswith('data:'): out=json.loads(line[5:])
    if out is None: out=json.loads(txt)
    return out
def tool(name,args):
    r=call('tools/call',{"name":name,"arguments":args})
    return r
if __name__=='__main__':
    m=sys.argv[1]
    if m=='list':
        r=call('tools/list')
        for t in r['result']['tools']:
            print('##',t['name']); print(t.get('description','')[:400].replace('\n',' '))
    elif m=='schema':
        r=call('tools/list')
        for t in r['result']['tools']:
            if t['name']==sys.argv[2]: print(t.get('description')); print(json.dumps(t['inputSchema'],ensure_ascii=False,indent=1))
    elif m=='call':
        r=tool(sys.argv[2],json.loads(sys.argv[3]))
        print(json.dumps(r,ensure_ascii=False,indent=1)[:20000])
def text(r):
    try: return r['result']['content'][0]['text']
    except Exception: return json.dumps(r)[:3000]
