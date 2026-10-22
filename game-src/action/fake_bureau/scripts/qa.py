# 최종 스트립 검수 시트: qa.py 대상 클립... → ../qa/<대상>_<클립>.png (회색 바탕, 한 줄 8장, 바닥선 빨강, 장 번호)
import sys,os,json
from PIL import Image,ImageDraw
from rig import BODY
ROOT=os.path.join(os.path.dirname(__file__),'..')
who=sys.argv[1]; W,H,_,_=BODY[who]; os.makedirs(ROOT+'/qa',exist_ok=True)
man=json.load(open(f'{ROOT}/final/{who}/manifest.json'))
names=sys.argv[2:] or list(man['clips'])
for n in names:
    for vd in [''] + [x+'/' for x in (sys.argv and [])]:
        pass
    st=Image.open(f'{ROOT}/final/{who}/{n}.png').convert('RGBA'); k=st.width//W; per=8; rows=(k+per-1)//per
    sh=Image.new('RGBA',(W*min(k,per),H*rows),(150,155,160,255)); d=ImageDraw.Draw(sh)
    for i in range(k):
        x,y=(i%per)*W,(i//per)*H; sh.alpha_composite(st.crop((i*W,0,i*W+W,H)),(x,y))
        d.line([(x,y+136),(x+W-1,y+136)],fill=(220,90,90,255)); d.rectangle([x,y,x+W-1,y+H-1],outline=(110,110,110,255)); d.text((x+3,y+2),f'{n} {i}',fill=(0,0,0,255))
    sh.resize((sh.width*2,sh.height*2),Image.NEAREST).save(f'{ROOT}/qa/{who}_{n}.png')
print(len(names))
