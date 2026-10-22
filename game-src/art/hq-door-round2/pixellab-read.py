#!/usr/bin/env python3
"""Read-only PixelLab inspection/recovery. Credentials come from environment only.

inspect: balance, active/recent jobs and billing/workflow help.
recover JOB_ID: retrieve existing result. Never submits/cancels/retries a generation.
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parent


def call(name, arguments):
    token = os.environ.get('PIXELLAB_API_TOKEN')
    if not token:
        raise SystemExit('PIXELLAB_API_TOKEN is not configured; no request submitted.')
    payload = {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
               'params': {'name': name, 'arguments': arguments}}
    req = urllib.request.Request('https://api.pixellab.ai/mcp',
        data=json.dumps(payload).encode(), headers={
            'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
            'Authorization': 'Bearer ' + token})
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
    raise ValueError('MCP response not found')


def record(folder, name, args):
    response = call(name, args)
    # Preserve raw PNG bytes and hashes, not a re-encoded image.
    images = []
    for i, block in enumerate(response.get('result', {}).get('content', [])):
        if block.get('type') == 'image' and 'data' in block:
            data = base64.b64decode(block.pop('data'), validate=True)
            if block.get('mimeType') != 'image/png' or not data.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Expected PNG; response not promoted')
            filename = f'{name}-{i}.png'
            (folder / filename).write_bytes(data)
            block.update(file=filename, sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
            images.append(filename)
    evidence = {'observed_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                'tool': name, 'arguments': args, 'response': response}
    (folder / (name + '.json')).write_text(json.dumps(evidence, ensure_ascii=False, indent=2)+'\n')
    error = bool(response.get('error') or response.get('result', {}).get('isError'))
    print(json.dumps({'tool': name, 'service_error': error, 'evidence': str(folder), 'images': images}))
    return not error


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('command', choices=['inspect', 'recover'])
    p.add_argument('job_id', nargs='?')
    args = p.parse_args()
    if args.command == 'recover' and not args.job_id:
        p.error('recover requires an existing job ID')
    folder = ROOT / 'evidence' / dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    folder.mkdir(parents=True)
    if args.command == 'recover':
        ok = record(folder, 'get_image', {'job_id': args.job_id})
    else:
        ok = record(folder, 'get_balance', {})
        if ok:
            ok = record(folder, 'list_jobs', {'include_recent': True})
        if ok:
            ok = record(folder, 'search_help', {'question':
                'Confirm create_image_pixen 96x144 no_background=true view=side direction=south costs '
                '1 generation. Are get_balance/list_jobs/get_image/search_help free? What is the '
                'account concurrency limit and failed/timed-out submission billing/recovery policy? '
                'We need a front-elevation sliding door and will separate the fixed frame and moving '
                'leaves from one image locally to preserve exact state alignment.'})
    raise SystemExit(0 if ok else 2)


if __name__ == '__main__':
    main()
