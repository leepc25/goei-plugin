"""Recover the already-created free exact edit; pack its four reviewed cells."""
from pathlib import Path
from PIL import Image,ImageDraw
import urllib.request,json
ROOT=Path(__file__).resolve().parents[4];D=ROOT/'game-src/action/eileen/resume/live-20261022'
dest=D/'transition-exact'
with urllib.request.urlopen('https://api.pixellab.ai/mcp/pixel-tools/8acaabc7-e9a8-463b-8fd9-49e22aa019ea/image.png',timeout=120) as response:(dest/'result.png').write_bytes(response.read())
sheet=Image.open(dest/'result.png').convert('RGBA')
for slot,i in enumerate([2,3,4,5]):
 im=Image.open(D/f'transition-rig/{i:02d}.png').convert('RGBA');x,y=slot%2*128,slot//2*128
 im.paste(sheet.crop((x,y,x+128,y+128)),(16,16));im.save(dest/f'{i:02d}.png')
print('Recovered free exact rifle v2; no generation submitted')
