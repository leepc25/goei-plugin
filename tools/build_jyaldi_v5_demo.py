#!/usr/bin/env python3
"""쟈알디 v5 동작 시연판 빌더.

game-src/action/jyaldi-v5/clips/<이름>-<번호>.png (PixelLab 원본, 160×160, 리사이즈 없음)를
읽어 클립마다 가로 스트립 PNG로 묶고 manifest.json을 쓴 뒤, 모든 그림을 base64로 내장한
단일 HTML(release/demo/jyaldi-v5-action.html)을 만든다. 그림은 한 픽셀도 바꾸지 않는다.

사용: python3 tools/build_jyaldi_v5_demo.py
"""
import base64
import io
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5')
CLIPS = os.path.join(SRC, 'clips')
OUT_HTML = os.path.join(ROOT, 'release', 'demo', 'jyaldi-v5-action.html')
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')

# 클립 정의: (파일 접두어, 표시 이름, fps, 반복 여부, 첫 장(입력 고정 장) 사용 여부)
# PixelLab 결과의 0번 장은 입력 그림 그대로이므로 반복 클립에서는 0번을 빼고(끝 장과 같음) 쓴다.
CLIP_DEFS = [
    ('idle-mm', '기본 대기', 6, True, 'idle'),
    ('fight-idle', '전투 대기', 6, True, 'fight'),
    ('walk-mm', '걷기', 10, True, 'walk'),
    ('run', '달리기', 14, True, 'run'),
    ('jump', '점프', 12, False, 'jump'),
    ('melee1', '근접 1타', 14, False, 'melee1'),
    ('melee2', '근접 2타', 14, False, 'melee2'),
    ('melee3', '근접 3타', 12, False, 'melee3'),
    ('dash-attack', '돌진공격', 14, False, 'dash'),
    ('air-attack', '공중 공격', 12, False, 'air'),
    ('ranged-ready', '원거리 준비', 12, False, 'ready'),
    ('ranged-fire', '원거리 발사', 16, False, 'fire'),
    ('reload', '재장전', 10, False, 'reload'),
    ('unique-short', '고유기 짧게', 12, False, 'unique'),
    ('unique-charge', '고유기 충전', 8, True, 'charge'),
    ('guard', '가드', 12, False, 'guard'),
    ('guard-hit', '가드 피격', 12, False, 'guardhit'),
    ('evade', '회피', 16, False, 'evade'),
    ('ult', '필살기', 12, False, 'ult'),
    ('hit-light', '약 피격', 12, False, 'hit'),
    ('knockdown', '강 피격·다운', 12, False, 'down'),
    ('getup', '기상', 10, False, 'getup'),
]


def load_clip(prefix):
    frames = []
    i = 0
    while True:
        p = os.path.join(CLIPS, f'{prefix}-{i}.png')
        if not os.path.exists(p):
            break
        frames.append(Image.open(p).convert('RGBA'))
        i += 1
    return frames


def strip_png(frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * w, 0))
    b = io.BytesIO()
    s.save(b, 'PNG', optimize=True)
    return b.getvalue()


def main():
    manifest = {'agent': 'jyaldi', 'version': 'v5', 'frameW': 160, 'frameH': 160, 'footMargin': 8, 'clips': {}}
    strips = {}
    for prefix, label, fps, loop, key in CLIP_DEFS:
        frames = load_clip(prefix)
        if not frames:
            print('없음:', prefix, file=sys.stderr)
            continue
        use = frames[1:] if loop and len(frames) > 1 else frames
        feet = []
        for f in use:
            bb = f.getbbox()
            feet.append(bb[3] if bb else None)
        data = strip_png(use)
        strips[key] = base64.b64encode(data).decode()
        manifest['clips'][key] = {'file': prefix, 'label': label, 'fps': fps, 'loop': loop, 'frames': len(use), 'feet': feet, 'bytes': len(data)}
        print(f'{key:10s} {label:8s} {len(use)}장 {len(data)//1024}KB feet={feet}')
    json.dump(manifest, open(os.path.join(SRC, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bg64 = base64.b64encode(open(BG, 'rb').read()).decode()
    tpl = open(os.path.join(ROOT, 'tools', 'jyaldi_v5_demo_template.html'), encoding='utf-8').read()
    html = tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips)).replace('__BG__', bg64)
    os.makedirs(os.path.dirname(OUT_HTML), exist_ok=True)
    open(OUT_HTML, 'w', encoding='utf-8').write(html)
    print('wrote', OUT_HTML, len(html) // 1024, 'KB')


if __name__ == '__main__':
    main()
