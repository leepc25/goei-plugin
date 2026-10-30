"""맵 에디터 결과(zip 또는 map.json이 든 폴더)를 게임 장면으로 바꾼다.

사용: python3 tools/mapedit/import.py <에디터.zip | 폴더> <장면 id>   (예: jr_heolgap)
      python3 tools/mapedit/import.py --rebuild                      (game-src/mapedit/*/game.json으로 gen.ts만 다시)

하는 일
- 원본(map.json + 그림)을 game-src/mapedit/<장면>/ 에 보관한다 (에디터 「불러오기」로 다시 열 수 있게 zip도 같이).
- 배경을 배경 확대(bgScale)만큼 도트 그대로 키워 game-pack/jr-field/me_<장면>.webp 로.
- 막힘: 윗면 높이 400 이상은 holes(못 지나가는 다각형), 그보다 낮으면 발판(둘레 네모, 그 높이로 올라섬).
- 가림: 다각형은 cover(배경 그 부분을 사람 위에 다시 그림), 붓·자동으로 딴 마스크는 배경에서 오려 낸 그림으로.
- 소품: 놓은 크기·회전·뒤집기 그대로 도트로 굽는다.
- 사람 배율 dotK = 1.5 × 장면 세로 / 890 (세로 890 화면에서 맨 앞 1.5배, 맨 뒤 0.85배).
- 결과 모음: src/game/action/hq/mapedit.gen.ts
"""
import base64, io, json, shutil, sys, zipfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'game-src/mapedit'
PACK = ROOT / 'game-pack/jr-field'
GEN = ROOT / 'src/game/action/hq/mapedit.gen.ts'
ACTS = {'front': ['chairsit', 'seatthink'], 'side': ['chairsit', 'seatthink'], 'back': ['chairsit', 'seatthink']}


def read_source(src: Path):
    files = {}
    if src.suffix == '.zip':
        with zipfile.ZipFile(src) as z:
            for n in z.namelist(): files[n] = z.read(n)
    else:
        for f in src.iterdir():
            if f.is_file() and f.suffix != '.zip' and f.name != 'game.json': files[f.name] = f.read_bytes()
    return json.loads(files.pop('map.json')), files


def find(files, stem):
    for n in files:
        if n.rsplit('.', 1)[0] == stem: return n
    raise SystemExit(f'그림이 없다: {stem}')


def webp(im: Image.Image, name: str):
    PACK.mkdir(parents=True, exist_ok=True)
    im.save(PACK / f'{name}.webp', 'WEBP', lossless=True, method=4)
    return name


def data_img(url: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1])))


def convert(scene_id: str, m: dict, files: dict) -> dict:
    k = m.get('bgScale', 2)
    bg = Image.open(io.BytesIO(files[find(files, m['file'])])).convert('RGBA')
    W, H = bg.width * k, bg.height * k
    big = bg.resize((W, H), Image.NEAREST)
    file = webp(big.convert('RGB'), f'me_{scene_id}')
    holes, objects, names = [], [], [file]
    for i, b in enumerate(m.get('blocks', [])):
        h = b.get('h', 999)
        if h >= 400: holes.append(b['poly']); continue
        xs, ys = [p[0] for p in b['poly']], [p[1] for p in b['poly']]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        objects.append({'id': f'plat{i}', 'file': '', 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'sortY': y1, 'solid': [{'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'h': h}]})
    for o in m.get('objects', []):
        if o.get('cover'):
            pts = [p for poly in o['cover'] for p in poly]
            x0, y0 = min(p[0] for p in pts), min(p[1] for p in pts)
            x1, y1 = max(p[0] for p in pts), max(p[1] for p in pts)
            objects.append({'id': o['id'], 'file': '', 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0, 'sortY': o['sortY'], 'cover': o['cover']})
        elif o.get('coverMask'):
            mk = data_img(o['coverMask']).convert('L').resize((o['w'], o['h']), Image.NEAREST).point(lambda v: 255 if v > 127 else 0)
            cut = big.crop((o['x'], o['y'], o['x'] + o['w'], o['y'] + o['h']))
            cut.putalpha(mk)
            bb = cut.getbbox()
            if not bb: continue
            cut = cut.crop(bb)
            name = webp(cut, f'me_{scene_id}_{o["id"]}'); names.append(name)
            objects.append({'id': o['id'], 'file': name, 'x': o['x'] + bb[0], 'y': o['y'] + bb[1], 'w': cut.width, 'h': cut.height, 'sortY': o['sortY']})
        elif o.get('file'):
            im = Image.open(io.BytesIO(files[find(files, o['file'])])).convert('RGBA')
            if o.get('flip'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
            im = im.resize((o['w'], o['h']), Image.NEAREST)
            if o.get('rot'): im = im.rotate(-o['rot'], resample=Image.NEAREST, expand=False)
            name = webp(im, f'me_{scene_id}_{o["id"]}'); names.append(name)
            objects.append({'id': o['id'], 'file': name, 'x': o['x'], 'y': o['y'], 'w': o['w'], 'h': o['h'], 'sortY': o['sortY']})
    doors = {}
    for did, d in (m.get('doors') or {}).items():
        # door가 있으면(그림 속 문짝 자리·여닫는 방식) 그대로, 없으면 바닥 출구 자리만
        doors[did] = d.get('door') or {'x0': d['x'] - 80, 'x1': d['x'] + 80, 'y0': d['y'] - 48, 'y1': d['y'], 'anim': 'none', 'behind': 'dark'}
    spots = []
    for s in m.get('spots', []):
        sp = {'id': s['id'], 'x': s['x'], 'y': s['y'], 'verb': s.get('verb', '앉기'), 'face': s.get('face', 1), 'act': s.get('act') or ACTS.get(s.get('dir', 'side')), 'seat': s['seat']}
        spots.append(sp)
    lane = m.get('lane') or [min(p[1] for p in m['floor']), max(p[1] for p in m['floor']) - 12]
    scene = {'file': file, 'w': W, 'h': H, 'under': True, 'lane': lane, 'floor': m.get('floor'), 'holes': holes,
             'dotK': round(1.5 * H / 890, 4), 'blocks': [], 'doors': doors, 'lamps': m.get('lamps', []), 'windows': [], 'objects': objects}
    return {'scene': scene, 'spots': spots, 'files': names}


def rebuild():
    scenes, spots, names = {}, {}, []
    for g in sorted(SRC.glob('*/game.json')):
        d = json.loads(g.read_text()); sid = g.parent.name
        scenes[sid] = d['scene']; spots[sid] = d['spots']; names += d['files']
    j = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    GEN.write_text('// tools/mapedit/import.py가 만든다. 손으로 고치지 않는다.\n'
                   "import type { PaintedScene } from './painted';\nimport type { HqSpot } from './map';\n"
                   f'export const MAPEDIT_SCENES: Record<string, PaintedScene> = {j(scenes)};\n'
                   f'export const MAPEDIT_SPOTS: Record<string, HqSpot[]> = {j(spots)};\n'
                   f'export const MAPEDIT_FILES: string[] = {j(names)};\n')
    print('mapedit.gen.ts', list(scenes))


def main():
    if sys.argv[1:] == ['--rebuild']: return rebuild()
    src, sid = Path(sys.argv[1]), sys.argv[2]
    m, files = read_source(src)
    out = SRC / sid; out.mkdir(parents=True, exist_ok=True)
    if src.resolve() != out.resolve():
        (out / 'map.json').write_text(json.dumps(m, ensure_ascii=False, indent=1))
        for n, b in files.items(): (out / n).write_bytes(b)
    with zipfile.ZipFile(out / f'{sid}.zip', 'w', zipfile.ZIP_STORED) as z:
        z.writestr('map.json', json.dumps(m, ensure_ascii=False, indent=1))
        for n, b in files.items():
            if not n.endswith('.zip'): z.writestr(n, b)
    d = convert(sid, m, files)
    (out / 'game.json').write_text(json.dumps(d, ensure_ascii=False, indent=1))
    print(sid, f"{d['scene']['w']}×{d['scene']['h']}", '가림·소품', len(d['scene']['objects']), '막힘', len(d['scene']['holes']), '자리', len(d['spots']), 'dotK', d['scene']['dotK'])
    rebuild()


if __name__ == '__main__':
    main()
