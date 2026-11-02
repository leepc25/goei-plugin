# PixelLab 요청문 연구 — 통로 칸의 바닥이 좁게 나오는 원인 (2026-10-31)

사용자 「프롬프트좀 연구를 해봐」. 생성 없이 문서·지난 결과만으로.

## 문서에서 확인한 것 (pixellab.ai/docs, api.pixellab.ai/v2/openapi.json)
- generate-image-v2 = 웹의 「Create S-XL image (Pro)」. 요청문 최대 2,000자(API 제한), 참고 그림 4장 + 화풍 그림. init image·카메라 칸 없음 → 구도는 글과 참고 그림으로만.
- 크기 한계: 632×424(3:2), 792×336(21:9) 등. 비용: 342~512px 25회, 257~341px 15회, 171~256px 10회, 129~170px 4장 15회, 86~128px 4장 10회.
- 카메라 옵션(다른 도구)도 문서가 「약하게(weakly) 따른다」고 함. 글의 각도 숫자는 약하다는 영창 1·2차 기록과 같음.

## 지난 결과 대조 (뒷벽 아래 선 높이, `game-src/art/pixellab-test-20261028/연구_뒷벽선_비교9.png`, 빨강 60%·초록 70·80%)
| 그림 | 원근 문장 | 옆벽 | 뒷벽선 |
|---|---|---|---|
| 헐값매입 최초 | No vanishing point, 양끝 벽 토막 | 양쪽 | 약 62% |
| 영창 v2 | (헐값 참고 그림) | 양쪽 | 약 57% |
| 대기실 v8 | One-point | 왼쪽 | 약 62% |
| 진료실 v4 | One-point | 양쪽 | 약 60% |
| 수술실 v4 | One-point | 양쪽 | 약 58% |
| 대박 알선 v7 | One-point | 양쪽 | 약 57% |
| 앞골목 ① v1·v2·v3 | **Flat front view** + corridor | 왼쪽만/없음 | **76~78%** |

- 바닥 몫 숫자(40%), 밑그림, 카메라 35도는 효과 없음(v1~v3).
- 실내 6장은 모두 뒷벽선 57~62%. 통로 3장만 77%. 다른 점: 「Flat front view, no vanishing point」, 「corridor」, 방으로 닫히지 않음.
- 짐작(확인 안 됨): 「flat front view」는 건물 입면도처럼 벽을 정면으로 꽉 채우고 바닥을 얇은 띠로 그린다. 「corridor」는 좁은 공간이라 바닥이 좁다. 실내는 「방」이라 바닥이 안쪽으로 펼쳐진다.

## 시험 안 (사용자 허락 전, 생성 안 함)
작은 크기(160×106, 한 번에 4장, 15회)로 문장만 바꿔 뒷벽선을 잰다. 작은 크기와 632 구도가 같은지도 대조군으로 확인.
- A 대조: v4 요청문 그대로
- B: 「Flat front view」 → 「One-point perspective, the floor recedes toward the back wall」(옆벽 없음)
- C: B + 「corridor」 대신 넓은 바닥 묘사(「a wide underground arcade walkway, open concrete floor in front of the shop」)

## 결과: v6 (632, one-point) — 짐작 틀림
- 원근만 실내와 같게 바꿨는데 뒷벽선 약 77%(그대로). 오른쪽에 안쪽 옆벽·통로가 생기고 바닥 판 선이 다시 생김.
- 남은 차이: 실내는 물건(책상·침대·테이블)이 **바닥 위 방 안**에 놓이고, 통로는 내용이 **벽 안으로 들어간 가게 + 간판 + 천장**이라 세로 공간을 벽이 다 먹는 것으로 보임(확인 안 됨).
