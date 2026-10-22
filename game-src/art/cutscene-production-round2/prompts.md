# 최종 실행 요청과 동작
실제 PixelLab 배경 요청은 background-local.request.json. 단1회 제출했고 receipts/에 job/차감/회수를 보존했다.
background.request.json과 resume-evidence/의 구형 계획은 역사 기록이며 재실행하지 않는다.

첫 프레임을 review/first-frame-640.png에서 검수한 뒤 문을 제작했다.
AI동작 프롬프트는 제출하지 않았다. 본부 문 담당 신규 leaf-left/leaf-right를 같은 aperture 안에서 정수좌표 이동:
0,1,2,4,6,9,12,16,20,24,28,31,34,36,38,39,40px.
왼쪽은 음수, 오른쪽은 양수로 이동한다. 문틀과 배경은 고정. 17프레임 해시 모두 다르다.
