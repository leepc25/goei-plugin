#!/usr/bin/env python3
"""One Deadpole job at a time; immutable requests, no automatic paid retries."""
import argparse
import base64
from datetime import datetime, timezone
import fcntl
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import urllib.request
import os
from PIL import Image
import gen
import rig
import mcp_client

ROOT = Path(__file__).resolve().parents[4]
OUT = ROOT / 'game-src/action/deadpole/resume'
BASE = ROOT / 'game-src/action/deadpole/full/base.png'


def now():
    return datetime.now(timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temp.replace(path)


def designs():
    # Character-specific rig code only; never reads another character's art.
    retention = rig.P((rig.X+2, rig.HY+3), 8, rig.SIDE, -.1,
                      (rig.X+11, rig.G), (rig.X-7, rig.G),
                      ('r', 12, 13), ('r', 8, 9), le=('e', 2, 14), re=('e', 0, 12), tilt=-2)
    recoil = rig.jit(retention, -1, -1, ['RIGHT ARM'])
    catch = [dict(p) for p in rig.CLIPS['catch'][2][:-1]]
    # Dedicated counter starts at the same pose, not the unrelated contact clip.
    boundary = catch[-1]
    extended = dict(boundary)
    extended['RIGHT ARM'] = (boundary['RIGHT ARM'][0]+3, boundary['RIGHT ARM'][1])
    recovery = rig.jit(extended, -1, -1, ['RIGHT ARM'])
    return {
        'pipe_body': ('two handed swing, empty closed hands, then step back', rig.CLIPS['pipe'][2]),
        'cq1_body': ('chest level horizontal retention, brief wrist recoil, empty hands',
                     [rig.READY(), retention, recoil, retention]),
        'cq3_palm': ('rear hand stays low, front open palm pushes forward then returns',
                     [boundary, rig.lerp(boundary, rig.PSH, .5), rig.PSH, rig.PSH,
                      rig.lerp(rig.PSH, boundary, .5), boundary]),
        'catch_body': ('front open fingers close around a wrist, sidestep, rear hand low', catch),
        'counter_body': ('keep high hand closed, low empty hand extends horizontally and recoils',
                         [boundary, extended, recovery, extended, boundary]),
    }


def prepare():
    desc = ('petite adult woman, long straight black hair to hips, blunt bangs, pale face, '
            'warm charcoal open hip-length suit jacket, white shirt, black tie and gloves, '
            'strict right-facing profile, empty hands, character only, transparent background, '
            'no held objects, no weapons, no effects')
    result = []
    for name, (action, poses) in designs().items():
        args = dict(description=desc, action=action, direction='east', view='side',
                    no_background=True, first_frame_url='data:image/png;base64,'+base64.b64encode(BASE.read_bytes()).decode(),
                    first_frame_keypoints=rig.kp(gen.BASE_POSE), keypoints=[rig.kp(p) for p in poses], seed=1022)
        canonical = json.dumps(args, sort_keys=True, separators=(',', ':')).encode()
        request = dict(tool='animate_with_skeleton_v3', arguments=args,
                       input_sha256=sha(BASE.read_bytes()), request_sha256=sha(canonical),
                       estimated_generations=rig.cost(len(poses)), actual_cost=None,
                       status='draft_not_submitted', user_visual_approval=False,
                       reference_keypoints_status='inherited_estimate_requires_image_alignment_review')
        save(OUT/'requests'/f'{name}.json', request)
        save(OUT/'requests'/f'{name}-hands.json', {
            'status': 'skeleton_targets_not_verified_generated_hand_positions',
            'frames': [{s: [round(p[s+' ARM'][0]+rig.DX,3), round(p[s+' ARM'][1]+rig.DY,3)]
                        for s in ['RIGHT', 'LEFT']} for p in poses]})
        result.append(dict(clip=name, frames=len(poses), estimate=request['estimated_generations']))
    save(OUT/'requests/estimates.json', {'estimate_only': True, 'jobs': result})
    print(json.dumps(result, ensure_ascii=False))


def inspect():
    value = {'observed_at': now(), 'balance': mcp_client.tool('get_balance', {}),
             'jobs': mcp_client.tool('list_jobs', {'include_recent': True})}
    save(OUT/'live-account.json', value)
    print(json.dumps(value, ensure_ascii=False))


def submit(name, queue_reviewed, reference_reviewed):
    if not os.environ.get('PIXELLAB_API_TOKEN'):
        raise ValueError('PIXELLAB_API_TOKEN 미설정: 제출·예약하지 않음')
    if not queue_reviewed or not reference_reviewed:
        raise ValueError('계정 전체 큐·잔액·한도 조율과 기준 그림 관절 대조 후 두 reviewed 옵션을 지정')
    snapshot = json.loads((OUT/'live-account.json').read_text())
    if (datetime.now(timezone.utc)-datetime.fromisoformat(snapshot['observed_at'])).total_seconds() > 180:
        raise ValueError('inspect로 현재 계정 상태를 다시 확인하세요')
    request = json.loads((OUT/'requests'/f'{name}.json').read_text())
    if request['input_sha256'] != sha(BASE.read_bytes()):
        raise ValueError('입력 그림 해시 변경')
    raw = json.dumps(request['arguments'], sort_keys=True, separators=(',', ':')).encode()
    if request['request_sha256'] != sha(raw):
        raise ValueError('요청 해시 변경')
    # Shared among local worktrees. Remote workers still require coordinator review.
    common = subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], cwd=ROOT, text=True).strip()
    lock = (ROOT/ common).resolve()/'deadpole-production.lock'
    with lock.open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        for p in (OUT/'attempts').glob('*/state.json'):
            if json.loads(p.read_text())['state'] != 'recovered':
                raise ValueError('미회수 또는 결과 불명 작업이 있습니다. 재제출 금지: '+str(p))
        folder = OUT/'attempts'/name
        folder.mkdir(parents=True, exist_ok=False)
        save(folder/'request.json', request)
        save(folder/'account-before.json', snapshot)
        state = dict(state='submitting_outcome_unknown', started_at=now(), job_id=None, actual_cost=None)
        save(folder/'state.json', state)
        print(f"{name}: 예상 {request['estimated_generations']}회 차감, 1건 제출", flush=True)
        try:
            response = mcp_client.tool(request['tool'], request['arguments'])
            save(folder/'submit-response.json', response)
            job_ids = set(re.findall(r'\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b', mcp_client.text(response)))
            if len(job_ids) != 1:
                raise ValueError('작업 ID를 하나로 확정할 수 없음. 조회 후 대조, 재제출 금지')
            state.update(state='submitted', job_id=job_ids.pop())
            save(folder/'state.json', state)
        except Exception as exc:
            save(folder/'failure.json', {'observed_at': now(), 'error_type': type(exc).__name__,
                                        'note': '차감 여부 불명. 같은 요청 재제출 금지, 계정 큐 대조 필요.'})
            raise


def recover(name):
    folder = OUT/'attempts'/name
    state = json.loads((folder/'state.json').read_text())
    job_id = state['job_id']
    if not job_id:
        raise ValueError('결과 불명 제출: 현재 계정 큐에서 ID부터 대조')
    # Metadata is the authority for cost, never a shared balance subtraction.
    req = urllib.request.Request('https://api.pixellab.ai/v2/background-jobs/'+job_id,
                                 headers={'Authorization': 'Bearer '+os.environ['PIXELLAB_API_TOKEN']})
    with urllib.request.urlopen(req, timeout=45) as r:
        metadata = json.load(r)
    save(folder/'job.json', metadata)
    state['actual_cost'] = metadata.get('usage')
    save(folder/'state.json', state)
    if metadata.get('status') != 'completed':
        print(metadata.get('status')); return
    count = len(json.loads((folder/'request.json').read_text())['arguments']['keypoints'])
    frames = []
    for i in range(count):
        path = folder/f'{i:02d}.png'
        if not path.exists():
            result = mcp_client.tool('get_image', {'job_id': job_id, 'index': i})
            images = [b for b in result['result']['content'] if b.get('type') == 'image']
            if len(images) != 1 or images[0].get('mimeType') != 'image/png':
                raise ValueError('프레임 PNG 응답 없음; 재생성하지 않음')
            data = base64.b64decode(images[0]['data'], validate=True)
            with Image.open(io.BytesIO(data)) as im:
                im.load()
                if im.size != (192, 144) or not im.convert('RGBA').getchannel('A').getbbox():
                    raise ValueError('원본 크기 또는 알파 검증 실패')
            path.write_bytes(data)
        frames.append(dict(index=i, sha256=sha(path.read_bytes()), job_id=job_id))
    save(folder/'frames.json', frames)
    state.update(state='recovered', internal_review='pending', user_visual_approval=False)
    save(folder/'state.json', state)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare','inspect','submit','recover'])
    parser.add_argument('name', nargs='?', choices=list(designs()))
    parser.add_argument('--queue-reviewed', action='store_true')
    parser.add_argument('--reference-reviewed', action='store_true')
    a = parser.parse_args()
    if a.command in ['submit','recover'] and not a.name: parser.error('클립 이름 필요')
    if a.command == 'prepare': prepare()
    elif a.command == 'inspect': inspect()
    elif a.command == 'submit': submit(a.name, a.queue_reviewed, a.reference_reviewed)
    else: recover(a.name)
