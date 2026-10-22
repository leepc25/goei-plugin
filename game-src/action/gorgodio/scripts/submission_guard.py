"""고르고디오 몸·갑옷 공용 제출 기록. 통신 결과 불명은 재시도하지 않는다."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import re


def submit_once(call, arguments, folder, clip):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    for previous in folder.glob('*.json'):
        if json.loads(previous.read_text()).get('status') != 'recovered':
            raise RuntimeError('몸·갑옷 제출 기록에 미회수/미확정 작업이 있습니다. 새 생성 전에 기존 ID를 확인하세요.')
    raw = json.dumps(arguments, sort_keys=True, separators=(',', ':')).encode()
    digest = hashlib.sha256(raw).hexdigest()
    receipt = folder / (digest + '.json')
    # Exclusive creation happens BEFORE sending. A crash/timeout leaves a durable
    # intent and prevents another call with the same input on the next run.
    record = {'clip': clip, 'input_sha256': digest, 'arguments': arguments,
              'created_at': datetime.now(timezone.utc).isoformat(),
              'status': 'submission_unknown', 'job_id': None,
              'actual_cost': None, 'user_visual_approval': False}
    with receipt.open('x') as out:
        json.dump(record, out, ensure_ascii=False, indent=2)
        out.flush()
        os.fsync(out.fileno())
    try:
        response = call('animate_with_skeleton_v3', arguments)
    except Exception as exc:
        record['failure_type'] = type(exc).__name__
        receipt.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
        raise
    record['response'] = response
    result = response.get('result', {})
    text = '\n'.join(b.get('text', '') for b in result.get('content', []))
    match = re.search(r'job_id["\s:]+([0-9a-f-]{36})', text)
    record['job_id'] = match.group(1) if match else None
    record['status'] = 'submitted' if match and not result.get('isError') and not response.get('error') else 'submission_unresolved'
    # Preserve server usage separately; do not infer charges from balance deltas.
    record['server_usage'] = result.get('usage')
    tmp = receipt.with_suffix('.tmp')
    with tmp.open('w') as out:
        json.dump(record, out, ensure_ascii=False, indent=2)
        out.flush()
        os.fsync(out.fileno())
    tmp.replace(receipt)
    if record['status'] != 'submitted':
        raise RuntimeError('제출 결과 미확정: 응답·작업 목록 조사 후 담당자가 해결해야 합니다. 자동 재시도 금지.')
    return record['job_id'], text


def recovered(folder, job_id):
    for path in Path(folder).glob('*.json'):
        row = json.loads(path.read_text())
        if row.get('job_id') == job_id:
            row['status'] = 'recovered'
            tmp = path.with_suffix('.tmp')
            tmp.write_text(json.dumps(row, ensure_ascii=False, indent=2) + '\n')
            tmp.replace(path)
