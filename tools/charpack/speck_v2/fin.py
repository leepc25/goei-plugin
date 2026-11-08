import json,os,sys
from PIL import Image
S=os.path.dirname(os.path.abspath(__file__)); r=json.load(open(f'{S}/stripes.json'))
def final(k):
    v=r[k]; a=Image.open(f"{S}/rimfix/{v['char']}/{os.path.basename(v['path'])}.png").convert('RGBA')
    for c in v['clumps']:
        for p in c['px']: a.putpixel(tuple(p),(0,0,0,0))
    return v,a
if __name__=='__main__':
    k,f,x0,y0,x1,y1,z,out=sys.argv[1],int(sys.argv[2]),*map(int,sys.argv[3:8]),sys.argv[8]
    v,a=final(k); cw=v['cw']; o=Image.open(v['src']).convert('RGBA')
    cells=[]
    for s in (o,a):
        cc=s.crop((f*cw+x0,y0,f*cw+x1,y1)); bg=Image.new('RGBA',cc.size,(24,34,38,255)); bg.alpha_composite(cc); cells.append(bg.resize((cc.width*z,cc.height*z),Image.NEAREST))
    sh=Image.new('RGB',(cells[0].width*2+10,cells[0].height),(255,255,255))
    sh.paste(cells[0],(0,0)); sh.paste(cells[1],(cells[0].width+10,0)); sh.save(out)
