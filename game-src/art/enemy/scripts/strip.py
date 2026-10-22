# 장 이어 보기: python3 strip.py <kind> [clip...] → ../review/<kind>.png (3배, 발바닥 줄 빨강)
import sys,os,glob
from PIL import Image,ImageDraw
sys.path.insert(0,os.path.dirname(__file__))
from defs import M
ROOT=os.path.join(os.path.dirname(__file__),'..')
k=sys.argv[1]; W,H=M[k]['canvas']; sc=int(os.environ.get('SC','3'))
clips=sys.argv[2:] or sorted(os.listdir(f'{ROOT}/{k}/clips'))
rows=[]
for c in ['base']+clips:
    fs=[f'{ROOT}/{k}/base.png'] if c=='base' else sorted(glob.glob(f'{ROOT}/{k}/clips/{c}/[0-9][0-9].png'))
    if not fs: continue
    row=Image.new('RGBA',(W*sc*max(1,len(fs)),H*sc+14),(58,66,72,255)); d=ImageDraw.Draw(row)
    for i,f in enumerate(fs):
        row.alpha_composite(Image.open(f).convert('RGBA').resize((W*sc,H*sc),Image.NEAREST),(i*W*sc,14))
        d.line([(i*W*sc,14+(M[k]['foot']+1)*sc),((i+1)*W*sc-2,14+(M[k]['foot']+1)*sc)],fill=(220,70,70,255)); d.line([(i*W*sc,14),(i*W*sc,14+H*sc)],fill=(30,30,30,255))
    d.text((4,1),c,fill=(255,255,0,255)); rows.append(row)
w=max(r.width for r in rows); im=Image.new('RGBA',(w,sum(r.height for r in rows)),(30,30,30,255)); y=0
for r in rows: im.alpha_composite(r,(0,y)); y+=r.height
os.makedirs(f'{ROOT}/review',exist_ok=True); out=f'{ROOT}/review/{k}{"_"+"_".join(sys.argv[2:]) if sys.argv[2:] else ""}.png'; im.save(out); print(out,im.size)
