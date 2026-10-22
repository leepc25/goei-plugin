# 본부 유리문 1종 납품 · 2026-10-22

실제 PixelLab 원본에서 만든 닫힘·열림 PNG와 독립 검수판이다. 최종 게임에는 아직 반영하지 않았다. 사용자 시각 승인을 받았다는 뜻은 아니다.

- 브랜치: `codex/pixellab-doors-round2`. 시작 커밋 `bbe6496cc933879df10d607317763e96bf212872`.
- 화면 대조: 최신 통합 `59a2a883c6aca00f8c0e1e5fc2c421a6da770528`. 본부 복도 `f2`의 `office` 유리문 한 곳.
- `review/index.html`: 이미지 내장 단일 HTML. 기존/닫힘/열림 비교, 9단계 개폐 반복·슬라이더, 별도 화살표, 문턱·발 기준선, 모바일 확대 보기. 실제 게임 캡처 위의 자산 검수판이며 이동 게임은 아니다.

## 자산·정리 내역

| 용도 | 파일 | 실제 치수/좌표 |
|---|---|---|
| PixelLab 원본, 무수정 | `raw/pixellab-d0105c20.png` | RGBA 96×144, alpha bbox [4,4,92,139) |
| 닫힘·절반·열림 | `states/closed.png`, `half.png`, `open.png` | 각각 RGBA 96×144, 공통 앵커 (48,136) |
| 공통 문틀 | `layers/frame.png` | 96×144, bbox [3,5,93,138) |
| 어두운 개구부 | `layers/aperture.png` | 96×144, 개구부 (8,11,80,125) |
| 좌우 문짝 | `layers/leaf-left.png`, `leaf-right.png` | 각각 40×125, 닫힘 원점 (8,11)/(48,11), 이동 -40/+40 |
| 출입구 화살표 | `layers/entry-marker.png` | 48×16, 앵커 (24,8), 별도 레이어, 문자 없음 |
| 개폐 확인용 | `frames/open-00.png`…`open-08.png` | 같은 레이어를 기계적으로 합성한 9단계; 추가 AI 생성 아님 |

생성 원본은 공통 문틀이 없는 두 문짝이었다. 문짝은 40열씩 추출하고 원본 y64~73의 반복 젖빛 띠 10행을 제거해 목표 높이125를 맞췄다. 확대·축소나 비율 늘이기는 하지 않았다. 원본 금속 림의 세 색으로 고정 사각 문틀을 로컬 조립했다. **문틀과 상태 합성은 로컬 제작이며 PixelLab이 완성 문틀/열림 상태까지 생성했다고 주장하지 않는다.** 모든 절단 좌표·색·해시는 `preparation.json`, 재현 코드는 `assemble-assets.py`에 있다.

## 통합 좌표와 최소 패치

- 표시 배율2. 월드 문턱 앵커 **(1364,440)**. 일반식 (door.x,440).
- PNG 좌상단 **(1268,168)** = (door.x−96,168). 캡처 camera x1043에서는 **(225,168)**.
- 개구부 월드 **(1284,190,160,250)**. 문턱440, 도착 발486. 표식 월드 중심 **(1364,464)**, 표시범위 x1316~1412/y448~480.
- 레이어: 기존 벽/바닥 → 개구부 → clip된 문짝 → 고정 문틀 → 표식 → 캐릭터. 바깥은 투명, 열린 내부는 기존 기준색 #05070a이다.
- 이동/문턱/상호작용/암전/OPEN_T는 변경하지 않는다. 기존 `openOf(d.id)`를 그림에 전달한다. `d.open` 해금 여부를 열림 진행률로 쓰지 않는다. camX는 호출자의 context에서 이미 적용된다.
- `integration/minimal-integration.patch`: **미적용 제안**. 위 통합 SHA에 `git apply --check` 통과. 새 그림 helper + hub 한 곳의 선택 + mount/dispose 로더 연결만 포함한다. 다른 본부 문은 기존 그림을 사용한다.
- `integration/pack/`의 6개 파일을 통합 담당이 `game-pack/hq-door-round2/`로 복사한다. 기존 GOEIPACK `pack.json` 계약과 `bridge.assets.url('hq-door-round2',file)`를 쓴다. 최종 pack/build/release는 통합 담당 범위다.
- 단독 게임 빌드는 엔진 시작 전에 `integration/pack-inline.js`를 포함할 수 있다. 현재 독립 검수판은 이미 그림을 내장했다.
- 패치의 팩 누락/디코드 실패는 기존 도형 문으로 fallback한다. 새 비동기 로딩은 게임 시작을 기다리게 하지 않으며 정리 후 지연 응답을 무시한다.

## 실제 연결·생성·비용

MCP 계정 인증 성공: 활성 Tier3 구독. 첫 조회 14160.30회 잔여, 당시 active/recent jobs0. 이전 문 담당의 제출 ID/유료 생성0건; gallery의 door 검색 한 건은 캐릭터 화장실 동작으로 이번 문과 무관했다. 기존 문 회수 대상이 없어 신규1건을 제출했다.

| 호출 | 결과/비용 |
|---|---|
| `get_balance` / `list_jobs` / `list_images` / `list_objects` / `search_help` | 읽기·조회, 무료 |
| `create_image_pixen` | **1호출, 1 generation** |
| `wait_for_jobs` / `get_image` | 완료 원본 회수, 추가 생성0 |
| AI 편집/재생성/애니메이션 | 0호출/0회 |
| 로컬 분리·조립·표식·9단계 합성 | 유료 생성0회 |

Job **d0105c20-4b44-4ebb-b3a5-32ea1a4158c1**, asset **4d996bf4-cba3-559f-8c23-de805a905fe8**, seed102209. 완료 영수증이 charged1을 명시한다. 완료 직후 잔여14159.30을 확인했으며, 이후 공유 계정의 다른 담당 호출로14158.30이 관측됐다. 이후 계정 전체 차액을 이 문의 비용으로 합산하지 않는다. 구독 generation 단위이며 현금 환산액은 계산하지 않았다.

공식 MCP 스키마 및 무료 도움말에서 96×144/투명/side/south/비용1을 확인했다. Pixen은 스타일 이미지·팔레트 입력을 지원하지 않아 텍스트 색 설명을 재사용했다. `evidence/live-tool-contracts.json`, `live-help.json`, `create-image-pixen-receipt.json`, `get-image-result.json`, `spend.log`에 근거를 보존했다.

캐릭터 총괄 채팅 `01a162c7-9305-728e-a2b4-35d0f479d097`에 예약과 영수증을 직접 전달했다. 총괄은 `f4c613ef` 기록에서 문1회 차감을 확인하고 문 추가 예약0을 반영했다. 원장은 계정 전역 잠금이 아니며 다른 담당 작업을 취소하지 않았다.

## 검수와 남은 범위

- 원본·상태 RGBA, 크기, 공통 앵커, 투명 외곽, 개구부, 9단계에서 고정 영역 픽셀 동일성 검사 통과.
- 실제 최신 통합 게임을 키보드로 사무실→복도 이동해 캡처. 자산 생성에는 캐릭터 그림을 입력하지 않았다. 검수 화면 속 기존 캐릭터는 크기 비교용이다.
- Chromium PC1280×800, 모바일 가로844×390/세로390×844 모의 검사 통과. 닫힘·열림 실제 화면 차이, 개폐 재생, 표식/기준선 터치, 가로 넘침0, pageerror0, 외부 이미지 요청0.
- 제안 렌더러는 camera1043/door1364 조건에서 닫힘·절반·열림을 PNG와 **전체 픽셀 일치**로 검증했다. 팩 누락·dispose 후 fallback도 통과.
- 통합 원본은 타입 검사·빌드 통과. 제안 패치는 적용 가능 검사만 했으며 게임 이동 로직 통합 검사는 하지 않았다.
- 미완료: 사용자 시각 승인, 실기기 모바일 검사, 통합 담당의 최종 게임 반영·팩 릴리스·이동 회귀검사. 그 외 문 종류와 남쪽 출구는 이번 한 종류 범위 밖이다.

재현: `python assemble-assets.py` → `python build-review.py` → `node check-review.mjs`. 브라우저 모듈/실행 파일은 `PLAYWRIGHT_MODULE`, `CHROME_PATH`로 지정한다. `check-integration.mjs`는 `ESBUILD_MODULE`도 받는다.
