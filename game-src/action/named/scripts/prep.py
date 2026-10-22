# 기준 그림 후보 → ref.png(톤 맞춤) + ref-pad.png(인물 캔버스, 발바닥 = G+DY, 몸 가운데 = X+DX) + ref-kp.json(서 있는 뼈대를 그림에 맞춤) + ref-kp.png(확인)
# 톤: 외곽 어두운 화소 순검정, 채도 sf배(A2 채도 중앙값 0.21 쪽으로), 78색 이하. 사용: python3 prep.py <id> <seed> [sf]
import sys,json,importlib,colorsys,statistics as st
from PIL import Image
CID,SEED=sys.argv[1],sys.argv[2]; SF=float(sys.argv[3]) if len(sys.argv)>3 else 1.0
importlib.import_module('rig_'+CID); import common as c
def stats(im):
    px=[p[:3] for p in im.getdata() if p[3]>0]; hs=[colorsys.rgb_to_hsv(*[q/255 for q in x]) for x in px]
    return dict(n=len(set(px)),s=round(st.median(h[1] for h in hs),3),v=round(st.median(h[2] for h in hs),3),black=sum(1 for x in px if x==(0,0,0)))
def tone(im):
    im=im.convert('RGBA'); out=im.copy(); W,H=im.size; a=im.split()[-1]
    for y in range(H):
        for x in range(W):
            p=im.getpixel((x,y))
            if p[3]<128: out.putpixel((x,y),(0,0,0,0)); continue
            h,s,v=colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])
            edge=any(not(0<=x+dx<W and 0<=y+dy<H) or a.getpixel((x+dx,y+dy))<128 for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)))
            if v<0.16 and (edge or v<0.07): out.putpixel((x,y),(0,0,0,255)); continue
            out.putpixel((x,y),tuple(round(q*255) for q in colorsys.hsv_to_rgb(h,min(1,s*SF),v))+(255,))
    if len(set(out.getdata()))>78:
        al=out.split()[-1]; out=out.convert('RGB').quantize(colors=78,method=Image.Quantize.MEDIANCUT).convert('RGBA'); out.putalpha(al)
    return out
A=Image.open('../../jyaldi-v5/full/A2.png').convert('RGBA'); print('A2',stats(A))
im=Image.open(f'../{CID}/base/cand-{SEED}.png').convert('RGBA'); print('cand',stats(im))
ref=tone(im); print('ref',stats(ref)); ref.save(f'../{CID}/base/ref.png')
bb=ref.split()[-1].getbbox(); body=ref.crop(bb)
pad=Image.new('RGBA',(c.W,c.H),(0,0,0,0)); FY=round(c.G+c.DY); FX=round(c.X+c.DX)
pad.alpha_composite(body,(FX-body.width//2,FY-body.height)); pad.save(f'../{CID}/base/ref-pad.png')
pb=pad.split()[-1].getbbox(); print('pad',pad.size,'bbox',pb,'height',pb[3]-pb[1])
# 서 있는 뼈대 맞추기(백일몽 fitkp와 같은 방식): 골반 x = 아래 절반 몸 가운데, 키 비율로 세로 늘임
p=c.A_KP(); low=pad.crop((0,(pb[1]+pb[3])//2,c.W,pb[3])).split()[-1].getbbox(); cx=(low[0]+low[2])/2
hx=(p['RIGHT HIP'][0]+p['LEFT HIP'][0])/2+c.DX; top=p['NOSE'][1]+c.DY-12*c.K
sy=(FY-pb[1])/(FY-top)
q={k:(v[0]+cx-hx,FY-(FY-(v[1]+c.DY))*sy-c.DY) for k,v in p.items()}
c.set_akp(q); json.dump(c.kp(q),open(f'../{CID}/base/ref-kp.json','w'))
c.draw(q,pad,3).save(f'../{CID}/base/ref-kp.png'); print('fit scale',round(sy,3),'shift',round(cx-hx,1))
