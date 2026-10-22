"""Build Jyaldi-only evidence and an embedded review page. Never generates art."""
from pathlib import Path
import base64, hashlib, json
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
RUN = HERE / 'walk-20261022'

def image(path):
    raw = path.read_bytes()
    return {'src': str(path.relative_to(ROOT)).replace('\\', '/'), 'sha256': hashlib.sha256(raw).hexdigest(),
            'url': 'data:image/png;base64,' + base64.b64encode(raw).decode()}

def main():
    files = sorted((RUN/'raw').glob('[0-9][0-9].png'))
    assert len(files) == 8
    metrics=[]
    sheet=Image.new('RGB',(192*4*3,164*2*3),'#222b33')
    draw=ImageDraw.Draw(sheet)
    for i,p in enumerate(files):
        im=Image.open(p).convert('RGBA'); assert im.size==(192,144)
        box=im.getbbox(); assert box
        x=(i%4)*576; y=(i//4)*492
        sheet.paste(im.resize((576,432),Image.Resampling.NEAREST),(x,y+36),im.resize((576,432),Image.Resampling.NEAREST))
        draw.line((x,y+36+136*3,x+576,y+36+136*3),fill='#c18c75',width=2)
        draw.text((x+12,y+10),f'{i:02d} | raw | root +{i*6}',fill='white')
        metrics.append({'frame':i,'bbox':list(box),'lowest_opaque_y':box[3]-1,'colors':len(im.getcolors(192*144) or []),'sha256':image(p)['sha256']})
    sheet.save(RUN/'contact-sheet.png')
    (RUN/'metrics.json').write_text(json.dumps(metrics,indent=2)+'\n',encoding='utf-8')
    data={'new': [image(p) for p in files],
          'old':[image(HERE.parent/'full/clips/walk'/f'{i:02d}.png') for i in range(8)],
          'refs':[dict(image(HERE.parent/'full/A2.png'),label='재킷 수정 기준 A2'),dict(image(HERE.parent/'full/clips/guard/00.png'),label='입력 옆모습')],
          'motion':json.loads((HERE/'walk-motion.json').read_text(encoding='utf-8')),
          'job':'df3b56fb-5426-4491-888f-f94a4192e5cf','actualCost':3,'userVisualApproval':False}
    out=ROOT/'release/demo/jyaldi-walk-resume.html'
    out.write_text((HERE/'review.html').read_text(encoding='utf-8').replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('</','<\\/')),encoding='utf-8')
    print(out, out.stat().st_size)

if __name__=='__main__': main()
