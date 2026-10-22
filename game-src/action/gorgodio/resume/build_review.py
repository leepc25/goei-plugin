#!/usr/bin/env python3
"""원본을 수정하지 않는 고르고디오 몸·갑옷 비교판 및 비용 증거 목록."""
import base64
from collections import defaultdict
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
GD = HERE.parent
ROOT = GD.parents[2]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write(name, value):
    (HERE / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def inventory():
    jobs = {}
    failures = []
    for log in sorted((ROOT / 'game-src/action').glob('*/spend.log')):
        for line_no, line in enumerate(log.read_text().splitlines(), 1):
            source = {'path': str(log.relative_to(ROOT)), 'line': line_no}
            for job_id in set(re.findall(r'\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b', line)):
                row = jobs.setdefault(job_id, {'job_id': job_id, 'owners': [], 'evidence': [],
                    'actual_cost': None, 'actual_cost_status': 'server_usage_unavailable',
                    'current_status': 'not_authenticated'})
                if log.parent.name not in row['owners']: row['owners'].append(log.parent.name)
                row['evidence'].append(source)
            if re.search(r'\bFAIL\b|rate limit|\bEXC\b', line, re.I):
                failures.append({**source, 'record': line[:240]})
    write('job-ledger.json', {'scope': 'tracked game-src/action/*/spend.log',
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'new_paid_calls': 0, 'new_charge': 0, 'current_balance': None, 'current_account_limit': None,
        'active_jobs': None, 'jobs': list(jobs.values()), 'historical_failure_records': failures})
    print('작업 ID', len(jobs), '과거 실패 기록', len(failures), '실제 비용 미확인', len(jobs))


def build():
    manifest_path = GD / 'full/final/manifest.json'
    manifest = json.loads(manifest_path.read_text())
    clips = {}
    source_rows = []
    for name, meta in manifest['clips'].items():
        if name == 'talk': continue  # 코드 합성은 새 생성으로 집계하지 않는다.
        folder = GD / ('armor' if meta['set'] == 'armor' else 'full') / 'clips' / name
        paths = sorted(folder.glob('[0-9][0-9].png'))
        if not paths: continue
        frames = [Image.open(p).convert('RGBA') for p in paths]
        w, h = frames[0].size
        strip = Image.new('RGBA', (w * len(frames), h))
        details = []
        for i, (frame, path) in enumerate(zip(frames, paths)):
            assert frame.size == (w, h)
            strip.paste(frame, (w * i, 0))
            bbox = frame.getchannel('A').getbbox()
            details.append({'file': str(path.relative_to(ROOT)), 'sha256': sha(path.read_bytes()),
                            'bbox': bbox, 'alpha_bottom': bbox[3]-1 if bbox else None})
        raw = io.BytesIO(); strip.save(raw, 'PNG')
        final_path = GD / 'full/final' / (name + '.png')
        final = Image.open(final_path)
        assert final.size == (w * meta['frames'], h), name
        clips[name] = {'label': meta['label'], 'set': meta['set'], 'w': w, 'h': h,
            'anchor': manifest['sets'][meta['set']]['anchor'], 'foot': manifest['sets'][meta['set']]['foot'],
            'rawCount': len(frames), 'finalCount': meta['frames'], 'fps': meta['fps'],
            'raw': base64.b64encode(raw.getvalue()).decode(), 'final': base64.b64encode(final_path.read_bytes()).decode()}
        source_rows.append({'clip': name, 'set': meta['set'], 'raw_frames': details,
            'final_frames': meta['frames'], 'final_sha256': sha(final_path.read_bytes()),
            'generated_this_session': False, 'user_visual_approval': False})
    write('frame-inventory.json', {'manifest_sha256': sha(manifest_path.read_bytes()), 'clips': source_rows,
        'warning': 'alpha_bottom은 전체 불투명 영역의 끝이며 발 접지 판정이 아닙니다. 공중 자세를 일괄 보정하지 않습니다.'})
    pairs = [('idle','a_idle'),('walk','a_walk'),('run','a_glide'),('jump','a_jump'),('land','a_land'),
             ('guard','a_guard'),('chop1','a_swat'),('chop2','a_hammer'),('cleave','a_axe'),('summon','a_arrive')]
    # Contact sheets are inspection artifacts only. Runtime originals stay intact.
    for index, names in enumerate(pairs):
        cells=[]
        for name in names:
            c=clips[name]
            sheet=Image.open(io.BytesIO(base64.b64decode(c['raw'])))
            for frame in range(c['rawCount']):
                tile=Image.new('RGB',(280,230),'#283541'); draw=ImageDraw.Draw(tile)
                draw.line((0,210,279,210),fill='#66cda4')
                draw.line((100,0,100,229),fill='#59657a')
                im=sheet.crop((frame*c['w'],0,(frame+1)*c['w'],c['h']))
                tile.paste(im,(100-c['anchor'],210-c['foot']),im)
                draw.text((6,6),f'{name} / {frame:02}',fill='white');cells.append(tile)
        contact=Image.new('RGB',(280*4,230*((len(cells)+3)//4)),'#17212b')
        for n,tile in enumerate(cells):contact.paste(tile,((n%4)*280,(n//4)*230))
        contact.save(HERE / f'contact-{index:02}.png')
    html=(HERE/'review.html').read_text().replace('__CLIPS__',json.dumps(clips,ensure_ascii=False))
    out=ROOT/'release/demo/gorgodio-production-review.html'
    out.write_text(html)
    print('원본 비교판:',len(clips),'클립',out)


if __name__ == '__main__':
    inventory()
    build()
