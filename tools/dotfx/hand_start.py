"""필살기 시작 연출 (11-09, 킹오파98 롬에서 잰 순서·장수만 따름. 그림은 우리 것)
킹오파: 배경 흰색 4장 → 검은 배경 + 뒤에 층진 큰 빛이 8장 동안 줄어듦 → 가슴 앞 빛덩이 8장(커졌다 작아짐) → 사방 빛살 8장(밖으로 밀려나며 끊김). 한 장 = 1게임장(17ms).
- dot-hand-orb : 캐릭터 뒤. 빈 4장 + dot-halo(층진 둥근 빛) 첫 장을 점 그대로 줄여 8장
- dot-hand-rise: 캐릭터 앞. 빈 12장 + hand/ball.txt(손으로 찍은 빛덩이 8장) + 빛살 8장
빛살은 손으로 정한 갈래(각도·길이·끊는 자리·색)를 선 도구로 긋는다.
사용: python3 tools/dotfx/hand_start.py"""
import json, math
from pathlib import Path
from PIL import Image
import hand_dot as H

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "game-src" / "action" / "testroom3" / "vfx"
F = 17


def save(name, frames, dur):
    w, h = frames[0].size; cols = 4; rows = (len(frames) + cols - 1) // cols
    sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0)); meta = []
    for i, fr in enumerate(frames):
        x, y = (i % cols) * w, (i // cols) * h; sheet.paste(fr, (x, y))
        meta.append({"filename": f"{name} {i}.png", "frame": {"x": x, "y": y, "w": w, "h": h}, "rotated": False, "trimmed": False,
                     "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h}, "pivot": {"x": 0.5, "y": 0.5}, "duration": dur})
    sheet.save(OUT / f"{name}.png")
    (OUT / f"{name}.json").write_text(json.dumps({"frames": meta, "meta": {"app": "tools/dotfx/hand_start.py", "image": f"{name}.png", "size": {"w": sheet.width, "h": sheet.height}}}, ensure_ascii=False))
    print(name, len(frames), "장", w, "x", h)


def orb():
    halo = Image.open(OUT / "dot-halo.png").crop((0, 0, 256, 256))
    S = 256; frames = [Image.new("RGBA", (S, S)) for _ in range(4)]
    for sc in (1.0, 0.93, 0.86, 0.79, 0.72, 0.65, 0.58, 0.5):
        n = max(2, int(S * sc) // 2 * 2); f = Image.new("RGBA", (S, S))
        f.paste(halo.resize((n, n), Image.NEAREST), ((S - n) // 2, (S - n) // 2))
        frames.append(f)
    save("dot-hand-orb", frames, F)


# 빛살 갈래: (각도°, 굵기, 길이 비율) — 고르게 돌리지 않고 손으로 띄엄띄엄
RAYS = [(9, 2, 1.0), (38, 1, 0.62), (57, 2, 0.9), (101, 1, 0.7), (122, 2, 1.0), (151, 1, 0.55), (176, 2, 0.95), (213, 1, 0.66), (234, 2, 1.0), (268, 1, 0.6), (297, 2, 0.85), (331, 1, 0.72)]
# 장마다 (안쪽 r, 바깥 r, 끊는 간격(0=안 끊음), 색 안→밖)
STEPS = [(4, 40, 0, "WWY"), (8, 62, 0, "WYy"), (14, 78, 0, "WYy"), (24, 86, 9, "YYy"), (36, 90, 7, "Yyo"), (50, 91, 6, "yyo"), (62, 91, 5, "yoO"), (74, 91, 4, "oO")]


def line(px, S, x0, y0, x1, y1, ch, gap, k):
    n = max(1, int(max(abs(x1 - x0), abs(y1 - y0))))
    for i in range(n + 1):
        if gap and (i // gap) % 2 == 1: continue
        x = round(x0 + (x1 - x0) * i / n); y = round(y0 + (y1 - y0) * i / n)
        if 0 <= x < S and 0 <= y < S: px[x, y] = H.PAL[ch(i / n)] + (255,)


def rise():
    S = 184; c = S // 2; frames = [Image.new("RGBA", (S, S)) for _ in range(12)]
    ball, _ = H.load(ROOT / "tools" / "dotfx" / "hand" / "ball.txt")
    for g in ball:
        f = Image.new("RGBA", (S, S)); px = f.load()
        for y, row in enumerate(g):
            for x, chh in enumerate(row):
                if chh in H.PAL: px[c - 12 + x, c - 12 + y] = H.PAL[chh] + (255,)
        frames.append(f)
    for k, (r0, r1, gap, cols) in enumerate(STEPS):
        f = Image.new("RGBA", (S, S)); px = f.load()
        for j, (deg, w, lf) in enumerate(RAYS):
            a = math.radians(deg)
            ca, sa = math.cos(a), math.sin(a)
            ch = lambda t, cols=cols: cols[min(len(cols) - 1, int(t * len(cols)))]
            for o in range(w):
                ox, oy = -sa * o, ca * o
                line(px, S, c + ca * r0 * lf + ox, c + sa * r0 * lf + oy, c + ca * r1 * lf + ox, c + sa * r1 * lf + oy, ch, gap, k)
        frames.append(f)
    save("dot-hand-rise", frames, F)


if __name__ == "__main__":
    orb(); rise()
