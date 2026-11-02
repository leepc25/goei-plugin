"""여자 샤워실(확정 hq_bath_f_p5_extL1) 샤워 캐릭터 세워 보기 — 게임 요원 그림 game-pack/char-*/SH_E(샤워 몸 씻기) 첫 장면.
사용 샤워기 2~7번 (사용자 2026-11-01 15:46~15:49). 콘쥬스는 절대 넣지 않는다.
크기: 이 그림 문틀 전체 높이(약 202px, 문 발 y316) × 0.82 = 문 앞 사람 키 166 (사용자 15:06 장면별 문틀 기준).
원근: 칸막이 벽 앞·뒤 높이로 잰 소실 y196 → 키 = 1.383 × (발y − 196). 그림 몸 높이 237도트."""
import json
from PIL import Image
A = 'game-src/art/pixellab-hq-20261031/'
import sys as _s
bg = Image.open(A + (_s.argv[1] if len(_s.argv) > 1 else 'hq_bath_f_p5_extL1.png')).convert('RGBA')
FOOT = {2: (240, 340, 'W'), 3: (290, 312, 'W'), 4: (528, 338, 'W'), 5: (545, 305, 'W'), 6: (614, 316, 'E'), 7: (640, 348, 'E')}  # 바구니·대야 피해서 벽 면 앞 빈 바닥, 샤워기 쪽을 봄
CH = {2: '1.2', 3: '1.10', 4: '1.9', 6: '1.1'}  # 스팡달·게슈간·데드폴·쟈알디
assert '1.12' not in CH.values()
SHRINK = 0.88  # 사용자 15:52 「사람을 조금 줄이고」
def hgt(y): return 1.383 * (y - 196) * SHRINK
for n in sorted(CH, key=lambda n: FOOT[n][1]):
    fx, fy, face = FOOT[n]
    d = json.load(open(f'game-pack/char-{CH[n]}/char.json')); a = d['A']['SH_E']
    sheet = Image.open(f'game-pack/char-{CH[n]}/SH_E.webp').convert('RGBA')
    fr = Image.new('RGBA', (a['w'], a['h'])); fr.alpha_composite(sheet.crop((0, 0, a['cw'], a['ch'])), (a['ox'], a['oy']))  # 장면 칸 = cw×ch 잘린 그림을 (ox,oy)에
    k = hgt(fy) / 237
    fr = fr.resize((round(fr.width * k), round(fr.height * k)), Image.NEAREST)
    bb = fr.getbbox(); cx = (bb[0] + bb[2]) // 2
    if face == 'W':  # 그림은 모두 오른쪽(동)을 봄(cfg.dir과 무관, 확인 15:5x)
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT); cx = fr.width - cx
    bg.alpha_composite(fr, (fx - cx, fy - round(a['floor'] * k)))
bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save((_s.argv[2] if len(_s.argv) > 2 else '/mnt/project-files/hq-f3/now/샤워실여_샤워캐릭터_2배.png'))
