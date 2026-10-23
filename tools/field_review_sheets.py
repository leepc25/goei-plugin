"""Prepare enlarged review sheets only; never makes a visual decision or API call."""
import io,json,zipfile
from pathlib import Path
from PIL import Image,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'game-src/art/field/production'
DEST=Path('/workspace/field-audit')
DIRECTIONS=['south','south-east','east','north-east','north','north-west','west','south-west']

def main():
 s=json.loads((OUT/'state.json').read_text())
 for slug,c in s['characters'].items():
  if c.get('image_verified') and not c.get('image_visually_reviewed') and c['group']!='management':
   path=OUT/slug/'reference.png'
   if not path.exists():continue
   a=Image.open(path).convert('RGBA');a=a.resize((a.width*3,a.height*3),Image.Resampling.NEAREST)
   im=Image.new('RGB',a.size,(85,105,100));im.paste(a,mask=a)
   target=DEST/'references'/f'{slug}-latest.png';target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
   print('SOURCE',slug,target)
  if c.get('ready') and not c.get('eight_way_visual_reviewed') and (OUT/slug/'character.zip').exists():
   z=zipfile.ZipFile(OUT/slug/'character.zip');im=Image.new('RGB',(1024,1080),(155,174,166));d=ImageDraw.Draw(im)
   for i,dr in enumerate(DIRECTIONS):
    a=Image.open(io.BytesIO(z.read('Idle/rotations/'+dr+'.png'))).convert('RGBA')
    assert a.size==(128,256),(slug,dr,a.size)
    a=a.resize((256,512),Image.Resampling.NEAREST);x=i%4*256;y=i//4*540
    im.paste(a,(x,y+22),a);d.text((x+4,y+4),dr,fill='black')
   target=DEST/'eight-way'/f'{slug}.png';target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
   print('EIGHT',slug,target)

if __name__=='__main__':main()
