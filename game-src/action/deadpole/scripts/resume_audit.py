#!/usr/bin/env python3
"""Read-only source reconciliation; never calls a paid API or edits source art."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
CHAR = ROOT / 'game-src/action/deadpole'
OUT = CHAR / 'resume'
PREP = 'origin/codex/character-production-resume'
BATH = 'origin/codex/deadpole-bathing-game-src-action-deadpole-full-gpt-bathing-production.json-1792637734794'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode().strip()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save(name, value):
    OUT.mkdir(exist_ok=True)
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def ledger(path):
    """Deduplicate full UUIDs. Account-wide balance deltas are NOT job costs."""
    rows = {}
    lines = path.read_text().splitlines()
    for i, line in enumerate(lines, 1):
        for job_id in re.findall(r'\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b', line):
            row = rows.setdefault(job_id, {
                'job_id': job_id, 'actual_cost': None, 'actual_cost_status': 'no_per_job_receipt',
                'source': str(path.relative_to(ROOT)), 'source_lines': [], 'events': [],
            })
            row['source_lines'].append(i)
            row['events'].append(line)
            match = re.search(r'gen (\S+) (\d+)f ->', line)
            if match:
                row.update(clip=match[1], frames=int(match[2]))
    return list(rows.values())


def main():
    files = git('ls-tree', '-r', '--name-only', BATH, 'game-src/action/deadpole/full').splitlines()
    comparison = []
    for path in files:
        if not any(s in path for s in ['/bath/', '/shower/', '/showerturn/', '/undress/', '/gpt-bathing/']):
            continue
        source = git('rev-parse', BATH + ':' + path)
        current = git('rev-parse', 'HEAD:' + path)
        comparison.append(dict(path=path, source_blob=source, current_blob=current, identical=source == current))
    save('bath-comparison.json', {'source_commit': git('rev-parse', BATH), 'files': comparison})
    paths = sorted((CHAR / 'full').rglob('*.png')) + [CHAR / 'spend.log', CHAR / 'full/final/manifest.json']
    save('source-inventory.json', {
        'system_commit': git('rev-parse', 'HEAD'), 'preparation_commit': git('rev-parse', PREP),
        'deadpole_changed_since_preparation': git('diff', '--name-only', PREP, 'HEAD', '--', 'game-src/action/deadpole'),
        'files': [{'path': str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in paths],
    })
    logs = sorted((ROOT / 'game-src/action').rglob('spend.log')) + sorted((ROOT / 'game-src/art').rglob('spend.log'))
    jobs = [dict(owner=p.parent.name, **row) for p in logs for row in ledger(p)]
    save('historical-jobs.json', {
        'cost_note_ko': '공용 계정 잔액 차이는 다른 담당의 사용량을 포함하므로 작업별 실제 비용으로 쓰지 않음.',
        'jobs': jobs,
    })
    handoff = {
        'source_commit': git('rev-parse', PREP),
        'delivery_status': 'repository_handoff_available; recipient_receipt_unconfirmed',
        'common': ['docs/character-resume/README.md', 'tools/build_character_resume_demo.py',
                   'tools/character_resume_demo.html', 'tests/character-resume-browser.py'],
        'jyaldi': ['game-src/action/jyaldi-v5/resume', 'docs/character-resume/jyaldi-audit.md'],
        'kyuras': ['tools/recover_character_jobs.py', 'tests/character-recovery.test.py', 'docs/character-resume/kyuras-audit.md'],
        'other_characters': ['docs/character-resume/other-agents-audit.md'],
        'kyuras_recovery_owner': '큐라스 담당; 이 브랜치는 조회·회수·재생성하지 않음',
        'kyuras_jobs': ['11826541-47d1-40de-9664-f05f1838bb23', '9fe0e770-b992-4299-a4c1-90d6e591828a'],
        'instructions': '담당 경로만 git restore --source=<source_commit> -- <path>로 가져온다. 전체 브랜치 병합 금지.',
    }
    save('handoff.json', handoff)
    own = ledger(CHAR / 'spend.log')
    save('queue.json', {
        'owner': 'deadpole', 'branch': 'codex/art-deadpole-resume',
        'max_submitted_per_owner': 1, 'account_balance': None, 'account_active_jobs': None,
        'account_concurrency_limit': None, 'account_status': 'authentication_missing_401',
        'historical_approved_cap': 475, 'historical_reported_spend_approx': 315,
        'historical_exact_spend': None, 'remaining_approved_budget_exact': None,
        'new_paid_calls': 0, 'new_actual_charge': 0, 'historical_deadpole_job_count': len(own),
        'visual_approval': 'pending', 'generation_status': 'not_started_auth_blocked',
        'priorities': ['pipe body-only', 'cq1 horizontal retention', 'cq3 distinct palm shove', 'catch to counter continuous boundary'],
        'never_regenerate': ['undress', 'showerturn', 'shower', 'bath'],
        'note': '담당 배정은 기록했으나 다른 실행 환경의 배타 잠금이나 현재 계정 큐 확인을 대신하지 않는다.',
    })
    print(json.dumps({'historical_jobs': len(jobs), 'deadpole_jobs': len(own),
                      'bathing_identical': all(r['identical'] for r in comparison),
                      'compared_bathing_files': len(comparison)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
