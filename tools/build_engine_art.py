#!/usr/bin/env python3
"""게임 엔진용 쟈알디 그림 묶음 (2026-10-21).

game-src/action/jyaldi-v5/full/final/ 의 게임용 최종 스트립을 한 픽셀도 바꾸지 않고, 장마다 투명 테두리만 잘라 아틀라스 한 장에 담는다.
장마다 판정 상자를 그림에서 재서 함께 적는다 (엔진 판정 보기 H로 확인, 손으로 고칠 때는 OVERRIDE에).
  hurt = 몸통 상자 (불투명 픽셀 x의 10~90% 범위, 머리끝~발)
  reach = 그림의 가장 앞쪽 점 근처 상자 (때리는 장의 공격 판정 후보)
  hand  = 손 고정점 [x, y, 각도°]. 든 물건(무기·환경 물건)은 캐릭터 그림에 넣지 않고 엔진이 이 점에 물건 그림을 따로 그린다.
          final/hands.json {클립: [[x, y, 각도] 또는 null, ...]} (원본 192×144 장 좌표, 아래가 +y)이 있으면 그 값,
          없으면 팔 높이(그림 위에서 35~65%)의 가장 앞쪽 점으로 어림한다 (각도 -30).
좌표: 원본 장(192×144) 기준 → 앵커(x=57, 발 y=136) 기준으로 바꿔 적는다. 오른쪽 보기, y는 위가 +.

출력: game-pack/jyaldi/atlas.png, game-pack/jyaldi/frames.json, game-pack/jyaldi/pack.json, game-pack/jyaldi/cutin.png
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5', 'full')
OUT = os.path.join(ROOT, 'game-pack', 'jyaldi')
FOOT, ANCHOR = 136, 57

# 게임용 최종 스트립 (game-src/action/jyaldi-v5/full/final/<클립>.png, 192×144 장을 가로로 이음, 보정 반영).
# 엔진 키 → 최종 스트립 이름
CLIPS = {
    'idle': 'idle', 'guard': 'guard', 'engage': 'engage', 'walk': 'walk', 'step': 'step', 'run': 'run',
    'jump': 'jump', 'land': 'land', 'fall': 'fall', 'crouch': 'crouch', 'crouchwalk': 'crouchwalk',
    'lowkick': 'lowstrike', 'groundblast': 'groundblast', 'jab': 'jab', 'cross': 'cross', 'power': 'power',
    'dash': 'dash', 'airkick': 'airkick', 'draw': 'draw', 'fire': 'fire', 'reload': 'reload', 'blast': 'blast',
    'block': 'block', 'evade': 'evade', 'grab': 'grab', 'grabknee': 'grabknee', 'grabblast': 'grabblast',
    'super': 'super', 'hit': 'hit', 'down': 'down', 'getup': 'getup', 'collapse': 'collapse', 'tired': 'tired',
    'drink': 'drink', 'eat': 'eat', 'bandage': 'bandage', 'pickup': 'pickup', 'toss': 'toss',
    'pipe': 'pipe', 'walk_shotgun': 'walk_shotgun',
    # 쟈알디 단독 시연판(jyaldi-full)에서 쓰던 전투 클립 (2026-10-22 사용자: 통합판에 전부 연결)
    'holster': 'holster', 'charge': 'charge', 'chain': 'chain', 'wall': 'wall', 'shotgun': 'shotgun',
    'idle_shotgun': 'idle_shotgun', 'run_shotgun': 'run_shotgun', 'idle_pipe': 'idle_pipe', 'walk_pipe': 'walk_pipe',
    'carry2_idle': 'carry2_idle', 'carry2_walk': 'carry2_walk', 'carry2_run': 'carry2_run', 'support': 'support', 'glove': 'glove',
}
# 본부 자리 동작 (생활 클립, hub host.act가 순서대로 재생). 「본부 다시 만들기」 스레드 요청 2026-10-22
for _k in ('chairsit typing seatthink seatmouth doze liesit bedlie liehold handswork brushteeth gearcheck '
           'undress showerturn shower stepover bath holdlook').split():
    CLIPS[_k] = _k
FW, FH = 192, 144


def frames_of(name):
    strip = Image.open(os.path.join(SRC, 'final', name + '.png')).convert('RGBA')
    return [strip.crop((i * FW, 0, (i + 1) * FW, FH)) for i in range(strip.width // FW)]


HANDS_FILE = os.path.join(SRC, 'final', 'hands.json')
HANDS = json.load(open(HANDS_FILE)) if os.path.exists(HANDS_FILE) else {}


def guess_hand(im, bb):
    a = im.getchannel('A').load()
    h = bb[3] - bb[1]
    best = None
    for y in range(bb[1] + int(h * 0.35), bb[1] + int(h * 0.65)):
        for x in range(bb[2] - 1, bb[0] - 1, -1):
            if a[x, y] > 0:
                if not best or x > best[0]:
                    best = (x, y)
                break
    return best


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
    for key, src in CLIPS.items():
        fr = frames_of(src)
        info = []
        for im in fr:
            bb, hurt, reach = measure(im)
            if not bb:
                bb = (0, 0, 1, 1)
            crop = im.crop(bb)
            cells.append(crop)
            i = len(info)
            given = HANDS.get(key) or HANDS.get(src)
            if given and i < len(given) and given[i]:
                hx, hy, hd = given[i]
            else:
                g = guess_hand(im, bb) if hurt else None
                hx, hy, hd = (g[0] - 3, g[1], -30) if g else (ANCHOR + 18, FOOT - 50, -30)
            hand = [hx - ANCHOR, FOOT - hy, hd]
            info.append({'cell': len(cells) - 1, 'ox': bb[0] - ANCHOR, 'oy': bb[1] - FOOT, 'hurt': hurt, 'reach': reach, 'hand': hand})
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
