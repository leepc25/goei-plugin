# 검수용: 클립 장들을 한 줄로 이어 3배로 → 스크래치 폴더. 사용: python3 look.py <캐릭터> <클립> [<클립>...]
import sys,os
from PIL import Image
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from fxclean import clean
OUT='/tmp/claude-0/-home-user-goei-plugin/cdf263bc-f409-547f-b6b0-3e862348d2c4/scratchpad'
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','clips')
cn=sys.argv[1]; rows=[]
for c in sys.argv[2:]:
    d=os.path.join(R,cn,c); fs=sorted(f for f in os.listdir(d) if f.endswith('.png'))
    ims=[clean(Image.open(os.path.join(d,f))).crop((40,20,200,176)) for f in fs]
    rows.append(ims)
w=max(len(r) for r in rows)*160; h=len(rows)*156
s=Image.new('RGBA',(w,h),(96,102,108,255))
for y,r in enumerate(rows):
    for x,i in enumerate(r): s.alpha_composite(i,(x*160,y*156))
k=2 if w*3>2400 else 3
s.resize((w*k,h*k),Image.NEAREST).save(f'{OUT}/look-{cn}-{"_".join(sys.argv[2:])[:40]}.png'); print(f'{OUT}/look-{cn}-{"_".join(sys.argv[2:])[:40]}.png',[len(r) for r in rows])
