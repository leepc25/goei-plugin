"""Whole-frame 0/1px placement correction, no invented art or pose synthesis."""
from pathlib import Path
from PIL import Image
import hashlib,json
P=Path(__file__).resolve().parents[1]/'resume/saladin-walk'
DX=[0,0,1,1,0,0,0,1]
def main():
    out=P/'aligned';out.mkdir(exist_ok=True);rows=[]
    for i,dx in enumerate(DX):
        source=P/f'{i:02}.png';im=Image.open(source).convert('RGBA');result=Image.new('RGBA',im.size);result.alpha_composite(im,(dx,0));dest=out/source.name;result.save(dest)
        assert sum(im.getchannel('A').getdata())==sum(result.getchannel('A').getdata()),'Would clip pixels'
        rows.append({'frame':i,'dx':dx,'dy':0,'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
    (out/'alignment.json').write_text(json.dumps({'basis':'Visual shoe/heel contact in foot-evidence.json. Frames0-3 near support heel105; frames4-7 far support heel130. Cycle48 moves frame0 rear heel82 to130. No per-frame engine velocity is added.','cycle_dx':48,'frames':rows},indent=2)+'\n')
if __name__=='__main__':main()
