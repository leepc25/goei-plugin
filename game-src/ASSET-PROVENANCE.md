그림은 이 작업에서 이미지 생성 도구로 제작한 학교 배경, 요원/적/효과 시트와 기존 프로젝트 자료입니다. 새 지도는 비스듬한 학교 전경과 현재/다음 위치용 플랫폼, 장면 시트는 수송·투입·후송·은신처, 휴식 시트는 요원별 식사·음수·정비·휴식 자세를 요청했습니다. 원본 PNG는 프로젝트 source-assets에 유지했습니다. 실행용 PNG는 크기와 색 수를 줄여 압축했습니다.

기존 공개 소품은 CREDITS.md, 글꼴은 FONT-LICENSE.txt를 참고하세요. 배경 음악과 효과음은 외부 음원 다운로드 없이 Web Audio로 합성합니다.

## V5
- `assets/blaret5.png`: 제공된 봇카드 Blaret.avif 초상을 정체성 참고로 사용. built-in image_gen으로 도트 8프레임 생성. 일반 일러스트 시안은 납품에서 제외.
- `assets/fx4.png`: V5 전용 6열4행 이펙트 시트로 교체. built-in image_gen, 런타임에서 저알파 배경 및 프레임 경계 잔상 처리.
- `assets/car.png`: built-in image_gen으로 완전한 도트 수송 밴 생성. 배경과 별도 레이어로 이동 연출.
- 생성 원본은 저장소 `source-assets/expedition-v5/`에 보관. 배포 PNG는 크기·팔레트 최적화.

## V6
제작 도구: built-in image_gen. 원본은 저장소 source-assets/expedition-v6/. PNG 크기/팔레트만 배포에 맞춰 최적화.
- corridor6.png: 눈높이 1인칭 학교 복도, 중심 소실점, 좌우 갈림길, 어두운 청록/황색 조명, 320×180 픽셀 배경.
- shop6.png: 봇카드 Blaret 초상을 정체성 참고로 사용. 교실 진열대 뒤 블라렛이 눈깜박임/물품 제시/내려놓기를 하는 2×2 전체 장면. 분대 요원 없음.
- walk-a6.png / walk-b6.png: 기존 각 요원의 extra 시트를 정체성 참고로 사용. 8열×4행, 접지/다운/교차/업 및 반대쪽 다리의 8자세. 실제 알파 영역을 읽어 골반 기준과 발 기준을 등록하는 코드는 scripts/prepare-v6-atlas.py.
- V5의 map4/nodes4/blaret5/scenes4/barrel은 더 이상 런타임에서 사용하지 않아 모듈에서 제거했습니다. 저장소의 과거 원본과 버전 이력은 보존합니다.

- walk-e6.png: 기존 적 4종 시트를 참고한 8프레임 이동. 모퉁이 귀신/경비/세종대왕 동상/악몽의 주인 순서. 좌향 이동, 접지와 무릎 교차 자세, 종별 몸무게와 옷자락 변화.

## V7
`assets/return7.png`: generated with the built-in imagegen tool, packed to 320×180 for the game. Prompt: “Nighttime exterior entrance of a secret Korean anomaly management bureau headquarters; warm entrance lights; navy pixel art; clear walkable foreground; entrance on right; no people, vehicles, text or UI.” Full source: `source-assets/expedition-v7/return7.png`.
The attempted walk-sheet generation was rejected because it retained the high-knee poses; it is not shipped. Existing sheets remain, with metadata registration and playback corrections. No new walking asset is claimed.
