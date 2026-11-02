"""의자 자동 맞춤(10-28): 인물마다 앉기 끝 장(정면 60 · 옆 96 · 후면 61)을 재서 C01 의자(1배)의 위치·크기를 정함.
- 옆: 발에서 위로 올라가며 몸 뒤쪽 끝이 크게 뒤로 물러나는 줄 = 허벅지·엉덩이 아랫면 = 좌석 높이. 의자 좌석 높이(바닥에서 75화소)와 맞게 의자 크기를 정하고, 엉덩이 뒤 끝을 좌석 뒤 끝에 맞춤.
- 정면·후면: 같은 인물이니 옆에서 잰 크기를 쓰고, 몸 가운데에 맞춤. 정면은 의자가 사람 뒤라 바닥선이 조금 위, 후면은 앞이라 조금 아래(seat_fit.json 3명 손 맞춤 값과 같은 방향).
값은 화면 그림 화소(1배) 기준: 의자 바닥 가운데를 사람 발 기준점(그림 가운데·바닥)에서 dx(앞쪽 +)·dy(아래 +)만큼, 크기 s.
"""
import numpy as np
from PIL import Image

CHAIR_FLOOR = 171      # 의자 그림(200×200)에서 바퀴 바닥 줄
CHAIR_SEAT = {"east": 96, "south": 96, "north": 100}   # 좌석 윗면 줄
CHAIR_CX = {"east": 64, "south": 92, "north": 93}      # 옆: 좌석 뒤 끝 x / 정면·후면: 가운데 x
SEAT_H = CHAIR_FLOOR - 96


def mask(im):
    return np.array(im)[:, :, 3] > 40


def side_fit(im):
    """오른쪽을 보고 앉은 옆모습 한 장 → (좌석 높이, 엉덩이 뒤 끝 x, 바닥 y)"""
    m = mask(im); H, W = m.shape
    rows = [y for y in range(H) if m[y].any()]
    if not rows: return None
    floor = rows[-1]
    left = {y: int(np.nonzero(m[y])[0].min()) for y in rows}
    base = min(left[y] for y in range(floor - 6, floor + 1) if y in left)   # 발·정강이의 뒤 끝
    body_h = floor - rows[0]
    for y in range(floor - 8, rows[0], -1):
        if y in left and base - left[y] > 0.12 * body_h:   # 뒤로 크게 물러남 = 허벅지 아랫면
            return floor - y, left[y], floor
    return None


def center_x(im):
    m = mask(im); H, W = m.shape
    rows = [y for y in range(H) if m[y].any()]
    if not rows: return W / 2, H
    floor = rows[-1]; top = rows[0]
    band = m[top: top + int((floor - top) * 0.22)]   # 머리·어깨 가운데(팔·다리가 벌어져도 흔들리지 않게)
    xs = np.nonzero(band.any(axis=0))[0]
    return (xs.min() + xs.max()) / 2, floor


def fit(side_im, front_im, back_im):
    out = {}
    s = 1.0
    if side_im is not None:
        r = side_fit(side_im)
        if r:
            seat_h, back_x, floor = r
            s = 1.0   # 의자는 늘 1배(1m = 142화소). 크기를 바꾸지 않음(사용자 10-28)
            W = side_im.size[0]
            # 의자 그림을 s배로 그렸을 때 좌석 뒤 끝(CHAIR_CX east)이 엉덩이 뒤 끝에 오게: 의자 그림 원점(가운데 100)을 기준으로 dx
            out["side"] = {"dx": round(back_x - W / 2 - (CHAIR_CX["east"] - 100) * s, 1), "dy": round(floor - (side_im.size[1] - 4) + 2, 1), "s": round(s, 3)}
    for key, im, d in (("front", front_im, -6), ("back", back_im, 4)):
        if im is None: continue
        cx, floor = center_x(im)
        W = im.size[0]
        out[key] = {"dx": round(cx - W / 2 - (CHAIR_CX["south" if key == "front" else "north"] - 100) * s, 1), "dy": round(floor - (im.size[1] - 4) + d, 1), "s": round(s, 3)}
    return out
