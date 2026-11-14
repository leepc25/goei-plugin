"""미리보기를 공유 폴더에 나눠 담는다: python3 share.py <시안 폴더> <공유 폴더 이름>"""
import sys, os
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, name = sys.argv[1], sys.argv[2]
D = f'/mnt/project-files/작업_1115/아카_소개페이지/{name}/'
os.makedirs(D, exist_ok=True)
im = Image.open(os.path.join(src, 'preview_pc.png')).convert('RGB'); w, h = im.size
n = max(1, round(h / 8000)); ch = h // n + 1
for i in range(n): im.crop((0, i * ch, w, min(h, (i + 1) * ch))).save(D + f'PC_{i + 1}.jpg', quality=88)
s = im.resize((215, h // 4)); cols = max(1, min(8, round(s.height / 2000))); c2 = (s.height + cols - 1) // cols
out = Image.new('RGB', (cols * 225 - 10, c2), (60, 60, 60))
for i in range(cols): out.paste(s.crop((0, i * c2, 215, min(s.height, (i + 1) * c2))), (i * 225, 0))
out.save(D + '한눈에.png')
ph = Image.open(os.path.join(src, 'preview_phone.png')).convert('RGB')
ph.crop((0, 0, ph.width, min(ph.height, 9000))).save(D + '폰_앞부분.jpg', quality=88)
open(D + 'arca.html', 'w').write(open(os.path.join(src, 'arca.html')).read())
print(name, (w, h), 'PC', n, 'cols', cols)
