from pathlib import Path
from PIL import Image,ImageDraw
root=Path('game-src/action/geshugan')
items=[('getup',3),('crouch',1),('crouch',2),('crouch',3),('chain3',12),('chain3',13),('airstomp',3),('airstomp',4),('tackle',1),('tackle',3),('grabreap',4),('grabreap',5),('chain2',2),('chain2',4)]
canvas=Image.new('RGB',(7*220,2*280),(90,104,116));draw=ImageDraw.Draw(canvas)
for n,(clip,i) in enumerate(items):
 im=Image.open(root/'clips'/clip/f'{i:02}.png').convert('RGBA')
 box=im.getbbox(); x,y=box[0],box[1]
 crop=im.crop((x-2,y-2,x+53,y+63)).resize((220,260),Image.Resampling.NEAREST)
 canvas.paste(crop,((n%7)*220,(n//7)*280+20),crop)
 draw.text(((n%7)*220+4,(n//7)*280+3),f'{clip}/{i:02} crop {x-2},{y-2}',fill='white')
canvas.save(root/'resume'/'neck-before.png')
