# 고르고디오 결함 코드 보정 (결함 목록 docs/캐릭터제작서/고르고디오_결함목록_2026-10-22.md 의 「코드」 항목).
# apply(clip, frames, idx) → (frames, idx): idx = 원본 장 번호(손 고정점이 장 빼기 뒤에도 맞게).
import numpy as np
from PIL import Image

DROP_CLIPS = {'turn'}       # 시연판에서 뺄 클립 — turn: 생성기가 돌지 않음(세 장 다 오른쪽), 엔진 좌우 반전으로 대신
DROP_FRAMES = {             # {클립: [원본 장 번호, ...]} 생성기가 망친 장
    'kthrow': [1],          # 결함 2: 뒷모습으로 돈 장(0번은 kready 3번으로 바꿈)
    'kpull': [1],           # 결함 3: 뽑기 전인데 칼이 이미 손에 있음
    'vault': [4],           # 결함 9: 마지막 장 흐트러짐(반투명 점)
    'pipe': [1, 2],         # 결함 5: 파이프 없는 장·뒷모습 장(0번은 파이프 멘 대기 장으로 바꿈)
}
ORDER = {}                  # {클립: [원본 장 번호 순서]}
ERASE = {                   # {클립: [(장, x0, y0, x1, y1), ...]} 떠 있는 찌꺼기 지우기
    'pipe': [(3, 97, 19, 121, 35), (4, 175, 99, 196, 138), (5, 147, 105, 162, 134)],   # 결함 5: 생성기가 쇠파이프를 해머로 그림 → 머리만 지워 곧은 파이프로
    'vault': [(0, 104, 133, 224, 139), (1, 101, 134, 224, 139), (2, 124, 133, 224, 139), (2, 104, 137, 118, 172)],   # 결함 9: 생성기가 그린 장애물 윗면 선
    'shotgun': [(0, 159, 94, 224, 122), (1, 160, 92, 224, 122)],   # 결함 6: 총구 불꽃·연기(효과는 엔진이 그림)
}
OBJ = {                     # {클립: [(장, x0, y0, x1, y1), ...]} 생성기가 그린 손에 든 물건(회색 계열) 지우기 — 피부는 남김
    'pickup': [(2, 108, 144, 128, 164), (3, 108, 144, 128, 164), (4, 104, 120, 122, 136)],   # 결함 4
    'getup': [(1, 100, 124, 126, 144)],   # 결함 7: 발 옆 회색 얼룩
}
SCENE = {'door', 'ladder', 'vault'}   # 결함 8: 생성기가 문·사다리·장애물을 같이 그림 → 캐릭터 팔레트 밖 색 지우고 큰 덩어리만 남김
SUBST = {'kthrow': {0: ('kready', 3)}, 'pipe': {0: ('idle_pipe', 0)}}   # {클립: {장: (다른 클립, 장)}} 망친 장을 같은 자세의 다른 클립 장으로 바꿈


def components(m):
    """8방향 연결 덩어리 [(크기, [(y, x), ...]), ...]"""
    from collections import deque
    seen = np.zeros_like(m, dtype=bool); H, W = m.shape; out = []
    for y, x in zip(*np.nonzero(m)):
        if seen[y, x]: continue
        comp = []; q = deque([(y, x)]); seen[y, x] = True
        while q:
            cy, cx = q.popleft(); comp.append((cy, cx))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
        out.append((len(comp), comp))
    return out


def specks(im, keep=40):
    """본체와 떨어진 작은 덩어리(점·효과 찌꺼기)를 지운다: 연결 요소 중 keep px 미만."""
    a = np.array(im)
    for n, comp in components(a[:, :, 3] > 0):
        if n < keep:
            for cy, cx in comp: a[cy, cx, 3] = 0
    return Image.fromarray(a)


GPT_CLIPS = {'undress', 'showerturn', 'shower', 'bath'}
_REF = None


def ref_palette():
    """옆모습 기준판(full/ref.png)의 색 전부(외곽선 #000000 포함)."""
    global _REF
    if _REF is None:
        import os
        im = Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'full', 'ref.png')).convert('RGBA')
        _REF = np.array(sorted({p[:3] for p in im.getdata() if p[3] > 0}), dtype=float)
    return _REF


def gpt_normalize(fr, clip):
    """GPT 납품 보정(재의뢰 없이 코드로): 반투명 가장자리 → 불투명/투명, 색 → ref.png 팔레트 최근접,
    키 → 기준판과 같게(클립 첫 장 기준 한 배율), 발바닥 → y169. 앉은 목욕은 첫 장 배율만 undress 기준으로."""
    pal = ref_palette()
    a0 = np.array(fr[0]); ys = np.where(a0[:, :, 3] > 127)[0]
    h = (ys.max() - ys.min() + 1) if len(ys) else 111
    k = 111 / h if clip != 'bath' else getattr(gpt_normalize, 'k', 1.0)
    if clip == 'undress': gpt_normalize.k = k
    out = []
    for f in fr:
        a = np.array(f).copy()
        a[:, :, 3] = np.where(a[:, :, 3] > 127, 255, 0)
        m = a[:, :, 3] > 0
        c = a[m][:, :3].astype(float)
        d = ((c[:, None, :] - pal[None, :, :]) ** 2).sum(2)
        a[m, :3] = pal[d.argmin(1)].astype(np.uint8)
        im = Image.fromarray(a)
        if abs(k - 1) > 0.02:
            ys2 = np.where(a[:, :, 3] > 0)[0]; bot = ys2.max() if len(ys2) else 169
            w, hh = im.size; s = im.resize((round(w * k), round(hh * k)), Image.NEAREST)
            o = Image.new('RGBA', (w, hh)); o.alpha_composite(s, (round(86 - 86 * k), round(bot - bot * k))); im = o
        a = np.array(im); ys2 = np.where(a[:, :, 3] > 0)[0]
        if len(ys2) and clip != 'bath' and ys2.max() != 169:
            im = Image.fromarray(np.roll(a, 169 - ys2.max(), axis=0))
        out.append(im)
    return out


def erase_obj(im, box):
    a = np.array(im).copy(); x0, y0, x1, y1 = box
    sub = a[y0:y1, x0:x1].astype(int)
    r, g, b, al = sub[..., 0], sub[..., 1], sub[..., 2], sub[..., 3]
    grey = (al > 0) & (r - b < 50) & (np.maximum(np.maximum(r, g), b) > 45)   # 피부(r-b 큼)는 남김
    sub[grey, 3] = 0
    # 물건 외곽선(검정)만 남은 것: 둘레에 검정 아닌 불투명 픽셀이 없는 검정 픽셀 지움
    dark = (sub[..., 3] > 0) & (np.maximum(np.maximum(sub[..., 0], sub[..., 1]), sub[..., 2]) <= 45)
    lit = (sub[..., 3] > 0) & ~dark
    near = np.zeros_like(lit)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1): near |= np.roll(np.roll(lit, dy, 0), dx, 1)
    sub[dark & ~near, 3] = 0
    a[y0:y1, x0:x1] = sub.astype(np.uint8)
    return Image.fromarray(a)


def clean_scene(im):
    a = np.array(im).copy(); m = a[:, :, 3] > 0
    pal = ref_palette()
    px = a[m][:, :3].astype(float)
    d = np.sqrt(((px[:, None, :] - pal[None, :, :]) ** 2).sum(2)).min(1)
    alpha = a[:, :, 3].copy(); sub = alpha[m]; sub[d > 6] = 0; alpha[m] = sub; a[:, :, 3] = alpha
    # 연결 덩어리: 가장 큰 것의 15% 이상만 남김(떨어진 문틀·사다리 기둥 찌꺼기 제거)
    comps = components(a[:, :, 3] > 0)
    big = max((n for n, _ in comps), default=0)
    for n, comp in comps:
        if n < 0.15 * big:
            for cy, cx in comp: a[cy, cx, 3] = 0
    return Image.fromarray(a)


def apply(clip, fr, idx):
    import os
    for i, (src, j) in SUBST.get(clip, {}).items():
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'full', 'clips', src, f'{j:02d}.png')
        if i < len(fr) and os.path.exists(p): fr[i] = Image.open(p).convert('RGBA')
    if clip in GPT_CLIPS: fr = gpt_normalize(fr, clip)
    if clip in SCENE: fr = [clean_scene(f) for f in fr]
    for i, *box in OBJ.get(clip, []):
        if i < len(fr): fr[i] = erase_obj(fr[i], box)
    fr = [specks(f) for f in fr]
    for i, x0, y0, x1, y1 in ERASE.get(clip, []):
        if i < len(fr):
            a = np.array(fr[i]); a[y0:y1, x0:x1] = 0; fr[i] = Image.fromarray(a)
    if clip in ORDER:
        idx = [i for i in ORDER[clip] if i < len(fr)]
    drop = set(DROP_FRAMES.get(clip, []))
    idx = [i for i in idx if i not in drop]
    return [fr[i] for i in idx], idx
