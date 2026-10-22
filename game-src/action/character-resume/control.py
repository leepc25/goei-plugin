#!/usr/bin/env python3
"""총괄용 무료 계정 조회와 로컬 원장 대조. 생성·취소 기능 없음."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
JOB = re.compile(r'(?:background_job_id|job_id|\bjob)\s*["\s:]+(' + UUID + r')', re.I)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def rpc(raw):
    text = raw.decode()
    if text.lstrip().startswith('{'):
        return json.loads(text)
    for block in text.replace('\r\n', '\n').split('\n\n'):
        lines = [line[5:].lstrip() for line in block.splitlines() if line.startswith('data:')]
        if lines:
            value = json.loads('\n'.join(lines))
            if 'result' in value or 'error' in value:
                return value
    raise ValueError('JSON-RPC response missing')


def account():
    """Keep inherited proxy/CA; token is optional because proxy auth may exist."""
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder = HERE / 'control-evidence' / stamp
    token = os.environ.get('PIXELLAB_API_TOKEN') or os.environ.get('PIXELLAB_API_KEY', '')
    summary = {'observed_at': now(), 'balance': None, 'active_jobs': None,
               'concurrency_limit': None, 'paid_generation_calls': 0,
               'new_generation_charge': 0, 'observations': {}}
    # These are documented free queries. Never submit or cancel jobs here.
    for name, arguments in [('get_balance', {}), ('list_jobs', {}),
                             ('search_help', {'question': 'How can I read my current account tier and concurrent background-job limit without generating or cancelling anything? Give the read-only API or MCP operation; do not infer my tier from old records.'})]:
        payload = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                   'params': {'name': name, 'arguments': arguments}}
        headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        record = {'observed_at': now(), 'request': payload}
        try:
            req = urllib.request.Request('https://api.pixellab.ai/mcp',
                                         data=json.dumps(payload).encode(), headers=headers)
            with urllib.request.urlopen(req, timeout=40) as response:
                record['http_status'] = response.status
                raw = response.read()
            # Never persist a credential echoed by a remote service.
            if token:
                raw = raw.replace(token.encode(), b'[REDACTED]')
            data = rpc(raw)
            record['response'] = data
            result = data.get('result', {})
            record['ok'] = not data.get('error') and not result.get('isError') and 'result' in data
        except urllib.error.HTTPError as exc:
            record.update(ok=False, http_status=exc.code, error_type='HTTPError')
        except Exception as exc:
            record.update(ok=False, error_type=type(exc).__name__)
        write(folder / (name + '.json'), record)
        summary['observations'][name] = {'ok': record['ok'], 'evidence': str((folder / (name + '.json')).relative_to(ROOT))}
        print(name, '응답 저장' if record['ok'] else '조회 실패 — 증거 저장')
    summary['note'] = '성공 응답의 단위·필드 확인 후 잔액/한도 기입. 실패 또는 미확인은 null이며 0이 아님.'
    write(folder / 'summary.json', summary)
    write(HERE / 'account-latest.json', summary)


def inventory():
    jobs, logs, failures, cost_claims, manifests = {}, [], [], [], []
    paths = sorted((ROOT / 'game-src/action').glob('*/spend*.log'))
    paths += sorted((ROOT / 'game-src/art').glob('*/spend*.log'))
    for path in paths:
        raw = path.read_bytes()
        rel = str(path.relative_to(ROOT))
        logs.append({'path': rel, 'sha256': digest(raw)})
        for number, line in enumerate(raw.decode(errors='replace').splitlines(), 1):
            for job in set(JOB.findall(line)):
                row = jobs.setdefault(job, {'job_id': job, 'character': path.parent.name,
                    'actual_cost': None, 'cost_status': 'server_receipt_unverified', 'sources': []})
                row['sources'].append({'path': rel, 'line': number})
            if re.search(r'charged|차감|usage|cost|비용', line, re.I):
                cost_claims.append({'path': rel, 'line': number, 'text': line,
                                    'status': 'historical_log_claim_not_server_receipt'})
            if re.search(r'error|failed|실패|rate limit|rejected', line, re.I):
                failures.append({'path': rel, 'line': number, 'text': line})
    for path in sorted((ROOT / 'game-src/action').rglob('manifest.json')):
        if 'character-resume' in path.parts:
            continue
        raw = path.read_bytes()
        manifests.append({'path': str(path.relative_to(ROOT)), 'sha256': digest(raw)})
    value = {'observed_at': now(), 'source_commit': subprocess.check_output(
        ['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'note': '작업 ID 명시 줄만 수집. 이미지 UUID·문자열 id는 작업 ID로 추측하지 않음. 잔액 차이를 작업 비용으로 배분하지 않음. 로그 실패 문구는 서버 최종 상태를 뜻하지 않음.',
        'job_count': len(jobs), 'jobs': sorted(jobs.values(), key=lambda j: (j['character'], j['job_id'])),
        'logs': logs, 'manifests': manifests, 'historical_cost_claims': cost_claims,
        'failure_mentions': failures}
    write(HERE / 'job-inventory.json', value)
    print(f'작업 ID {len(jobs)}개, 원장 {len(logs)}개, manifest {len(manifests)}개; 서버 영수증 미확인 비용은 null')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['account', 'inventory'])
    args = parser.parse_args()
    {'account': account, 'inventory': inventory}[args.command]()
