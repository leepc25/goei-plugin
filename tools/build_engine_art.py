#!/usr/bin/env python3
"""게임 엔진용 쟈알디 그림 묶음 (2026-10-21).

game-src/action/jyaldi-v5/full/clips/ 의 기존 클립을 한 픽셀도 바꾸지 않고, 장마다 투명 테두리만 잘라 아틀라스 한 장에 담는다.
장마다 판정 상자를 그림에서 재서 함께 적는다 (엔진 판정 보기 H로 확인, 손으로 고칠 때는 OVERRIDE에).
  hurt = 몸통 상자 (불투명 픽셀 x의 10~90% 범위, 머리끝~발)
  reach = 그림의 가장 앞쪽 점 근처 상자 (때리는 장의 공격 판정 후보)
좌표: 원본 장(192×144) 기준 → 앵커(x=57, 발 y=136) 기준으로 바꿔 적는다. 오른쪽 보기, y는 위가 +.

출력: game-pack/jyaldi/atlas.png, game-pack/jyaldi/frames.json, game-pack/jyaldi/pack.json, game-pack/jyaldi/cutin.png
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'full')
OUT = os.path.join(ROOT, 'game-pack', 'jyaldi')
FOOT, ANCHOR = 136, 57

# 엔진 키: (원본 클립, 장 선택) — 장 선택은 build_jyaldi_full_demo.py의 범위·순서와 같다
CLIPS = {
    'idle': ('idle', None), 'guard': ('guard', None), 'engage': ('engage', None),
    'walk': ('walk', None), 'step': ('step', None), 'run': ('run', None),
    'jump': ('jump', None), 'land': ('land', None), 'fall': ('fall', None),
    'crouch': ('crouch', None), 'crouchwalk': ('duckwalk', list(range(0, 7))),
    'lowkick': ('lowkick', None), 'groundblast': ('lowstrike', None),
    'jab': ('combo', list(range(0, 5))), 'cross': ('combo', list(range(4, 10))), 'power': ('combo', list(range(9, 15))),
    'dash': ('dash', None), 'airkick': ('airkick', list(range(0, 5))),
    'draw': ('draw', None), 'fire': ('fire', [3, 0, 2, 1]), 'reload': ('reload', None),
    'blast': ('blast', None), 'block': ('blockfront', None), 'evade': ('evade', None),
    'grab': ('grab2', None), 'grabknee': ('grabknee2', None), 'grabblast': ('grabblast', [0, 1, 2, 3, 4, 7, 5, 6]),
    'super': ('super', None), 'hit': ('hit', None), 'down': ('down', list(range(0, 7))), 'getup': ('getup', None),
    'collapse': ('collapse', None), 'tired': ('tired', None),
    'drink': ('drink', None), 'eat': ('eat', None), 'bandage': ('bandage', None), 'pickup': ('pickup', None), 'toss': ('toss', None),
}


def frames_of(src):
    d = os.path.join(SRC, 'clips', src)
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d)) if f.endswith('.png')]


def measure(im):
    a = im.getchannel('A')
    bb = a.getbbox()
    if not bb:
        return None, None, None
    px = a.load()
    xs = []
    front = (bb[0], bb[1])
    for y in range(bb[1], bb[3]):
        for x in range(bb[0], bb[2]):
            if px[x, y] > 0:
                xs.append(x)
                if x > front[0]:
                    front = (x, y)
    xs.sort()
    lo, hi = xs[len(xs) // 10], xs[len(xs) * 9 // 10]
    # 앵커 기준, y 위가 +
    hurt = [lo - ANCHOR, hi + 1 - ANCHOR, FOOT - bb[3], FOOT - bb[1]]
    fx, fy = front
    reach = [fx - 22 - ANCHOR, fx + 4 - ANCHOR, FOOT - (fy + 12), FOOT - (fy - 12)]
    return bb, hurt, reach


def main():
    os.makedirs(OUT, exist_ok=True)
    cells, meta = [], {}
    for key, (src, sel) in CLIPS.items():
        fr = frames_of(src)
        if key == 'getup':  # 생성된 0·1장 회색 얼룩 → 다운 마지막 누운 장으로 대체 (시연판 빌더와 같음)
            fr = frames_of('down')[6:7] + fr[2:]
        if sel:
            fr = [fr[i] for i in sel if i < len(fr)]
        info = []
        for im in fr:
            bb, hurt, reach = measure(im)
            if not bb:
                bb = (0, 0, 1, 1)
            crop = im.crop(bb)
            cells.append(crop)
            info.append({'cell': len(cells) - 1, 'ox': bb[0] - ANCHOR, 'oy': bb[1] - FOOT, 'hurt': hurt, 'reach': reach})
        meta[key] = info
    # 줄 채우기 아틀라스 (폭 2048)
    W, x, y, rowh, pos = 2048, 0, 0, 0, []
    for c in cells:
        if x + c.width > W:
            x, y, rowh = 0, y + rowh + 1, 0
        pos.append((x, y))
        x += c.width + 1
        rowh = max(rowh, c.height)
    H = y + rowh
    atlas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for c, p in zip(cells, pos):
        atlas.paste(c, p)
    atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
    for key, info in meta.items():
        for f in info:
            c = cells[f['cell']]
            f['sx'], f['sy'] = pos[f['cell']]
            f['w'], f['h'] = c.width, c.height
            del f['cell']
    json.dump({'anchor': ANCHOR, 'foot': FOOT, 'clips': meta}, open(os.path.join(OUT, 'frames.json'), 'w'), separators=(',', ':'))
    json.dump({'id': 'jyaldi', 'required': True}, open(os.path.join(OUT, 'pack.json'), 'w'))
    Image.open(os.path.join(SRC, 'cutin51.png')).save(os.path.join(OUT, 'cutin.png'), optimize=True)
    print('atlas', W, H, os.path.getsize(os.path.join(OUT, 'atlas.png')) // 1024, 'KB', 'frames', len(cells))


if __name__ == '__main__':
    main()
