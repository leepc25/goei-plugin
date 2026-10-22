import json,datetime
from pathlib import Path
R=Path(__file__).resolve().parent;now=datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(n):return json.loads((R/n).read_text(encoding='utf8'))
def write(n,x):(R/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
d=read('deliveries.json');d['observed_at']=now
new=[dict(character='kyuras',commit='7aaef6d19699ab298fd7d87563938126d3d63acd',branch='codex/art-kyuras-resume',html='release/demo/kyuras-full.html',new_frames=35,recovered_frames=12,charged_generations=18,historical_recovered_charge=6,free_edit_pixels=1192,visual_status='candidate; 47 source frames verified, final build54 clips missing0, recovery tests7 passed',remaining='finger readability user review; slight head angle drift; old down afterimage',user_visual_approval=False),dict(character='deadpole',commit='85922529bfe7738fabb3522c9428527ab7576655',branch='codex/art-deadpole-resume',html='release/demo/deadpole-resume.html',charged_generations=11,visual_status='owner delivered; independent full review pending',remaining='pointing-like grip; bridge supporting foot slide',user_visual_approval=False),dict(character='geshugan',commit='54c4d129133fd80a0142570586cf0716f9023c39',branch='codex/art-geshugan-resume',html='release/demo/geshugan-full.html',charged_generations=31,visual_status='owner delivered20 frames,30 paid generations rejected; independent full review pending',user_visual_approval=False)]
for x in new:d['deliveries']=[y for y in d['deliveries'] if y['character']!=x['character']]+[x]
write('deliveries.json',d)
v=read('coordinator-visual-review.json');v['observed_at']=now
v['reviews'].append(dict(character='kyuras',clip='snap2/snap3',status='review_candidate',finding='Direct inspection of all6+7 edited frames: raised rear hand and crossed releases visible. Exact-edit assertions restrict378+464 changed pixels to guarded hands. Installed final frames verified. User approval pending; no final browser rerun.',user_visual_approval=False))
write('coordinator-visual-review.json',v)
p=R/'LOCAL-20261022.md';old=p.read_text(encoding='utf8');heading='''# 최신 납품 상태 · 2026-10-22 20:46 KST

큐라스 7aaef6d1 커밋을 codex/art-kyuras-resume에 push했다. 기존 과금2건12장 회수(과거6회, 추가0), 신규6건35장 실제18회. 무료 손 보정4건1192px. 독립 HTML release/demo/kyuras-full.html에 반영했고 사용자 시각 승인은 아직 없다. 빌드54클립 누락0/회수검사7개/최종47프레임 크기·해시 검증 통과. 마지막 snap2/3 적용 이후 브라우저 재실행은 하지 않았다. 기존 down 잔상과 일부 얼굴 각도 변화는 남는다. 내부 담당 사용량 제한 후 총괄이 저장·검수·push를 이어받았으며 추가 유료 제출은 없었다.

11:46:22 UTC 무료 조회 잔액13990.30회, 계정 실행2건(스팡달·블라렛/살라딘 각1), 큐라스0. 문서상 동시한도20, 별도 계정 cap 미반환. 11:47:22 UTC 영수증 취합39작업, 신규 확정171회/과거 회수6회 별도. 다른 담당이 계속 작업하므로 이는 시점별 스냅샷이다. COST-REPORT.md가 작업별 실제 비용이며 계정 잔액 차감 전체와 같다고 주장하지 않는다.

데드폴·게슈간 추가 납품은 deliveries.json에 owner-reported로 기록했다. 쟈알디는 HOLD 후 핵심자세 수정 재개, 에일린은 유료 전환 실패를 보존하고 검증 중이다. 다른 담당 완료와 전체 최종 합격을 혼동하지 않는다.

## 이전 경과 기록 (아래 진행 상태는 과거 관측)

''';p.write_text(heading+old,encoding='utf8')
with (R/'control-spend.jsonl').open('a',encoding='utf8') as f:f.write(json.dumps(dict(observed_at=now,event='kyuras_delivery',coordinator_paid_submissions=0,kyuras_new_actual_generations=18,historical_recovery=6,recovery_new_charge=0,receipt_snapshot_current_total=171))+'\n')
