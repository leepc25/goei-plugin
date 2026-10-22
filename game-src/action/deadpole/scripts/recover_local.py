"""Recover native-MCP results from their explicit no-auth download URLs."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import sys
import urllib.request
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'game-src/action/deadpole/resume'

def main(name):
    folder=OUT/'attempts'/name
    meta=json.loads((folder/'result.json').read_text(encoding='utf-8'))
    assert meta['status']=='completed'
    urls=meta['download_urls']
    def get(pair):
        i,url=pair; path=folder/f'{i:02d}.png'
        if not path.exists():
            with urllib.request.urlopen(url, timeout=60) as r: data=r.read()
            path.write_bytes(data)
        with Image.open(path) as im:
            im.load();assert im.size==(192,144);assert im.mode=='RGBA'
            bbox=im.getchannel('A').getbbox();assert bbox
        return dict(index=i,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),bbox=bbox,job_id=meta['job_id'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: rows=list(pool.map(get,enumerate(urls)))
    (folder/'frames.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
    state=json.loads((folder/'state.json').read_text(encoding='utf-8'))
    state.update(state='recovered',actual_cost={'amount':meta['charged_generations'],'unit':'generations','source':'result.json'},internal_review='pending')
    (folder/'state.json').write_text(json.dumps(state,indent=2),encoding='utf-8')
    cols=4; cellw,cellh=384,324
    sheet=Image.new('RGB',(cols*cellw,((len(rows)+cols-1)//cols)*cellh),'#68717b')
    d=ImageDraw.Draw(sheet)
    for row in rows:
        i=row['index'];x=(i%cols)*cellw;y=(i//cols)*cellh
        im=Image.open(folder/f'{i:02d}.png').resize((384,288),Image.Resampling.NEAREST)
        sheet.paste(im,(x,y+30),im)
        d.text((x+8,y+6),f'{name} {i}',fill='white')
        d.line((x,y+30+272,x+cellw,y+30+272),fill='#e29c89')
    sheet.save(OUT/'review'/f'{name}-new.png')
    print(json.dumps({'clip':name,'frames':len(rows),'actual_generations':meta['charged_generations'],'bbox':[r['bbox'] for r in rows]}))

if __name__=='__main__': main(sys.argv[1])
