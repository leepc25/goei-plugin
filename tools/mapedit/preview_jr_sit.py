"""중림 앉혀 보기(2배): 장면 의자 자리에 인물을 게임과 같은 규칙으로 앉힌다 (사용자 2026-11-02 11:43).
의자는 그 자리 고정, 사람 발 = 의자 원점 − 맞춤값×배율 (fighter/seats.ts seatBody). 맞춤값: C01 = testroom3/chairs/<키>.json,
휴게실 의자 'L' = game-src/art/objects/chairs_shell/fit_all.json. 앉은 그림 = 앉기 줄(정면 60·옆 96·후면 61) 끝 장, 바닥선 = 그 장 가장 낮은 점.
사용: python3 tools/mapedit/preview_jr_sit.py <장면> <out.png> <자리id>=<인물키> ...
"""
import json, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'game-src/action/testroom3')); sys.path.insert(0, str(ROOT / 'game-src/action/testroom3/qa'))
_argv = sys.argv; sys.argv = sys.argv[:1]
import fit_chair as fc
sys.argv = _argv
sys.path.insert(0, str(ROOT / 'tools/mapedit'))
from preview_jr_chairs import persp

SIT = {'front': '60', 'side': '96', 'back': '61'}
SHELL = json.loads((ROOT / 'game-src/art/objects/chairs_shell/fit_all.json').read_text())


def main():
    sid, out = sys.argv[1], sys.argv[2]
    who = dict(a.split('=') for a in sys.argv[3:])
    g = json.loads((ROOT / f'game-src/mapedit/{sid}/game.json').read_text())['scene']
    m = json.loads((ROOT / f'game-src/mapedit/{sid}/map.json').read_text())
    P = ROOT / 'game-pack/jr-field'
    img = Image.open(P / f"{g['file']}.webp").convert('RGBA')
    layers = [(o['sortY'], 0, Image.open(P / f"{o['file']}.webp").convert('RGBA'), (o['x'], o['y'])) for o in g['objects'] if o.get('file')]
    chairs = m.get('chairs', [])
    for ch in chairs:
        face, st = ch.get('face'), ch.get('set')
        d = 'north' if face == 'N' else ('east' if st else 'west') if face == 'W' else 'east' if face == 'E' else ('south-east' if st else 'east')
        im = Image.open(ROOT / ('game-src/art/objects/chairs_shell/fit/%s.png' % d if st else 'game-src/art/objects/chairs/raw/c01_%s.png' % d)).convert('RGBA')
        if st and face == 'W': im = im.transpose(Image.FLIP_LEFT_RIGHT)
        k = persp(g, ch['y']) * g['dotK']
        im = im.resize((round(200 * k), round(200 * k)), Image.NEAREST)
        layers.append((ch['y'] + (1 if face == 'N' else -1), 0, im, (round(ch['x'] - 100 * k), round(ch['y'] - 171 * k))))
    for sp in m['spots']:
        key = who.get(sp['id'])
        if not key: continue
        if 'chair' in sp and isinstance(sp['chair'], int):
            ch = chairs[sp['chair']]; st = ch.get('set'); face = ch.get('face')
            dir_ = 'back' if face == 'N' else 'side' if face else 'front'
        else:
            st = None; face = None; dir_ = sp.get('dir', 'front')
        cfg, _ = fc.load(key)
        if st == 'L':
            fit = {'dx': 0, 'dy': 0, **SHELL.get(key, {}).get(dir_, {})}
        else:
            ims, vals = fc.values(cfg); fit = vals[dir_]
        im = fc.last(cfg, SIT[dir_]); sb = fc.line_base(cfg, SIT[dir_])
        fsgn = -1 if face == 'W' else 1
        if fsgn < 0: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        cx, cy = sp['seat']['x'], sp['seat']['y']
        k = persp(g, cy) * g['dotK']
        bx, by = cx - fsgn * fit['dx'] * k, cy - fit['dy'] * k
        w, h = round(im.width * k), round(im.height * k)
        s = im.resize((w, h), Image.NEAREST)
        # 후면 앉기는 의자가 몸 앞(의자 깊이 +1), 나머지는 몸이 의자 앞
        layers.append((by, 1, s, (round(bx - w / 2), round(by - sb * k))))
        print(sp['id'], key, dir_, 'set', st, 'fit', fit.get('dx'), fit.get('dy'), 'k %.3f' % k)
    for _, _, im, p in sorted(layers, key=lambda t: (t[0], t[1])): img.alpha_composite(im, p)
    img.convert('RGB').save(out)


if __name__ == '__main__':
    main()
