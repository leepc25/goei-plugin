# 전체 NPC 클립 뼈대 검사(꺾임 방향·캔버스 밖·뼈 길이) + 미리보기 그림. 사용: python3 npc_check.py [id:클립,...]  -> ../review/skel-<id>.png
import sys,os,math
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE); sys.path.insert(0,os.path.join(HERE,'../../jyaldi-v5/scripts'))
import rig,npc_set,audit_joints
from PIL import Image,ImageDraw
R=os.path.join(HERE,'../review')
def out_of_canvas(p):
    return [k for k,(x,y) in p.items() if not(2<=x+2<=190 and 2<=y+28<=143)]
def sheet(id,names,c):
    s=2; n=max(len(c[k][1]) for k in names)
    im=Image.new('RGBA',(150*s*n,124*s*len(names)),(30,34,40,255)); d=ImageDraw.Draw(im)
    for j,k in enumerate(names):
        for i,p in enumerate(c[k][1]):
            im.alpha_composite(rig.draw(p,None,s).crop((10*s,20*s,160*s,144*s)),(i*150*s,j*124*s))
        d.text((4,j*124*s+4),k,fill=(255,255,0,255))
    im.save(f'{R}/skel-{id}.png')
if __name__=='__main__':
    want={}
    for a in sys.argv[1:]:
        id,ns=a.split(':'); want[id]=ns.split(',')
    nb=0
    for id in npc_set.ALL:
        c=npc_set.clips(id)
        for n,(a,ps) in c.items():
            for i,p in enumerate(ps):
                b=audit_joints.bad(p); o=out_of_canvas(p)
                if b or o: nb+=1; print(id,n,i,b,o[:3])
        if id in want: sheet(id,want[id],c)
    print('문제 장',nb)
