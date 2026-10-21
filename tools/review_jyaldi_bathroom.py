"""Contact sheet and structural checks for the bathroom deliverables."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'game-src/action/jyaldi-v5/full'
NAMES='showerin shower showerout bathin bath bathout toiletin toilet toiletout handwash'.split()
EXPECTED=dict.fromkeys(NAMES,6); EXPECTED.update(bath=4,toilet=4)
def main():
    sheet=Image.new('RGB',(192*6,144*len(NAMES)),'#34404a')
    draw=ImageDraw.Draw(sheet)
    for row,n in enumerate(NAMES):
        files=sorted((SRC/'clips'/n).glob('[0-9][0-9].png'))
        assert len(files)==EXPECTED[n],(n,len(files))
        for i,p in enumerate(files):
            im=Image.open(p)
            assert im.size==(192,144),(p,im.size)
            assert im.mode=='RGBA',(p,im.mode)
            assert im.getchannel('A').getextrema()==(0,255),(p,'not transparent')
            sheet.paste(im,(i*192,row*144),im.getchannel('A'))
        draw.text((2,row*144+2),n,fill='yellow')
    sheet.save(SRC/'bathroom-review-final.png')
    print('PASS: 10 clips, 56 RGBA frames, 192x144; visual and contact validation still required')
if __name__=='__main__': main()
