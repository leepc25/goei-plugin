"""Verify the free PixelLab exact edit against guarded decisions; never submit a job."""
import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
R=Path(__file__).resolve().parents[1]/'resume'
P=R/'saladin-run-r3'
def h(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    source=json.loads((P/'rifle-source.json').read_text())
    assert h(R/source['source'])==source['source_sha256']
    ops=json.loads((P/'rifle-exact-decisions.json').read_text())
    sheet=Image.open(P/'rifle-exact-sheet.png').convert('RGBA')
    assert sheet.size==(768,528)
    out=P/'with-rifle';out.mkdir(exist_ok=True)
    contact=Image.new('RGB',(1024,392),'#465265');d=ImageDraw.Draw(contact)
    audit=[]
    for i,op in enumerate(ops):
        raw=Image.open(P/f'{i:02d}.png').convert('RGBA');expected=raw.copy()
        assert op['frames']==[i+1]
        for x,y,before,after in op['pixels']:
            rgba=lambda s:tuple(bytes.fromhex(s[1:]))
            assert expected.getpixel((x,y))==rgba(before),(i,x,y)
            expected.putpixel((x,y),rgba(after))
        actual=sheet.crop(((i%3)*256,(i//3)*176,(i%3+1)*256,(i//3+1)*176))
        assert np.array_equal(np.array(actual),np.array(expected)),i
        a=np.array(raw);b=np.array(actual);change=np.any(a!=b,axis=2)
        assert not change[:121].any() and not change[137:].any()
        path=out/f'{i:02d}.png';actual.save(path)
        contact.paste(actual,((i%4)*256,(i//4)*196+20),actual)
        d.text(((i%4)*256+8,(i//4)*196+3),str(i),fill='white')
        audit.append(dict(frame=i,changed_pixels=int(change.sum()),raw_sha256=h(P/f'{i:02d}.png'),corrected_sha256=h(path),face_and_legs_unchanged=True))
    contact.save(P/'rifle-contact.png')
    (P/'rifle-verification.json').write_text(json.dumps(dict(workbench_id='78721d2f-835f-4446-8969-de02180ed0ae',paid_generations=0,server_export_equals_guarded_decisions=True,frames=audit),indent=2)+'\n')
    print(json.dumps(audit))
if __name__=='__main__':main()
