"""본부 방문용 요원 대기 그림 팩 (game-pack/visit-agents).

이미 만들어 둔 각 요원의 대기(idle) 클립만 모아 한 장(atlas.png)과 frames.json으로 묶는다. 새 그림을 만들지 않는다.
frames.json: {"agents": {"<이름>": {"ms": 프레임 간격, "frames": [{"sx","sy","w","h","ox","oy"}], "clips": {"<클립>": {"ms", "frames", "loop"}}}}}
필드 동작(docs/필드_클립_이름_약속.md): game-src/field-clips/<이름>/<클립 이름>/*.png 를 넣으면 그 클립이 들어간다.
옛 요원 폴더(SRC)의 clips/ 아래에 약속된 이름의 폴더가 있어도 들어간다. 대기(idle)는 frames 자리.
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
FIELD = ROOT / 'game-src/field-clips'
# 필드 클립 이름 (docs/필드_클립_이름_약속.md). 한 번 재생하고 마지막 장에서 멈추는 것은 False
CLIP_LOOP = {
    'walk': True, 'run': True,
    'work': True, 'eat': True, 'rest': True, 'pee': True, 'poo': True, 'hobby': True,
    'greet': False, 'bow': False, 'gesture': False, 'nod': False, 'shake': False, 'surprise': False,
    'stretch': False, 'sigh': False, 'armcross': True, 'think': True, 'scratch': False, 'laugh': False, 'angry': False,
    'talk': True, 'scared': True, 'flee': True, 'cower': True, 'down': False, 'getup': False,
}


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


def extra_clips(name: str, idle_folder) -> dict:
    """약속된 이름의 클립 폴더들: 옛 요원 clips/ 형제 폴더 + game-src/field-clips/<이름>/ (뒤가 이김)"""
    out = {}
    roots = []
    if idle_folder is not None:
        roots.append(idle_folder.parent)
    roots.append(FIELD / name)
    for root in roots:
        for cid in CLIP_LOOP:
            f = root / cid
            if f.is_dir() and any(f.glob('*.png')):
                out[cid] = clip(f)
    return out


def main():
    agents = {'쟈알디': jyaldi()}
    clips = {'쟈알디': extra_clips('쟈알디', None)}
    for name, folder in SRC.items():
        if folder.is_dir():
            agents[name] = clip(folder)
            clips[name] = extra_clips(name, folder)
    # field-clips 에만 있는 인물 (대기 폴더 idle 이 있어야 한다)
    if FIELD.is_dir():
        for d in sorted(FIELD.iterdir()):
            if d.is_dir() and d.name not in agents and (d / 'idle').is_dir():
                agents[d.name] = clip(d / 'idle')
                clips[d.name] = extra_clips(d.name, None)
    pad = 1
    rows, y, width = [], 0, 0
    meta = {}
    def put(frames, into):
        nonlocal y, width
        x, h = 0, 0
        for im, ox, oy in frames:
            into.append({'sx': x, 'sy': y, 'w': im.width, 'h': im.height, 'ox': ox, 'oy': oy})
            rows.append((im, x, y))
            x += im.width + pad
            h = max(h, im.height)
        width = max(width, x)
        y += h + pad

    for name, frames in agents.items():
        meta[name] = {'ms': 180, 'frames': []}
        put(frames, meta[name]['frames'])
        for cid, cframes in clips.get(name, {}).items():
            meta[name].setdefault('clips', {})[cid] = {'ms': 120 if cid in ('walk', 'run') else 160, 'loop': CLIP_LOOP[cid], 'frames': []}
            put(cframes, meta[name]['clips'][cid]['frames'])
    sheet = Image.new('RGBA', (width, y))
    for im, x, yy in rows:
        sheet.paste(im, (x, yy))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / 'atlas.png', optimize=True)
    (OUT / 'frames.json').write_text(json.dumps({'agents': meta}, ensure_ascii=False))
    (OUT / 'pack.json').write_text(json.dumps({'id': 'visit-agents', 'required': True}))
    print(sheet.size, {k: [len(v['frames'])] + sorted(v.get('clips', {})) for k, v in meta.items()})


main()
