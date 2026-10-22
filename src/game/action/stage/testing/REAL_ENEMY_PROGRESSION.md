# 실제 적·진행 경계 검수 (2026-10-22)

공유 통합 작업의 `stage/module.ts`와 `tests/progression-real-enemies.test.mjs` 수정. 캐릭터 자산·적 동작 자체·전투 수치를 변경하지 않았다.

## 수정한 문제

- 시드 4, 깊이 5, 재현/red 수호자 방: `family208`이 실제 `family_f`/`family_m`으로 생성되고 처음에는 비적대다. 일반 encounter가 먼저 해제돼 방이 완료된 것으로 표시되는 문제를 막았다. 둘의 실제 사망 이벤트를 모두 받은 뒤 방 정리로 인정한다. 일반 수호자의 규칙 완료 이벤트도 수용하여 `risenhouse`를 규칙으로 해결했을 때 진행을 막지 않는다.
- 비적대 수호자 상태를 허용했던 구형 저장은 살아 있는 몸을 저장하지 않으므로, 노부부의 `guardianSpawned`만 남고 몸이 사라졌다. 미해결 노부부는 복원 시 다시 소환하고 미해결 가족은 수호자 파도만 재생성한다. 이미 해결한 가족과 일반 적의 재생성은 회귀 검사로 금지한다.
- 추격 방의 적 생성이 추격 벽 갱신 조건 안에 있었다. 오른쪽 진입으로 벽을 끄면 계획된 적도 생기지 않았다. B-12의 계획된 stalker도 일반 encounter가 없고 별도 생성이 누락됐다. 벽과 별개로 양방향 700px 이내 계획 적을 한 번 생성한다. 방 통과 목표와 출입 잠금 조건은 완화하지 않았다.
- 통합 담당의 `World.canCheckpoint()` 수정과 함께 비적대 수호자·비보스 B-12 손도 몸이 남아 있는 동안 안전 저장을 금지한다. 전투 잠금 여부(`isThreat`)는 몸을 생략해도 안전한지의 기준이 아니다.

## 검증

- `npm run typecheck`: 통과.
- `node --test tests/progression-real-enemies.test.mjs tests/run-system.test.mjs tests/stage.test.mjs`: 세 파일 모두 통과.
- 최종 `node tests/progression-real-enemies.test.mjs`: 5개 통과. 실제 `createEnemy`, 쟈알디 프레임 정보, `World.step`의 E 입력/이벤트 경로를 사용한다.
- 수호자 규칙 검사는 실제 `signalEnemies({kind:'clock'})`를 사용한다. 일반 전투와 수호자 사망은 진행 경계 검증을 위해 실제 Enemy의 `die()`를 호출한다. 따라서 이 결과는 전투 난이도, 모든 적을 사용자 입력만으로 처치하는 완주, 브라우저 수동 플레이의 증거가 아니다.

범위 밖: 적 원본 동작·수치, 실제 공격/규칙 조작 연결이 아직 없는 수호자의 콘텐츠 보완은 별도 수호자 담당과 통합 담당이 검토한다.
