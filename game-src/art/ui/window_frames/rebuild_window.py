# 비운 퍽 판을 9분할로 늘려 능력치·기술·소지품 판을 만들고, 머리띠(비움)와 합쳐 빈 창 틀을 만든다
from PIL import Image
src = Image.open('window_clean.png').convert('RGBA')
perk = src.crop((419, 82, 618, 258))  # 199×176, 안쪽 비움
PW, PH = perk.size
TAB = perk.crop((PW//2 - 48, 0, PW//2 + 48, 24))  # 이름표 판
def hpanel(w, c=40):
    out = Image.new('RGBA', (w, PH))
    out.paste(perk.crop((0, 0, c, PH)), (0, 0))
    out.paste(perk.crop((PW - c, 0, PW, PH)), (w - c, 0))
    col = perk.crop((c, 0, c + 1, PH))
    for x in range(c, w - c): out.paste(col, (x, 0))
    out.paste(TAB, (w//2 - 48, 0), TAB)
    return out
def vpanel(p, h, t=36, b=24):
    w = p.width; out = Image.new('RGBA', (w, h))
    out.paste(p.crop((0, 0, w, t)), (0, 0))
    out.paste(p.crop((0, PH - b, w, PH)), (0, h - b))
    row = p.crop((0, t, w, t + 1))
    for y in range(t, h - b): out.paste(row, (0, y))
    return out
win = Image.new('RGBA', src.size)
win.paste(src.crop((0, 0, 640, 80)), (0, 0))          # 머리띠
win.paste(hpanel(192), (22, 82))                       # 능력치
win.paste(hpanel(192), (222, 82))                      # 기술
win.paste(perk, (419, 82))                             # 퍽
win.paste(vpanel(hpanel(373), 93), (134, 262))         # 소지품
win.save('window_empty.png')
win.resize((1280, 720), Image.NEAREST).save('/mnt/project-files/ui_window/창틀_빈판.png')
