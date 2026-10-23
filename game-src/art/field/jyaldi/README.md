# 쟈알디 · 기준 그림과 PixelLab 변환 시험

2026-10-24 (Asia/Seoul). 적용 지침: [필드 그림 통합 지침](../../../../docs/필드_그림_통합_지침.md).

- [정면 전신 기준 그림 원본](reference/front-concept.png): GPT 생성 원본 1024×1536 PNG, 바이트 변경 없음. 원작 `assets/agents/Jyaldi_default.avif`와 `assets/portraits/Jyaldi/Jyaldi_serious.avif`를 이미지 참조로 사용했다. 도트 결과물이 아닌 고해상도 투입용 그림이다. 도구 응답까지 50.307초. GPT 생성의 차감 단위는 도구에서 제공하지 않는다.
- [변환용 캔버스](reference/front-concept-input.png): 원본에서 좌우 각 92px의 바깥 여백을 덜어내고 위아래 각 72px의 투명 여백을 추가한 840×1680 PNG. 전신의 머리·얼굴·옷·손·신발 및 신체 비율을 변형하지 않았다. 출력 128×256과 가로세로 비를 맞춘다. 원본을 덮어쓰지 않는다.
- 사용자 지시: 이 기준 그림으로 PixelLab 입력/변환 시험을 진행하고 원본을 GitHub에 보존한다. 캐릭터 8방향 등록과 애니메이션 생성은 이번 정면 변환 결과를 보여주기 전에 진행하지 않는다.
- 계획: 일반 `image_to_pixelart` 128×256, `faithful=true`, `init_image_strength=200`, 필요 시 `reduce_colors` 48색. 공식 MCP 도움말 견적 1 + 0.1 generations이며 실제 차감과 소요 시간은 `spend.log`에 기록한다.
- 기술 검수와 사용자 시각 승인은 구분한다. 실제 변환 결과를 확인하기 전에는 도트 품질·비율·투명 배경을 합격으로 보고하지 않는다. 게임에 반영된 자산이 아니다.

기존 성공 결과의 도구·요청 기록은 [남녀 페르소나 원본](../../../persona-reference-20261022/README.md)에 있다. 기존 남녀는 Pro Flash 직접 생성 결과이고 이번에는 고해상도 기준 그림의 도트 변환을 시험하므로, 같은 결과나 같은 비용을 보장하지 않는다.

## 1회 변환 결과

- [PixelLab에서 내려받은 변경 없는 원본](pixel/front-pixellab-original.png): 128×256, 38색, 회색 배경 포함(알파 전부 255). Job `bd98178d-2317-4b11-b86b-af1717e9ef7c`, Creator asset `d9e9c4d1-fa27-5165-8f11-1c75fc27f112`.
- [투명 배경 파생 파일](pixel/front-transparent.png): 외부와 연결된 정확한 RGB(128,128,128) 배경만 alpha=0으로 처리했다. 남은 인물 RGBA 픽셀은 모두 PixelLab 원본과 동일하다. 인물 경계는 x30~106, y11~243, 몸 높이 233px. 별도의 PixelLab 생성·배경 제거 호출은 없었다.
- [4배 정수 확대](pixel/front-transparent-4x.png), [기술 확인 기록](pixel/verification.json), [변환 요청 인자](pixel/conversion-request.json), [원본 생성 영수증](pixel/conversion-receipt.txt), [실측 기록](spend.log).
- 실제 차감 **1.0 generations**, 요청부터 완료 관측까지 **70.654초**(폴링·통신 포함). 생성 영수증의 차감 1회와 계정 전후 차이 1회가 일치한다. 결과가 이미 48색 이하이므로 `reduce_colors`는 실행하지 않았고 추가 0.1회 차감도 없었다.
- 상태: **사용자 시각 검수 대기**, 8방향 등록 0회, 동작 생성 0회, 게임 반영 없음. 기술 수치가 맞는 것만으로 얼굴·체형·도트 품질이 승인됐다고 판단하지 않는다.

![도트 변환 결과 원본 크기](pixel/front-transparent.png)
