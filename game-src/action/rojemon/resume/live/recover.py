"""Recover URLs already returned by get_image. Never generates or authenticates."""
import hashlib, json, sys, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main(clip):
    out = HERE / clip
    urls = json.loads((out / 'urls.json').read_text(encoding='utf-8'))
    raw = out / 'raw'
    raw.mkdir(exist_ok=True)
    rows=[]
    for i, url in enumerate(urls):
        p=raw/f'{i:02}.png'
        if not p.exists():
            with urllib.request.urlopen(url, timeout=60) as r: data=r.read()
            p.write_bytes(data)
        im=Image.open(p).convert('RGBA'); a=im.getchannel('A'); bb=a.getbbox()
        assert im.size==(256,160), im.size
        assert bb
        rows.append(dict(frame=i,sha256=sha(p),bbox=list(bb),edge_contact=bb[0]==0 or bb[1]==0 or bb[2]==256 or bb[3]==160,alpha_values=sorted(set(a.getdata()))))
    sheet=Image.new('RGB',(1024,360),'#292c32'); d=ImageDraw.Draw(sheet)
    for i,p in enumerate(sorted(raw.glob('*.png'))):
        im=Image.open(p).convert('RGBA'); x=i%4*256; y=i//4*180+20
        d.text((x+8,y-17),f'{clip} {i:02}',fill='white'); d.line((x,y+144,x+255,y+144),fill='#626873')
        sheet.paste(im,(x,y),im)
    sheet.resize((2048,720),Image.Resampling.NEAREST).save(out/'contact.png')
    (out/'geometry.json').write_text(json.dumps(rows,indent=2)+'\n')
    state=json.loads((out/'state.json').read_text()); state.update(status='recovered',frame_count=len(rows),geometry='geometry.json',user_visual_approval=False)
    (out/'state.json').write_text(json.dumps(state,indent=2)+'\n')
    print(json.dumps(rows))
if __name__=='__main__': main(sys.argv[1])
