"""로제몬 시연판 장 단위 보정 (검수에서 나온 결함을 코드로 고침). apply(src, frames, idx) -> (frames, idx)
DROP[src] = 버릴 장 번호, ORDER[src] = 장 순서 바꾸기, SHIFT[src] = {장: (dx, dy)} 그림 옮기기."""
from PIL import Image

DROP = {}
ORDER = {}
SHIFT = {}


def _shift(im, dx, dy):
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (dx, dy)); return out


def apply(src, frames, idx):
    pairs = list(zip(frames, idx))
    if src in SHIFT:
        pairs = [(_shift(f, *SHIFT[src][i]) if i in SHIFT[src] else f, i) for f, i in pairs]
    if src in ORDER:
        pairs = [pairs[i] for i in ORDER[src] if i < len(pairs)]
    if src in DROP:
        pairs = [p for p in pairs if p[1] not in DROP[src]]
    return [p[0] for p in pairs], [p[1] for p in pairs]
