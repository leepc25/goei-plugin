import sys,json,time,base64,re,os
sys.path.insert(0,'.'); import mcp
DESC=("Pixel art game sprite for a side-scrolling beat-em-up, one full-body standing idle pose, facing right in a near-profile three-quarter view. "
"Tall adult Korean woman in her thirties, figure exactly 128 pixels tall from top of head to soles, long straight black hair falling to the waist, pale skin, "
"red eyes with the near eye clearly visible as a red dot, calm expressionless face, slim long face. Black fitted two-piece pant suit (jacket and trousers), "
"white dress shirt collar, black necktie, black leather gloves, black dress shoes. Pistol holster on the right hip. Posture straight and composed, weight even, "
"arms relaxed down at the sides with gloved hands visible, both feet flat on one ground line slightly apart, toes pointing right. "
"Clean readable pixel clusters, outlines in a dark hue of each color (no pure black outline), about 14 colors, light from the upper left, "
"transparent background, the whole figure inside the canvas with the soles 16 pixels above the bottom edge.")
PAL=["#15141a","#2a2833","#1c1d24","#2d2f3a","#3f4252","#e8e6e0","#c9c7c0","#f0d6c4","#d4b09a","#d12b3a","#111115","#4a4d56","#8a2430","#6b4a3a"]
W=int(os.environ.get("CANVAS","160"))
def submit(seed,pal):
    args={"description":DESC,"width":W,"height":W,"no_background":True,"seed":seed}
    if pal: args["palette"]=PAL; args["palette_name"]="jyaldi-v5"
    r=mcp.tool('create_image_pro_flash',args); t=mcp.text(r)
    open('spend.log','a').write(f"{time.strftime('%H:%M:%S')} sheet seed={seed} pal={pal} create_image_pro_flash -> {t[:400]}\n")
    m=re.search(r'job_id["\s:]+([0-9a-f-]{36})',t)
    print('seed',seed,'pal',pal,'->',t[:300].replace('\n',' | '))
    return m.group(1) if m else None
def poll(job,out):
    for _ in range(90):
        r=mcp.tool('get_image',{'job_id':job}); txt=mcp.text(r)
        imgs=[c for c in r.get('result',{}).get('content',[]) if c.get('type')=='image']
        if imgs:
            open(out,'wb').write(base64.b64decode(imgs[0]['data'])); return txt
        if 'fail' in txt.lower() or 'error' in txt.lower(): return 'ERR '+txt[:300]
        time.sleep(8)
    return 'timeout'
if __name__=='__main__':
    specs=[(101,False),(102,False),(103,True)] if len(sys.argv)<2 else [(int(s.split(':')[0]), s.endswith(':p')) for s in sys.argv[1:]]
    jobs=[(s,p,submit(s,p)) for s,p in specs]
    for s,p,j in jobs:
        if not j: print('no job for',s); continue
        t=poll(j,f'sheet/cand-{s}{"p" if p else ""}.png'); print('done',s,t[:200].replace('\n',' | '))
    print(mcp.text(mcp.tool('get_balance',{})))
