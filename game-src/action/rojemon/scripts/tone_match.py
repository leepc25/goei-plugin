# 기준 후보(c3)의 색을 쟈알디 그림 톤에 맞춤(비용 0). 정장: 쟈알디 정장 색상(205°)·채도(0.09~0.18)로, 피부 그림자: 쟈알디식 갈색 쪽으로, 머리: 채도를 쟈알디 수준으로 낮춤.
# 사용: python3 scripts/tone_match.py base/c3.png base/A.png
import sys,colorsys
from PIL import Image
src,dst=sys.argv[1],sys.argv[2]
im=Image.open(src).convert('RGBA'); px=im.load()
def hls(c): return colorsys.rgb_to_hls(*[v/255 for v in c])
def rgb(h,l,s): return tuple(round(v*255) for v in colorsys.hls_to_rgb(h,l,s))
for y in range(im.height):
    for x in range(im.width):
        r,g,b,a=px[x,y]
        if a==0: continue
        h,l,s=hls((r,g,b)); hd=h*360
        if l<0.03: continue                                   # 외곽선(검정) 그대로
        if 195<=hd<=232 and l<0.4:                             # 정장(청흑)
            px[x,y]=rgb(205/360, min(0.37,l*1.15), min(0.16,s*0.5))+(a,)
        elif 236<=hd<=320 and s<0.6:                           # 머리(라벤더): 채도만 낮춤
            px[x,y]=rgb(h, l*0.97, s*0.75)+(a,)
        elif (hd<=22 or hd>=350) and l<0.62 and s>0.3:         # 피부 깊은 그림자(붉음)만 쟈알디식 갈색 쪽으로
            px[x,y]=rgb(22/360, l, s*0.8)+(a,)
im.save(dst)
