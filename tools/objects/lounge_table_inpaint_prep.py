"""휴게실 p8s 바닥에 테이블 자리 네모를 잡아 inpaint 창·마스크·미리보기 만들기(생성은 안 함).
창 = p8s x[WX0, WX0+512) 전체 높이. 마스크 = 테이블 자리(흰색). 미리보기 = 자홍 네모 + 왼쪽에 앉은 쟈알디·쉘 의자(크기 기준)."""
import sys, os, json
from pathlib import Path
ROOT=Path('/home/user/goei-plugin')
sys.path.insert(0,str(ROOT/'game-src/action/testroom3')); sys.path.insert(0,str(ROOT/'game-src/action/testroom3/qa'))
os.environ['CHAIR_DIR']=str(ROOT/'game-src/art/objects/chairs_shell/fit')
import fit_chair as fc
from PIL import Image, ImageDraw
WX0=60; W=512; MX0,MY0,MX1,MY1=200,262,420,412; FOOT=400   # 2차: 폭 220(1차 140은 상판이 잘림), 높이 150, 발선 400
bg=Image.open(ROOT/'game-src/art/pixellab-hq-20261031/hq_lounge_p8s.png').convert('RGBA')
win=bg.crop((WX0,0,WX0+W,bg.height)); mask=Image.new('RGB',win.size,(0,0,0)); ImageDraw.Draw(mask).rectangle([MX0-WX0,MY0,MX1-WX0-1,MY1-1],fill=(255,255,255))
# 마스크 칸 안의 옛 그림은 지움(흰색)
wi=win.copy(); ImageDraw.Draw(wi).rectangle([MX0-WX0,MY0,MX1-WX0-1,MY1-1],fill=(255,255,255,255))
D=ROOT/'game-src/art/pixellab-hq-20261031/lounge_table'; wi.save(D/'inpaint_input.png'); mask.save(D/'inpaint_mask.png')
json.dump({'WX0':WX0,'W':W,'mask':[MX0,MY0,MX1,MY1],'foot':FOOT},open(D/'inpaint_spec.json','w'))
# 미리보기
pv=bg.copy(); fit=json.load(open(ROOT/'game-src/art/objects/chairs_shell/jyaldi_fit_v4.json'))
cfg,_=fc.load('1.1_쟈알디'); im=fc.last(cfg,'105')
cx=MX0-25-6; foot=FOOT-15
c=Image.open(ROOT/'game-src/art/objects/chairs_shell/fit/east.png').convert('RGBA')
pv.alpha_composite(c,(round(cx+fit['side']['dx']-100),round(foot+fit['side']['dy']-171)))
pv.alpha_composite(im,(round(cx-im.width/2),round(foot-(im.height-4))))
g=ImageDraw.Draw(pv); g.rectangle([MX0,MY0,MX1-1,MY1-1],outline=(255,0,255,255),width=2); g.rectangle([WX0,0,WX0+W-1,bg.height-1],outline=(0,255,255,255),width=1)
g.line([(MX0-40,FOOT),(MX1+40,FOOT)],fill=(255,80,80,255),width=1); g.line([(MX0-40,FOOT-120),(MX1+40,FOOT-120)],fill=(80,255,80,255),width=1)
pv.convert('RGB').resize((bg.width*2,bg.height*2),Image.NEAREST).save('/mnt/project-files/hq-f3/now/lounge_table_inpaint_spot2_x2.png')
print('ok')
