import json,datetime,hashlib,re
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parents[1]; repo=R.parents[2]; now=datetime.datetime.now(datetime.timezone.utc).isoformat()
a=json.loads((R/'resume/delivery-audit.json').read_text())
expected={'snap1':5,'snap2':6,'snap3':7,'idle_pipe':4,'walk_pipe':8,'shotgun':5,'idle_shotgun':4,'run_shotgun':8}
checks={}
for clip,n in expected.items():
 fs=sorted((R/'clips'/clip).glob('[0-9][0-9].png')); assert len(fs)==n,(clip,len(fs)); assert all(Image.open(f).size==(192,144) for f in fs)
 checks[clip]={'frames':n,'sha256':[hashlib.sha256(f.read_bytes()).hexdigest() for f in fs]}
html=(repo/'release/demo/kyuras-full.html').read_text(encoding='utf8');assert '__MANIFEST__' not in html
(R/'resume/final-verification.json').write_text(json.dumps({'observed_at':now,'clips':checks,'new_frames':35,'recovered_frames':12,'browser':'Prior owner PC/mobile tests preserved; final snap2/snap3 update statically verified, no fresh browser run','visual_review':'snap2 raised rear hand and snap3 crossed hand releases visible; thin body and dark suit preserved. Slight head angle variation remains. Down final-frame afterimage remains outside this delivery. User approval pending.','user_visual_approval':False},indent=2),encoding='utf8')
with (R/'spend.log').open('a',encoding='utf8') as f:
 for j in a['jobs']:
  if j['clip'] in ('snap2','snap3'):f.write(f"\n{now} resume_verified clip={j['clip']} job_id={j['job_id']} actual_generations={j['actual_generations']} source=native_get_image.charged_generations\n")
 for p in a['free_pixel_edits']:
  if p['clip'] in ('snap2','snap3'):f.write(f"{now} resume_free_edit clip={p['clip']} changed_pixels={p['total_changed_pixels']} charged_generations=0\n")
(R/'resume/README.md').write_text('''# 큐라스 제작 재개 납품 · 2026-10-22

기존 idle_shotgun 4장·run_shotgun 8장을 원래 작업 ID로 회수했다. 과거 청구는 각각 3회, 이번 회수 차감은 0이다. 신규 snap1/2/3, idle_pipe, walk_pipe, shotgun 6건 35장은 모두 완료했고 실제 청구는 각각 3회, 합계 18회다. ID·서버 청구 원문·입력 및 결과 해시는 delivery-audit.json과 requests, *-completed.json, generated/*/manifest.json에 보존했다. 공유 계정 잔액 차이로 비용을 계산하지 않았다.

기본 공격은 새 뼈대와 손가락 장전/해제 모양을 적용했다. 생성 결과가 주먹처럼 보였던 문제는 같은 유료 호출을 반복하지 않고 PixelLab 무료 정확 픽셀 편집으로 수정했다. snap1 220px, snap2 378px, snap3 464px, run_shotgun 130px 변경. 나머지 픽셀 불변을 대조했고 원본과 변경 요청을 모두 보존했다. 무기는 기존 설계대로 시연판에서 손 좌표에 그린다.

독립 시연판: release/demo/kyuras-full.html. 집중 검수에서 동작 선택, 장 정지, 이전/다음 장을 사용할 수 있다. 54클립 빌드 누락 0, 회수 검사 7개 통과. 이전 담당 PC/모바일 실행 증거는 browser/에 있다. 마지막 snap2/3 반영 후에는 프레임·정적 검증을 수행했으며 브라우저 재실행을 주장하지 않는다.

생성 완료와 사용자 시각 승인은 별개다. 손의 읽힘·복식·마른 체형을 검수했으나 일부 얼굴 각도 변화와 기존 down 마지막 장 잔상은 남는다. 전 동작 완성이나 사용자 합격으로 표시하지 않았다. 생활·사교 추가 양산은 하지 않았다.

초기 인증 실패 기록은 README-authentication-history.md에 보존했다. 이후 native MCP 인증 성공으로 회수했다. 준비 브랜치의 회수 도구만 선택 반입했고 전체 브랜치를 병합하지 않았다. 엔진·본부·스테이지·공용 atlas·통합 HTML은 수정하지 않았다.
''',encoding='utf8')
print(json.dumps({'verified_frames':sum(expected.values()),'new_actual_generations':18}))
