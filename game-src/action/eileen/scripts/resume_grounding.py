"""Reviewed support-frame placement only; raw artwork is never rewritten."""
from PIL import Image

# 2026-10-22 contact-sheet review: stationary support soles, not jump/run frames.
# Positive y moves down. No resize, alpha wrap or inferred all-frame floor snapping.
OFFSETS = {
    'pushkick': {1: 2, 2: 2, 3: 2, 4: 2},
    'step': {2: -1, 3: -1, 4: -1, 6: -1},
    'limp': {3: -2, 4: -2},
}

def apply(clip, frames):
    offsets = [OFFSETS.get(clip, {}).get(i, 0) for i in range(len(frames))]
    result = []
    for frame, dy in zip(frames, offsets):
        if not dy:
            result.append(frame)
            continue
        shifted = Image.new('RGBA', frame.size)
        shifted.paste(frame, (0, dy))
        assert sum(frame.getchannel('A').getdata()) == sum(shifted.getchannel('A').getdata()), 'clipped sprite'
        result.append(shifted)
    return result, offsets

def shift_anchors(anchors, offsets):
    if anchors:
        for anchor, dy in zip(anchors, offsets):
            for key in ('hand', 'hand2', 'hip', 'muzzle'):
                if key in anchor:
                    anchor[key][1] += dy
    return anchors
