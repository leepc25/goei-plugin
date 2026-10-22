# 검수용 접촉 시트: python3 sheet.py out.png clip... (쟈알디 대기 1장 + 데드폴 기준 그림을 맨 앞에)
import sys, glob, os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); F = os.path.join(HERE, '../full')
out, names = sys.argv[1], sys.argv[2:]
rows = [[Image.open(os.path.join(HERE, '../../jyaldi-v5/full/clips/idle/00.png')), Image.open(F + '/base.png')]]
for n in names: rows.append([Image.open(f) for f in sorted(glob.glob(f'{F}/clips/{n}/*.png'))])
cw, ch, k, per = 120, 110, 3, 8
nr = sum(max(1, (len(r) + per - 1) // per) for r in rows)
o = Image.new('RGBA', (cw * per * k, ch * nr * k), (88, 96, 104, 255)); y = 0
for r in rows:
    for i, im in enumerate(r):
        o.alpha_composite(im.convert('RGBA').crop((0, 30, cw, 30 + ch)).resize((cw * k, ch * k), Image.NEAREST), ((i % per) * cw * k, (y + i // per) * ch * k))
    y += max(1, (len(r) + per - 1) // per)
o.save(out)
