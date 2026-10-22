# 고르고디오 결함 코드 보정 (결함 목록 docs/캐릭터제작서/고르고디오_결함목록_2026-10-22.md 의 「코드」 항목).
# apply(clip, frames, idx) → (frames, idx): idx = 원본 장 번호(손 고정점이 장 빼기 뒤에도 맞게).
import numpy as np
from PIL import Image

DROP_CLIPS = set()          # 시연판에서 뺄 클립
DROP_FRAMES = {}            # {클립: [원본 장 번호, ...]} 생성기가 망친 장
ORDER = {}                  # {클립: [원본 장 번호 순서]}
ERASE = {}                  # {클립: [(장, x0, y0, x1, y1), ...]} 떠 있는 찌꺼기 지우기


def specks(im, keep=40):
    """본체와 떨어진 작은 덩어리(점·효과 찌꺼기)를 지운다: 연결 요소 중 keep px 미만."""
    a = np.array(im); m = a[:, :, 3] > 0
    from collections import deque
    seen = np.zeros_like(m); H, W = m.shape
    for y in range(H):
        for x in range(W):
            if m[y, x] and not seen[y, x]:
                comp = []; q = deque([(y, x)]); seen[y, x] = 1
                while q:
                    cy, cx = q.popleft(); comp.append((cy, cx))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = 1; q.append((ny, nx))
                if len(comp) < keep:
                    for cy, cx in comp: a[cy, cx, 3] = 0
    return Image.fromarray(a)


def apply(clip, fr, idx):
    fr = [specks(f) for f in fr]
    for i, x0, y0, x1, y1 in ERASE.get(clip, []):
        if i < len(fr):
            a = np.array(fr[i]); a[y0:y1, x0:x1] = 0; fr[i] = Image.fromarray(a)
    if clip in ORDER:
        idx = [i for i in ORDER[clip] if i < len(fr)]
    drop = set(DROP_FRAMES.get(clip, []))
    idx = [i for i in idx if i not in drop]
    return [fr[i] for i in idx], idx
