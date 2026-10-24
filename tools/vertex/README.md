# Vertex AI 이미지 시험 (Nano Banana 계열)

- 키: 환경 변수 `VERTEX_SA_JSON`(서비스 계정 JSON). 파일·커밋에 키를 넣지 않는다.
- `vertex_token.py`: JWT 서명으로 액세스 토큰 받기. `gen_image.py`: 참고 그림 + 프롬프트로 한 장 생성.
- 사용 가능(global, countTokens 200): `gemini-3.1-flash-image`, `gemini-3-pro-image`, `gemini-2.5-flash-image`. `-preview` 이름과 `nano-banana-2.1`은 404.

## 2026-10-24 시험: 2F 복도 f2
- 명령: `python3 gen_image.py f2_prompt.txt ../../game-src/art/start-room/design.png ../../game-src/art/field/raw/f2_nanobanana_test.png 4:1 2K`
- 4:1 선택 이유: 목표 3700×700 = 5.29:1. 4:1과 8:1 중 4:1이 더 가깝다(8:1은 세로 700에 가로 5600이라 너무 김).
- 결과: 4128×1024(4.03:1), 15.3초, 출력 이미지 토큰 1680 → 약 $0.10.
- 관찰: 화풍·밝은 벽·매끈한 바닥·엘리베이터 두 대·양끝 방화문은 맞음. 벽선이 60%가 아니라 약 78%(바닥이 얇음), 종합대응팀 유리문·게시판 근처에 흐린 겹침 자국, 벽시계 두 개, 엘리베이터 홀 왼쪽에 문 같은 판 하나 더 있음.
- 8:1 지원은 아직 실측하지 않았다(비용 아끼려 한 장만 생성).
