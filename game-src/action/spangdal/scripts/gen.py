#!/usr/bin/env python3
"""스팡달 한 작업 제출/회수. 새 결과는 resume/candidates에만 저장한다.

준비: gen.py CLIP --prepare --revision REV [--ref PNG --refkp CLIP:FRAME]
제출: gen.py CLIP --revision REV --account-clear
회수: gen.py CLIP --revision REV --resume
--account-clear는 총괄이 계정 큐·한도·소유권 및 차감 견적을 확인했다는 표시다.
전송 오류·실패·기존 revision은 자동 재제출하지 않는다. 계정 간 분산 잠금은 별도 총괄이 맡는다.
"""
import argparse
import base64
import datetime as dt
import tempfile
import hashlib
import io
import json
import os
if os.name == 'nt':
    import msvcrt
else:
    import fcntl
from pathlib import Path
import re
import sys
import urllib.request

from PIL import Image

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
sys.path.insert(0, str(BASE.parent / 'jyaldi-v5/scripts'))
sys.path.insert(0, str(HERE))  # rig는 스팡달, skel 수학 유틸리티만 공유
import rig
DESC = ('slim adult woman agent, short wavy nearly black dark purple bob to the jaw, side bangs hiding the far eye, '
        'pale skin, one dull gold eye, faint closed-mouth half smile, black hip-length suit jacket, white shirt, black necktie, '
        'knee-length black pencil skirt, black stockings, low black heels, open empty hands with straight fingers pressed together, '
        'strict right-facing side profile, character only, no weapon, no prop, no effects')


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def call(name, arguments):
    token = os.environ.get('PIXELLAB_API_TOKEN')
    if not token:
        raise RuntimeError('PIXELLAB_API_TOKEN 미설정. 유료 호출하지 않음')
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                       'params': {'name': name, 'arguments': arguments}}).encode()
    req = urllib.request.Request('https://api.pixellab.ai/mcp', data=body, headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'})
    with urllib.request.urlopen(req, timeout=45) as response:
        raw = response.read().decode()
    if raw.lstrip().startswith('{'):
        return json.loads(raw)
    for block in raw.replace('\r\n', '\n').split('\n\n'):
        lines = [line[5:].lstrip() for line in block.splitlines() if line.startswith('data:')]
        if lines:
            value = json.loads('\n'.join(lines))
            if 'result' in value or 'error' in value:
                return value
    raise RuntimeError('JSON-RPC 응답 없음. 재제출 금지')


def checked(response):
    if response.get('error') or response.get('result', {}).get('isError'):
        raise RuntimeError('PixelLab 오류. 보존한 응답 확인; 자동 재시도 없음')
    return response['result']


def submit_once(folder, payload, client=call):
    statepath = folder / 'state.json'
    if statepath.exists():
        raise RuntimeError('제출 이력이 있는 revision. --resume으로 조회; 재제출 금지')
    # Persist before crossing the network boundary, including timeouts/unknown receipts.
    save(folder / 'request.json', payload)
    state = {'state': 'submission_unknown', 'attempted_at': now(), 'job_id': None,
             'request_sha256': sha(json.dumps(payload, sort_keys=True).encode()),
             'actual_cost': None, 'user_visual_approval': False}
    save(statepath, state)
    response = client('animate_with_skeleton_v3', payload['arguments'])
    save(folder / 'submission-response.json', response)
    checked(response)
    match = re.search(r'(?:job_id|id)["\s:]+([0-9a-f-]{36})', json.dumps(response))
    if not match:
        raise RuntimeError('작업 ID 미확인. 계정 큐 대조 전 재제출 금지')
    state.update(state='submitted', job_id=match[1])
    save(statepath, state)
    return state


def recover(folder, client=call):
    state = json.loads((folder / 'state.json').read_text())
    if not state.get('job_id'):
        raise RuntimeError('작업 ID 미확인. 총괄에게 submission_unknown 대조 요청')
    response = client('get_image', {'job_id': state['job_id']})
    save(folder / 'status-response.json', response)
    checked(response)
    # get_image textual state is preserved; only actual PNG blocks constitute recovery.
    payload = json.loads((folder / 'request.json').read_text())
    n = len(payload['arguments']['keypoints'])
    frames = []
    for i in range(n):
        png = folder / f'{i:02}.png'; proof = folder / f'{i:02}.receipt.json'
        if png.exists():
            row = json.loads(proof.read_text())
            if row['job_id'] != state['job_id'] or row['sha256'] != sha(png.read_bytes()):
                raise RuntimeError('회수 파일 증거 불일치. 덮어쓰기 금지')
        else:
            result = client('get_image', {'job_id': state['job_id'], 'index': i})
            content = checked(result).get('content', [])
            images = [b for b in content if b.get('type') == 'image']
            if len(images) != 1 or images[0].get('mimeType') != 'image/png':
                save(folder / f'{i:02}.pending-response.json', result)
                raise RuntimeError('PNG 미수신. 생성 재호출 없음; 나중에 --resume')
            data = base64.b64decode(images[0]['data'], validate=True)
            with Image.open(io.BytesIO(data)) as im:
                if im.format != 'PNG' or im.size != (192, 144) or not im.convert('RGBA').getchannel('A').getbbox():
                    raise RuntimeError('빈 이미지 또는 규격 불일치')
            row = {'job_id': state['job_id'], 'frame': i, 'sha256': sha(data), 'recovered_at': now()}
            save(proof, row); png.write_bytes(data)
            # Keep usage/text from each response, replace only duplicated image bytes by hash.
            images[0].pop('data'); images[0]['sha256'] = row['sha256']
            save(folder / f'{i:02}.response.json', result)
        frames.append(row)
    state.update(state='recovered_pending_visual_review', frames=frames)
    save(folder / 'state.json', state)
    return state


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('clip', choices=sorted(rig.CLIPS))
    p.add_argument('--revision', required=True)
    p.add_argument('--prepare', action='store_true')
    p.add_argument('--resume', action='store_true')
    p.add_argument('--account-clear', action='store_true')
    p.add_argument('--ref', type=Path, default=BASE / 'base/S0-pad.png')
    p.add_argument('--refkp')
    p.add_argument('--max', type=int, choices=[1], default=1)
    a = p.parse_args()
    if not re.fullmatch(r'[a-z0-9_-]+', a.revision):
        p.error('revision은 영문 소문자·숫자·_·-만 허용')
    folder = BASE / 'resume/candidates' / a.clip / a.revision
    with open(Path(tempfile.gettempdir()) / 'goei-pixellab-spangdal.lock', 'a+b') as lock:
        if os.name == 'nt':
            if lock.tell() == 0: lock.write(b'0'); lock.flush()
            lock.seek(0); msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if a.resume:
            print(json.dumps(recover(folder), ensure_ascii=False)); return
        ref = a.ref.resolve(); data = ref.read_bytes()
        if not ref.is_relative_to(BASE.resolve()):
            p.error('스팡달 폴더의 참조 원본만 허용')
        act, _prop, poses = rig.CLIPS[a.clip]
        kp = rig.A_KP
        if a.refkp:
            clip, frame = a.refkp.split(':'); kp = rig.CLIPS[clip][2][int(frame)]
        payload = {'tool': 'animate_with_skeleton_v3', 'reference_path': str(ref.relative_to(BASE)),
                   'reference_sha256': sha(data), 'clip': a.clip,
                   'arguments': {'description': DESC, 'action': act[:100], 'direction': 'east',
                                 'first_frame_url': 'data:image/png;base64,' + base64.b64encode(data).decode(),
                                 'first_frame_keypoints': rig.kp(kp), 'keypoints': [rig.kp(x) for x in poses], 'seed': 11}}
        if a.prepare:
            if (folder / 'state.json').exists():
                raise RuntimeError('제출 이력이 있는 revision의 요청문 변경 금지')
            save(folder / 'request.draft.json', payload)
            print('요청 초안 저장. 제출 0건. 현재 견적·계정 한도·중복 작업 대조 필요'); return
        if not a.account_clear:
            p.error('총괄의 현재 계정 큐·한도·견적 확인 뒤 --account-clear 필요')
        draft = folder / 'request.draft.json'
        if not draft.exists() or json.loads(draft.read_text()) != payload:
            raise RuntimeError('검토된 요청 초안이 없거나 입력이 변경됨. --prepare 후 견적·입력 해시 재확인')
        for statefile in (BASE / 'resume/candidates').glob('*/*/state.json'):
            if json.loads(statefile.read_text())['state'] != 'recovered_pending_visual_review':
                raise RuntimeError('기존 미해결 작업 있음. 계정 큐와 먼저 대조')
        for name in ('get_balance', 'list_jobs'):
            response = call(name, {})
            save(folder / (name + '.json'), {'observed_at': now(), 'response': response})
            checked(response)
        state = submit_once(folder, payload)
        print(json.dumps(state, ensure_ascii=False))
        with (BASE / 'spend.log').open('a') as log:
            log.write(f"{now()} gen {a.clip} job_id={state['job_id']} actual_cost=unknown receipt={folder.relative_to(BASE)}\n")


if __name__ == '__main__':
    main()
