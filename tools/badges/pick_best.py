from PIL import Image
import json
V={2:['실패_버림/sheet2_0.png','sheet2_r_0.png','sheet2_r2_0.png'],
   3:['실패_버림/sheet3_0.png','sheet3_r_0.png','sheet3_r2_0.png'],
   4:['실패_버림/sheet4_0.png','sheet4_r_fix.png'],
   5:['실패_버림/sheet5_0.png','sheet5_r_0.png','sheet5_r2_0.png']}
ref=Image.open('sheet1_token_0.png').convert('RGBA')
def metrics(im,c,r):
    cell=im.crop((c*64,r*64,c*64+64,r*64+64)); px=cell.load()
    a=cell.getchannel('A'); bb=a.point(lambda v:255 if v>8 else 0).getbbox()
    if not bb: return None
    w,h=bb[2]-bb[0],bb[3]-bb[1]
    # interior hole: transparent pixels inside circle of radius 22 from center
    cx,cy=(bb[0]+bb[2])/2,(bb[1]+bb[3])/2; hole=0; tot=0; sat=0; lum=0; n=0
    for y in range(64):
        for x in range(64):
            p=px[x,y]
            if (x-cx)**2+(y-cy)**2<22**2:
                tot+=1
                if p[3]<128: hole+=1
            if p[3]>128:
                if max(p[:3])-min(p[:3])>40: sat+=1
                lum+=.299*p[0]+.587*p[1]+.114*p[2]; n+=1
    edge = bb[0]==0 or bb[1]==0 or bb[2]==64 or bb[3]==64
    return dict(w=w,h=h,hole=hole/tot,sat=sat,lum=lum/max(n,1),edge=edge)
R=metrics(ref,0,0); rl=sum(metrics(ref,c,r)['lum'] for c in range(8) for r in range(4))/32
out={}
for s,fs in V.items():
    ims=[Image.open(f).convert('RGBA') for f in fs]
    for k in range(32):
        c,r=k%8,k//8; best=None
        for vi,im in enumerate(ims):
            if (s,vi) in {(2,1),(4,0)}: continue
            m=metrics(im,c,r)
            if not m: continue
            score=abs(m['w']-61)+abs(m['h']-60)+m['hole']*200+m['sat']*0.5+abs(m['lum']-rl)*1.0+m['hole']*0
            m['score']=round(score,1); m['v']=vi
            if best is None or score<best['score']: best=m
        out[f'{s}-{k+1}']=best
json.dump(out,open('/tmp/claude-0/sc/pick.json','w'),ensure_ascii=False)
print('ref lum',rl)

from collections import Counter
print(Counter((k.split('-')[0],v['v']) for k,v in out.items()))
for k,v in sorted(out.items(), key=lambda kv:-kv[1]['score'])[:12]: print(k,v)
for s_,fs in V.items():
    ims=[Image.open(f).convert('RGBA') for f in fs]
    sheet=Image.new('RGBA',(512,256),(0,0,0,0))
    for k in range(32):
        v=out[f'{s_}-{k+1}']['v']; c,r=k%8,k//8
        sheet.alpha_composite(ims[v].crop((c*64,r*64,c*64+64,r*64+64)),(c*64,r*64))
    sheet.save(f'sheet{s_}_pick.png')
    bg=Image.new('RGBA',(512,256),(40,44,60,255)); bg.alpha_composite(sheet)
    bg.resize((1536,768),Image.NEAREST).save(f'/mnt/project-files/ui_window/뱃지_{s_}판_골라모음_3배.png')
