"""본부 방문용 요원 대기 그림 팩 (game-pack/visit-agents).

이미 만들어 둔 각 요원의 대기(idle) 클립만 모아 한 장(atlas.png)과 frames.json으로 묶는다. 새 그림을 만들지 않는다.
frames.json: {"agents": {"<이름>": {"ms": 프레임 간격, "frames": [{"sx","sy","w","h","ox","oy"}]}}}
ox/oy는 발 가운데(바닥선)에서 잘린 그림 왼쪽 위까지의 거리(원본 픽셀). 게임은 PIXEL(2.75)배로 그린다.
사용법: python3 tools/build_visit_agents.py
"""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / 'game-src/action'
SRC = {
    '에일린': A / 'eileen/clips/idle',
    '스팡달': A / 'spangdal/full/clips/idle',
    '데드폴': A / 'deadpole/full/clips/idle',
    '게슈간': A / 'geshugan/clips/idle',
    '로제몬': A / 'rojemon/clips/idle',
    '큐라스': A / 'kyuras/clips/idle',
    '고르고디오': A / 'gorgodio/full/clips/idle',
    '잼트리': A / 'npc/clips/jaemtri/idle',
    '데쥬레': A / 'npc/clips/dejure/idle',
}
OUT = ROOT / 'game-pack/visit-agents'


def jyaldi():
    d = json.loads((ROOT / 'game-pack/jyaldi/frames.json').read_text())
    atlas = Image.open(ROOT / 'game-pack/jyaldi/atlas.png').convert('RGBA')
    out = []
    for f in d['clips']['idle']:
        im = atlas.crop((f['sx'], f['sy'], f['sx'] + f['w'], f['sy'] + f['h']))
        out.append((im, f['ox'], f['oy']))
    return out


def clip(folder: Path):
    ims = [Image.open(p).convert('RGBA') for p in sorted(folder.glob('*.png'))]
    boxes = [im.getbbox() for im in ims if im.getbbox()]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    # 발 가운데: 첫 장 아래 8줄의 불투명 픽셀 가운데
    a = ims[0].getchannel('A')
    xs = [x for y in range(y1 - 8, y1) for x in range(ims[0].width) if a.getpixel((x, y)) > 0]
    cx = round(sum(xs) / len(xs)) if xs else (x0 + x1) // 2
    return [(im.crop((x0, y0, x1, y1)), x0 - cx, y0 - y1) for im in ims]


def main():
    agents = {'쟈알디': jyaldi()}
    for name, folder in SRC.items():
        if folder.is_dir():
            agents[name] = clip(folder)
    pad = 1
    rows, y, width = [], 0, 0
    meta = {}
    for name, frames in agents.items():
        x, h = 0, 0
        meta[name] = {'ms': 180, 'frames': []}
        for im, ox, oy in frames:
            meta[name]['frames'].append({'sx': x, 'sy': y, 'w': im.width, 'h': im.height, 'ox': ox, 'oy': oy})
            rows.append((im, x, y))
            x += im.width + pad
            h = max(h, im.height)
        width = max(width, x)
        y += h + pad
    sheet = Image.new('RGBA', (width, y))
    for im, x, yy in rows:
        sheet.paste(im, (x, yy))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / 'atlas.png', optimize=True)
    (OUT / 'frames.json').write_text(json.dumps({'agents': meta}, ensure_ascii=False))
    (OUT / 'pack.json').write_text(json.dumps({'id': 'visit-agents', 'required': True}))
    print(sheet.size, {k: len(v['frames']) for k, v in meta.items()})


main()
