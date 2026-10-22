"""Render audited cost fields without double counting submission and completion."""
import json
from pathlib import Path
P=Path(__file__).resolve().parent
data=json.loads((P/'verified-local-receipts.json').read_text(encoding='utf-8'))
lines=['# 작업별 서버 비용 취합', '', '관측: '+data['observed_at'], '',
       '확정 차감과 제출 영수증을 중복 합산하지 않는다. 과거 회수 비용은 이번 신규 비용에서 제외한다. 사용자 시각 승인과 서버 완료는 별개다.', '',
       '| 담당 | 작업 ID | 서버 상태 | 확정 차감 | 제출 영수증 | 추정 | 구분 |',
       '|---|---|---|---:|---:|---:|---|']
def n(x): return '미확인' if x is None else str(x)
for j in sorted(data['jobs'],key=lambda j:(j['character'],j['job_id'])):
    lines.append('| '+ ' | '.join([j['character'],j['job_id'],n(j['server_status']),n(j['charged_generations']),n(j['submission_cost_generations']),n(j['estimated_generations']),j['billing_period']])+' |')
lines += ['',f"이번 재개 중 완료 영수증 확인분 합계: {data['current_confirmed_charged_generations']}회.",
          f"기존 회수 2건의 과거 비용: {data['historical_recovered_generations']}회(회수 추가 비용0).",'',
          '정확한 서버 응답·원본 경로·SHA256은 verified-local-receipts.json, 담당 배정은 local-owners.json, 직접 검수는 coordinator-visual-review.json 참조.']
(P/'COST-REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print('COST-REPORT.md:',len(data['jobs']),'jobs')
