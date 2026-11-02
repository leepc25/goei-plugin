"""앉은 동작 줄 확인 시트(2배): 한 줄 = 인물·동작, 칸 = 앉기 끝 장 + 그 동작 모든 장. 의자 고정, 사람은 맞춤값만큼(게임과 같은 바닥 기준).
  python3 tools/objects/act_sheet.py <out.png> key:line[,key:line...]
값 = fit_all.json[key][line] 있으면 그것, 없으면 [key][view]."""
import sys,os,json
from pathlib import Path
ARGV=sys.argv[1:]
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit'); sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa')); sys.path.insert(0,str(ROOT/'tools/objects'))
import fit_chair as fc
from act_cmp import frames, ACTS, SIT
from PIL import Image, ImageDraw, ImageFont
FONT=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',12)
J=json.load(open(ROOT/'game-src/art/objects/chairs_shell/fit_all.json'))
VIEW={l:v for v,ls in ACTS.items() for l in ls}
def cell(im,p,v,lab):
    W,H,TOP=150 if v!='side' else 190,300,40
    T=Image.new('RGBA',(W,H),(92,86,78,255)); g=ImageDraw.Draw(T)
    for y in range(0,H,10): g.line([(0,y),(W,y)],fill=(100,94,86,255))
    base=H-15
    ox,oy=round(W/2-im.size[0]/2-p['dx']), round(base-p['dy']-min(im.size[1]-4,im.getbbox()[3]))
    ch=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2-100),base-171
    if v!='back': T.alpha_composite(ch,(cx,cy)); T.alpha_composite(im,(ox,oy))
    else: T.alpha_composite(im,(ox,oy)); T.alpha_composite(ch,(cx,cy))
    for x in range(0,W,4): g.point((x,base),fill=(255,60,60,255))
    T=T.crop((0,TOP,W,H)).convert('RGB').resize((W*2,(H-TOP)*2),Image.NEAREST)
    d=ImageDraw.Draw(T); d.rectangle([0,0,W*2,13],fill=(20,20,20)); d.text((3,1),lab,fill=(255,255,255),font=FONT)
    return T
out,items=ARGV[0],[x.split(':') for x in ARGV[1].split(',')]
rows=[]
for k,l in items:
    v=VIEW[l]; c,_=fc.load(k); pv=J[k][v]; pl=J[k].get(l,pv)
    cs=[cell(fc.last(c,SIT[v]),pv,v,f'{k.split("_",1)[1]} {SIT[v]}끝 {pv["dx"]},{pv["dy"]}')]
    for i,f in enumerate(frames(c,l)): cs.append(cell(f,pl,v,f'{l}-{i+1} {pl["dx"]},{pl["dy"]}'))
    rows.append(cs)
cw,chh=rows[0][0].size; cw=max(r[0].size[0] for r in rows); n=max(len(r) for r in rows)
S=Image.new('RGB',(cw*n,chh*len(rows)),(30,30,30))
for j,r in enumerate(rows):
    for i,cc in enumerate(r): S.paste(cc,(i*cw,j*chh))
S.save(out); print(out,S.size)
