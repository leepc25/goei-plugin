#!/usr/bin/env python3
"""잡몹 도트 장 단위 자동 검사. 명세: docs/GPT요청_잡몹_공통.md
사용: python3 tools/check_enemy_frames.py [kind...]   (없으면 game-src/art/enemy/ 아래 전부)
검사: 캔버스 크기, 반투명 가장자리, 발바닥 줄(땅에 선 클립), 몸 중심 흔들림, 키(기준 그림 대비), 장 수, 색 수, 장 사이 색 바뀜."""
import sys,os,glob,json
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','game-src','art','enemy')
sys.path.insert(0,os.path.join(ROOT,'scripts'))
from defs import M
from clips import SPEC   # 클립 이름 → (장 수, 땅에 선 클립인지)
def stats(im):
    a=im.getchannel('A'); bb=a.getbbox()
    semi=sum(1 for v in a.getdata() if 0<v<255)
    cols=len({p[:3] for p in im.getdata() if p[3]==255})
    return bb,semi,cols
def check(k):
    d=M[k]; W,H=d['canvas']; bad=[]
    base=os.path.join(ROOT,k,'base.png')
    if not os.path.exists(base): return [(k,'base','기준 그림 없음')]
    bim=Image.open(base).convert('RGBA'); bbb,_,bcols=stats(bim); bh=bbb[3]-bbb[1]; bcx=(bbb[0]+bbb[2])/2
    bpal={p[:3] for p in bim.getdata() if p[3]==255}
    for clip,(n,grounded) in SPEC.get(k,{}).items():
        files=sorted(glob.glob(os.path.join(ROOT,k,'clips',clip,'[0-9][0-9].png')))
        if len(files)!=n: bad.append((k,clip,f'장 수 {len(files)}/{n}'))
        for f in files:
            i=os.path.basename(f)[:2]; im=Image.open(f).convert('RGBA')
            if im.size!=(W,H): bad.append((k,clip,i,f'크기 {im.size}')); continue
            bb,semi,cols=stats(im)
            if bb is None: bad.append((k,clip,i,'빈 장')); continue
            if semi>20: bad.append((k,clip,i,f'반투명 {semi}px'))
            if cols>64: bad.append((k,clip,i,f'색 {cols}개'))
            if grounded and abs(bb[3]-1-d['foot'])>2: bad.append((k,clip,i,f'발바닥 y={bb[3]-1} (기준 {d["foot"]})'))
            if bb[0]<=0 or bb[2]>=W or bb[1]<=0: bad.append((k,clip,i,'캔버스 끝에 닿음(잘림)'))
            pal={p[:3] for p in im.getdata() if p[3]==255}
            new=len(pal-bpal)
            if pal and new/len(pal)>0.6: bad.append((k,clip,i,f'기준 그림에 없는 색 {new}/{len(pal)}'))
    return bad
if __name__=='__main__':
    names=sys.argv[1:] or [k for k in M if os.path.isdir(os.path.join(ROOT,k))]
    allbad=[]
    for k in names:
        b=check(k); allbad+=b; print(k,'OK' if not b else f'{len(b)}건')
    for b in allbad: print('  ',*b)
    sys.exit(1 if allbad else 0)
