#!/usr/bin/env python3
"""아이템·무기 그림 도트화: game-src/art/items/raw/<시트>.png (마젠타 바탕 3×3) → game-src/art/items/dot/<id>.png + items.json

배경 물건과 같은 방법 B(원본 해상도에서 팔레트로 색을 고르고 칸마다 다수결). 크기는 아래 표:
  ('w', n) = 손에 드는 무기 길이 n도트, ('h', n) = 높이 n도트, ('m', 미터) = 실제 높이(쟈알디 키 1.65m = 99도트).
grip(손 기준점)은 요청서 규칙대로 자동으로 잰 뒤 GRIP_FIX로 사람이 고친다. 부수는 물건·조각은 grip 없음.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bg_pixelize import DPM, cut_objects, ink, mode_down, place_palette, tone  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'game-src/art/items/raw'
OUT = ROOT / 'game-src/art/items/dot'

# 시트별 9칸: (아이템 id, 크기, grip 규칙). grip 규칙: 'hilt' 왼쪽 손잡이, 'pistol' 권총 손잡이, 'gun' 긴 총 뒤 손잡이,
# 'hold' 가운데 아래 1/3, 'top' 위쪽 가운데(머리 위로 들기), None = grip 없음.
SHEETS: dict[str, list[tuple[str, tuple[str, float], str | None]]] = {
    'items_weapons_temp': [
        ('pipe', ('w', 36), 'hilt'), ('chairleg', ('w', 24), 'hilt'), ('kitchenknife', ('w', 18), 'hilt'),
        ('katana', ('w', 38), 'hilt'), ('smg', ('w', 28), 'gun'), ('servicepistol', ('w', 16), 'pistol'),
        ('shotgun', ('w', 38), 'gun'), ('ammo_box', ('h', 12), 'hold'), ('rifle_mag', ('h', 14), 'hold'),
    ],
    'items_weapons_signature': [
        ('sig_jyaldi_pistol', ('w', 15), 'pistol'), ('sig_aileen_carbine', ('w', 30), 'gun'), ('sig_aileen_pistol', ('w', 17), 'pistol'),
        ('sig_deadpole_pistol', ('w', 18), 'pistol'), ('sig_gorgodio_knife', ('w', 22), 'hilt'), ('sig_gorgodio_knife_stuck', ('h', 20), None),
        ('sig_geshugan_cube', ('h', 12), 'hold'), ('sig_rojemon_doll', ('h', 20), 'hold'), ('pistol_mag', ('h', 12), 'hold'),
    ],
    'items_consumables': [
        ('medkit', ('h', 16), 'hold'), ('bandage', ('h', 14), 'hold'), ('antidote', ('h', 16), 'hold'),
        ('salt', ('h', 15), 'hold'), ('flash', ('h', 15), 'hold'), ('smoke', ('h', 17), 'hold'),
        ('charm', ('h', 18), 'hold'), ('energy', ('h', 16), 'hold'), ('adrenaline', ('w', 18), 'hold'),
    ],
    'items_pickups': [
        ('cash', ('h', 12), 'hold'), ('coins', ('h', 12), 'hold'), ('shard', ('h', 16), 'hold'),
        ('heal_orb', ('h', 14), 'hold'), ('rounds', ('h', 12), 'hold'), ('scrap', ('h', 14), 'hold'),
        ('oddcoin', ('h', 16), 'hold'), ('rustkey', ('h', 16), 'hold'), ('tooth', ('h', 12), 'hold'),
    ],
    'items_relics': [
        ('photo', ('h', 18), 'hold'), ('dreamcatcher', ('h', 18), 'hold'), ('blackbox', ('h', 18), 'hold'),
        ('unknown_device', ('h', 18), 'hold'), ('backpack', ('h', 20), 'hold'), ('wallet', ('h', 12), 'hold'),
        ('hand_mirror', ('h', 18), 'hold'), ('music_box', ('h', 14), 'hold'), ('cassettes', ('h', 14), 'hold'),
    ],
    'items_vendor': [
        ('vendor_stall', ('m', 2.1), None), ('doctor_bag', ('m', 0.45), None), ('loan_envelope', ('h', 14), 'hold'),
        ('vending', ('m', 1.8), None), ('merchant_crate', ('m', 0.6), None), ('cash_box', ('h', 14), 'hold'),
        ('clinic_tray', ('m', 0.85), None), ('stall_lamp', ('h', 20), None), ('price_tag', ('h', 12), 'hold'),
    ],
    'props_throw_break': [
        ('chair', ('m', 0.9), 'top'), ('pot', ('m', 0.7), 'top'), ('extinguisher', ('m', 0.6), 'top'),
        ('tv', ('m', 0.6), 'top'), ('table', ('m', 0.35), 'top'), ('bin', ('m', 0.7), 'top'),
        ('crate', ('m', 0.7), None), ('drawer', ('m', 0.8), None), ('mailbox', ('m', 0.6), None),
    ],
    'props_break_more': [
        ('barrel', ('m', 0.9), None), ('locker', ('m', 1.9), None), ('crackedwall', ('m', 1.0), None),
        ('crate_broken', ('m', 0.3), None), ('drawer_broken', ('m', 0.35), None), ('mailbox_broken', ('m', 0.3), None),
        ('barrel_broken', ('m', 0.6), None), ('pot_broken', ('m', 0.35), None), ('tv_broken', ('m', 0.45), None),
    ],
}

# 자동 grip이 어긋난 것은 여기서 고친다 (도트 좌표).
GRIP_FIX: dict[str, list[int]] = {}


def unkey(sheet: Image.Image) -> Image.Image:
    """마젠타 바탕 빼기: 가장자리에서 이어진 마젠타 계열만 지운다(보라 수정·안개 병은 남는다), 분홍 테두리 2칸 정리."""
    a = np.asarray(sheet.convert('RGBA')).copy()
    r, g, b = (a[:, :, i].astype(int) for i in range(3))
    key = (r - g > 150) & (b - g > 150) & (abs(r - b) < 60)
    reach = np.zeros_like(key)
    reach[0, :] = key[0, :]; reach[-1, :] = key[-1, :]; reach[:, 0] = key[:, 0]; reach[:, -1] = key[:, -1]
    while True:
        n = reach.copy()
        n[1:] |= reach[:-1]; n[:-1] |= reach[1:]; n[:, 1:] |= reach[:, :-1]; n[:, :-1] |= reach[:, 1:]
        n &= key
        if (n == reach).all():
            break
        reach = n
    # 물건 안에 갇힌 바탕(가판 차양 아래, 쟁반 다리 사이): 아주 진한 마젠타는 어디서든 지운다
    reach |= (r > 215) & (b > 215) & (g < 45)
    pink = (r - g > 70) & (b - g > 70)
    for _ in range(2):
        edge = np.zeros_like(reach)
        edge[1:] |= reach[:-1]; edge[:-1] |= reach[1:]; edge[:, 1:] |= reach[:, :-1]; edge[:, :-1] |= reach[:, 1:]
        reach |= edge & pink
    a[reach] = (0, 0, 0, 0)
    return Image.fromarray(a, 'RGBA')


def grip_of(im: Image.Image, rule: str | None) -> list[int] | None:
    al = np.asarray(im.getchannel('A')) > 0
    h, w = al.shape
    ys, xs = np.nonzero(al)
    if rule is None or not len(xs):
        return None
    if rule == 'top':
        top = ys.min()
        return [int(w // 2), int(top)]
    if rule == 'hold':
        return [int(w // 2), int(round(h * 2 / 3))]
    if rule == 'hilt':
        # 왼쪽 1/5 손잡이 부분의 가운데
        x1 = max(1, w // 5)
        sel = xs < x1
        return [int(x1 // 2), int(round(ys[sel].mean()))]
    # 총: 몸통 아래로 내려온 손잡이. 권총은 왼쪽 절반, 긴 총은 15~55% 구간에서 가장 낮게 내려온 열 묶음.
    lo, hi = (0, w // 2) if rule == 'pistol' else (int(w * 0.15), int(w * 0.55))
    bottoms = np.array([ys[xs == x].max() if (xs == x).any() else -1 for x in range(w)])
    seg = bottoms[lo:hi]
    deep = seg.max()
    cols = np.nonzero(seg >= deep - 1)[0] + lo
    body = int(np.median([ys[xs == x].min() for x in range(w) if (xs == x).any()]))
    return [int(round(cols.mean())), int(round((body + deep) / 2 + (deep - body) * 0.15))]


def main(argv: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    meta_path = ROOT / 'game-src/art/items/items.json'
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    for sheet, rows in SHEETS.items():
        if argv and sheet not in argv:
            continue
        src = RAW / f'{sheet}.png'
        if not src.exists():
            continue
        objs = cut_objects(unkey(Image.open(src)))
        if len(objs) != 9:
            print(f'{sheet}: 물건 {len(objs)}개 (9개가 아님) — 건너뜀')
            continue
        jobs = []
        for (iid, (mode, v), rule), o in zip(rows, objs):
            if mode == 'w':
                size = (int(v), max(1, round(o.height * v / o.width)))
            else:
                nh = round(v * DPM) if mode == 'm' else int(v)
                size = (max(1, round(o.width * nh / o.height)), nh)
            jobs.append((iid, tone(o), size, rule))
        pal = place_palette([j[1].convert('RGB') for j in jobs])
        for iid, im, size, rule in jobs:
            q = mode_down(im, size, pal)
            pad = Image.new('RGBA', (q.width + 2, q.height + 2))
            pad.paste(q, (1, 1))
            q = ink(pad, True)
            q.save(OUT / f'{iid}.png', optimize=True)
            g = GRIP_FIX.get(iid) or grip_of(q, rule)
            e = {'file': f'dot/{iid}.png', 'sheet': sheet, 'w': q.width, 'h': q.height, 'foot': [q.width // 2, q.height - 1]}
            if g:
                e['grip'] = g
            meta[iid] = e
        print(f'{sheet}: {len(jobs)}개')
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
