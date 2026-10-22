"""Read-only input alignment and recovered frame inspection for local MCP production."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'game-src/action/deadpole/resume'

def alignment():
    req = json.loads((OUT/'requests/pipe_body.json').read_text(encoding='utf-8'))
    base = Image.open(ROOT/'game-src/action/deadpole/full/base.png').convert('RGBA')
    panel = Image.new('RGBA', (768,576), '#646c76')
    panel.alpha_composite(base.resize(panel.size, Image.Resampling.NEAREST))
    d=ImageDraw.Draw(panel)
    for p in req['arguments']['first_frame_keypoints']:
        x,y=p['x']*768,p['y']*576
        d.ellipse((x-3,y-3,x+3,y+3), fill='#ff6060')
        d.text((x+4,y),p['label'],fill='white')
    panel.save(OUT/'review/reference-alignment.png')

if __name__=='__main__': alignment()
