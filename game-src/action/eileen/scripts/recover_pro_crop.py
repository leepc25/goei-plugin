from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import urllib.request,hashlib,json,sys
from PIL import Image
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'game-src/action/eileen/resume/live-20261022'
def fetch(i):
 path=OUT/f'transition-pro/crop-{i:02d}.png'
 if not path.exists():
  with urllib.request.urlopen(f'https://api.pixellab.ai/mcp/images/296587c6-95c3-4b93-92a7-d164ddb10506/download?index={i}',timeout=60) as r:blob=r.read()
  path.write_bytes(blob)
 crop=Image.open(path).convert('RGBA');assert crop.size==(80,80)
 source=Image.open(OUT/f'transition-rig/{i:02d}.png').convert('RGBA')
 # Replace including transparency, at the exact fixed crop position, no scaling.
 source.paste(crop,(30,40));source.save(OUT/f'transition-pro/{i:02d}.png')
 return i
if __name__=='__main__':
 with ThreadPoolExecutor(max_workers=3) as ex:print(list(ex.map(fetch,range(7))))
 sys.path.insert(0,str(ROOT/'game-src/action/eileen/scripts'))
 from build_resume_review import sheet
 fs=[Image.open(OUT/f'transition-pro/{i:02d}.png').convert('RGBA') for i in range(7)]
 sheet([('pro 0+',fs[:4]),('pro 4+',fs[4:])],OUT/'transition-pro/review.png',2)
