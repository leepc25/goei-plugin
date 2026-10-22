# 뼈대 미리보기 시트: ../plan/plan-NN.png (클립 한 줄, 첫 칸 = 기준 그림 + 기준 관절)
import sys,os
from PIL import Image,ImageDraw
import rig_rojemon as R, rig_puppets as PP
BONES=[('NECK','NOSE'),('NECK','RIGHT SHOULDER'),('RIGHT SHOULDER','RIGHT ELBOW'),('RIGHT ELBOW','RIGHT ARM'),('NECK','LEFT SHOULDER'),('LEFT SHOULDER','LEFT ELBOW'),('LEFT ELBOW','LEFT ARM'),
       ('NECK','RIGHT HIP'),('RIGHT HIP','RIGHT KNEE'),('RIGHT KNEE','RIGHT LEG'),('NECK','LEFT HIP'),('LEFT HIP','LEFT KNEE'),('LEFT KNEE','LEFT LEG')]
BASE={'roje':('../base/A-pad.png',R.A_KP,192,144),'kid':('../base/K-pad.png',PP.A_KP['kid'],96,96),'man':('../base/M-pad.png',PP.A_KP['man'],192,144)}
def draw(p,w,h,base=None,s=2,crop=None):
    im=Image.new('RGBA',(w*s,h*s),(40,46,54,255))
    if base: im.alpha_composite(base.resize((w*s,h*s),Image.NEAREST))
    d=ImageDraw.Draw(im)
    for a,b in BONES:
        c=(255,90,90,255) if 'RIGHT' in a+b else (90,170,255,255) if 'LEFT' in a+b else (240,240,240,255)
        d.line([(p[a][0]*s,p[a][1]*s),(p[b][0]*s,p[b][1]*s)],fill=c,width=s)
    d.ellipse([p['NOSE'][0]*s-3,p['NOSE'][1]*s-3,p['NOSE'][0]*s+3,p['NOSE'][1]*s+3],fill=(255,230,80,255))
    return im
if __name__=='__main__':
    os.makedirs('../plan',exist_ok=True)
    allc={**R.CLIPS,**PP.CLIPS}
    names=[a for a in sys.argv[1:]] or list(allc)
    rows=[]
    for n in names:
        b,ps=allc[n]; f,kp,w,h=BASE[b]; base=Image.open(f).convert('RGBA'); s=2 if w>100 else 3
        cw,ch=(110*s,110*s) if w>100 else (w*s,h*s); ox,oy=(0,30*s) if w>100 else (0,0)
        row=Image.new('RGBA',(cw*16,ch),(20,22,26,255))
        row.alpha_composite(draw(kp,w,h,base,s).crop((ox,oy,ox+cw,oy+ch)),(0,0))
        for i,p in enumerate(ps): row.alpha_composite(draw(p,w,h,None,s).crop((ox,oy,ox+cw,oy+ch)),((i+1)*cw,0))
        ImageDraw.Draw(row).text((4,4),n,fill=(255,255,0,255)); rows.append(row)
    for i in range(0,len(rows),10):
        part=rows[i:i+10]; Wd=max(r.width for r in part); sheet=Image.new('RGBA',(Wd,sum(r.height for r in part)))
        y=0
        for r in part: sheet.alpha_composite(r,(0,y)); y+=r.height
        sheet.resize((sheet.width//2,sheet.height//2),Image.NEAREST).save(f'../plan/plan-{i//10:02d}.png')
    print(len(rows),'rows',(len(rows)+9)//10,'sheets')
