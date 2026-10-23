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
- 상태: **사용자 반려 — 기존 남녀와 다른 도트 품질로 사용 불가.** 8방향 등록 0회, 동작 생성 0회, 게임 반영 없음. 기술 수치가 맞는 것만으로 얼굴·체형·도트 품질이 승인됐다고 판단하지 않는다. 아래 그림은 반려 기록 보존용이다.

![도트 변환 결과 원본 크기](pixel/front-transparent.png)

## 2차 시험 · 외모와 도트 스타일을 분리한 Pro 이미지 생성

1차의 일반 변환은 사용자 반려 상태이므로 같은 방식으로 반복하지 않는다. 2차는 **`create_image_pro`**로 128×256 정면 도트 1장을 새로 생성한다. 기존 남녀의 Pro Flash와도 구분해서 기록한다.

- 외모 입력: 사용자가 선택한 고해상도 기준 그림. [Pro용 입력](reference/front-concept-pro-input.png)은 840×1680 입력을 비율 그대로 256×512로 축소한 참조용 PNG이며 최종 도트가 아니다. 얼굴·복식·전신 형태의 지침으로 사용한다.
- 스타일 입력: 기존 여성 도트 `gallery:4db87d5a-70bb-5169-a83d-36222e6bb9ae` 원본. `style_copy=[color_palette, outline, detail, shading]`로 도트 밀도·윤곽·명암·색감만 참고하며 단발·치마·얼굴·오른쪽 3/4 자세를 복사하지 않도록 요청했다.
- 요청: `width=128`, `height=256`, `no_background=true`, `max_colors=48`, `seed=10242027`. [전체 요청 기록](pro-style-trial/request.json), [실제 접수 응답](pro-style-trial/queue-receipt.txt).
- 접수 응답: candidate 1장, 외모 참조 1장 및 별도 스타일 참조 사용, 견적 10 generations. Job `9d30ebb3-709d-4613-8ac8-c5cd78ef2ef6`, Creator asset `b99bcd59-d54f-5b2b-a5b4-e8e7ee6758ae`.
- [PixelLab 생성 원본](pro-style-trial/front-original.png), [4배 확대](pro-style-trial/front-4x.png), [기존 남녀와 비교](pro-style-trial/comparison-4x.png), [완료 영수증](pro-style-trial/completion-receipt.txt), [기술 확인 기록](pro-style-trial/verification.json).
- 실제 결과: **128×256·48색, 알파 0/255**, 인물 경계 x31~94, y17~247, 몸 높이 231px. 내려받은 원본의 인물·배경 픽셀을 수정하지 않았다.
- 실제 차감 **10.0 generations**, 요청부터 완료 관측까지 **171.772초**(통신·폴링 포함). 영수증 10회와 계정 전후 차이 10회가 일치한다.
- 상태: **사용자 시각 검수 대기**. 크기·색 수·알파 확인이 얼굴·체형·스타일의 승인을 뜻하지 않는다. 캐릭터 등록 0회, 애니메이션 생성 0회. 1차 일반 변환 1회와 합쳐 누적 차감 11회다.

![2차 Pro 이미지 생성 원본 크기](pro-style-trial/front-original.png)
