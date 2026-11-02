# 의무실 p9: 앞 침대 지운 칸 왼쪽 끝(x82) 바닥 빛 반사 이음 손질(사용자 11-59 「코드로 고쳐」 세 곳). 짚은 자리의 줄만, 같은 그림 안의 색으로.
from PIL import Image
P='game-src/art/pixellab-hq-20261031/'
im=Image.open(P+'hq_b2_infirmary_p9_fixbed.png').convert('RGBA'); px=im.load(); L=im.convert('L').load()
ch=[]
def setc(x,y,ref):
    if px[x,y]!=px[ref]: px[x,y]=px[ref]; ch.append((x,y))
# A 위 반사 윗변: 새 칸은 329~331 연한 띠(226)·328 바닥(208) → 옛 쪽 꼭대기 흰 픽셀 맞춤
for y in (329,330,331):
    for x in range(66,82):
        if L[x,y]==255: setc(x,y,(90,y))
for x in range(66,82):
    if L[x,328]==226: setc(x,328,(90,328))
# B 위 반사 아랫변: 새 칸은 346~347 흰색, 349~350 연한 띠 → 옛 쪽을 맞춤(옛 반사 왼끝까지)
xl=min(x for x in range(0,82) if L[x,345]>=248)
for x in range(xl,82):
    for y in (346,347):
        if L[x,y]==226: setc(x,y,(90,y))
    for y in (349,350):
        if L[x,y]==208: setc(x,y,(90,y))
# C 아래 반사 윗변: 새 칸은 371~373 바닥, 374~377 띠, 378 흰색 → 옛 쪽을 맞춤
xl2=min(x for x in range(0,82) if L[x,378]==248)
for x in range(xl2,82):
    for y in (371,372,373):
        if L[x,y]==226: setc(x,y,(66,366))
    for y in (376,377):
        if L[x,y]==248: setc(x,y,(90,376))
im.save(P+'hq_b2_infirmary_p9_fix2.png')
xs=[c[0] for c in ch]; ys=[c[1] for c in ch]
print(len(ch),'px changed; x',min(xs),max(xs),'y',min(ys),max(ys), 'patch left', xl, xl2)
# D 바닥의 흐린 난간 자국(x211~281, y330~343) 지우기(사용자 12:00 「이 난간 코드로 지워」).
#  난간 살 픽셀(밝기 188·196)만 같은 줄의 가까운 바닥 픽셀로 채우고, 아래 가로대 줄(341~343)은 바로 아래 줄(344) 색을 그대로 씀.
L2=im.convert('L').load(); n0=len(ch)
for y in range(341,344):
    for x in range(211,282): setc(x,y,(x,344))
for y in range(330,341):
    row=[L2[x,y] for x in range(0,im.width)]
    for x in range(211,282):
        if row[x] in (188,196):
            l=x
            while l>200 and row[l] in (188,196): l-=1
            r=x
            while r<290 and row[r] in (188,196): r+=1
            setc(x,y,(l,y) if x-l<=r-x else (r,y))
im.save(P+'hq_b2_infirmary_p9_fix2.png')
xs=[c[0] for c in ch[n0:]]; ys=[c[1] for c in ch[n0:]]
print('D',len(ch)-n0,'px; x',min(xs),max(xs),'y',min(ys),max(ys))
# D2 남은 살 한 줄(밝기 208, 흰 반사 안) — 양옆이 반사색이면 왼쪽 색으로
L3=im.convert('L').load(); n1=len(ch)
for y in range(330,341):
    for x in range(211,282):
        if L3[x,y]==208 and L3[x-2,y]>=226 and L3[x+2,y]>=226 and L3[x-1,y]!=208 or (L3[x,y]==208 and L3[x-1,y]>=226 and L3[x+3,y]>=226):
            setc(x,y,(x-1,y) if L3[x-1,y]>=226 else (x-2,y))
for y in range(331,341): setc(270,y,(269,y))  # 살 한 줄 x270
im.save(P+'hq_b2_infirmary_p9_fix2.png'); print('D2',len(ch)-n1)
