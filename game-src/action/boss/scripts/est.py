# estimate-skeleton (0.1회): python3 est.py 그림.png → 그림.skel.json
import sys,json,base64,urllib.request,ssl
for f in sys.argv[1:]:
    b=base64.b64encode(open(f,'rb').read()).decode()
    req=urllib.request.Request('https://api.pixellab.ai/v2/estimate-skeleton',data=json.dumps({'image':{'type':'base64','base64':b}}).encode(),headers={'Content-Type':'application/json'})
    r=urllib.request.urlopen(req,context=ssl.create_default_context(cafile='/root/.ccr/ca-bundle.crt'),timeout=120).read().decode()
    open(f.replace('.png','.skel.json'),'w').write(r)
    for k in json.loads(r)['keypoints']: print(f.split('/')[-1],k['label'],round(k['x']*256),round(k['y']*256))
