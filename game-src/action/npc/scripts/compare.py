# 쟈알디 A2와 NPC 후보를 같은 배율로 나란히 + 톤 수치(키, 외곽선 검정 비율, 색 수, 채도·명도 중앙값). 사용: python3 compare.py id... -> ../review/compare-<tag>.png
import sys,os,colorsys,collections
from PIL import Image,ImageDraw
HERE=os.path.dirname(os.path.abspath(__file__)); B=os.path.join(HERE,'../base'); R=os.path.join(HERE,'../review'); os.makedirs(R,exist_ok=True)
A2=os.path.join(HERE,'../../jyaldi-v5/full/A2.png')
def stats(path):
    im=Image.open(path).convert('RGBA'); px=im.load(); W,H=im.size
    cols=collections.Counter(); edge=0; edgeblack=0
    for y in range(H):
        for x in range(W):
            r,g,b,a=px[x,y]
            if a<128: continue
            cols[(r,g,b)]+=1
            if any(not(0<=x+dx<W and 0<=y+dy<H) or px[x+dx,y+dy][3]<128 for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                edge+=1; edgeblack+= (max(r,g,b)<40)
    sv=[colorsys.rgb_to_hsv(*(c/255 for c in k)) for k,n in cols.items() for _ in range(n)]
    S=sorted(s for h,s,v in sv); V=sorted(v for h,s,v in sv)
    bb=im.split()[3].point(lambda a:255 if a>=128 else 0).getbbox()
    return dict(h=bb[3]-bb[1],foot=bb[3],colors=len(cols),edge_black=round(edgeblack/max(1,edge),2),sat=round(S[len(S)//2],2),val=round(V[len(V)//2],2))
if __name__=='__main__':
    tag=sys.argv[1]; paths=[A2]+[os.path.join(B,f) for id in sys.argv[2:] for f in sorted(os.listdir(B)) if f.startswith(id+'-') and f.endswith('.png')]
    s=4; cell=96*s; sheet=Image.new('RGBA',(cell*len(paths),cell+60),(44,56,62,255)); d=ImageDraw.Draw(sheet)
    for i,p in enumerate(paths):
        im=Image.open(p).convert('RGBA').resize((cell,cell),Image.NEAREST); sheet.alpha_composite(im,(i*cell,0))
        st=stats(p); d.text((i*cell+4,cell+4),os.path.basename(p),fill=(255,255,0,255))
        d.text((i*cell+4,cell+20),f"h{st['h']} foot{st['foot']} c{st['colors']} ol{st['edge_black']}",fill=(255,255,255,255))
        d.text((i*cell+4,cell+36),f"sat{st['sat']} val{st['val']}",fill=(255,255,255,255))
        d.line([(i*cell,cell-4*s),(i*cell+cell,cell-4*s)],fill=(120,130,140,255))
        print(os.path.basename(p),st)
    sheet.save(f'{R}/compare-{tag}.png')
