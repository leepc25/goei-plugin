# 고른 기준 그림을 256×176(위 32 덧댐)으로 옮겨 base/<이름>.png로 두고 base.json에 첫 장 관절(쟈알디 대기 0장)을 적음.
# 사용: python3 addbase.py <이름> <원본 파일> [위 덧댐=32] [첫 자세를 딸 클립(기준 그림 자세가 대기와 다를 때)]
import sys,os,json
sys.path.insert(0,'.')
from PIL import Image
import bsrig, rig
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','base')
name,src=sys.argv[1],sys.argv[2]; top=int(sys.argv[3]) if len(sys.argv)>3 else 32
im=Image.open(os.path.join(R,src)).convert('RGBA')
out=Image.new('RGBA',(bsrig.CW,bsrig.CH)); out.alpha_composite(im,(0,top)); out.save(os.path.join(R,name+'.png'))
B=json.load(open(os.path.join(R,'base.json')))
pose=bsrig.CHARS[name]['clips'][sys.argv[4]][2][0] if len(sys.argv)>4 else rig.CLIPS['idle'][2][0]
B[name]={'img':name+'.png','kp':bsrig.kp(pose,bsrig.CHARS[name]['scale']),'src':src}
json.dump(B,open(os.path.join(R,'base.json'),'w'))
print(name,out.getbbox())
