"""Eileen-only reviewed rifle sling segment and explicit anchors."""
from pathlib import Path
from PIL import Image
import json,math
ART=Path(__file__).resolve().parents[1]
D=ART/'resume/live-20261022'
def apply(frames,anchors):
 request=json.loads((D/'transition-rig/request.json').read_text(encoding='utf-8'))
 points=request['arguments']['keypoints']
 prefix=[];prefix_anchors=[]
 for i in range(6):
  folder='transition-rig' if i<2 else 'transition-exact'
  prefix.append(Image.open(D/f'{folder}/{i:02d}.png').convert('RGBA'))
  p={v['label']:(v['x']*192,v['y']*144) for v in points[i]}
  w,e,w2=p['RIGHT ARM'],p['RIGHT ELBOW'],p['LEFT ARM']
  prefix_anchors.append({'hand':[round(v) for v in w],'hand2':[round(v) for v in w2],'angle':round(math.degrees(math.atan2(w[1]-e[1],w[0]-e[0]))),'hip':[round((p['RIGHT HIP'][j]+p['LEFT HIP'][j])/2) for j in [0,1]]})
 # Existing pistol-draw suffix and its original anchors remain exact.
 return prefix+frames[1:],prefix_anchors+anchors[1:]
