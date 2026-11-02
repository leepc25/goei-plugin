# 의무실 p6 침대 앞 난간 가림 — 픽셀 표(밝기 4단계 글자 지도)를 한 줄씩 눈으로 읽고 손으로 적은 값(자동 따기 아님).
# 사용자 11-02 11:13 「침대 두개 오브젝트 정밀하게 따라」, 11:24 「픽셀 단위로 제대로 못땄네」 → 줄마다 시작·끝 x + 난간 살 사이 틈(구멍)을 정확히.
# 난간 = ROWS 칸 전체 - HOLES(살 사이 틈, 몸이 비쳐 보임). 몸을 그린 뒤 이 칸만 배경 픽셀로 다시 덮는다.
from PIL import Image
BEDS = {
 'bed1_back': {
   'ROWS': {249:(468,525), 250:(466,526), 251:(465,527), **{y:(464,527) for y in range(252,272)}},
   'HOLES': [(x0,253,x1,263) for x0,x1 in [(468,476),(480,488),(492,500),(504,512),(516,523)]],
 },
 'bed2_front': {
   'ROWS': {306:(496,565), 307:(495,566), 308:(494,566), 309:(493,568), **{y:(492,569) for y in range(310,334)}},
   'HOLES': [(x0,311,x1,324) for x0,x1 in [(496,507),(511,522),(526,536),(541,551),(556,565)]],
 },
}
def mask(size=(632,424)):
    m = Image.new('L', size, 0); px = m.load()
    for b in BEDS.values():
        for y,(x0,x1) in b['ROWS'].items():
            for x in range(x0,x1+1): px[x,y] = 255
        for x0,y0,x1,y1 in b['HOLES']:
            for y in range(y0,y1+1):
                for x in range(x0,x1+1): px[x,y] = 0
    return m
if __name__ == '__main__':
    bg = Image.open('game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p6_632x424.png').convert('RGBA')
    out = Image.new('RGBA', bg.size, (0,0,0,0)); out.paste(bg, (0,0), mask())
    out.save('game-src/art/objects/infirmary/p6_bed_rails_front.png')
