"""Create per-clip full-frame contact sheets without changing production images."""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageDraw
from field_character_production import OUT,TEMPLATES

def main():
 p=argparse.ArgumentParser();p.add_argument('slug');p.add_argument('--output',default='/workspace/field-audit/motions');a=p.parse_args()
 dest=Path(a.output)/a.slug;dest.mkdir(parents=True,exist_ok=True)
 for template,label in TEMPLATES:
  folder=OUT/a.slug/'motions'/template;files=sorted(folder.glob('*.png'),key=lambda x:int(x.stem))
  if not files:continue
  ims=[Image.open(f).convert('RGBA') for f in files];w=max(im.width for im in ims);h=max(im.height for im in ims)
  cols=min(4,len(ims));zoom=2 if w<=256 else 1;sheet=Image.new('RGBA',(cols*w*zoom,math.ceil(len(ims)/cols)*(h*zoom+24)),'#9baea6');draw=ImageDraw.Draw(sheet)
  for i,im in enumerate(ims):
   x=i%cols*w*zoom;y=i//cols*(h*zoom+24);draw.text((x+4,y+4),f'frame {i+1} / {len(ims)}',fill='black');sheet.alpha_composite(im.resize((im.width*zoom,im.height*zoom),Image.Resampling.NEAREST),(x,y+24))
  path=dest/(template+'.png');sheet.save(path);print(template,len(ims),path)

if __name__=='__main__':main()
