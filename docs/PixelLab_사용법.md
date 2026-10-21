# PixelLab 사용법 정리

조사일 2026-10-21. 출처: 공식 [MCP 문서](https://api.pixellab.ai/mcp/docs), [API 명세](https://api.pixellab.ai/v2/openapi.json), [도구 문서](https://www.pixellab.ai/docs), MCP `search_help`(PixelLab 도움말, 무료). "비공식"은 PixelLab 튜토리얼을 요약한 제3자 자료([gfargo/pixelkiln](https://github.com/gfargo/pixelkiln))다.

## 우리가 실패한 이유 (쟈알디 대표 자세, 2026-10-21)

- 전투 대기 자세 한 장에서 `animate_image` 열린 생성으로 강한 스트레이트·질주를 뽑았다. 발이 제자리에 남아 2회 연속 불합격(12회 낭비).
- 공식 도움말: 시작 장이 이미 그 동작의 시작처럼 보여야 하고, 시작 자세가 결과를 크게 좌우한다. 대기 자세에서 큰 동작은 나오지 않는다.

## 도구별 요점

| 도구 | 쓰임 | 비용 | 주의 |
| --- | --- | --- | --- |
| `animate_image` (v3) | 글로 동작 생성. `last_frame` 주면 보간(끝 자세 고정) | ceil(가로×세로×장수/65536) | 첫 장에서 크게 못 벗어남. 음영 유지(실측 색 ~35). `enhance_prompt`(+0.05), `drift_threshold`(색 깜빡임 억제) |
| `animate_with_skeleton_v3` (베타) | 장마다 관절 18개 좌표를 직접 지정 → 그 자세로 다시 그림 | 3장=2, 8장=3, 15장=4 | COCO-18. 좌표 0~1 비율, ARM=손목, LEG=발목, 동쪽을 보면 RIGHT=앞쪽. `first_frame_keypoints`가 실제 그림과 맞아야 색·투명 유지. 관절 추정은 REST `POST /v2/estimate-skeleton` |
| `animate_image_pixminimax` | 4~40장 긴 동작 | 크기 무관, 132×132가 128보다 쌈 | 실측: 색 37→12, 음영 소실 |
| `edit_image_pixen` / `edit_image` | 색·소품·표정 수정 | 1 / 10~25 | **자세를 보존하는 도구.** 자세 바꾸기에 쓰지 않는다 |
| `animate_character` 템플릿 | lead-jab, cross-punch, running-8-frames, flying-kick, taking-punch, getting-up 등 | — | PixelLab 캐릭터 객체 필요. v3 참조 그림은 정면(south) 요구 |

## 권장 절차 (큰 동작)

1. 핵심 자세(타격·접촉·공중)를 먼저 만들어 사용자 확인.
2. 준비 → 타격 → 회수를 따로 뽑고, 앞 클립 끝 장 = 다음 클립 첫 장으로 이어 붙인다.
3. 동작이 클수록 장 수를 늘린다(공격 연속은 16장 권장, 비공식: 넘어짐 8장 이상).
4. 뻗는 쪽에 캔버스 여백을 충분히 둔다.
5. 프롬프트는 외모 말고 움직임을 한 문장으로(속도·힘·무엇이 먼저 나가는지).
