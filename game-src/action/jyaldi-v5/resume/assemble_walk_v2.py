"""Extract exact tool-returned frames, omit duplicate endpoints, and audit footprints."""
from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json
P=Path(__file__).resolve().parent/'walk-contact-v2';out=P/'review-frames';out.mkdir(exist_ok=True)
rows=[];frames=[]
for part in [1,2]:
 sheet=Image.open(P/f'segment{part}-fixed-sheet.png').convert('RGBA');assert sheet.size==(576,288)
 base=sheet.crop((0,0,192,144))
 for i in range(4):
  region=(62,127,85,137) if part==1 else ((82,127,105,137) if i==0 else (92,132,105,137) if i in [1,2] else (82,132,90,137))
  x=i%3*192;y=i//3*144;im=sheet.crop((x,y,x+192,y+144));raw=Image.open(P/f'segment{part}-raw'/f'{i:02d}.png').convert('RGBA')
  assert im.crop(region).tobytes()==base.crop(region).tobytes(),'Stance shoe differs'
  assert im.crop((0,0,192,127)).tobytes()==raw.crop((0,0,192,127)).tobytes(),'Upper art changed'
  index=(part-1)*4+i;path=out/f'{index:02d}.png';im.save(path);frames.append(im)
  rows.append({'frame':index,'segment':part,'source_index':i,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'bbox':list(im.getbbox()),'stance_region':list(region),'visible_stance_pixels_exact':True,'upper_pixels_unchanged':True,'occlusion_note':'far shoe partly occluded by near swing foot; only visible sole locked' if part==2 and i else None})
sheet=Image.new('RGB',(2304,912),'#24323b');d=ImageDraw.Draw(sheet)
for i,im in enumerate(frames):
 x=i%4*576;y=i//4*456;big=im.resize((576,432),Image.Resampling.NEAREST);sheet.paste(big,(x,y+24),big);d.text((x+12,y+4),f'{i:02d} root+{i*5}',fill='white');d.line((x,y+432,x+576,y+432),fill='#b68d71')
sheet.save(P/'final-contact-sheet.png')
(P/'frame-audit.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8')
print('PASS8 frames, declared visible stance regions bit-exact, upper artwork unchanged')
