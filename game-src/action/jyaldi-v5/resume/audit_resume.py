#!/usr/bin/env python3
"""Offline provenance audit. Never calls PixelLab or modifies source artwork."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
CHAR = HERE.parent

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()

def write(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def main():
    refs = {r: git('rev-parse', r) for r in ['origin/main', 'origin/codex/metroidvania-run-system', 'origin/codex/character-production-resume']}
    manifest_path = CHAR / 'full/final/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    clips = {}
    for clip in ['walk', 'run', 'grabknee', 'undress', 'showerturn', 'shower']:
        files = sorted((CHAR / 'full/clips' / clip).glob('[0-9][0-9].png'))
        strip_path = CHAR / 'full/final' / (clip + '.png')
        strip = Image.open(strip_path).convert('RGBA')
        count = manifest['clips'][clip]['frames']
        assert strip.size == (192 * count, 144), clip
        rows = []
        for i, path in enumerate(files):
            im = Image.open(path).convert('RGBA')
            rows.append({'path':path.relative_to(ROOT).as_posix(), 'sha256':sha(path), 'size':list(im.size),
                         'same_as_final_frame': i < count and im.size == (192,144) and im.tobytes() == strip.crop((i*192,0,(i+1)*192,144)).tobytes()})
        if clip in ['walk', 'run']:
            assert len(files) == count == 8 and all(r['same_as_final_frame'] for r in rows), clip
        clips[clip] = {'raw_count':len(files), 'manifest_frames':count, 'manifest':manifest['clips'][clip], 'strip_sha256':sha(strip_path), 'raw':rows}
    compare_paths = ['game-src/action/jyaldi-v5/full', 'game-src/action/jyaldi-v5/spend.log']
    comparisons = {r: git('diff','--name-only',refs['origin/codex/metroidvania-run-system'],commit,'--',*compare_paths).splitlines() for r,commit in refs.items()}
    spec = importlib.util.spec_from_file_location('drafts', HERE / 'build_drafts.py')
    drafts = importlib.util.module_from_spec(spec); spec.loader.exec_module(drafts)
    geometry = [drafts.validate(clip, *drafts.make(clip)) for clip in ['walk','run']]
    request_hashes = {}
    for clip in ['walk','run']:
        path = HERE / (clip + '-request.draft.json')
        request = json.loads(path.read_text(encoding='utf-8'))
        assert request['job_id'] is None and len(request['arguments']['keypoints']) == 8
        canonical = json.dumps(request['arguments'], sort_keys=True, separators=(',',':')).encode()
        request_hashes[clip] = {'file_sha256':sha(path),'arguments_sha256':hashlib.sha256(canonical).hexdigest()}
    write('source-audit.json', {'refs':refs,'source_comparisons':comparisons,'manifest_sha256':sha(manifest_path),
          'clips':clips,'geometry':geometry,'requests':request_hashes,'scope':'preexisting source audit only; generated delivery in walk-20261022/manifest.json','paid_calls_by_audit':0,'new_artwork_by_audit':False,'user_visual_approval':False})
    # Index submission IDs, retaining source line evidence. No balance-delta attribution.
    jobs = {}
    for folder in ['jyaldi-v5','kyuras','eileen','geshugan','gorgodio','deadpole','spangdal','rojemon']:
        path = ROOT / 'game-src/action' / folder / 'spend.log'
        if not path.exists():
            continue
        for number,line in enumerate(path.read_text(encoding='utf-8', errors='replace').splitlines(),1):
            match = re.search(r'(?:job_id:\s*|->\s*id:\s*)([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})',line)
            if not match:
                continue
            job_id = match[1]
            row = jobs.setdefault(job_id, {'job_id':job_id,'character':folder,'actual_cost':None,
                'cost_status':'unverified_requires_per_job_server_usage','evidence':[]})
            row['evidence'].append({'path':path.relative_to(ROOT).as_posix(),'line':number,'text':line})
    receipt_path = HERE / 'evidence/walk-completed.json'
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))['structuredContent']
        if receipt['job_id'] in jobs:
            jobs[receipt['job_id']].update(actual_cost=receipt['charged_generations'], cost_unit='generations', cost_status='server_receipt_verified', cost_evidence=receipt_path.relative_to(ROOT).as_posix())
    write('job-index.json', {'basis':refs['origin/codex/metroidvania-run-system'],'scope':'eight agent spend.log submission records only; not live account job list',
          'note':'Historical balance changes and batch estimates are not per-job actual charges. Unknown cost is null, not zero.',
          'job_count':len(jobs),'jobs':list(jobs.values())})
    print('PASS: walk/run 16 raw frames match final; geometry and request hashes checked; historical jobs:',len(jobs))

if __name__ == '__main__':
    main()
