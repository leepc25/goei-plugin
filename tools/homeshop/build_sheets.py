"""망상홈쇼핑 방송 그림 묶기 (2026-11-11).
원본(PixelLab 결과, 브랜치 claude/project-thread-eva8nj 의 game-src/art/pixellab-test-20261028/homeshop/)에서
방송 화면이 쓰는 것만 골라 game-src/homeshop/ 에 둔다: 배경 판·진행자 기본 장(png→webp 무손실) + 동작마다 가로 줄 시트(17장×256).
그림은 한 점도 고치지 않는다(무손실). 자리·재생 규칙 기본값은 homeshop.json 에 적는다(전부 설정에서 고침).
쓰기: python3 -I tools/homeshop/build_sheets.py <원본 homeshop 폴더>
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'game-src', 'homeshop')
os.makedirs(OUT, exist_ok=True)

def save(im, name):
    im.save(os.path.join(OUT, name), 'WEBP', lossless=True, quality=100, method=6, exact=True)

def sheet(folder, name):
    files = sorted(f for f in os.listdir(folder) if f.endswith('.png'))
    frames = [Image.open(os.path.join(folder, f)).convert('RGBA') for f in files]
    w, h = frames[0].size
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        assert f.size == (w, h)
        out.paste(f, (i * w, 0))
    save(out, name)
    return len(frames)

for src, dst in [('bg_plate_512x384_bright_ttsym.png', 'a_plate.webp'), ('bg_plate_512x384_off.png', 'a_plate_off.webp'),
                 ('host_sprite_v1.png', 'a_host.webp'), ('cutB_plate_v4.png', 'b_plate.webp'), ('cutB_host_v9face2_nowhite3.png', 'b_host.webp')]:
    save(Image.open(os.path.join(SRC, src)).convert('RGBA'), dst)

# 컷 A 동작 10개 (11-10 09:50 정리본). 이름은 컷 B 와 맞춘다
A = [('idle', '대기', 'idle3', 'base'), ('talk', '말하기', 'talk3', 'event'), ('excited', '신남', 'excited', 'event'), ('urgent', '매진 임박', 'urgent3', 'event'),
     ('count', '할부 세기', 'count2', 'event'), ('amazed', '놀람', 'amazed2_eyefix3', 'event'), ('whisper', '속삭임', 'whisper', 'event'),
     ('laugh', '웃음', 'laugh', 'filler'), ('cold', '차가워짐', 'cold', 'event'), ('angry', '화남', 'angry', 'event')]
clipsA = []
for name, ko, d, group in A:
    f = f'a_{name}_1.webp'
    n = sheet(os.path.join(SRC, f'anim_hostA_{d}_clean'), f)
    clipsA.append({'name': name, 'ko': ko, 'ver': '1', 'group': group, 'frames': n, 'file': f})

man = json.load(open(os.path.join(SRC, 'cutB_final', 'manifest.json'), encoding='utf8'))
clipsB = []
for c in man['clips']:
    f = f"b_{c['name']}_{c['ver']}.webp"
    n = sheet(os.path.join(SRC, 'cutB_final', f"{c['name']}_{c['ver']}"), f)
    # 11-12 사용자: 수동 넘김이라 대기가 길다 → 순한 동작(경련·소리 없는 웃음)은 「가끔」으로
    group = 'filler' if c['name'] in ('twitch', 'silentlaugh') else c['group']
    clipsB.append({'name': c['name'], 'ko': c['ko'], 'ver': c['ver'], 'group': group, 'frames': n, 'file': f})

layout = json.load(open(os.path.join(SRC, 'plate512_layout.json'), encoding='utf8'))
meta = {
    'w': 512, 'h': 384, 'box': 256,
    'cuts': {
        # 진행자 256 칸의 왼쪽 위 자리. mask = 가림 판(진열대 윤곽 그대로, 아래 over_mask 가 판에서 뜬다). over = 가림 판이 없을 때만 쓰는 옛 곧은 줄
        'A': {'plate': 'a_plate.webp', 'off': 'a_plate_off.webp', 'host': 'a_host.webp', 'x': -6, 'y': 65, 'over': 297, 'mask': 'a_over.webp', 'screen': layout['screen'], 'bulbs': layout['bulbs'], 'clips': clipsA},
        'B': {'plate': 'b_plate.webp', 'host': 'b_host.webp', 'x': 70, 'y': 40, 'clips': clipsB},
    },
}
json.dump(meta, open(os.path.join(OUT, 'homeshop.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
# 컷 A 가림 판 (11-12): 방금 쓴 판·동작 장에서 진열대 윤곽과 몸통·팔 가르는 열을 재서 a_over.webp 를 만든다
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import over_mask
over_mask.build()
print(len(clipsA), len(clipsB))
