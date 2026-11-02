"""쉘 의자(L02) 전 캐릭터 맞춤값. 기준 = 게임과 같은 BASE(h-4), shell_chair_var.py 와 같은 합성.
  seed                      : 사무의자 값 + (쟈알디 쉘값 - 쟈알디 사무값)으로 첫 값(이미 있는 키는 안 건드림)
  sheet <view> <out> [i0 i1]: 6x2 모음 그림(2배), 칸 번호 = 목록 순번
  set <key> <view> dx dy [img]
값 파일: game-src/art/objects/chairs_shell/fit_all.json
"""
import sys, json, os, re
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
A=sys.argv[1:]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc
from PIL import Image, ImageDraw, ImageFont
FONT=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',12)
F=ROOT/'game-src/art/objects/chairs_shell/fit_all.json'
J=json.loads(F.read_text()) if F.exists() else {}
LID={'front':'60','side':'96','back':'61'}
def keys():
    ks=[p.stem for p in (TR/'chars').glob('*.json')]
    ks=sorted(ks,key=lambda s:[int(x) for x in re.findall(r'\d+',s.split('_')[0])])
    out=[]
    for k in ks:
        try:
            c,_=fc.load(k); ims,_=fc.values(c)
            if all(ims[v] is not None for v in LID): out.append(k)
        except Exception: pass
    return out
def save(): F.write_text(json.dumps(J,ensure_ascii=False,indent=0))
cmd=A[0]
if cmd=='seed':
    jy=json.loads((ROOT/'game-src/art/objects/chairs_shell/jyaldi_fit_v4.json').read_text())
    c,_=fc.load('1.1_쟈알디'); _,jo=fc.values(c)
    D={v:(jy[v]['dx']-jo[v]['dx'], jy[v]['dy']-jo[v]['dy']) for v in LID}
    for k in keys():
        if k in J: continue
        c,_=fc.load(k); _,o=fc.values(c)
        J[k]={v:{'dx':round(o[v]['dx']+D[v][0]),'dy':round(o[v]['dy']+D[v][1]),'img':(o[v]['img'] if v!='side' else 'east')} for v in LID}
    J['1.1_쟈알디']={v:{'dx':jy[v]['dx'],'dy':jy[v]['dy'],'img':jy[v]['img']} for v in LID}
    save(); print(len(J),D)
elif cmd=='set':
    k,v,dx,dy=A[1],A[2],int(A[3]),int(A[4]); J[k][v].update(dx=dx,dy=dy)
    if len(A)>5: J[k][v]['img']=A[5]
    save(); print(k,v,J[k][v])
elif cmd=='sheet':
    v,out=A[1],A[2]; ks=keys(); i0=int(A[3]) if len(A)>3 else 0; i1=int(A[4]) if len(A)>4 else i0+12
    if len(A)>5: ks=A[5].split(','); i0,i1=0,len(ks)
    cells=[]
    for i in range(i0,min(i1,len(ks))):
        k=ks[i]; c,_=fc.load(k); ims,_=fc.values(c); im=fc.last(c,LID[v]); p=J[k][v]
        W,H,TOP=150 if v!='side' else 190,300,40
        T=Image.new('RGBA',(W,H),(92,86,78,255)); g=ImageDraw.Draw(T)
        for y in range(0,H,10): g.line([(0,y),(W,y)],fill=(100,94,86,255))
        base=H-15   # 11-02 사용자: 게임처럼 의자는 제자리(바닥선)에 고정, 사람을 맞춤값만큼 옮겨 그림
        ox,oy=round(W/2-im.size[0]/2-p['dx']), round(base-p['dy']-min(im.size[1]-4,im.getbbox()[3]))
        ch=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2-100),base-171
        if v!='back': T.alpha_composite(ch,(cx,cy)); T.alpha_composite(im,(ox,oy))
        else: T.alpha_composite(im,(ox,oy)); T.alpha_composite(ch,(cx,cy))
        for x in range(0,W,4): g.point((x,base),fill=(255,60,60,255))
        T=T.crop((0,TOP,W,H)).convert('RGB').resize((W*2,(H-TOP)*2),Image.NEAREST)
        d=ImageDraw.Draw(T); d.rectangle([0,0,W*2,13],fill=(20,20,20)); d.text((3,1),f'{i} {k.split("_",1)[1]} {p["dx"]},{p["dy"]} {p["img"]}',fill=(255,255,255),font=FONT)
        cells.append(T)
    cw,chh=cells[0].size; cols=int(os.environ.get('COLS',6)); rows=(len(cells)+cols-1)//cols
    S=Image.new('RGB',(cw*cols,chh*rows),(30,30,30))
    for j,cc in enumerate(cells): S.paste(cc,((j%cols)*cw,(j//cols)*chh))
    S.save(out); print(out,S.size)
