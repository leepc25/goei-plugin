"""에일린 전용 MCP 전송. 환경 인증·기본 TLS 유지, 자동 재시도 없음."""
import json
import os
import urllib.request


def call(method, params=None, id=1):
    token = os.environ.get('PIXELLAB_API_TOKEN') or os.environ.get('PIXELLAB_API_KEY')
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request('https://api.pixellab.ai/mcp', headers=headers,
        data=json.dumps({'jsonrpc': '2.0', 'id': id, 'method': method, 'params': params or {}}).encode())
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
    raise ValueError('MCP 응답 확인 필요. 재제출 금지')


def tool(name, args):
    return call('tools/call', {'name': name, 'arguments': args})


def text(response):
    return '\n'.join(b.get('text', '') for b in response.get('result', {}).get('content', [])) or json.dumps(response)


def checked(response):
    if response.get('error') or response.get('result', {}).get('isError'):
        raise RuntimeError(text(response))
    return response
