"""컷신 도트 프레임 검사: python3 tools/check_cutscene_frames.py [저장소 경로]

컷마다 timing.json, 장 수 = ms 개수, 0001부터 빈 번호 없음, 640×360, 불투명, 색 수, 컷 길이(콘티 초와 비교),
컷신 안 컷 빠짐, index.json 등록 여부를 보고 GPT에게 줄 다시 해 달라는 줄을 찍는다.
"""
import json
import re
import sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
frames = root / 'game-src/art/cutscene/frames'
src = (root / 'src/game/action/story/scripts/videos.ts').read_text(encoding='utf-8')
cuts_of = {m[1]: [float(x) for x in m[2].split(',')] for m in re.finditer(r"^\s+(\w+): \{\s*cuts: \[([^\]]*)\]", src, re.M)}
try:
    index = json.loads((frames / 'index.json').read_text(encoding='utf-8'))
except Exception:
    index = []

redo = []
for cs in sorted(cuts_of):
    d = frames / cs
    if not d.exists():
        print(f'{cs}: 아직 없음')
        continue
    print(f'== {cs} (index.json {"등록" if cs in index else "미등록"})')
    for i, sec in enumerate(cuts_of[cs], 1):
        cd = d / f'c{i}'
        prob = []
        if not cd.exists():
            redo.append(f'{cs}/c{i}: 컷 폴더가 없음. 콘티 c{i}({sec:g}초)를 만들어 game-src/art/cutscene/frames/{cs}/c{i}/0001.png… + timing.json으로 올려 주세요.')
            print(f'  c{i}: 없음')
            continue
        pngs = sorted(p.name for p in cd.glob('*.png'))
        nums = [int(p[:4]) for p in pngs if re.fullmatch(r'\d{4}\.png', p)]
        bad_names = [p for p in pngs if not re.fullmatch(r'\d{4}\.png', p)]
        ms = None
        try:
            ms = json.loads((cd / 'timing.json').read_text(encoding='utf-8'))['ms']
        except Exception as e:
            prob.append(f'timing.json 없음/깨짐({e.__class__.__name__})')
        n = len(nums)
        gaps = sorted(set(range(1, (max(nums) if nums else 0) + 1)) - set(nums))
        if gaps:
            prob.append(f'빠진 번호 {gaps[:10]}')
        if bad_names:
            prob.append(f'이름이 다른 파일 {bad_names[:5]}')
        if ms is not None and len(ms) != n:
            prob.append(f'timing.json ms {len(ms)}개인데 그림 {n}장')
        colors = set()
        for p in pngs:
            im = Image.open(cd / p)
            if im.size != (640, 360):
                prob.append(f'{p} 크기 {im.size}')
            if im.mode in ('RGBA', 'LA', 'P') and im.convert('RGBA').getextrema()[3][0] < 255:
                prob.append(f'{p} 투명 픽셀')
            c = im.convert('RGB').getcolors(1 << 20)
            colors |= {x[1] for x in c} if c else set()
        total = sum(ms) / 1000 if ms else 0
        loop = (json.loads((cd / 'timing.json').read_text(encoding='utf-8')).get('loop') if ms else None)
        if ms and not loop and abs(total - sec) > 0.6:
            prob.append(f'길이 {total:.2f}초 (콘티 {sec:g}초)')
        print(f'  c{i}: {n}장, {total:.2f}/{sec:g}초, 색 {len(colors)}' + ('' if not prob else ' ← ' + '; '.join(prob)))
        if prob:
            redo.append(f'{cs}/c{i}: ' + '; '.join(prob) + f'. 이 컷을 콘티 c{i}({sec:g}초)대로 다시 올려 주세요(0001.png부터 빈 번호 없이, 640×360, timing.json ms 개수 = 장 수).')
    extra = sorted(p.name for p in d.iterdir() if p.is_dir() and not re.fullmatch(r'c\d+', p.name) or (p.is_dir() and int(p.name[1:]) > len(cuts_of[cs])))
    if extra:
        print(f'  콘티에 없는 폴더 {extra}')
for x in sorted(set(index) - set(cuts_of)):
    print(f'index.json에 모르는 이름 {x}')
print('\n다시 요청할 컷:' if redo else '\n다시 요청할 컷 없음')
for r in redo:
    print('-', r)
