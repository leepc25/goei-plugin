"""에일린 클립 코드 보정 (2026-10-22 장 단위 검수 결과, docs/캐릭터제작서/에일린_결함목록_2026-10-22.md).
apply(key, frames, idx, get) → (frames, idx). get(이름) = 효과 지우기를 거친 다른 클립의 장 목록."""
import numpy as np
from PIL import Image


def shift_region(im, x0, dy, dx=0):
    """x0보다 앞(오른쪽) 픽셀만 dy·dx만큼 옮김 = 손·총만 반동으로 튀게"""
    a = np.array(im); b = a.copy(); b[:, x0:] = 0
    part = np.zeros_like(a); part[:, x0:] = a[:, x0:]
    part = np.roll(np.roll(part, dy, 0), dx, 1)
    m = part[..., 3] > 0; b[m] = part[m]
    return Image.fromarray(b)


def erase_nondark(im, x0, y0, x1, y1):
    a = np.array(im); r = a[y0:y1, x0:x1]
    mx = r[..., :3].max(axis=2)
    r[mx >= 90] = 0
    return Image.fromarray(a)


def apply(key, fr, idx, get):
    fr = list(fr); idx = list(idx)
    if key == 'pistolfire':
        # 결함: 생성기가 권총 대신 소총을 들려 놓음 → 권총 전환 끝 장(권총 두 손 조준)으로 다시 짬, 반동은 손·총만 위로
        t = get('transition')
        if t:
            base = t[-1]; a = np.array(base); xs = np.nonzero(a[..., 3].any(axis=0))[0]
            x0 = int(xs.max()) - 26   # 앞팔 끝~권총
            fr = [base, shift_region(base, x0, -3, -1), shift_region(base, x0, -1), base]
            idx = [len(t) - 1] * 4; idx = [('transition', i) for i in idx]
    if key == 'pistolreload':
        t = get('transition')
        if t and len(fr) >= 6:
            for i in (0, 4, 5): fr[i] = t[-1]; idx[i] = ('transition', len(t) - 1)
    if key == 'read' and len(fr) > 6:
        fr[6] = erase_nondark(fr[6], 97, 95, 104, 112)   # 총구 아래로 늘어진 가는 선
    return fr, idx
