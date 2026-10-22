"""Jyaldi-only follow-up viewer from actual generated frames; preserves prior viewer."""
from pathlib import Path
import json,base64,hashlib
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[3];RUN=HERE/'walk-contact-v2'
def image(p):
 raw=p.read_bytes();return {'src':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),'url':'data:image/png;base64,'+base64.b64encode(raw).decode()}
files=sorted((RUN/'review-frames').glob('[0-9][0-9].png'));assert len(files)==8
manifest=json.loads((RUN/'manifest.json').read_text(encoding='utf-8'))
motion={'root_x':[i*5 for i in range(8)],'cycle_delta_x':40,'phases':['근측 접촉','체중 싣기','통과','발 내밀기','원측 접촉','체중 싣기','통과','발 내밀기']}
data={'new':[image(p) for p in files],'old':[image(HERE/'walk-20261022/raw'/f'{i:02d}.png') for i in range(8)],'refs':[dict(image(HERE.parent/'full/A2.png'),label='재킷 기준 A2'),dict(image(HERE.parent/'full/clips/guard/00.png'),label='입력 옆모습')],'motion':motion,'job':', '.join(j['job_id'] for j in manifest['jobs']),'actualCost':sum(j['actual_generations'] for j in manifest['jobs']),'userVisualApproval':False}
template=(HERE/'review.html').read_text(encoding='utf-8')
template=template.replace('쟈알디 · 걷기 8장','쟈알디 · 걷기 접촉 수정').replace('쟈알디 · 걷기 재개 검수','쟈알디 · 걷기 접촉 수정 검수')
template=template.replace('이전 걷기 · 비교용','1차 수정 · 비교용').replace('새 걷기','2차 수정').replace('서버 차감 3회',f"이번 서버 차감 {data['actualCost']}회")
template=template.replace('원본 8장을 그대로 표시합니다.','새 생성과 접지 보정을 거친 8장을 표시합니다.').replace('프레임별 원본','프레임별 보정 결과').replace('장 원본','장 결과').replace('새 생성 결과','핵심 자세·보간·접지 보정 결과').replace('새 그림을 혼합하지 않았습니다.','기존 결과와 새 결과를 섞지 않았습니다.')
template=template.replace('48px','40px').replace('+=48*facing','+=40*facing').replace('-=48*facing','-=40*facing').replace('?96:0','?80:0')
template=template.replace("camera=$('source').value==='new'?world+facing*DATA.motion.root_x[frame]:0", "camera=world+facing*frame*($('source').value==='new'?5:6)")
template=template.replace("if(frame===0&&$('source').value==='new')world+=40*facing", "if(frame===0)world+=($('source').value==='new'?40:48)*facing")
template=template.replace("if($('source').value==='new'){if(frame===7&&d===1)world+=40*facing;if(frame===0&&d===-1)world-=40*facing;}", "if(frame===7&&d===1)world+=($('source').value==='new'?40:48)*facing;if(frame===0&&d===-1)world-=($('source').value==='new'?40:48)*facing;")
template=template.replace("?80:0", "?80:96").replace('이전 걷기','1차 수정')
template=template.replace('<label><input type="checkbox" id="guide" checked>접지선·뼈대</label>','<input type="checkbox" id="guide" hidden>')
template=template.replace('const p=DATA.motion.pixel_keypoints[frame]','const p=DATA.motion.pixel_keypoints?.[frame]||{}')
start=template.index('<p class="warning" id="verdict">');end=template.index('</p>',start)+4
template=template[:start]+'<p class="warning" id="verdict">'+manifest['review_message']+'</p>'+template[end:]
template=template.replace('다음 주기 0장을 40px 전진한 위치','다음 주기 0장을 40px 전진한 위치')
out=ROOT/'release/demo/jyaldi-walk-contact-v2.html';out.write_text(template.replace('__DATA__',json.dumps(data,ensure_ascii=False).replace('</','<\\/')),encoding='utf-8')
print(out,out.stat().st_size)
