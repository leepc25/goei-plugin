#!/usr/bin/env python3
"""Offline requests and provenance. This script cannot submit paid jobs."""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

from PIL import Image, ImageDraw
import jsonschema

HERE = Path(__file__).resolve().parent
CHAR = HERE.parent
ROOT = CHAR.parents[2]
sys.path.insert(0, str(CHAR / 'scripts'))
import rig_rojemon as R
import rig_puppets as P

OFFSET = (48, 8)
SIZE = (256, 160)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def joints(pose):
    return [{'label': k, 'x': round((pose[k][0] + OFFSET[0]) / SIZE[0], 6),
             'y': round((pose[k][1] + OFFSET[1]) / SIZE[1], 6),
             'z_index': 8 if k.startswith('RIGHT') else 2 if k.startswith('LEFT') else 5}
            for k in R.J]


def prepare():
    if any((HERE/'live').glob('*/submit-response.json')):
        raise SystemExit('실제 제출 기록이 있습니다. prepare는 현재 원장을 덮어쓸 수 없습니다. live/ledger.json과 보존된 요청을 사용하세요.')
    tools = json.loads((HERE / 'evidence/tools-live.json').read_text())['result']['tools']
    schema = next(t['inputSchema'] for t in tools if t['name'] == 'animate_with_skeleton_v3')
    records = []
    specs = [
        ('down', 'A-pad.png', R.A_KP, R.CLIPS['down'][1],
         'petite young woman agent, long wavy pale lavender hair, blunt bangs, purple eyes, '
         'fitted black suit jacket, white shirt, black necktie, black pencil skirt, bare legs, black low heel pumps',
         'fall backwards from a startled recoil to lying supine and remain down'),
        ('man_throw', 'M-pad.png', P.A_KP['man'], P.CLIPS['man_throw'][1],
         'faceless wooden artist mannequin, smooth light wood, ball joints, adult proportions',
         'overhead throw with a backward windup then forward release and recovery'),
    ]
    for clip, filename, first, poses, desc, action in specs:
        source = CHAR / 'base' / filename
        im = Image.open(source).convert('RGBA')
        assert im.size == (192, 144)
        padded = Image.new('RGBA', SIZE)
        padded.paste(im, OFFSET)
        out = HERE / 'inputs' / filename
        out.parent.mkdir(parents=True, exist_ok=True)
        padded.save(out)
        assert padded.crop((48, 8, 240, 152)).tobytes() == im.tobytes()
        args = dict(description=desc, action=action, direction='east', view='side',
                    first_frame_url='data:image/png;base64,' + base64.b64encode(out.read_bytes()).decode(),
                    first_frame_keypoints=joints(first), keypoints=[joints(p) for p in poses],
                    no_background=True, seed=7)
        jsonschema.validate(args, schema)
        for frame in [args['first_frame_keypoints'], *args['keypoints']]:
            assert len(frame) == 18 and {j['label'] for j in frame} == set(R.J)
            assert all(0 < j['x'] < 1 and 0 < j['y'] < 1 for j in frame)
        request = {'name': 'animate_with_skeleton_v3', 'arguments': args}
        save(HERE / 'requests' / (clip + '.json'), request)
        records.append(dict(clip=clip, status='not_submitted_auth_blocked', job_id=None,
                            estimate_generations=3, actual_cost=None, reference_sha256=sha(source.read_bytes()),
                            input_sha256=sha(out.read_bytes()),
                            request_sha256=sha((HERE / 'requests' / (clip + '.json')).read_bytes()),
                            canvas=list(SIZE), source_offset=list(OFFSET),
                            runtime_anchor_x=(57 if clip == 'down' else 56) + OFFSET[0],
                            runtime_ground_y=136 + OFFSET[1], user_visual_approval=False))
        sheet = Image.new('RGB', (SIZE[0]*4, (SIZE[1]+20)*2), '#292c32')
        d = ImageDraw.Draw(sheet)
        for i, pose in enumerate(poses):
            x, y = (i % 4)*SIZE[0], (i // 4)*(SIZE[1]+20)+20
            d.text((x+8,y-18), f'{clip} {i:02}', fill='white')
            d.line((x,y+144,x+256,y+144), fill='#646c79')
            for joint in joints(pose):
                u, v = x+joint['x']*SIZE[0], y+joint['y']*SIZE[1]
                d.ellipse((u-2,v-2,u+2,v+2), fill='#df96ea')
        sheet.save(HERE / 'evidence' / (clip + '-planned-joints.png'))
    save(HERE / 'queue.json', dict(owner='codex/art-rojemon-resume', max_submitted=1,
                                  current_balance=None, current_account_limit=None,
                                  current_account_active_jobs=None, jobs=records))

    # Preserve each historical job, but never turn an old estimate into actual usage.
    logs = {}
    for path in sorted((ROOT / 'game-src/action').glob('*/spend.log')):
        text = path.read_text(errors='replace')
        matches = list(re.finditer(r'(?:background_job_id["\s:]+|job_id["\s:]+|-> id: )([0-9a-f-]{36})', text))
        for match in matches:
            job = match.group(1)
            row = logs.setdefault(job, dict(job_id=job, owner=path.parent.name, actual_cost=None,
                                            cost_status='server_receipt_required', evidence=[]))
            row['evidence'].append(dict(path=str(path.relative_to(ROOT)),
                                        line=text[:match.start()].count('\n')+1))
    save(HERE / 'historical-job-index.json', list(logs.values()))
    paths = [p for p in CHAR.rglob('*') if p.is_file() and 'resume' not in p.parts and '__pycache__' not in p.parts]
    save(HERE / 'source-hashes.json', {str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in sorted(paths)})
    refs = ['HEAD', 'origin/codex/character-production-resume']
    comparison = subprocess.check_output(['git','diff','--name-only',*refs,'--',str(CHAR.relative_to(ROOT))], cwd=ROOT,text=True)
    save(HERE / 'provenance.json', dict(
        refs={r:subprocess.check_output(['git','rev-parse',r],cwd=ROOT,text=True).strip() for r in refs},
        original_character_diff=comparison.splitlines(),
        new_paid_calls=0, new_actual_cost=0, imported_branch=False))
    print(f'2 schema-valid drafts; {len(logs)} historical job IDs; no paid calls')


if __name__ == '__main__':
    prepare()
