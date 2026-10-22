"""Package recovered armor frames into an independent playable demo.
Old originals and full/final are read-only inputs. No shared engine writes.
"""
from pathlib import Path
import base64,copy,hashlib,io,json,math
from PIL import Image,ImageDraw

HERE=Path(__file__).resolve().parent
GD=HERE.parent
ROOT=GD.parents[2]
OUT=HERE/'arrival-v2'
JOB='7282832d-aa8a-4969-b050-096a6a4832ed'
def b64(data):return base64.b64encode(data).decode()
def sha(data):return hashlib.sha256(data).hexdigest()

def build():
    paths=sorted((OUT/'raw').glob('[0-9][0-9].png'))
    assert len(paths)==8, 'Must recover all 8 original frames before delivery'
    frames=[Image.open(p).convert('RGBA') for p in paths]
    assert all(im.size==(256,192) for im in frames)
    strip=Image.new('RGBA',(256*8,192))
    rows=[]
    for i,(p,im) in enumerate(zip(paths,frames)):
        strip.paste(im,(i*256,0))
        rows.append({'index':i,'path':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':sha(p.read_bytes()),'bbox':im.getbbox()})
    strip.save(OUT/'a_arrive_v2.png')
    manifest=json.loads((GD/'full/final/manifest.json').read_text(encoding='utf-8'))
    # Reference sprites end at inclusive sole pixels 169 / 187. Set-level
    # registration preserves jump/hover displacement within each animation.
    manifest['sets']['bare']['foot']=169
    manifest['sets']['armor']['foot']=187
    strips={k:b64((GD/'full/final'/f'{k}.png').read_bytes()) for k in manifest['clips']}
    plan=json.loads((OUT/'plan.json').read_text(encoding='utf-8'))
    c=manifest['clips']['a_arrive']
    c.update(frames=8,label='소환 자세 연결 · 새 PixelLab 8장',fps=10,loop=False,
             job_id=JOB,actual_cost_generations=3,user_visual_approval=False)
    c['anchors']=[]
    for p in plan['armor_poses']:
        w,e,w2=p['RIGHT ARM'],p['RIGHT ELBOW'],p['LEFT ARM']
        c['anchors'].append({'hand':list(map(round,w)),'hand2':list(map(round,w2)),
          'angle':round(math.degrees(math.atan2(w[1]-e[1],w[0]-e[0]))),
          'hip':[round((p['RIGHT HIP'][i]+p['LEFT HIP'][i])/2) for i in [0,1]]})
    strips['a_arrive']=b64((OUT/'a_arrive_v2.png').read_bytes())
    manifest['production']={'job_id':JOB,'actual_cost':3,'unit':'generations','request_sha256':plan['request_sha256'],
        'new_clips':['a_arrive'],'user_visual_approval':False,'frames':rows,
        'warning':'Other clips are existing comparison assets. Remaining combat/movement defects are not approved.'}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    tpl=(ROOT/'tools/gorgodio_full_template.html').read_text(encoding='utf-8')
    tpl=tpl.replace('<h1>고르고디오 전 동작 시연판', '<p style="color:#ffd68b">새 갑옷 소환 8장 반영 · D로 몸→갑옷 전환 · 생성 완료 / 사용자 시각 승인 대기</p><h1>고르고디오 독립 수정 시연판')
    html=tpl.replace('__MANIFEST__',json.dumps(manifest,ensure_ascii=False)).replace('__STRIPS__',json.dumps(strips)).replace('__BG__',b64((ROOT/'game-src/action/bureau-corridor.png').read_bytes())).replace('__NBARE__','76').replace('__NARMOR__','28')
    (ROOT/'release/demo/gorgodio-resume.html').write_text(html,encoding='utf-8')
    # Every generated frame at 2x, plus the exact body endpoint, on common sole/anchor lines.
    tiles=[]
    for label,im,anchor,foot in [('body summon/07',Image.open(GD/'full/clips/summon/07.png').convert('RGBA'),86,169)]+[(f'armor new/{i:02}',im,100,187) for i,im in enumerate(frames)]:
        tile=Image.new('RGB',(380,420),'#243341');d=ImageDraw.Draw(tile)
        d.line((0,390,379,390),fill='#75ddaa');d.line((160,0,160,419),fill='#516578')
        im=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
        tile.paste(im,(160-anchor*2,390-foot*2),im);d.text((8,8),label,fill='white');tiles.append(tile)
    contact=Image.new('RGB',(1140,1260),'#243341')
    for i,im in enumerate(tiles):contact.paste(im,((i%3)*380,(i//3)*420))
    contact.save(OUT/'contact.png')
    print('Built playable demo with 8 new original frames; no user approval asserted')
if __name__=='__main__':build()
