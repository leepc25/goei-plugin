# 쟈알디 샤워·목욕·용변 158~167

2026-10-21 GPT 작업. 사용자 직접 확정: 성인의 비성적인 알몸 생활 장면. 임의의 수건·거품·가림판을 추가하지 않는다. 샤워·목욕은 탈의, 용변은 하의를 내린다. 기존 towel은 의뢰서대로 showerout 이후 재생한다.

- 런타임: clips/ 아래 10개 클립, 56장, 192×144 RGBA. 기존 FOOT=136, ANCHOR=57 좌표계 유지, 개별 리사이즈 없음.
- 최초 skeleton 생성 10건은 30회. 욕조 밖에 앉음, 용변 대기의 정장 유지, 입장 시 가구에 접근하지 않는 문제를 확인했다.
- 무료 search_help 조사 후 방식 변경: 신규 생성된 가구 포함 프레임을 기준으로 명시적인 공간 이동 뼈대 사용. 수정 skeleton 3건 9회, 시작·끝 장 고정 toiletout 3회, 욕조 안 기준의 bath 반복 2회. 합계 44회, 잔액 9079 → 9035.
- 샤워 입장 마지막 장의 흩어짐은 정상 직전 장 유지로 처리. showerout과 bathout은 수정된 입장 클립의 역순. animate_image 결과의 원본 입력 장은 제외하고 약정된 4/6장만 사용.
- 초기 그림과 깨진 수정 장은 bathroom-initial/에 보존. 작업 ID·요청·파생 관계는 bathroom-production.json, 차감 기록은 ../spend.log.
- 구조 검사: tools/review_jyaldi_bathroom.py. 빌드: tools/build_jyaldi_full_demo.py, missing []. 10개 클립은 검수한 장 수를 유지하도록 일반 auto_trim 대상에서 제외.
- 남은 시각 한계: 생성된 가구 형태와 문 위치가 클립 간 완전히 일치하지 않는다. 화장실에는 중복 변기가 남아 있다. 기술 검증은 사용자 시각 품질 승인을 뜻하지 않는다.

시연판: release/demo/jyaldi-full.html, 목록 끝의 씻기·집안일·운동에서 선택.
