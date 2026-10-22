#!/usr/bin/env python3
"""Embed the existing, explicitly identified source frames in a standalone review UI.
No generation, pixel edits, runtime asset writes, or engine changes.
"""
from pathlib import Path
import base64
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]

def image(path):
    raw = (ROOT / path).read_bytes()
    return {'source': path, 'sha256': hashlib.sha256(raw).hexdigest(),
            'url': 'data:image/png;base64,' + base64.b64encode(raw).decode()}

def clip(path, label, fps):
    files = sorted((ROOT / path).glob('*.png'))
    if not files:
        raise ValueError(f'No original frames: {path}')
    return {'label': label, 'fps': fps, 'frames': [image(str(p.relative_to(ROOT))) for p in files]}

agents = []
for key, name, root, clips, refs, note in [
    ('jyaldi', '쟈알디', 'game-src/action/jyaldi-v5/full/clips',
     [('walk','걷기',12),('run','달리기 · 3차 수정본',16),('idle','대기',8)],
     [('승인 이력 · 기준표 A','game-src/action/jyaldi-v5/sheet7/jyaldi-base-pixen-a.png'),
      ('후속 재킷 수정 · A2','game-src/action/jyaldi-v5/full/A2.png'),
      ('후속 옆모습 참조 · 가드 0장','game-src/action/jyaldi-v5/full/clips/guard/00.png')],
     '걷기와 달리기는 현재 원본 8장을 그대로 재생합니다. 걷기의 굽힌 무릎·작은 보폭·고정된 팔을 확인하세요. 최신 달리기는 3차 수정본이며 과거 0장 반려본과 다릅니다.'),
    ('kyuras','큐라스','game-src/action/kyuras/clips',
     [('snap1','기본 공격 1타',12),('snap2','기본 공격 2타',12),('snap3','기본 공격 3타',12),('walk_shotgun','산탄총 이동 자세',12),('idle','대기',8)],
     [('기준 그림 A','game-src/action/kyuras/base/A.png')],
     '기본 공격이 손가락 튕기기보다 주먹 지르기로 읽히는지 검수합니다. 유료 작업 idle_shotgun·run_shotgun은 회수 미확인으로 제외했습니다. 같은 이름의 과거 final 파일은 사용하지 않습니다.'),
    ('eileen','에일린','game-src/action/eileen/clips',
     [('idle','대기',8),('aim','조준',10),('aimshot','조준 사격',12),('walk','걷기',12),('run','달리기',16),('buttstroke','총몸 내려찍기',12)],
     [],
     '현재 원본 전투 자세를 재생합니다. 몸통·팔·손의 이어짐, 소총 파지와 얼굴 가림을 확인하세요. 원본에 그려진 소총을 그대로 표시하며 별도 무기 합성과 전투 판정은 연결하지 않았습니다.'),
]:
    agents.append({'id':key,'name':name,'note':note,
                   'clips':{c:clip(f'{root}/{c}',label,fps) for c,label,fps in clips},
                   'references':[dict(image(path),label=label) for label,path in refs]})

payload = {'sourceBase':'0a13285205b77fd6cf33b966cea246efa0d3082e',
           'generatedThisSession':False,'userVisualApproval':False,'agents':agents}
template = (ROOT/'tools/character_resume_demo.html').read_text()
output = ROOT/'release/demo/character-production-resume.html'
output.write_text(template.replace('__REVIEW_DATA__', json.dumps(payload,ensure_ascii=False).replace('</','<\\/')))
print(f'{output.relative_to(ROOT)}: {output.stat().st_size:,} bytes; {sum(len(c["frames"]) for a in agents for c in a["clips"].values())} original frames')
