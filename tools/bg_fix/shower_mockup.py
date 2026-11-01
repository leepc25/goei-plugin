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
LOCK_X = [130, 360]                     # 사물함 줄 x(가운데)
LOCK_D = (WALL, 600)                    # 뒷벽~앞 y (앞쪽 y600~669는 지나다니는 길)
SH_X = [700, 980, 1260]                 # 샤워 줄 x (간격 240)
SH_Y = [455, 515, 575]                  # 벽마다 샤워기 3개(앞뒤)
WALL_F = 600                            # 샤워 벽 앞 끝 y

VPX, VPY = 750, -200                     # 14:12 사용자 「정면에서 바라보고 원근」: 소실점(화면 가운데 위)
SC = (WALL - VPY) / (WALL_F - VPY)        # 뒤 끝 축척
def persp(fx, HT):
    bx = VPX + (fx - VPX) * SC
    return bx, HT * SC
def slab(d, fx, HT, face, edge, lines):
    """14:13 사용자 「왜 자꾸 모이게 하지」: 모으지 않는다. 정면(약간 위)에서 본 앞뒤로 긴 벽 = 앞 끝면(정면 직사각형)
    + 그 위로 곧게 이어지는 윗면 띠(뒤 끝까지, 기울지 않음). 옆면은 안 보이고 샤워기만 양옆으로 튀어나옴."""
    TOP = 18                                            # 벽 두께
    d.rectangle((fx - TOP // 2, WALL - HT, fx + TOP // 2, WALL_F - HT), fill=edge, outline=(10, 10, 12))   # 윗면(뒤~앞)
    d.rectangle((fx - TOP // 2, WALL_F - HT, fx + TOP // 2, WALL_F), fill=face, outline=(10, 10, 12))     # 앞 끝면
    return fx, HT, fx, 1
def front():
    im = Image.new('RGB', (W, H), (40, 42, 48)); d = ImageDraw.Draw(im)
    d.rectangle((0, 70, W, WALL), fill=(150, 146, 140))                      # 뒷벽
    d.rectangle((560, 70, W, WALL), fill=(170, 182, 188))                    # 샤워 구역 타일 벽
    for x in range(560, W, 28): d.line((x, 70, x, WALL), fill=(150, 162, 170))
    for y in range(70, WALL, 28): d.line((560, y, W, y), fill=(150, 162, 170))
    d.rectangle((0, WALL, W, H), fill=(120, 116, 112))                       # 바닥
    d.line((0, WALL, W, WALL), fill=(20, 20, 24), width=3)
    d.line((560, 70, 560, H), fill=(230, 80, 80), width=2)
    d.text((20, 80), '사물함 구역 (배경: 사물함 줄 양면, 열고 닫기 없음)', font=F, fill=(255, 255, 255))
    d.text((580, 80), '샤워 구역 (배경은 타일 벽·바닥, 샤워 벽은 오브젝트 반복)', font=F, fill=(255, 255, 255))
    d.rectangle((0, WALL_F, 560, FRONT), outline=(255, 220, 90), width=2)
    d.text((10, 640), '앞쪽 길', font=FS, fill=(255, 220, 90))
    # 사물함 줄 (14:11 「캐비닛도 마찬가지」): 뒷벽에서 앞으로 나온 줄, 양면 문
    for cx in LOCK_X: slab(d, cx, 250, (95, 105, 120), (60, 68, 80), 5)
    # 샤워 벽 (14:10 「벽이 있어야지」「아랫부분으로 지나다닐 수 있는 벽」): 양면에 샤워기 앞뒤 3개
    for sx in SH_X:
        slab(d, sx, 290, (178, 190, 196), (150, 162, 170), 3)
        for fy in SH_Y:
            y = fy - 240
            for side in (-1, 1):                         # 양면 샤워기: 벽 옆으로 튀어나옴
                x = sx + side * 9
                d.polygon([(x, y), (x + side * 22, y + 4), (x + side * 22, y + 13), (x, y + 9)], fill=(230, 230, 236), outline=(10, 10, 12))
                d.ellipse((x + side * 34 - 10, fy - 4, x + side * 34 + 10, fy + 4), fill=(60, 60, 66))
    d.rectangle((560, WALL_F, W, FRONT), outline=(255, 220, 90), width=2)
    d.text((570, 640), '앞쪽 길', font=FS, fill=(255, 220, 90))
    # 사람 예: 벽 동쪽 면 앞에서 서쪽 보기(반전), 서쪽 면 쪽에서 동쪽 보기
    for (img, x, fy) in [(ew, LOCK_X[0] + 30, 560), (ew, SH_X[0] + 40, SH_Y[1]), (e, SH_X[1] - 90, SH_Y[2]), (ew, SH_X[2] + 30, SH_Y[0])]:
        im.paste(img, (x, fy - 234), img)
    d.text((SH_X[0] - 20, H - 26), '샤워 벽 1개 = 샤워기 3개(앞뒤) × 양면 = 6자리', font=FS, fill=(255, 255, 255))
    return im

def plan():
    im = Image.new('RGB', (W, 330), (245, 245, 240)); d = ImageDraw.Draw(im)
    Y = lambda y: 40 + (y - WALL) * 1.0
    d.rectangle((0, Y(WALL) - 12, W, Y(WALL)), fill=(60, 60, 66)); d.text((10, 6), '위에서 본 배치 (위 = 뒷벽, 아래 = 화면 앞)', font=F, fill=(0, 0, 0))
    d.rectangle((0, Y(WALL), W, Y(FRONT)), outline=(120, 120, 120))
    for cx in LOCK_X:
        d.rectangle((cx - 10, Y(LOCK_D[0]), cx + 10, Y(LOCK_D[1])), fill=(110, 122, 140), outline=(30, 30, 36))
        d.text((cx + 14, Y(WALL) + 4), '사물함', font=FS, fill=(0, 0, 0))
        for fy in (455, 515, 575):
            for sx, arr in ((cx - 40, '→'), (cx + 14, '←')): d.text((sx, Y(fy) - 12), arr, font=F, fill=(200, 40, 40))
    for sx in SH_X:
        d.rectangle((sx - 6, Y(WALL), sx + 6, Y(WALL_F)), fill=(150, 162, 170), outline=(30, 30, 36))
        for fy in SH_Y:
            d.ellipse((sx - 4, Y(fy) - 4, sx + 4, Y(fy) + 4), fill=(30, 30, 36))
            d.text((sx - 42, Y(fy) - 12), '→', font=F, fill=(40, 90, 200)); d.text((sx + 16, Y(fy) - 12), '←', font=F, fill=(40, 90, 200))
    d.line((560, Y(WALL), 560, Y(FRONT)), fill=(230, 80, 80), width=2)
    d.text((10, Y(FRONT) + 6), '빨강 화살표 = 사물함 앞 옷 갈아입는 자리(동·서) · 파랑 = 샤워 자리(동쪽 보기 → / 서쪽 보기 ← 반전)', font=FS, fill=(0, 0, 0))
    return im

f, p = front(), plan()
out = Image.new('RGB', (W, H + p.height + 10), (255, 255, 255)); out.paste(f, (0, 0)); out.paste(p, (0, H + 10))
out.save(OUT + '/샤워실_시안_v4.png'); print('ok')
