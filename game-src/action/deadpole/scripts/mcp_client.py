"""PixelLab transport for Deadpole. Environment credential, inherited proxy/CA."""
import json
import os
import urllib.request


def tool(name, args):
    token = os.environ.get('PIXELLAB_API_TOKEN')
    if not token:
        raise RuntimeError('PIXELLAB_API_TOKEN 미설정: 제출하지 않음')
    request = urllib.request.Request('https://api.pixellab.ai/mcp', data=json.dumps({
        'jsonrpc': '2.0', 'id': 1, 'method': 'tools/call',
        'params': {'name': name, 'arguments': args},
    }).encode(), headers={
        'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream',
        'Authorization': 'Bearer ' + token,
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        raw = response.read().decode()
    if raw.lstrip().startswith('{'):
        result = json.loads(raw)
    else:
        result = next(json.loads(line[5:].strip()) for line in raw.splitlines()
                      if line.startswith('data:') and ('"result"' in line or '"error"' in line))
    if result.get('error') or result.get('result', {}).get('isError'):
        raise RuntimeError('PixelLab 요청 실패; 자동 재제출 금지: ' + text(result)[:300])
    return result


def text(result):
    return '\n'.join(block.get('text', '') for block in result.get('result', {}).get('content', [])
                     if block.get('type') == 'text') or json.dumps(result)
