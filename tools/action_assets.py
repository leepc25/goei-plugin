"""검수한 동작 시트의 슬라이싱·트리밍·팔레트 패킹. 신체 비율을 변형하지 않는다.

python3 tools/action_assets.py
layout.json에 검수한 원본 크기/행 경계/시트당 단일 배율을 기록한다.
앉기·누움 등 프레임별 높이를 동일하게 맞추지 않는다.
"""
from pathlib import Path
import json
import statistics
import hashlib
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'game-src/action'
OUT=ROOT/'game-pack/action'

def read_sheet(config):
    import numpy as np
    from scipy import ndimage
    image=Image.open(SRC/config['file']).convert('RGBA')
    if list(image.size)!=config['size']:raise ValueError(f"원본 크기 변경: {config['file']}")
    if hashlib.sha256((SRC/config['file']).read_bytes()).hexdigest()!=config['sha256']:raise ValueError('검수한 시트 변경')
    # 팔·다리가 셀 경계를 넘어도 잘리지 않도록 원본 전체의 연결 요소로 분리한다.
    mask=np.asarray(image.getchannel('A'))>128
    labels,count=ndimage.label(mask,structure=np.ones((3,3)))
    sizes=np.bincount(labels.ravel());sizes[0]=0
    chosen=sorted(range(1,count+1),key=lambda i:-sizes[i])[:config['count']]
    if len(chosen)!=config['count'] or min(sizes[i] for i in chosen)<config.get('minimumArea',5000):raise ValueError('프레임이 서로 붙었거나 누락됨')
    boxes=ndimage.find_objects(labels)
    chosen.sort(key=lambda i:(boxes[i-1][0].start+boxes[i-1][0].stop)/2)
    ordered=[]
    for row in range(0,len(chosen),config['cols']):
        ordered.extend(sorted(chosen[row:row+config['cols']],key=lambda i:(boxes[i-1][1].start+boxes[i-1][1].stop)/2))
    result=[]
    for component in ordered:
        ys,xs=boxes[component-1];box=(xs.start,ys.start,xs.stop,ys.stop)
        cell=image.crop(box)
        main=labels[ys,xs]==component
        cell.putalpha(Image.fromarray((main*255).astype('uint8')))
        band=main[int(cell.height*.42):int(cell.height*.5)]
        points=np.nonzero(band)[1]
        anchor=int(np.median(points)) if len(points) else cell.width//2
        result.append((cell,anchor,cell.height,cell.height))
    scale=config['scale']
    return [(im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.NEAREST),round(ax*scale),round(ay*scale),round(h*scale)) for im,ax,ay,h in result]

def build():
    OUT.mkdir(exist_ok=True,parents=True)
    layout=json.loads((SRC/'layout.json').read_text())
    frames=[]
    for config in layout['sheets']:frames.extend(read_sheet(config))
    expected=layout['frameCount']
    if len(frames)!=expected:raise ValueError(f'예상 {expected}프레임, 실제 {len(frames)}')
    standard=json.loads((SRC/'jyaldi-standard.json').read_text())
    if hashlib.sha256((SRC/'jyaldi-master.png').read_bytes()).hexdigest()!=standard['sourceSha256']:raise ValueError('기준 원본 변경')
    if layout.get('masterSha256')!=standard['sourceSha256']:raise ValueError('동작 시트가 현재 기준 원본과 연결되지 않음')
    if not layout.get('visualReview'):raise ValueError('시트 시각 검수 기록 필요')
    master=Image.open(OUT/'jyaldi-master.png').convert('RGBA')
    if hashlib.sha256((OUT/'jyaldi-master.png').read_bytes()).hexdigest()!=standard['runtimeSha256']:raise ValueError('기준 도트 변경')
    frames.append((master,master.width//2,master.height,160))
    positions={};x=y=shelf=0
    for i,(image,*_) in sorted(enumerate(frames),key=lambda entry:-entry[1][0].height):
        if x+image.width>1024:x=0;y+=shelf+2;shelf=0
        positions[i]=(x,y);x+=image.width+2;shelf=max(shelf,image.height)
    atlas=Image.new('RGBA',(1024,y+shelf));meta=[];contacts=[]
    for i,(image,ax,ay,height) in enumerate(frames):
        x,y=positions[i];atlas.paste(image,(x,y));meta.append([x,y,image.width,image.height,ax,ay,height])
        alpha=image.getchannel('A');active=[x for x in range(image.width) if any(alpha.getpixel((x,y))>80 for y in range(max(0,image.height-4),image.height))]
        groups=[]
        for x in active:
            if not groups or x>groups[-1][-1]+2:groups.append([x])
            else:groups[-1].append(x)
        contacts.append([[round(statistics.mean(group))-ax,0] for group in groups if len(group)>=3][:2])
    atlas.quantize(colors=192,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(OUT/'a-jyaldi-action.png',optimize=True)
    bg=Image.open(SRC/'bureau-corridor.png').convert('RGB').resize((640,360),Image.Resampling.NEAREST)
    bg.quantize(colors=96,dither=Image.Dither.NONE).save(OUT/'bg-bureau-action.png',optimize=True)
    legacy=json.loads((ROOT/'game-pack/patrol/atlas.json').read_text())
    clips={**layout['clips'],'master':[expected]}
    if any(i<0 or i>=len(frames) for clip in clips.values() for i in clip):raise ValueError('잘못된 클립 인덱스')
    required={'idle','walk','run','melee1','melee2','melee3','shot','guard','crouch','jump_up','jump_apex','jump_down','land','dash','hurt','down','rise'}
    if not required.issubset(clips) or any(not clips[key] or any(i>=expected for i in clips[key]) for key in required):raise ValueError('동작 누락 또는 기준 정지 이미지로 대체됨')
    idleHeight=meta[clips['idle'][0]][3]
    if not 150<=idleHeight<=170 or meta[clips['crouch'][0]][3]>=idleHeight-20 or meta[clips['down'][-1]][3]>=idleHeight/2:raise ValueError('서기/앉기/다운 크기 검증 실패')
    data={name:legacy[name] for name in ['corner','watchman']}
    data['action']={'frames':meta,'clips':clips,'scale':1,'contacts':contacts,'source':standard['sourceSha256'],'visualReview':layout['visualReview']}
    (OUT/'atlas.json').write_text(json.dumps(data,separators=(',',':')))
    for name in ['e-corner','e-watchman']:(OUT/f'{name}.png').write_bytes((ROOT/f'game-pack/patrol/{name}.png').read_bytes())
    print('frames',len(frames),'sprite PNG', (OUT/'a-jyaldi-action.png').stat().st_size,'background', (OUT/'bg-bureau-action.png').stat().st_size)

if __name__=='__main__':build()
