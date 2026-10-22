# 쟈알디 A2 톤 맞추기: 정장류(어둡고 채도 낮은) 화소를 A2 정장 색 줄(색상 약 205도, 채도 0.2~0.3)에서 명도가 가장 가까운 색으로 바꿈.
# 순검정 외곽선(명도<0.03), 피부·흰 셔츠·흰 머리(명도>0.62 또는 채도 높은 따뜻한 색), 금속 밝은 면은 그대로.
import os,colorsys
from PIL import Image
A2=os.path.join(os.path.dirname(__file__),'../../jyaldi-v5/full/A2.png')
def _ramp():
    im=Image.open(A2).convert('RGBA'); c={}
    for p in im.getdata():
        if p[3]>128: c[p[:3]]=c.get(p[:3],0)+1
    out=[]
    for k,n in c.items():
        h,s,v=colorsys.rgb_to_hsv(*[x/255 for x in k])
        if n>=15 and 0.03<v<0.6 and 0.14<s<0.35 and 180<=h*360<=215: out.append((v,k))
    return sorted(out)
RAMP=_ramp()
def suitlike(rgb):
    h,s,v=colorsys.rgb_to_hsv(*[x/255 for x in rgb]); h*=360
    if v<0.03 or v>0.6: return False
    if s<0.18: return True                       # 무채색 검정·회색
    return 170<=h<=250 and s<0.5                 # 푸른 회색
def _vals(im):
    return sorted(colorsys.rgb_to_hsv(*[q/255 for q in p[:3]])[2] for p in im.convert('RGBA').getdata() if p[3]>128 and suitlike(p[:3]))
A2V=None
def lut(ref):
    """기준 그림의 정장 명도 분포를 A2 정장 명도 분포에 백분위로 맞추는 함수(대상마다 한 번 만들어 모든 장에 같은 것 사용)."""
    global A2V
    if A2V is None: A2V=_vals(Image.open(A2))
    rv=_vals(ref)
    def f(v):
        import bisect
        q=bisect.bisect_left(rv,v)/max(1,len(rv)); return A2V[min(len(A2V)-1,int(q*len(A2V)))]
    return f
def tone(im,f=None):
    im=im.convert('RGBA'); px=im.load(); cache={}
    for y in range(im.height):
        for x in range(im.width):
            p=px[x,y]
            if p[3]<=128: continue
            c=p[:3]
            if c not in cache:
                if suitlike(c):
                    v=colorsys.rgb_to_hsv(*[q/255 for q in c])[2]
                    if f: v=f(v)
                    cache[c]=min(RAMP,key=lambda r:abs(r[0]-v))[1]
                else: cache[c]=c
            px[x,y]=cache[c]+(255,)
    return im
if __name__=='__main__':
    import sys
    for fn in sys.argv[1:]:
        im=Image.open(fn); tone(im,lut(im)).save(fn.replace('.png','.tone.png'))
