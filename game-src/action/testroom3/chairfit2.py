"""의자 자동 맞춤 2판(10-29, 사용자: 의자가 전혀 안 맞음 → 전수 다시).
앉기 끝 장(정면 60 · 옆 96 · 후면 61)을 재서 C01 의자(1배)의 자리를 정한다. 의자 방향(img)은 눈으로 고른 값을 chairs/<키>.json 에 두고, 이 식은 그 방향 의자의 좌석 가운데를 쓴다.
- 정면·후면: 엉덩이·허리 띠(그림 위에서 42~60%)의 몸 가운데 x = 그 방향 의자 좌석 가운데 x. 정면 dy = -20(의자가 사람 뒤라 바닥선이 위), 후면 dy = +12(앞이라 아래).
- 옆: 발에서 위로 올라가다 몸 뒤쪽 끝이 크게 뒤로 물러나는 줄 = 허벅지 아랫면 = 좌석 윗면(의자 바닥에서 75화소 위). 허벅지 윗띠의 가장 앞 점 = 무릎 → 좌석 앞 끝(east 의자 x=131)보다 34화소 앞에(허벅지 길이 ≈ 80 > 좌석 깊이 46) 오게(엉덩이 뒤 끝은 머리카락·코트에 가려 못 씀).
값은 1배 화면 화소: dx 앞쪽(오른쪽) +, dy 아래 +, 의자 원점(100, 171) 기준(테스트룸·fit_chair 와 같음).
"""
import numpy as np
from PIL import Image

CHAIR_FLOOR = 171; SEAT_TOP = 96; SEAT_H = CHAIR_FLOOR - SEAT_TOP   # 75
SEAT_FRONT_EAST = 131; KNEE_AHEAD = 34                                # 옆 의자 좌석 앞 끝 x, 무릎은 그보다 이만큼 앞
SEAT_CX = {"south": 92, "south-east": 98, "south-west": 86, "north": 93, "north-east": 98, "north-west": 87}


def mask(im): return np.array(im)[:, :, 3] > 40


def hip_center(im, lo=0.42, hi=0.60):
    """정면·후면: 엉덩이·허리 띠의 몸 가운데 x, 바닥 y"""
    m = mask(im); rows = np.nonzero(m.any(axis=1))[0]
    if not len(rows): return im.size[0] / 2, im.size[1]
    top, floor = int(rows[0]), int(rows[-1]); h = floor - top
    band = m[top + int(h * lo): top + int(h * hi)]
    xs = np.nonzero(band.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2, floor


def side_measure(im):
    """오른쪽을 보고 앉은 옆모습 → (좌석 높이 seat_h, 무릎 앞 x, 바닥 y). 엉덩이 뒤 끝은 긴 머리·코트 자락이 뒤로 늘어져 못 믿음(10-29 잼트리·고그니쟈) → 무릎 앞을 기준으로"""
    m = mask(im); H, W = m.shape
    rows = [y for y in range(H) if m[y].any()]
    if not rows: return None
    floor = rows[-1]; top = rows[0]; body_h = floor - top
    left = {y: int(np.nonzero(m[y])[0].min()) for y in rows}
    right = {y: int(np.nonzero(m[y])[0].max()) for y in rows}
    base = min(left[y] for y in range(floor - 6, floor + 1) if y in left)   # 발·정강이 뒤 끝
    seat_y = None
    for y in range(floor - 8, top, -1):
        if y in left and base - left[y] > 0.12 * body_h:   # 뒤로 크게 물러남 = 허벅지 아랫면
            seat_y = y; break
    if seat_y is None or floor - seat_y < 45: seat_y = floor - SEAT_H   # 코트 자락·치마에 걸림 → 기본 좌석 높이
    knee = max(right[y] for y in range(seat_y - 22, seat_y + 4) if y in right)   # 허벅지 윗띠의 가장 앞 = 무릎
    return floor - seat_y, knee, floor


def fit(side_im, front_im, back_im, imgs, prev=None):
    """imgs = {front: south|south-east|south-west, side: east, back: north|north-east|north-west}. prev = 전 판 값(정면 dy 만 이어 씀)"""
    out = {}
    if side_im is not None and (r := side_measure(side_im)):
        seat_h, knee, floor = r; W, H = side_im.size
        out["side"] = {"dx": round((knee - KNEE_AHEAD) - W / 2 - (SEAT_FRONT_EAST - 100), 1), "dy": round(floor - (H - 4) + max(0, min(10, SEAT_H - seat_h)), 1), "s": 1.0, "img": "east"}
    for key, im, dy0 in (("front", front_im, -20), ("back", back_im, 12)):   # 정면: 의자가 뒤라 바닥선 위(-20), 후면: 앞이라 아래(+12). 인물마다 다르게 하지 않음
        if im is None: continue
        cx, floor = hip_center(im); W, H = im.size
        img = imgs.get(key) or ("south" if key == "front" else "north")
        out[key] = {"dx": round(cx - W / 2 - (SEAT_CX[img] - 100), 1), "dy": round(floor - (H - 4) + dy0, 1), "s": 1.0, "img": img}
    return out
