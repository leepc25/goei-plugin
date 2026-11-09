"""손으로 찍은 조각(불혀·연기·불꽃)을 여러 개 겹쳐 큰 불길 장을 만든다 (11-09). 조각 그림은 손도트 그대로, 여기서는 놓는 자리·시간만 정함.
사용: python3 tools/dotfx/hand_compose.py"""
import json, math, random
from pathlib import Path
from PIL import Image
import hand_dot as H

ROOT = Path(__file__).resolve().parents[2]
def frames(name):
    fr, _ = H.load(ROOT / "tools" / "dotfx" / "hand" / f"{name}.txt"); return fr

def stamp(canvas, fr, x, y, flip=False):
    for j, row in enumerate(fr):
        for i, ch in enumerate(row):
            if ch == '.' or ch not in H.PAL: continue
            xx = x + (len(row) - 1 - i if flip else i); yy = y + j
            if 0 <= yy < len(canvas) and 0 <= xx < len(canvas[0]): canvas[yy][xx] = ch

def burst(out, W=104, Hh=112, N=14, seed=7, n_tongue=64, n_smoke=22, core='hit_a', ink=True):
    rnd = random.Random(seed)
    T, S, C, B = frames('tongue'), frames('smoke'), frames(core), frames('hit_b')
    ox, oy = 24, 78                      # 맞은 자리
    tongues = []
    for k in range(n_tongue):
        a = math.radians(rnd.uniform(-75, 30))      # 오른쪽·위로
        sp = rnd.uniform(0.9, 2.2); b = rnd.randint(0, 6)
        tongues.append((a, sp, b, rnd.random() < 0.4, rnd.uniform(2, 14)))
    smokes = [(math.radians(rnd.uniform(-80, 20)), rnd.uniform(10, 34), rnd.randint(2, 7), rnd.random() < 0.5) for _ in range(n_smoke)]
    out_frames, dur = [], []
    for t in range(N):
        cv = [['.'] * W for _ in range(Hh)]
        # 연기 (맨 뒤)
        for a, r, b, fl in smokes:
            f = t - b
            if 0 <= f < len(S):
                rr = r + f * 2.2
                stamp(cv, S[f], int(ox + math.cos(a) * rr) - 7, int(oy + math.sin(a) * rr - f * 1.5) - 6, fl)
        # 불혀
        for a, sp, b, fl, r0 in tongues:
            f = t - b
            if 0 <= f < len(T):
                rr = r0 + f * sp * 3
                stamp(cv, T[f], int(ox + math.cos(a) * rr) - 8, int(oy + math.sin(a) * rr - f * 2) - 19, fl)
        # 먹물 (가운데, 처음 몇 장)
        if ink and t < len(B): stamp(cv, B[t], ox - 20, oy - 20)
        # 흰 섬광 (맨 앞)
        if t < len(C): stamp(cv, C[t], ox - 18, oy - 18)
        out_frames.append(cv); dur.append(35 if t < 6 else 45)
    # 시트로
    cols = 4; rows = (N + cols - 1) // cols
    sheet = Image.new("RGBA", (W * cols, Hh * rows), (0, 0, 0, 0)); px = sheet.load(); meta = []
    for i, cv in enumerate(out_frames):
        x0, y0 = (i % cols) * W, (i // cols) * Hh
        for y, row in enumerate(cv):
            for x, ch in enumerate(row):
                if ch in H.PAL: px[x0 + x, y0 + y] = H.PAL[ch] + (255,)
        meta.append({"filename": f"{out} {i}.png", "frame": {"x": x0, "y": y0, "w": W, "h": Hh}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": W, "h": Hh}, "sourceSize": {"w": W, "h": Hh}, "pivot": {"x": ox / W, "y": oy / Hh}, "duration": dur[i]})
    sheet.save(H.OUT / f"{out}.png")
    (H.OUT / f"{out}.json").write_text(json.dumps({"frames": meta, "meta": {"app": "tools/dotfx/hand_compose.py (손도트 조각 겹치기)", "image": f"{out}.png", "size": {"w": sheet.width, "h": sheet.height}}}, ensure_ascii=False))
    print(out, N, W, Hh)

if __name__ == "__main__":
    burst('dot-hand-burst')
    burst('dot-hand-burst2', seed=21, core='hit_c', ink=False, n_tongue=50)
