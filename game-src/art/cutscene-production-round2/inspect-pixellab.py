#!/usr/bin/env python3
"""Read-only account preflight. Never generates, cancels, or automatically retries.
PIXELLAB_API_TOKEN comes from the environment; inherited proxy/CA are preserved.
"""
import datetime as dt
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent


def parse_rpc(raw):
    text = raw.decode()
    if text.lstrip().startswith('{'):
        return json.loads(text)
    for block in text.replace('\r\n', '\n').split('\n\n'):
        lines = [line[5:].lstrip() for line in block.splitlines() if line.startswith('data:')]
        if lines:
            value = json.loads('\n'.join(lines))
            if 'result' in value or 'error' in value:
                return value
    raise ValueError('Missing MCP response')


def main():
    token = os.environ.get('PIXELLAB_API_TOKEN')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder = ROOT / 'resume-evidence' / ('account-' + stamp)
    folder.mkdir(parents=True)
    calls = [
        ('get_balance', {}),
        ('list_jobs', {'include_recent': True}),
        ('search_help', {'question': (
            'For a new empty HQ corridor environment cut: create_image_pixen opaque 320x180, '
            'then animate_image opaque 96x144 crop, frame_count=16. Please confirm exact '
            'subscription generation charge (expected 1+4), exact USD credit charge, '
            'whether output is 17 frames including unchanged input index 0, how to retrieve '
            'all frames, failure/refund policy, concurrent job limits, and whether '
            'doorframe preservation is guaranteed. No characters, no image prompt enhancement. '
            'Account access and recovery must precede generation.'
        )}),
    ]
    failed = False
    for name, arguments in calls:
        event = {'at': dt.datetime.now(dt.timezone.utc).isoformat(), 'tool': name,
                 'arguments': arguments, 'paidGeneration': False}
        body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
                           'params': {'name': name, 'arguments': arguments}}).encode()
        request = urllib.request.Request('https://api.pixellab.ai/mcp', data=body, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                event['httpStatus'] = response.status
                result = parse_rpc(response.read())
            event['response'] = result
            ok = 'error' not in result and 'result' in result and not result['result'].get('isError', False)
            event['status'] = 'succeeded' if ok else 'service-error'
        except Exception as exc:
            ok = False
            event['status'] = 'transport-error'
            event['errorType'] = type(exc).__name__
        # Never write the request headers or credential values.
        serialized = json.dumps(event, ensure_ascii=False, indent=2)
        if token:
            serialized = serialized.replace(token, '[REDACTED]')
        (folder / (name + '.json')).write_text(serialized + '\n')
        print(name, event['status'], flush=True)
        failed |= not ok
    print('Evidence:', folder)
    print('No generation or cancellation submitted. Inspect listed jobs and recover owned jobs before generating.')
    return 1 if failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
