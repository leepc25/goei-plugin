---
name: goei-restroom-stalls-1101
description: 남자 화장실 대변기 칸 확정 사항 2026-11-01 13:52 — 칸 줄 오른쪽 끝 = 소변기 벽 이음줄 x412, 오른쪽 1·2번 칸만 사용, 맨 왼쪽 칸 닫힘 고정 미사용
metadata:
  type: project
  modified: 2026-11-01T13:55:21.821Z
---
사용자 13:45~13:52 (스레드 「남자 화장실 칸 마무리하기」):
- 「이 위치까지 대변기칸 땡겨 경계까지」 → 끝 기둥 오른쪽 끝 = 소변기 벽 이음줄 x412. `tools/bg_fix/stall_toilet_raise.py` RIGHT=413 (전엔 398), 배경 hq_restroom_m_final_v2_984x424.png. 커밋 81e2ef180 (claude/project-thread-xb9u41).
- 「오른쪽부터 1번 2번칸만 열고닫고 활성화」, 「제일 왼쪽칸은 고정으로 닫혀있는거고 미사용」.
- 미리보기 v8: /mnt/project-files/hq-f3/now/화장실남_전체_v8.png. 미리보기 재현: e.png = tools/mapedit/eileen_stand.png를 높이 334로 NEAREST 확대, scipy 필요.
**How to apply:** 문은 왼쪽 칸부터 그린다(오른쪽 칸 열린 문이 위, 13:56 사용자 지적, v9). 게임에 칸 넣을 때 3번 칸은 문 0(닫힘) 고정·상호작용 없음. See [[goei-hq-interior-rooms-1101]].
여자 화장실(13:57~14:01): 남자 확정판 복사, 소변기 대신 칸을 경계 x667부터 왼쪽으로(칸 4개), 소변기 벽 윗판은 민 벽으로 메움, 왼쪽 10px 잘라 974폭(hq_restroom_w_bg_974x424.png, tools/bg_fix/stall_women_preview.py), 칸 전부 사용.
샤워실(14:02~14:03): 동작이 동쪽뿐 → 샤워기·사물함 모두 동/서 향함. 들어가면 사물함, 그다음 트인 샤워장(부스 없음), 입구 좌우 무관. 배경 요청문 specs/hq_shower_m_p1_prompt.txt(빈 방), 「뽑아」 대기. 휴게실보다 샤워실 먼저.
여자 탈의실 확정 14:23: hq_shower_f_p1_632x424.png(원근 방). 왼쪽 유리문 = 목욕탕(별도 장면), 입구 = 화면 아래. 남자 탈의실은 미정.
