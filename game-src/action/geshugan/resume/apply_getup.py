from pathlib import Path
from PIL import Image
import hashlib,json
src=Path('game-src/action/geshugan');out=src/'resume'/'repaired'/'getup';out.mkdir(parents=True,exist_ok=True)
p=src/'clips/getup/03.png'; original=Image.open(p).convert('RGBA');edited=Image.open(src/'resume/getup-edit/result.png').convert('RGBA')
box=[56,70,66,85];result=original.copy();result.paste(edited.crop(box),box[:2]);dest=out/'03.png';result.save(dest)
row={'original':'clips/getup/03.png','original_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'replacement':dest.relative_to(src).as_posix(),'replacement_sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'job_id':'c2c9cbc3-8a1e-40fa-b776-6112e7e5a82a','tool':'edit_image_pixen','patch_box':box,'transform':'copy generated face rectangle at original coordinates; preserve all pixels outside','review':'single visible eye reads as right-facing profile; body/feet/hands pixel-identical; user approval pending'}
(src/'resume/accepted-edits.json').write_text(json.dumps({'user_visual_approval':False,'frames':{'getup/03':row}},indent=2),encoding='utf-8')
print('getup accepted region',box)
