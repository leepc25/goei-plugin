#!/usr/bin/env python3
"""Free account checks only. Reads the configured token; no generation/cancellation."""
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import urllib.request

HERE = Path(__file__).resolve().parent

def parse(raw):
    text = raw.decode()
    if text.lstrip().startswith('{'):
        return json.loads(text)
    for block in text.replace('\r\n','\n').split('\n\n'):
        lines = [s[5:].lstrip() for s in block.splitlines() if s.startswith('data:')]
        if lines:
            value = json.loads('\n'.join(lines))
            if 'result' in value or 'error' in value:
                return value
    raise ValueError('No JSON-RPC response')

def main():
    token = os.environ.get('PIXELLAB_API_TOKEN') or os.environ.get('PIXELLAB_API_KEY')
    if not token:
        raise SystemExit('PIXELLAB_API_TOKEN 인증 연결 필요. 조회/유료 호출을 실행하지 않았습니다.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    output = HERE / 'evidence' / ('account-' + stamp)
    output.mkdir(parents=True, exist_ok=False)
    for name,args in [('get_balance',{}),('list_jobs',{'include_recent':True}),('search_help',{'question':'How can this authenticated account inspect its current concurrency limit and actual per-job charged usage for animate_with_skeleton_v3? Confirm current 8-frame price.'})]:
        body = json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':name,'arguments':args}}).encode()
        req = urllib.request.Request('https://api.pixellab.ai/mcp',data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','Accept':'application/json, text/event-stream'})
        # Keep inherited proxy, system CA verification, and no retry.
        with urllib.request.urlopen(req,timeout=45) as response:
            result = parse(response.read())
        (output / (name + '.json')).write_text(json.dumps({'observed_at':datetime.now(timezone.utc).isoformat(),'response':result},ensure_ascii=False,indent=2)+'\n')
        if result.get('error') or result.get('result',{}).get('isError'):
            raise SystemExit(name + ': 서비스 오류. 저장된 응답 확인; 제출 금지.')
        print(name + ': 조회 성공, ' + str(output / (name + '.json')))
    print('계정 조회 완료. 실행 중 쟈알디/계정 한도를 담당자와 대조한 뒤 걷기 1건만 제출. 이 도구는 제출하지 않습니다.')

if __name__ == '__main__':
    main()
