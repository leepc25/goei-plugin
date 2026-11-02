"""사무의자(C01) 전 캐릭터 맞춤값 (11-02 사용자: 「쉘 맞추듯이 전부 다시 맞춰야해」).
쉘 의자(shell_fit_all.py)와 같은 그림 규칙: 의자는 바닥 제자리, 사람을 dx,dy 만큼 옮김(+dx = 사람 왼쪽, +dy = 사람 위).
  seed                      : 쉘 맞춤값 + 의자 좌석 위치 차(방향별)로 첫 값(이미 있는 키는 안 건드림)
  sheet <view> <out> [i0 i1] [키,키..] : 6열 모음 그림(2배)
  set <key> <view> dx dy [img]
  apply                     : testroom3/chairs/<키>.json 의 front/side/back 에 써 넣음(다른 줄 키는 그대로)
값 파일: game-src/art/objects/chairs_office/fit_all.json
"""
import sys, json, os, re
from pathlib import Path
ROOT=Path('/home/user/goei-plugin'); TR=ROOT/'game-src/action/testroom3'
os.environ['CHAIR_DIR']=str(ROOT/'game-src/action/objects/C01_사무의자_1배')
A=sys.argv[1:]; sys.argv=sys.argv[:1]
sys.path.insert(0,str(TR)); sys.path.insert(0,str(TR/'qa'))
import fit_chair as fc
from PIL import Image, ImageDraw, ImageFont
FONT=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',12)
F=ROOT/'game-src/art/objects/chairs_office/fit_all.json'
J=json.loads(F.read_text()) if F.exists() else {}
LID={'front':'60','side':'96','back':'61'}
SKIP={'5.2_브라우니'}   # 11-02 사용자: 브라우니는 의자 앉기 전부 뺌
# 좌석 가운데 차(C01 - 쉘, 1배, 96~112줄 무게중심) → 사람도 같은 만큼 옮김. 옆은 등받이가 두꺼워 사람을 앞(오른쪽)으로 10
SEAT={'south':-8,'south-east':-3,'south-west':-12,'north':-8,'north-east':-1,'north-west':-14,'east':10}
def keys():
    ks=[p.stem for p in (TR/'chars').glob('*.json')]
    ks=sorted(ks,key=lambda s:[int(x) for x in re.findall(r'\d+',s.split('_')[0])])
    out=[]
    for k in ks:
        try:
            c,_=fc.load(k); ims,_=fc.values(c)
            if k not in SKIP and all(ims[v] is not None for v in LID): out.append(k)
        except Exception: pass
    return out
def save(): F.write_text(json.dumps(J,ensure_ascii=False,indent=0))
cmd=A[0]
if cmd=='seed':
    S=json.loads((ROOT/'game-src/art/objects/chairs_shell/fit_all.json').read_text())
    for k in keys():
        if k in J or k not in S: continue
        J[k]={v:{'dx':S[k][v]['dx']-SEAT[S[k][v]['img']],'dy':S[k][v]['dy'],'img':S[k][v]['img']} for v in LID}
    save(); print(len(J))
elif cmd=='set':
    k,v,dx,dy=A[1],A[2],int(A[3]),int(A[4]); J[k][v].update(dx=dx,dy=dy)
    if len(A)>5: J[k][v]['img']=A[5]
    save(); print(k,v,J[k][v])
elif cmd=='apply':
    n=0
    for k,vals in J.items():
        if k in SKIP: continue
        p=TR/'chairs'/f'{k}.json'; d=json.loads(p.read_text()) if p.exists() else {}
        for v in LID: d[v]={'dx':vals[v]['dx'],'dy':vals[v]['dy'],'s':1.0,'img':vals[v]['img']}
        p.write_text(json.dumps(d,ensure_ascii=False,indent=1)+'\n'); n+=1
    print('applied',n)
elif cmd=='sheet' or cmd=='try':
    if cmd=='try':   # try <key> <view> <out> img:dx:dy img:dx:dy ...  저장 없이 나란히
        k0,v,out=A[1],A[2],A[3]; var=[x.split(':') for x in A[4:]]
        J={k0:{v:None}}; ks=[k0]*len(var); A=['sheet',v,out,'0',str(len(var))]
        TRY=[{'img':a,'dx':int(b),'dy':int(c)} for a,b,c in var]
    v,out=A[1],A[2]; ks=keys() if cmd=='sheet' else ks; i0=int(A[3]) if len(A)>3 else 0; i1=int(A[4]) if len(A)>4 else i0+12
    idx=list(range(i0,min(i1,len(ks))))
    if len(A)>5 and cmd=='sheet': idx=[ks.index(x) for x in A[5].split(',')]
    cells=[]
    for i in idx:
        k=ks[i]; c,_=fc.load(k); im=fc.last(c,LID[v]); p=J[k][v] if cmd=='sheet' else TRY[i]
        W,H,TOP=150 if v!='side' else 190,300,40
        T=Image.new('RGBA',(W,H),(92,86,78,255)); g=ImageDraw.Draw(T)
        for y in range(0,H,10): g.line([(0,y),(W,y)],fill=(100,94,86,255))
        base=H-15
        ox,oy=round(W/2-im.size[0]/2-p['dx']), round(base-p['dy']-min(im.size[1]-4,im.getbbox()[3]))
        ch=Image.open(fc.chair_png(p['img'])).convert('RGBA'); cx,cy=round(W/2-100),base-171
        if v!='back': T.alpha_composite(ch,(cx,cy)); T.alpha_composite(im,(ox,oy))
        else:
            T.alpha_composite(im,(ox,oy))
            if os.environ.get('GHOST'):   # 확인용: 뒤 의자를 반투명으로 → 엉덩이·등 가운데가 보임
                import numpy as np; a=np.array(ch); a[:,:,3]=(a[:,:,3]*float(os.environ['GHOST'])).astype('uint8'); ch=Image.fromarray(a)
            T.alpha_composite(ch,(cx,cy))
            if os.environ.get('GHOST'): 
                b=np.array(Image.open(fc.chair_png(p['img'])))[:,:,3]>40; ccx=cx+np.where(b[42:112])[1].mean(); sy=cy+next(y for y in range(96,130) if b[y].sum()>40)
                g.line([(ccx,0),(ccx,H)],fill=(80,200,255,255)); g.line([(0,sy),(W,sy)],fill=(255,230,60,255))
        for x in range(0,W,4): g.point((x,base),fill=(255,60,60,255))
        T=T.crop((0,TOP,W,H)).convert('RGB').resize((W*2,(H-TOP)*2),Image.NEAREST)
        d=ImageDraw.Draw(T); d.rectangle([0,0,W*2,15],fill=(20,20,20)); d.text((3,1),f'{i} {k.split("_",1)[1]}  {p["dx"]},{p["dy"]} {p["img"]}',fill=(255,255,255),font=FONT)
        cells.append(T)
    cw,chh=cells[0].size; cols=int(os.environ.get('COLS',6)); rows=(len(cells)+cols-1)//cols
    S=Image.new('RGB',(cw*cols,chh*rows),(30,30,30))
    for j,cc in enumerate(cells): S.paste(cc,((j%cols)*cw,(j//cols)*chh))
    S.save(out); print(out,S.size)
