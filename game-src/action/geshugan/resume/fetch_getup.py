from pathlib import Path
import urllib.request,zipfile,io
from PIL import Image,ImageDraw
out=Path('game-src/action/geshugan/resume/getup-edit');out.mkdir(exist_ok=True)
data=urllib.request.urlopen('https://api.pixellab.ai/mcp/images/c2c9cbc3-8a1e-40fa-b776-6112e7e5a82a/download',timeout=40).read()
(out/'download.bin').write_bytes(data)
if zipfile.is_zipfile(io.BytesIO(data)):
 z=zipfile.ZipFile(io.BytesIO(data));print(z.namelist())
 png=[n for n in z.namelist() if n.endswith('.png')][0];data=z.read(png)
(out/'result.png').write_bytes(data)
a=Image.open('game-src/action/geshugan/clips/getup/03.png').convert('RGBA'); b=Image.open(out/'result.png').convert('RGBA')
print('dimensions',a.size,b.size)
c=Image.new('RGBA',(768,328),(90,104,116,255));d=ImageDraw.Draw(c)
for i,(im,label) in enumerate([(a,'before'),(b,'PixelLab result')]):
 c.alpha_composite(im.resize((384,288),Image.Resampling.NEAREST),(384*i,20));d.text((384*i+5,4),label,fill='white')
c.save(out/'comparison.png')
