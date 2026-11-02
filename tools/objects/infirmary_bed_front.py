# 의무실 p6 침대 앞 난간 가림 — 8배 격자를 눈으로 읽고 손으로 적은 직사각형(자동 따기 아님, 사용자 11-02 11:13 「침대 두개 오브젝트 정밀하게 따라」).
# 몸을 그린 뒤 이 칸의 배경 픽셀을 다시 덮어 난간이 몸 앞에 오게 한다. 난간 살 사이 틈은 비워 둔다(몸이 보임).
from PIL import Image
RAILS = {
 'bed1_back': [(464,249,526,253),(464,249,467,271),(523,249,526,271),(464,264,526,271),
               (477,249,480,270),(489,249,492,270),(501,249,504,270),(513,249,516,270)],
 'bed2_front':[(492,306,569,310),(492,306,496,333),(565,306,569,333),(492,327,569,333),
               (507,306,510,332),(523,306,526,332),(537,306,541,332),(552,306,556,332)],
}
def mask(size=(632,424)):
    m = Image.new('L', size, 0)
    for rs in RAILS.values():
        for x0,y0,x1,y1 in rs: m.paste(255,(x0,y0,x1+1,y1+1))
    return m
if __name__ == '__main__':
    bg = Image.open('game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p6_632x424.png').convert('RGBA')
    out = Image.new('RGBA', bg.size, (0,0,0,0)); out.paste(bg, (0,0), mask())
    out.save('game-src/art/objects/infirmary/p6_bed_rails_front.png')
