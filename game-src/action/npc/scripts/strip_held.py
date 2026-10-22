# 손에 든 물건·빛줄기 지우기(사용자 규칙: 그림엔 캐릭터만, 손전등 몸통은 남기고 빛은 게임이 그림).
# 몸 앞쪽(몸 중심보다 MINDX 넘게 앞)에 있는, 밝고 채도 낮은 칠의 덩어리(MINSZ칸 이상)를 지움. 흰 셔츠 깃·흰 가운처럼 몸 중심 가까운 것은 남김.
# 사용: python3 strip_held.py id/클립 ...  (모듈: strip(arr, mindx, minsz) -> (arr, 지운 칸))
import sys,os,numpy as np
from PIL import Image
from scipy import ndimage
def strip(im,mindx=10,minsz=12):
    im=im.copy(); a=im[...,3]>0
    rgb=im[...,:3].astype(int); mx=rgb.max(-1); mn=rgb.min(-1)
    pale=a&(mx>105)&((mx-mn)<38)
    xs=np.nonzero(a)[1]; cx=np.median(xs)
    lab,k=ndimage.label(pale,structure=np.ones((3,3))); n=0
    for i in range(1,k+1):
        m=lab==i; sz=int(m.sum())
        if sz>=minsz and np.nonzero(m)[1].mean()>cx+mindx:
            im[m]=0; n+=sz
    # 지우고 남은 몸과 떨어진 부스러기
    a=im[...,3]>0; lab,k=ndimage.label(a,structure=np.ones((3,3)))
    if k>1:
        sz=ndimage.sum(a,lab,range(1,k+1)); keep=1+int(np.argmax(sz))
        for i in range(1,k+1):
            if i!=keep and sz[i-1]<40: im[lab==i]=0; n+=int(sz[i-1])
    return im,n
if __name__=='__main__':
    C=os.path.join(os.path.dirname(os.path.abspath(__file__)),'../clips')
    for t in sys.argv[1:]:
        d=f'{C}/{t}'
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'):
                im=np.array(Image.open(f'{d}/{f}').convert('RGBA')); out,n=strip(im)
                if n: Image.fromarray(out).save(f'{d}/{f}')
                print(t,f,n)
