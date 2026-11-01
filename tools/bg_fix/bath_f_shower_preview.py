"""여자 샤워실(확정 hq_bath_f_p5_extL1) 샤워 캐릭터 세워 보기 — 사용 가능 샤워기 2~7번 (사용자 2026-11-01 15:47~15:48).
크기: 에일린 서기 기준(발 y419에서 165px)에서 원근 비례 h = 165*(y+72)/491. 동작 그림 몸 높이 99px = 그 키."""
from PIL import Image
A = 'game-src/art/pixellab-hq-20261031/'
bg = Image.open(A + 'hq_bath_f_p5_extL1.png').convert('RGBA')
H = {2: (203, 160), 3: (244, 164), 4: (480, 157), 5: (504, 169), 6: (662, 170), 7: (690, 157)}
FOOT = {2: (240, 340, 'L'), 3: (290, 312, 'L'), 4: (528, 338, 'L'), 5: (545, 305, 'L'), 6: (614, 316, 'R'), 7: (640, 348, 'R')}  # 바구니·대야 피해서 벽 면 앞 빈 바닥
CH = {3: 'geshugan/final', 4: 'deadpole/full/final', 7: 'spangdal/full/final', 6: 'jyaldi-v5/full/final'}
def hgt(y): return 165 * (y + 72) / 491
for n in sorted(CH, key=lambda n: FOOT[n][1]):
    fx, fy, face = FOOT[n]
    fr = Image.open('game-src/action/' + CH[n] + '/shower.png').convert('RGBA').crop((0, 0, 192, 144))
    k = hgt(fy) / 99
    fr = fr.resize((round(192 * k), round(144 * k)), Image.NEAREST)
    bb = fr.getbbox(); cx = (bb[0] + bb[2]) // 2
    if face == 'R': fr = fr.transpose(Image.FLIP_LEFT_RIGHT); cx = fr.width - cx
    bg.alpha_composite(fr, (fx - cx, fy - round(136 * k)))
bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save('/mnt/project-files/hq-f3/now/샤워실여_샤워캐릭터_2배.png')
