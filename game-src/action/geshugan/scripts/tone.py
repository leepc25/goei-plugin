# 기준 그림 색 맞추기: 슬랙스·넥타이의 검정 음영을 쟈알디 정장 청회색 단계로 옮김(같은 명도 순서, 1:1 대응).
from PIL import Image
M={(15,16,21):(18,22,23),(18,21,25):(26,30,33),(22,25,30):(36,40,43),(27,32,36):(46,53,60),(47,55,62):(62,77,89),(62,73,83):(75,89,99),(5,6,7):(13,18,19)}
def tone(im):
    im=im.convert('RGBA'); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if a and (r,g,b) in M: px[x,y]=M[(r,g,b)]+(a,)
    return im
if __name__=='__main__':
    import sys; tone(Image.open(sys.argv[1])).save(sys.argv[2])
