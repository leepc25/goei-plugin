# 캐릭터 제작 재개 · 엔진 연결 계약

이번 납품은 기존 원본의 비교 검수와 연결 준비용이다. **새 PixelLab 수정 그림은 아직 없고 사용자 시각 승인도 없으므로 엔진 자동 적용은 금지한다.** 쟈알디 걷기·달리기의 그림 결함, 큐라스 snap1~3의 펀치로 읽히는 손·팔 결함이 해결되지 않았다. 신규 결과로 소개하거나 현재 통합 atlas를 교체하는 패치가 아니다.

## 납품 경로와 재현

- 도구: `tools/build_character_delivery.py`
- 패키지: `game-src/action/character-resume/delivery/manifest.json`
- 시트: 위 패키지 기준 `strips/jyaldi/{walk,run}.png`, `strips/kyuras/{snap1,snap2,snap3,walk_shotgun}.png`
- 검사: `tests/character-delivery.test.py`

```bash
python3 tools/build_character_delivery.py
python3 tools/build_character_delivery.py --check
python3 tests/character-delivery.test.py
```

Pillow가 필요하다. 빌더는 네트워크나 생성 API를 호출하지 않는다. 원본 6클립의 최종 PNG를 바이트 그대로 복사한다. 픽셀 수정·리사이즈·색 보정·신규 생성은 하지 않는다. 원본 낱장들은 복제하지 않고 경로·SHA-256·마지막 변경 커밋을 기록한다. 출력은 위 전용 delivery 폴더뿐이며 통합 엔진·본부·스테이지·`game-pack/jyaldi/atlas.png`를 바꾸지 않는다.

기준 ref 기본값은 `origin/codex/metroidvania-run-system`이며 manifest에 해석된 40자리 커밋을 저장한다. 해당 ref가 나중에 바뀌었을 때 당시 결과를 검사하려면 `--baseline <납품 manifest의 baseline_commit>`을 지정한다. 각 파일의 `last_commit`은 마지막 변경 이력, `sha256`은 실제 패키징한 파일의 증거다. 검수 당시 source 원본이 변경되면 `--check`는 실패한다.

## 엔진 담당자가 받는 자료형

패키지 schema는 `goei.character-review-delivery/1`이다. 기존 게임 pack.json으로 위장하지 않으므로 현행 엔진이 자동으로 읽을 수 없다.

| 필드 | 의미 |
| --- | --- |
| `new_art_generated: false` | 기존 생성물을 비교용으로 선별했음 |
| `user_visual_approval: false` | 사용자 시각 승인 없음 |
| `engine_auto_apply: false` | 자동 통합 대상 아님 |
| `clips["요원/클립"].strip` | 패키지 manifest 기준 시트 상대 경로 |
| `geometry.frameW/frameH` | 192×144, 한 프레임 규격 |
| `geometry.anchor/foot` | 기존 기준 x=57, 발 앵커 y=136 |
| `metadata.frames/fps/loop/hits` | 원래 final manifest의 프레임·재생·타격 정보 |
| `metadata.adv/origin/slide` | 그림의 기존 이동 계약. 존재하는 값만 원본대로 보존 |
| `metadata.anchors` | 두 손목·골반 및 앞팔 각도, 원래 뼈대 기반 값 |
| `hands` | 원래 hands.json의 `[x,y,각도]` 배열 |
| `provenance` | 시트·manifest·hands·낱장 원본의 경로/해시/커밋 |
| `excluded_legacy_files` | 큐라스 구형 잔존 시트 5개, 해시와 배제 사유 |

손 좌표의 각도는 `metadata.anchors.angle`에 90도를 더한 값(360 나머지)이다. 이미지에서 새로 측정한 손 좌표가 아니다. 자동 검사는 metadata와 hands의 일치만 검증한다. 실제 손과 무기 부착 위치의 시각 일치는 별도로 확인해야 한다.

## 잘못된 옛 파일을 연결하지 않는 규칙

큐라스 `idle_pipe`, `walk_pipe`, `shotgun`, `idle_shotgun`, `run_shotgun`은 final PNG가 있지만 현재 원본과 manifest/hands에 없다. 기존 기록을 삭제하지 않고 출력 허용 목록에서 차단했다. 폴더의 PNG 전체를 glob으로 읽어 연결하면 안 된다.

빌더는 6클립의 명시적 허용 목록만 쓴다. 다음 중 하나라도 있으면 패키지를 만들지 않는다.

- manifest 누락 또는 0장
- 원본 누락, 장 번호 누락/중복, 캔버스 규격 불일치, 빈 원본
- 시트 너비와 프레임 수 불일치
- 손 좌표·anchors의 장수 또는 내용 불일치
- 타격 장 인덱스가 범위 밖
- 출력에 허용되지 않은 파일 존재

기존 파일이 존재해도 큐라스 5개 구형 무기 클립은 항상 거부한다. 과금 작업 두 건을 실제로 회수하고 검수했다면 원본·manifest·작업 ID·비용·해시를 연결한 후 이 허용 목록 정책을 명시적으로 개정해야 한다. 단순히 배제 목록에서 이름을 지워 옛 시트를 살리지 않는다.

## 승인 후 엔진 담당자의 적용 순서

1. 새 PixelLab 수정 결과와 프레임별 검수, 사용자 시각 승인을 확보한다. 이 단계까지 본 패키지는 비교 전용이다.
2. 신규 manifest에 각 프레임의 접지·이동·손 좌표와 실제 타격 장을 확정한다. 기존 값의 일괄 복사는 금지한다.
3. 시스템 담당자가 자신의 브랜치에서 atlas/frames와 요원별 moves를 연결한다. 본 제작 브랜치는 엔진 코드를 직접 수정하지 않는다.
4. 기존 좌표는 발 앵커 `(57,136)`을 기준으로 한다. `origin` 이동량과 `adv/slide`는 그림 내 이동을 중복 가산하지 않도록 실제 접지와 함께 확인한다. 현재 값만으로 접지 개선을 주장하지 않는다.
5. PC와 폰 가로 844×390에서 8→1 반복 경계, 전후 방향 반전, 손 번갈이, 무기 부착을 다시 검수한다.

엔진 연결용 패치는 이 빌더·검사·계약·비교 패키지를 추가하는 패치로 전달한다. 새 수정 그림을 넣은 엔진 패치가 아니라는 점을 패치 제목과 최종 인계에 함께 적는다.
