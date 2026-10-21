# 발이 미끄러지지 않는 뼈대(2026-10-21 문워크 수정): 그림 안에서 실제로 전진한다.
# 3연타: 앞발 내딛기(뒷발 고정) → 타격 → 뒷발이 끌려와 대기 폭 회복. 다음 타는 그 자리에서 시작.
# 걷기: 복싱 밀고 끌기 한 주기(앞발 → 뒷발), 끝 장 = 대기 + 보폭. 뒤로 걷기는 거꾸로 재생(뒷발 먼저 → 앞발).
# 코드는 끝 장(대기+이동량)에서만 위치를 옮기고 대기 그림으로 바꾼다 → 이음매 없음.
import skel2
P=skel2.pose
O=-20  # 캔버스 안 시작 위치(3타 주먹이 160 안에 들도록 왼쪽으로)
def guard(d): return P((69+O+d,60),5,-0.8,-0.5,(82+O+d,100),(56+O+d,98),(19,1),'chin')
def lerp(a,b,t): return {k:(a[k][0]+(b[k][0]-a[k][0])*t,a[k][1]+(b[k][1]-a[k][1])*t) for k in a}
def staged(a,b,t):
    out={}
    for k in a:
        tt=min(1,t*1.5) if ('HIP' in k or 'KNEE' in k or 'LEG' in k) else t**1.6 if ('ELBOW' in k or k.endswith(' ARM')) else min(1,t*1.2)
        out[k]=(a[k][0]+(b[k][0]-a[k][0])*tt,a[k][1]+(b[k][1]-a[k][1])*tt)
    return out
def rear_slide(imp,g_next,t):
    """타격 자세에서 뒷발만 끌려옴: 앞발 고정, 뒷다리·골반·상체는 다음 대기로 t만큼"""
    m=lerp(imp,g_next,t)
    for k in ('RIGHT HIP','RIGHT KNEE','RIGHT LEG'): pass
    m['RIGHT LEG']=g_next['RIGHT LEG']  # 앞발은 이미 다음 대기 자리(=타격 때 디딘 자리)
    lift=4*(1-abs(2*t-1))                # 끌려오는 뒷발이 살짝 뜸
    m['LEFT LEG']=(m['LEFT LEG'][0],m['LEFT LEG'][1]-lift)
    return m
ADV=(6,10,20)
G0=guard(0);G1=guard(6);G2=guard(16);G3=guard(36)
JAB=P((73+O,60),8,-1.2,-0.6,(88+O,100),(56+O,98),'out','chin')
CROSS=P((80+O+6,61),12,1.3,1.0,(92+O+6,100),(58+O+6,96),'chin','out',head=(6,-6))
POWER=P((84+O+16,64),15,-1.4,-0.9,(102+O+16,100),(58+O+16,98),'out','chin',head=(6,-6))
COMBO=[('00g0',G0),('01jab-a',staged(G0,JAB,.5)),('02jab',JAB),('03jab-slide',rear_slide(JAB,G1,.5)),('04g1',G1),
 ('05cross-a',staged(G1,CROSS,.35)),('06cross-b',staged(G1,CROSS,.7)),('07cross',CROSS),('08cross-slide',rear_slide(CROSS,G2,.5)),('09g2',G2),
 ('10power-a',staged(G2,POWER,.3)),('11power-b',staged(G2,POWER,.65)),('12power',POWER),('13power-slide',rear_slide(POWER,G3,.5)),('14g3',G3)]
# 걷기: 보폭 14. 앞발 4장(들고 앞으로, 착지) → 뒷발 4장(끌려옴). 골반은 두 발 가운데를 따라감.
STRIDE=14
def walk(lead_d,rear_d,lead_lift,rear_lift):
    p=P((69+O+(lead_d+rear_d)/2,60),5,-0.8,-0.5,(82+O+lead_d,100-lead_lift),(56+O+rear_d,98-rear_lift),(19,1),'chin')
    return p
WALK=[('w1',walk(4,0,4,0)),('w2',walk(9,0,4,0)),('w3',walk(14,0,1,0)),('w4',walk(14,0,0,0)),
      ('w5',walk(14,4,0,3)),('w6',walk(14,9,0,3)),('w7',walk(14,13,0,1)),('w8',walk(14,14,0,0))]
if __name__=='__main__':
    from PIL import Image; import skel
    for nm,seq in (('combo2',COMBO),('walk',[('g0',G0)]+WALK)):
        s=2; im=Image.new('RGBA',(160*s*len(seq),112*s))
        for i,(n,p) in enumerate(seq): im.alpha_composite(skel.draw(p,None,s),(i*160*s,0))
        im.save(f'../skel/{nm}-plan.png')
    for n,p in COMBO+WALK: print(n,'leadx',round(p['RIGHT LEG'][0]),'rearx',round(p['LEFT LEG'][0]),'fist',round(max(p['RIGHT ARM'][0],p['LEFT ARM'][0])))
