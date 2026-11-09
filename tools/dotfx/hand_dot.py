"""손으로 찍은 도트(글자 격자)를 이펙트 시트로 바꾼다 (11-09 사용자 「도트를 찍으라니까 도형놀이」).
tools/dotfx/hand/<이름>.txt: '@ 장시간ms' 줄로 장을 나누고, 줄마다 글자 하나 = 점 하나. 사용: python3 tools/dotfx/hand_dot.py hit_big dot-hand-hit"""
import sys, json
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "game-src" / "action" / "testroom3" / "vfx"
PAL = {'W': (255, 255, 255), 'Y': (255, 246, 190), 'y': (255, 214, 90), 'o': (255, 170, 50), 'O': (240, 120, 30),
       'r': (200, 70, 20), 'R': (130, 36, 14), 'b': (84, 38, 16), 'k': (34, 16, 10), 'g': (120, 110, 106), 'G': (72, 64, 62)}


SHIFT = {'W': 'Y', 'Y': 'y', 'y': 'o', 'o': 'O', 'O': 'r', 'r': 'R', 'R': 'G', 'b': 'G', 'k': 'b', 'G': 'g', 'g': '.'}


def load(src):
    """장: '@ ms' 다음 줄들. '+' 줄 아래는 위에 겹쳐 찍음('.'은 그대로 둠). '@ ms from N shift S cut C' = N번째 장을 S단계 어둡게, 바깥 C겹 깎음(사라질 때)"""
    frames, dur, cur, layer = [], [], None, None
    def close():
        if cur is not None: frames.append(cur)
    for ln in Path(src).read_text(encoding="utf-8").splitlines():
        if ln.startswith('#'): continue
        if ln.startswith('@'):
            close(); a = ln[1:].split(); dur.append(int(a[0]))
            if 'from' in a:
                o = dict(zip(a[1::2], a[2::2])); base = [list(r) for r in frames[int(o['from']) - 1]]
                for _ in range(int(o.get('shift', 0))): base = [[SHIFT.get(c, c) for c in r] for r in base]
                for _ in range(int(o.get('cut', 0))):
                    h, w = len(base), max(len(r) for r in base)
                    g = lambda x, y: base[y][x] if 0 <= y < h and 0 <= x < len(base[y]) else '.'
                    base = [[c if c != '.' and all(g(x + dx, y + dy) != '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))) else '.' for x, c in enumerate(r)] for y, r in enumerate(base)]
                cur = base
            else: cur = []
            layer = None; continue
        if cur is None: continue
        if ln.strip() == '+': layer = 0; continue
        if not ln.strip(): continue
        if layer is None: cur.append(list(ln.rstrip()))
        else:
            while len(cur) <= layer: cur.append([])
            row = cur[layer]
            for x, ch in enumerate(ln.rstrip()):
                if ch == '.': continue
                while len(row) <= x: row.append('.')
                row[x] = ch
            layer += 1
    close()
    frames = [f[:48] if len(f) > 48 and all(not ''.join(r).strip('.') for r in f[48:]) else f for f in frames]
    return frames, dur


def main(name, out, pivot=(0.5, 0.5)):
    frames, dur = load(ROOT / "tools" / "dotfx" / "hand" / f"{name}.txt")
    W = max(len(r) for f in frames for r in f); H = max(len(f) for f in frames)
    cols = min(4, len(frames)); rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (W * cols, H * rows), (0, 0, 0, 0)); px = sheet.load(); meta = []
    for i, f in enumerate(frames):
        ox, oy = (i % cols) * W, (i // cols) * H
        for y, row in enumerate(f):
            for x, ch in enumerate(row):
                if ch in PAL: px[ox + x, oy + y] = PAL[ch] + (255,)
        meta.append({"filename": f"{out} {i}.png", "frame": {"x": ox, "y": oy, "w": W, "h": H}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": W, "h": H}, "sourceSize": {"w": W, "h": H}, "pivot": {"x": pivot[0], "y": pivot[1]}, "duration": dur[i]})
    sheet.save(OUT / f"{out}.png")
    (OUT / f"{out}.json").write_text(json.dumps({"frames": meta, "meta": {"app": "tools/dotfx/hand_dot.py (손으로 찍은 도트)", "image": f"{out}.png", "size": {"w": sheet.width, "h": sheet.height}}}, ensure_ascii=False))
    print(out, len(frames), "장", W, "x", H)


if __name__ == "__main__":
    a = sys.argv[1:]
    main(a[0], a[1], (0.5, float(a[2])) if len(a) > 2 else (0.5, 0.5))
