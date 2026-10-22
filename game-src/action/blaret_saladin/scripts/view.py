# 뼈대 미리보기 확대판: python3 view.py <캐릭터> [클립...] → ../plan/v-<캐릭터>-<n>.png (클립 5개씩, 장마다 x 30~210 잘라 3배)
import sys,os
sys.path.insert(0,'.'); import bsrig,rig
from PIL import Image,ImageDraw
cn=sys.argv[1]; ch=bsrig.CHARS[cn]; names=sys.argv[2:] or list(ch['clips'])
X0,X1,S=30,210,3; w=(X1-X0)*S; h=bsrig.CH*S
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../plan')
def fr(p):
    im=Image.new('RGBA',(w,h),(30,34,40,255)); d=ImageDraw.Draw(im)
    q={k:((v[0]+bsrig.OX-X0)*S,(v[1]+bsrig.OY)*S) for k,v in bsrig.scaled(p,ch['scale']).items()}
    d.line([(0,(rig.G+bsrig.OY)*S),(w,(rig.G+bsrig.OY)*S)],fill=(90,90,90,255))
    for a,b in rig.BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([q[a],q[b]],fill=c,width=4)
    d.ellipse([q['NOSE'][0]-6,q['NOSE'][1]-6,q['NOSE'][0]+6,q['NOSE'][1]+6],fill=(255,230,80,255))
    return im
for g in range(0,len(names),5):
    grp=names[g:g+5]; mx=max(len(ch['clips'][n][2]) for n in grp)
    sheet=Image.new('RGBA',(w*mx,h*len(grp)),(20,20,24,255))
    for r,n in enumerate(grp):
        for i,p in enumerate(ch['clips'][n][2]): sheet.alpha_composite(fr(p),(i*w,r*h))
        ImageDraw.Draw(sheet).text((6,r*h+6),n,fill=(255,255,0,255))
    sheet=sheet.resize((sheet.width//3,sheet.height//3),Image.LANCZOS)
    sheet.save(f'{OUT}/v-{cn}-{g//5}.png')
print('ok',len(names))
