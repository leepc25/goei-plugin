#!/usr/bin/env python3
"""쟈알디 v5 동작 시연판 빌더.

<클립 폴더>/<이름>-<번호>.png (PixelLab 원본, 160×160, 리사이즈 없음)를 읽어 클립마다 가로 스트립 PNG로
묶고 manifest.json을 쓴 뒤, 모든 그림을 base64로 내장한 단일 HTML을 만든다. 그림은 한 픽셀도 바꾸지 않는다.

사용: python3 tools/build_jyaldi_v5_demo.py [--clips game-src/action/jyaldi-v5/clips] [--out release/demo/jyaldi-v5-action.html] [--title "기준표 102"]
"""
import argparse
import base64
import io
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'game-src', 'action', 'jyaldi-v5')
BG = os.path.join(ROOT, 'game-src', 'action', 'bureau-corridor.png')

# 클립 정의. key: 시연판 상태 이름, file: 파일 접두어(없으면 key), fps, loop, drop0: 0번 장(입력 고정 장) 제외,
# dropN: 마지막 장(고정 장) 제외, hit: 타격 판정이 나는 장 번호(사용 장 기준), holdS: 그 장을 추가로 멈춰 세우는 초.
C = lambda key, label, fps, **k: dict(key=key, label=label, fps=fps, file=k.get('file', key), loop=k.get('loop', False), drop0=k.get('drop0', False), dropN=k.get('dropN', False), hit=k.get('hit'), holdS=k.get('holdS', 0))
CLIP_DEFS = [
    C('idle', '기본 대기', 6, loop=True, drop0=True),
    C('fight', '전투 대기', 6, loop=True, drop0=True),
    C('walk', '걷기', 10, loop=True, drop0=True),
    C('run', '달리기', 14, loop=True, drop0=True),
    C('jump', '점프(도약)', 12),
    C('land', '착지', 12),
    C('melee1', '근접 1타', 14, hit=3, holdS=0.05),
    C('melee2', '근접 2타', 14, hit=3, holdS=0.05),
    C('melee3', '근접 3타', 12, hit=6, holdS=0.1),
    C('dash', '대시·돌진공격', 14, hit=3, holdS=0.05),
    C('air', '공중 공격', 12, hit=3, holdS=0.06),
    C('draw', '권총 뽑기', 12),
    C('fire', '발사', 16, hit=1, holdS=0.04),
    C('reload', '재장전', 10),
    C('holster', '권총 집어넣기', 12),
    C('unique', '고유기', 12, hit=4, holdS=0.08),
    C('charge', '고유기 충전', 8, loop=True, drop0=True),
    C('guard', '가드', 12),
    C('guardhit', '가드 피격', 12),
    C('evade', '뒤 대시', 16),
    C('ult', '필살기', 12, hit=9, holdS=0.12),
    C('hit', '약 피격', 12),
    C('down', '강 피격·다운', 12),
    C('downidle', '누운 채 대기', 6, loop=True, drop0=True),
    C('getup', '기상', 10),
]
# 이전 이름 호환(1단계 clips/ 폴더)
ALIASES = {'idle': 'idle-mm', 'fight': 'fight-idle', 'walk': 'walk-mm', 'dash': 'dash-attack', 'air': 'air-attack', 'draw': 'ranged-ready', 'fire': 'ranged-fire', 'unique': 'unique-short', 'charge': 'unique-charge', 'guardhit': 'guard-hit', 'hit': 'hit-light', 'down': 'knockdown'}


def load_frames(clips_dir, prefix):
    frames, i = [], 0
    while True:
        p = os.path.join(clips_dir, f'{prefix}-{i}.png')
        if not os.path.exists(p):
            break
        frames.append(Image.open(p).convert('RGBA'))
        i += 1
    return frames


def load_clip(clips_dir, d):
    names = [d['file']]
    if d['key'] in ALIASES:
        names.append(ALIASES[d['key']])
    for n in names:
        fr = load_frames(clips_dir, n)
        if fr:
            return fr
    if d['key'] == 'melee3':  # 1단계 분할 클립 호환
        a, b = load_frames(clips_dir, 'melee3a'), load_frames(clips_dir, 'melee3b')
        return a + b[1:] if a and b else a or b
    return []


def strip_png(frames):
    w, h = frames[0].size
    s = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.paste(f, (i * w, 0))
    b = io.BytesIO()
    s.save(b, 'PNG', optimize=True)
    return b.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--clips', default=os.path.join(SRC, 'clips'))
    ap.add_argument('--out', default=os.path.join(ROOT, 'release', 'demo', 'jyaldi-v5-action.html'))
    ap.add_argument('--title', default='기준표 102 기준')
    ap.add_argument('--manifest', default=None, help='manifest.json 경로(기본: 클립 폴더/manifest.json)')
    a = ap.parse_args()
    w0 = h0 = None
    manifest = {'agent': 'jyaldi', 'version': 'v5', 'frameW': 160, 'frameH': 160, 'footMargin': 8, 'clips': {}}
    strips = {}
    for d in CLIP_DEFS:
        frames = load_clip(a.clips, d)
        if not frames:
            print('없음:', d['key'], file=sys.stderr)
            continue
        use = frames[1:] if d['drop0'] and len(frames) > 1 else frames
        if d['dropN'] and len(use) > 1:
            use = use[:-1]
        if w0 is None:
            w0, h0 = use[0].size
            manifest['frameW'], manifest['frameH'] = w0, h0
        feet = []
        for f in use:
            bb = f.getbbox()
            feet.append(bb[3] if bb else None)
        data = strip_png(use)
        strips[d['key']] = base64.b64encode(data).decode()
        manifest['clips'][d['key']] = {'file': d['file'], 'label': d['label'], 'fps': d['fps'], 'loop': d['loop'], 'frames': len(use), 'feet': feet, 'bytes': len(data), 'hit': min(d['hit'], len(use) - 1) if d['hit'] is not None else None, 'holdS': d['holdS']}
        print(f"{d['key']:9s} {d['label']:8s} {len(use)}장 {len(data)//1024}KB feet={feet}")
    json.dump(manifest, open(a.manifest or os.path.join(a.clips, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bg64 = base64.b64encode(open(BG, 'rb').read()).decode()
    tpl = open(os.path.join(ROOT, 'tools', 'jyaldi_v5_demo_template.html'), encoding='utf-8').read()
    html = tpl.replace('__MANIFEST__', json.dumps(manifest, ensure_ascii=False)).replace('__STRIPS__', json.dumps(strips)).replace('__BG__', bg64).replace('__TITLE__', a.title)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    open(a.out, 'w', encoding='utf-8').write(html)
    print('wrote', a.out, len(html) // 1024, 'KB')


if __name__ == '__main__':
    main()
