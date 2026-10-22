# 생성기가 덧붙인 효과선(떨림·외침 줄, 회색 먼지 같은 외곽선 없는 칠) 지우기.
# 캐릭터는 검은 외곽선으로 닫혀 있으므로, 캔버스 바깥에서 4방향으로 채워 들어가며 '투명 또는 외곽선이 아닌 칠'을 따라 닿는 칠 = 외곽선 밖 효과 → 지움.
# 외곽선에 틈이 있어 몸 안까지 새면(지울 칸이 LIMIT 넘음) 그 장은 손대지 않고 알림. 몸과 떨어진 조각도 지움.
# 사용: python3 fx_clean.py id[/클립] ...   (모듈: clean(arr) -> (arr, 지운 칸 수 또는 -1))
import sys,os,numpy as np
from PIL import Image
from scipy import ndimage
LIMIT=60
def clean(im,dark=70):
    im=im.copy(); a=im[...,3]>0
    outline=a&(im[...,:3].max(-1)<dark)
    free=~outline                                   # 채움이 지나갈 수 있는 칸
    pad=np.pad(free,1,constant_values=True)
    lab,_=ndimage.label(pad)                        # 4방향
    outside=(lab==lab[0,0])[1:-1,1:-1]
    fx=outside&a
    n=int(fx.sum())
    if n>LIMIT: return im,-1
    a&=~fx
    lab,k=ndimage.label(a,structure=np.ones((3,3)))
    if k>1:
        sz=ndimage.sum(a,lab,range(1,k+1)); keep=1+int(np.argmax(sz)); n+=int(a.sum()-sz[keep-1]); a&=(lab==keep)
    im[~a]=0
    return im,n
if __name__=='__main__':
    C=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../clips')
    for t in sys.argv[1:]:
        dirs=[f'{C}/{t}'] if '/' in t else [f'{C}/{t}/{d}' for d in sorted(os.listdir(f'{C}/{t}')) if os.path.isdir(f'{C}/{t}/{d}')]
        for d in dirs:
            for f in sorted(os.listdir(d)):
                if not f.endswith('.png'): continue
                im=np.array(Image.open(f'{d}/{f}').convert('RGBA')); out,n=clean(im)
                if n<0: print('LEAK',d,f)
                elif n: Image.fromarray(out).save(f'{d}/{f}'); print(os.path.relpath(d,C),f,n)
