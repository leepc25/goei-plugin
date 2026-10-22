# 후보를 최종 캔버스에 앉히고(발바닥 줄·몸 중심 맞춤) 쟈알디 대기 장과 나란히 놓은 비교판을 만든다.
# 사용: python3 place.py sheet [kind...]   → cand/<kind>/sheet.png
#       python3 place.py pick <kind> <seed> → <kind>/base.png
import sys,os,glob
from PIL import Image,ImageDraw
sys.path.insert(0,os.path.dirname(__file__))
from defs import M
ROOT=os.path.join(os.path.dirname(__file__),'..')
JY=os.path.join(ROOT,'../../action/jyaldi-v5/full/clips/idle/00.png')
def clean(im):
    """반투명 가장자리 정리: 알파 128 미만은 지우고 나머지는 불투명으로"""
    im=im.convert('RGBA'); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]; px[x,y]=(r,g,b,0 if a<128 else 255)
    return im
def place(k,src):
    d=M[k]; im=clean(Image.open(src))
    if d.get('flipv'): im=im.transpose(Image.FLIP_TOP_BOTTOM)
    bb=im.getchannel('A').getbbox(); fig=im.crop(bb)
    W,H=d['canvas']; out=Image.new('RGBA',(W,H),(0,0,0,0))
    pl=d.get('place')
    if pl=='arm': x,y=40,80-fig.height//2
    elif pl=='face': x,y=60-fig.width//2,60-fig.height//2
    elif 'float' in d: x,y=d['cx']-fig.width//2,d['float']-fig.height//2
    else: x,y=d['cx']-fig.width//2,d['foot']+1-fig.height
    out.alpha_composite(fig,(max(0,x),max(0,y))); return out,fig.size
def sheet(k):
    cands=sorted(glob.glob(f'{ROOT}/cand/{k}/[0-9]*.png'))
    if not cands: return
    jy=Image.open(JY).convert('RGBA'); W,H=M[k]['canvas']; sc=3
    cw=max(W,192); row=Image.new('RGBA',((len(cands)+1)*cw*sc,max(H,144)*sc),(58,66,72,255))
    jj=jy.resize((192*sc,144*sc),Image.NEAREST); row.alpha_composite(jj,(0,max(H,144)*sc-144*sc))
    dr=ImageDraw.Draw(row)
    for i,c in enumerate(cands):
        im,sz=place(k,c); big=im.resize((W*sc,H*sc),Image.NEAREST)
        ox=(i+1)*cw*sc; row.alpha_composite(big,(ox,max(H,144)*sc-H*sc))
        dr.line([(ox,(max(H,144)-H+M[k]['foot']+1)*sc),(ox+W*sc,(max(H,144)-H+M[k]['foot']+1)*sc)],fill=(255,80,80,255))
        dr.text((ox+4,4),f'{os.path.basename(c)} {sz[0]}x{sz[1]}',fill=(255,255,0,255))
    row.save(f'{ROOT}/cand/{k}/sheet.png')
if __name__=='__main__':
    if sys.argv[1]=='sheet':
        for k in sys.argv[2:] or list(M): sheet(k)
    elif sys.argv[1]=='pick':
        k,s=sys.argv[2],sys.argv[3]; os.makedirs(f'{ROOT}/{k}',exist_ok=True)
        im,sz=place(k,f'{ROOT}/cand/{k}/{s}.png'); im.save(f'{ROOT}/{k}/base.png'); print(k,s,sz)
