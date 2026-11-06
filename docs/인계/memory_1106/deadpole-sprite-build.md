---
name: deadpole-sprite-build
description: 데드폴(deadpole) 도트 제작 현황 — 기준 그림 3차, 비용, 생성 스크립트, GPT 의뢰 상태 (스레드 「데드폴 도트 제작」, 2026-10-22)
metadata:
  type: project
  modified: 2026-10-22T02:16:27.609Z
---
- 2026-10-22 01:21 사용자: 쟈알디 외 7명 + NPC도 제작, 요원마다 쟈알디와 같은 장면 전부, 동작은 성격대로 전부 다르게. 톤(외곽선·명암·도트)만 쟈알디와 같고 체형·옷·머리·자세는 그 요원 기본 그림(assets/agents/<영문>_default.avif)대로. 승인 "일단 만들어봐".
- 기획서 docs/캐릭터제작서/동작설계_deadpole.md. 134클립 + talk, GPT 4클립. 상한 475회.
- 기준 그림: 2차(쟈알디 옆모습을 얼굴만 편집)는 쟈알디 몸·옷 복제라 코디네이터가 지적 → 3차(02:15) = 숯빛 정장·흰 셔츠·넥타이·곧은 생머리, ×0.88 축소(scripts/scale_base.py, 원점 36,37 고정). 교훈: 다른 요원은 처음부터 기본 그림과 나란히 놓고 옷·머리·실루엣까지 확인.
- 생성: game-src/action/deadpole/scripts/gen.py (--resume, spend.log의 'gen RESET' 뒤 작업만 이어받음). 2차 기준 작업 약 43회 낭비, 누적 약 70회 + 3차 배치 약 393회. 결과 full/clips/<클립>/, 2차 결과는 full/old_v2/.
- PixelLab 동시 작업: 요원 스레드당 최대 2칸(사용자 확정 2026-10-22 03:12, 요원 7명 최우선). gen.py MAXJ=2.
- 지시문에 다른 사람·물건(enemy, someone, cup…)을 쓰면 그려 넣음 → collar에 남자가 그려져 버림. 몸 동작만 쓰도록 rig.py 고침. 버린 클립은 spend.log에 'gen DROP <이름>'.
- 생성 그림에 총구 불꽃이 섞여 나옴 → 검수 때 코드로 지움.
- GPT 탈의·샤워·목욕: 사용자가 붙여넣음, GPT가 2차 기준으로 undress 00~04 이미 올림. 의뢰서에 3-1 수치표(02:15) 추가, 보강판 붙여넣기 줄 코디네이터에 보냄. 받은 장의 흠은 다시 그리지 않고 코드로 고침(재의뢰는 사용자 승인 필요).
- 2026-10-22 04:06 전투·이동 72클립 + GPT 씻기 4클립 시연판 main 7204912 (검수 전 링크 보고). 빌더 tools/build_deadpole_full_demo.py, 보정 tools/deadpole_fixes.py, 결함 목록 docs/캐릭터제작서/데드폴_결함목록_2026-10-22.md. 약 270회 사용.
- 보류: 생활·사교·감정 69클립(목록은 결함 목록 4장, 약 200회 예상). gen.py --resume로 이어 만듦.
See [[jyaldi-full-build]], [[character-art-rules]], [[game-design-feedback]].
- 2026-10-22 05:25 사용자: 사용량 초과로 모든 작업 GPT로 이관. 최종 main 3b15d85(1·2차 독립 검수 불합격, 잘림·찌꺼기 일부 고침). 인수인계 /mnt/project-files/game/인수인계/데드폴 도트 제작.md. PixelLab 약 315회.
