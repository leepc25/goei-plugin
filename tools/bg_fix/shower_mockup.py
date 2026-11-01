"""샤워실 시안 (2026-11-01 14:05 사용자 「시안을」, 생성 없음·코드 그림).
게임 축척: 그림 세로 700, 벽선 y420, 걷는 띠 y420~669, 1m=142px. 사람 = eileen_stand(60x234).
사물함 = 배경(열고 닫기 없음), 뒷벽에서 앞으로 짧게 튀어나온 줄 → 문이 동·서를 향함.
샤워기 = 「샤워 줄」 오브젝트: 앞뒤(세로)로 기둥 3개, 기둥마다 동·서 양쪽에 샤워기. 코드로 x 반복.
사용: python3 shower_mockup.py <글꼴.ttf> <출력 폴더>"""
import sys
from PIL import Image, ImageDraw, ImageFont
F = ImageFont.truetype(sys.argv[1], 22); FS = ImageFont.truetype(sys.argv[1], 16)
OUT = sys.argv[2]
W, H, WALL, FRONT = 1500, 700, 420, 669
e = Image.open('tools/mapedit/eileen_stand.png').convert('RGBA')
ew = e.transpose(Image.FLIP_LEFT_RIGHT)
LOCK_X = [120, 330]                     # 사물함 줄 x(가운데)
LOCK_D = (WALL, 520)                    # 뒷벽~앞 y (앞쪽 y520~669는 지나다니는 길)
SH_X = [720, 960, 1200]                 # 샤워 줄 x (간격 240)
SH_Y = [470, 560, 650]                  # 줄마다 기둥 3개(앞뒤)

def front():
    im = Image.new('RGB', (W, H), (40, 42, 48)); d = ImageDraw.Draw(im)
    d.rectangle((0, 70, W, WALL), fill=(150, 146, 140))                      # 뒷벽
    d.rectangle((560, 70, W, WALL), fill=(170, 182, 188))                    # 샤워 구역 타일 벽
    for x in range(560, W, 28): d.line((x, 70, x, WALL), fill=(150, 162, 170))
    for y in range(70, WALL, 28): d.line((560, y, W, y), fill=(150, 162, 170))
    d.rectangle((0, WALL, W, H), fill=(120, 116, 112))                       # 바닥
    d.line((0, WALL, W, WALL), fill=(20, 20, 24), width=3)
    d.line((560, 70, 560, H), fill=(230, 80, 80), width=2)
    d.text((20, 80), '사물함 구역 (배경)', font=F, fill=(255, 255, 255))
    d.text((580, 80), '샤워 구역 (배경은 타일 벽·바닥만, 샤워기는 오브젝트 반복)', font=F, fill=(255, 255, 255))
    d.rectangle((0, 520, 560, FRONT), outline=(255, 220, 90), width=2)
    d.text((10, 640), '앞쪽 길 (y520~669)', font=FS, fill=(255, 220, 90))
    # 사물함 줄: 뒷벽에서 앞으로 튀어나옴. 앞 끝면(좁게) + 옆면(문, 동·서 향함) 비스듬히
    for cx in LOCK_X:
        top = 170
        d.polygon([(cx - 70, top), (cx - 40, top - 30), (cx - 40, LOCK_D[0] - 30), (cx - 70, LOCK_D[1])], fill=(95, 105, 120), outline=(10, 10, 12))   # 서쪽 면(문)
        d.polygon([(cx + 40, top - 30), (cx + 70, top), (cx + 70, LOCK_D[1]), (cx + 40, LOCK_D[0] - 30)], fill=(85, 95, 110), outline=(10, 10, 12))   # 동쪽 면(문)
        d.rectangle((cx - 70, top, cx + 70, LOCK_D[1]), fill=(110, 122, 140), outline=(10, 10, 12))                                                       # 앞 끝면
        for k in range(3): d.line((cx - 70 + 47 * (k + 1), top, cx - 70 + 47 * (k + 1), LOCK_D[1]), fill=(70, 78, 90))
        d.text((cx - 60, top + 10), '사물함 줄', font=FS, fill=(255, 255, 255))
    im.paste(e, (LOCK_X[0] + 75, LOCK_D[1] - 10 - 234 + 0), e)                 # 사물함 동쪽 옆에서 서쪽(반전)… 아래서 표시
    # 샤워 줄
    for sx in SH_X:
        d.line((sx, 70, sx, 95), fill=(60, 60, 66), width=6)
        for fy in SH_Y:
            topy = fy - 270
            d.line((sx, topy, sx, fy), fill=(200, 200, 206), width=6)        # 기둥
            d.line((sx, topy, sx, fy), fill=(20, 20, 24), width=1)
            d.polygon([(sx - 3, topy + 10), (sx - 28, topy + 18), (sx - 28, topy + 28), (sx - 3, topy + 22)], fill=(230, 230, 236), outline=(10, 10, 12))  # 서쪽 샤워기
            d.polygon([(sx + 3, topy + 10), (sx + 28, topy + 18), (sx + 28, topy + 28), (sx + 3, topy + 22)], fill=(230, 230, 236), outline=(10, 10, 12))  # 동쪽 샤워기
            d.ellipse((sx - 10, fy - 4, sx + 10, fy + 4), fill=(60, 60, 66))   # 배수구
    # 사람 예: 첫 줄 서쪽에서 동쪽 보기, 동쪽에서 서쪽 보기(반전)
    for (img, x, fy) in [(e, SH_X[0] - 95, SH_Y[1]), (ew, SH_X[0] + 35, SH_Y[2]), (e, SH_X[1] - 95, SH_Y[0])]:
        im.paste(img, (x, fy - 234), img)
    d.text((SH_X[0] - 20, H - 26), '샤워 줄 1개 = 기둥 3개(앞뒤) × 양쪽 = 6자리', font=FS, fill=(255, 255, 255))
    return im

def plan():
    im = Image.new('RGB', (W, 330), (245, 245, 240)); d = ImageDraw.Draw(im)
    Y = lambda y: 40 + (y - WALL) * 1.0
    d.rectangle((0, Y(WALL) - 12, W, Y(WALL)), fill=(60, 60, 66)); d.text((10, 6), '위에서 본 배치 (위 = 뒷벽, 아래 = 화면 앞)', font=F, fill=(0, 0, 0))
    d.rectangle((0, Y(WALL), W, Y(FRONT)), outline=(120, 120, 120))
    for cx in LOCK_X:
        d.rectangle((cx - 40, Y(LOCK_D[0]), cx + 40, Y(LOCK_D[1])), fill=(110, 122, 140))
        d.text((cx - 30, Y(470) - 10), '사물함', font=FS, fill=(255, 255, 255))
        for sx, arr in ((cx - 70, '→'), (cx + 50, '←')): d.text((sx, Y(480)), arr, font=F, fill=(200, 40, 40))
    for sx in SH_X:
        for fy in SH_Y:
            d.ellipse((sx - 7, Y(fy) - 7, sx + 7, Y(fy) + 7), fill=(30, 30, 36))
            d.text((sx - 42, Y(fy) - 12), '→', font=F, fill=(40, 90, 200)); d.text((sx + 16, Y(fy) - 12), '←', font=F, fill=(40, 90, 200))
    d.line((560, Y(WALL), 560, Y(FRONT)), fill=(230, 80, 80), width=2)
    d.text((10, Y(FRONT) + 6), '빨강 화살표 = 사물함 앞 옷 갈아입는 자리(동·서) · 파랑 = 샤워 자리(동쪽 보기 → / 서쪽 보기 ← 반전)', font=FS, fill=(0, 0, 0))
    return im

f, p = front(), plan()
out = Image.new('RGB', (W, H + p.height + 10), (255, 255, 255)); out.paste(f, (0, 0)); out.paste(p, (0, H + 10))
out.save(OUT + '/샤워실_시안_v1.png'); print('ok')
