"""Write the verified job ledger and per-frame review; no network or paid calls."""
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'game-src/action/deadpole/resume'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def main():
    notes={
      'pipe_body':[
        '얼굴·숯빛 정장 유지. 빈손 준비, 무기 잔재 없음.',
        '예비동작에서 손이 얼굴 일부를 가림. 머리·무기 캔버스 잘림 없음.',
        '양손이 붙은 덩어리로 읽힘. 긴 생머리 유지.',
        '앞으로 뻗은 양손. 고정 길이 소품 파지 위치 확인.',
        '아래로 후속 스윙. 손·몸통·발 전체 보임.',
        '뒤로 물러난 준비. 후퇴 중간 장이 짧아 리듬 개선 여지.',
        '후퇴 준비 유지. 0번과 위치가 달라 무봉제 반복으로 승인하지 않음.',
        '마지막 유지 장. 원본 보존, 독립판에서는 중복 유지 1장 제외.'],
      'catch_counter':[
        '빈손 준비. 얼굴·체형·복식 유지.',
        '높은 손이 가리키기로 읽혀 잡기 불합격. 얼굴 가림 없음.',
        '옆으로 비킨 낮은 자세. 높은 손의 움켜쥠 표현 보류.',
        '자세 유지. 높은 손의 움켜쥠 표현 보류.',
        '낮은 손이 허리 앞. 바닥 표시 오프셋 +1px.',
        '잡기 끝과 맞쏘기 첫 장 공유. 동일 원본 픽셀·오프셋·소품 확인.',
        '낮은 손을 조금 뻗음. 소품 총구 수평. 높은 손 보류.',
        '손목 회수. 머리 높이 약1px 변화, 높은 손 보류.',
        '낮은 손 재전진. 얼굴·복식 유지. 높은 손 보류.',
        '유지 자세. 시작으로 반복 시 위치 차이 있어 단발 전환용.'],
      'close_combo':[
        '낮은 빈손 준비. 얼굴·복식 유지.',
        '얼굴 아래 리텐션. 권총 소품 수평.',
        '작은 손목 반동. 파지 손은 한 덩어리로 읽힘.',
        '리텐션 회수. 접지 높이 일정.',
        '내디딤 중간. 머리카락 가는 끝 일부가 퍼짐.',
        '두 손 전방 신전. 얼굴 가림 없음.',
        '손목 반동. 검은 장갑 유지.',
        '두 손 조준 회수. 다음 장으로 공간 이동이 급해 별도 보간 추가.',
        '높은 손을 열기 시작. 낮은 손은 권총 위치. 앞 장과 연결 보간 대상.',
        '손바닥 밀기 중간. 얼굴 가림 해소.',
        '열린 손바닥이 분명. 뒤 손은 허리 앞.',
        '밀기 유지. 머리 높이 약1px 차이.',
        '손바닥 회수. 몸·복식 유지.',
        '복귀. 단발 동작이며 0번으로 반복 연결 품질 승인 아님.'],
      'combo_bridge':[
        '입력 시작 장과 RGBA 픽셀 동일. 별도 재생하지 않고 cq2 끝에서 사용.',
        '후퇴 보간. 몸과 떨어진 흰 효과가 x>=120에 생김. 원본 보존, 독립판 draw_width=120만 표시.',
        '후퇴 보간. 분리된 흰 효과 표시 제외. 양발 접촉 상태에서 위치가 바뀌어 접지 보류.',
        '낮은 손 분리·손바닥 열기. 지지발 미끄러짐 보류.',
        'last_frame 입력과 366픽셀 다름. API가 끝장 일부 재그림. 이 출력은 재생 제외하고 원래 입력 close_combo/08.png로 연결.']}
    ledger=[];reviews=[]
    for name,items in notes.items():
        f=OUT/'attempts'/name;req=read(f/'request.json');meta=read(f/'result.json');rows=read(f/'frames.json')
        state=read(f/'state.json');state['internal_review']='held_hand_shape' if name=='catch_counter' else 'held_grounding' if name=='combo_bridge' else 'conditional_candidate'
        state['user_visual_approval']=False;save(f/'state.json',state)
        ledger.append(dict(clip=name,tool=req['tool'],job_id=meta['job_id'],asset_id=meta['asset']['id'],
                           frames_returned=meta['frames'],input_sha256=req['input_sha256'],last_frame_sha256=req.get('last_frame_sha256'),
                           request_sha256=req['request_sha256'],actual_generations=meta['charged_generations'],
                           cost_evidence=f'attempts/{name}/result.json',status='recovered',user_visual_approval=False))
        assert len(items)==len(rows)
        for row,note in zip(rows,items):
            reviews.append(dict(clip=name,frame=row['index'],sha256=row['sha256'],note=note,
                                reviewed_dimensions=['얼굴','체형','복식','손','접지','시작/끝 경계'],user_visual_approval=False))
    save(OUT/'jobs-local.json',{'jobs':ledger,'total_actual_generations':sum(x['actual_generations'] for x in ledger),'shared_balance_delta_used':False})
    save(OUT/'review/frame-by-frame.json',reviews)
    superseded={'cq1_body':'close_combo','cq3_palm':'close_combo','catch_body':'catch_counter','counter_body':'catch_counter'}
    for name,replacement in superseded.items():
        p=OUT/'requests'/f'{name}.json';r=read(p)
        r.update(status='superseded_do_not_submit',superseded_by=replacement);save(p,r)
    for name in ['pipe_body','catch_counter','close_combo']:
        p=OUT/'requests'/f'{name}.json';r=read(p)
        r.update(status='submitted_and_recovered_do_not_resubmit');save(p,r)
    live=read(OUT/'live-account.json');q=read(OUT/'queue.json')
    q.update(account_status='authenticated_local_mcp',account_balance=14021.30,account_active_jobs=2,
             account_concurrency_limit=20,account_observed_at=live['observed_at'],owner_active_jobs=0,
             new_paid_calls=4,new_actual_charge=11,generation_status='4_jobs_recovered_partial_visual_hold',
             visual_approval='pending',note='실제비용은 각 job 서버 charged_generations 합계. 계정 잔액 감소에는 다른 담당 작업 포함. 과거 정확한 잔여승인량은 여전히 미확인.')
    save(OUT/'queue.json',q)
    failures=read(OUT/'local-failures.json')
    if not any(x.get('stage')=='interpolation_endpoint_verification' for x in failures):
        failures.append({'stage':'interpolation_endpoint_verification','job_id':ledger[-1]['job_id'],'actual_charge':2,
                         'defect':'Returned last frame differs from supplied endpoint by 366 pixels; intermediate frames contain detached white effects and support-foot sliding',
                         'resolution':'Use original supplied endpoint in runtime; display only x<120 for bridge intermediates to exclude detached effects; mark grounding held; no repeated paid call'})
    save(OUT/'local-failures.json',failures)
    refs={name:subprocess.check_output(['git','rev-parse','origin/codex/'+name],cwd=ROOT,text=True).strip() for name in ['metroidvania-run-system','character-production-resume','art-deadpole-resume']}
    save(OUT/'local-source-check.json',{'checked_at':datetime.now(timezone.utc).isoformat(),'refs':refs,
          'deadpole_full_diff_against_system':subprocess.check_output(['git','diff','--name-only','origin/codex/metroidvania-run-system','--','game-src/action/deadpole/full'],cwd=ROOT,text=True),
          'integration':'no merge; continued existing Deadpole branch; own paths only','original_files_preserved':771,
          'handoff_received_from_coordinator':'01a1632e-358b-7931-b8ab-c3487b5b6095','kyuras_recovery':'not queried or retrieved'})
    prefix='''# 데드폴 로컬 제작 재개 결과 · 2026-10-22

**실제 생성·회수 완료: 4건, 서버 실제 차감 합계 11회. 사용자 시각 승인 전이며 손 모양·접지 일부 보류.**

브랜치 `codex/art-deadpole-resume`. 새 그림은 `release/demo/deadpole-resume.html`에 반영했다. 기존·신규 비교, 장별 이동, 속도 조절, 근접 3연타, 잡기→맞쏘기를 조작할 수 있다. 기존 통합 게임·atlas·본부·스테이지는 변경하지 않았다.

| 작업 | 작업 ID | 실제 비용 | 회수 |
|---|---|---:|---:|
| 파이프 빈손 몸 | `4ee67072-3bcb-431e-b62b-a1f2446761ea` | 3회 | 8장 |
| 잡기→맞쏘기 | `d9e65b7a-aca2-48db-b2d9-1ae5d15823e4` | 3회 | 10장 |
| 근접 공격 | `4206757c-145c-4b9a-8211-2e585da3df75` | 3회 | 14장 |
| 2타→3타 보간 | `0d951568-6645-4872-8dc8-30511d65023a` | 2회 | 5장(입력 첫 장 포함) |

가격은 각 응답의 `charged_generations`로 확인했다. 공용 잔액 차이는 개인 비용으로 계산하지 않았다. 로컬 인증 후 첫 잔액 14,160.30회, 납품 준비 조회 14,021.30회/$0/계정 활성2건, 데드폴 활성0건. 조회시각·원문은 `live-account.json`. Tier3 2x 한도는 무료 공식 도움말에서20건 확인; 데드폴 제출중 최대1건을 지켰다. 이 수치는 조회 시점 스냅샷이다.

## 적용 결과와 미완료

- 파이프: 새 빈손 몸으로 장마다 달라지던 생성 무기를 제거했다. 독립판은 기존 소품 `game-src/art/items/dot/pipe.png` 한 장을 동일 크기로 회전해 보여 준다. 잘림 없음. 두 손이 붙은 덩어리로 읽히고 후퇴 리듬은 짧다.
- 근접1타: 얼굴 높이 총을 낮은 리텐션으로 수정, 별도 권총 소품 수평 유지. 반동은 작다.
- 근접3타: 열린 손바닥 밀기가 보인다. 낮은 손과 높은 손 역할이 분리됐다.
- 잡기→맞쏘기: 같은 생성 `05.png`를 경계에 공유. 그림·바닥 오프셋·소품 좌표까지 동일함을 검사했다. **높은 손이 움켜쥠보다 가리키기로 보여 손 모양은 불합격/보류.**
- 근접2→3타: 뼈대 조합의 급한 후퇴를 발견해 같은 방식 재생성 대신 첫/끝 장 보간으로 변경. 반환 끝 장은 입력과366픽셀이 달라 실제 재생은 원래 입력 끝 장을 쓴다. 중간1·2장의 몸과 떨어진 흰 효과는 `draw_width=120`으로 표시만 제외(원본 유지). **지지발 미끄러짐은 보류.**
- 생활·사교·씻기는 신규 생성0건. 기존 씻기20장과 기록2개 동일 blob 확인을 유지했고 전체 기존 full/771파일을 보존했다. 산탄총 통일 등 이외 결함은 이번 수정 완료에 포함하지 않는다.

## 기록·검증·다음 담당

`attempts/<작업>/`에 요청, 입력 해시, 작업 ID, 서버 응답, 원본 PNG, 프레임 해시를 보존했다. `jobs-local.json`은 실제 비용 원장, `review/frame-by-frame.json`은37개 반환 프레임 검수, `local-failures.json`은 실패/방식 변경 기록이다. `final/manifest.json`은 독립판 원본 대응·손 좌표·바닥 오프셋·승인 상태다. 최종 기술 검사는 `review/provenance-test.json`, `review/browser-test.json`에 있다.

총괄 채팅 `01a1632e-358b-7931-b8ab-c3487b5b6095`에 ID·비용·해시와 범위를 전달했다. 큐라스 기과금2건은 이 담당이 조회·회수하지 않았다. 공통 도구 인계는 아래 고정커밋 목록과 총괄 `handoff-index.json`을 따른다. 전체 준비 브랜치는 병합하지 않았다.

Windows에서는 기존 제출 도구의 fcntl 의존을 배타 파일 생성 방식으로 수정했다. 실제 생성은 인증된 네이티브 PixelLab MCP로 제출했다. 회수는 `recover_local.py`, 독립판은 `build_resume_demo.py`로 재현한다. 프레임 소유권·입력 해시·원본 보존·실제 비용·경계 검사와 중복 방지 안전검사9개, PC1280×860/휴대폰가로844×390 브라우저 검증 통과. 이 통과는 시각적 합격을 의미하지 않는다.

다음 개선은 **높은 손의 움켜쥠을 마스크 제한 편집으로 고치고**, 연결 보간의 발 접촉을 별도 검증한 핵심 자세로 바꾸는 것이다. 동일 실패 요청을 글만 바꿔 반복하지 않는다. 사용자 시각 승인은 아직 받지 않았다.

---

## 이전 클라우드 준비 기록 (아래 인증 실패는 과거 상태)

'''
    path=OUT/'README.md';old=path.read_text(encoding='utf-8')
    marker='## 이전 클라우드 준비 기록 (아래 인증 실패는 과거 상태)\n\n'
    if marker in old: old=old.split(marker,1)[1]
    path.write_text(prefix+old,encoding='utf-8')
    print('Wrote verified ledger, queue snapshot, 37 frame reviews and handoff.')

if __name__=='__main__': main()
