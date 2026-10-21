// 본부 대본: 잼트리 자리(임무 창구), 정비·보급실(콘쥬스), 감정실(데쥬레), 격리 연구실(고그니쟈), 탕비실 대화 사건, 출동 제안.
// 근거: 위키 「잼트리」「고그니쟈」「데쥬레」「콘쥬스」, 기본 기획서 4·5·17장. 상태 값 이름은 README.md 참고.
export default String.raw`
=== jaemtri_desk
> goto again if met_jaemtri
jaemtri(smile): 어머, 후배, 왔어?
jaemtri(smile): 잼트리 요원이라고 불러. 그거면 돼. …아니다, 언니라고 불러도 돼. 다들 결국 그렇게 되거든.
jaemtri: 여기가 임무 창구야. 온라인 순찰로 찾은 괴담 글, 실종 신고, 생존자 진술. 전부 이 태블릿으로 들어와.
jaemtri(serious): 그리고 하나만. 현장에서 들은 이름은 여기 와서 말하지 마. 코드네임 제도는 철저하거든.
jaemtri(smile): 자, 그럼 일 얘기 할까?
> set met_jaemtri = 1
> goto menu
-- again
~ jaemtri(smile): 왔어? 커피 먼저 할래, 일 먼저 할래?
~ jaemtri(smile): 어머, 후배. 얼굴 좋아졌네. 앉아.
~ jaemtri: 태블릿에 새 글 올라왔어. 볼래?
~ jaemtri(smile): 우리 후배 고생했지~ 자, 서류부터.
-- menu
* 임무 게시판 -> board
* 규칙서 열람 -> rulebook
* 커피 한 잔 -> coffee [if !coffee]
* 그냥 이야기하기 -> free
* 나중에 올게요 -> bye
-- board
jaemtri: 지금 들어온 건 차원 승강기 건이야. 낡은 건물 엘리베이터, 점검표 서명란이 빈 거.
* [조사] 로비에서 규칙 2개 확인, 로프로 귀환 -> m1 [if !done_m1]
* [진압] 로비 L3 경비원 -> m2 [if done_m1 && !done_m2]
* [조사] 추격의 층 통과 -> m3 [if done_m2 && !done_m3]
* [구조] 야근하다 들어온 회사원 -> m4 [if done_m3 && !done_m4]
* [조사] 재현의 층 「아파트」 규칙 3개 -> m5 [if done_m3 && !done_m5]
* [진압] 405호 노부부 -> m6 [if done_m5 && !done_m6]
* [회수] 서명란이 빈 점검표 -> m7 [if done_m2 && !done_m7]
* [조사] 시험 층 목표 달성 -> m8 [if done_m6 && !done_m8]
* [기록] B-5 도달 -> m9 [if done_m8 && !done_m9]
* 다시 생각해 볼게요 -> menu
-- m1
jaemtri: 첫 건은 가볍게. 로비 층에서 규칙 두 개만 확인하고, 다락방 로프로 돌아오면 돼.
jaemtri(smile): 가볍다는 건 서류 얘기고. 로비가 제일 많이 죽였대. 평범해 보여서.
> set mission = 'm1'
> goto take
-- m2
jaemtri: 로비 세 번째 층에 경비원이 순찰을 돈대. 수십 년 전 제복. 정해진 길만 걸어.
jaemtri(serious): 손전등에 비치면 달려와. 경로 밖에 서 있으면 못 본대. 생존자가 그렇게 살았어.
> set mission = 'm2'
> goto take
-- m3
jaemtri: 추격의 층. 문이 열리는 순간 사냥이 시작된대. 설명이 필요 없다고 하더라.
jaemtri(smile): 생존자 한 분은 그 뒤로 마라톤 기록이 20분 줄었대. …웃으면 안 되는데.
> set mission = 'm3'
> goto take
-- m4
jaemtri(serious): 구조 요청이야. 야근 마치고 엘리베이터를 탔다가 안 내린 회사원. 가족이 신고했어.
jaemtri(serious): 출동 두 번 안에 데려와야 해. 그 뒤로는… 승객들 말로는, 더는 사람이 아니게 된대.
> set mission = 'm4'
> set rescue_open = 1
> goto take
-- m5
jaemtri: 재현의 층. 아파트 단지가 그대로 있대. 주민처럼 보이는 것들이 살고.
jaemtri: 명일 아파트 생환자 진술이랑 겹치는 데가 많아. 신발, 인사, 목소리, 밥상. 규칙 세 개만 확인해 와.
> set mission = 'm5'
> goto take
-- m6
jaemtri(serious): 405호. 노부부가 밥을 차려 놓고 기다린대. 아들이랑 딸이 곧 온다고.
jaemtri(serious): 재현된 거야. 진짜 405호는 아니고. …그러니까 마음 쓰지 마. 알았지?
> set mission = 'm6'
> goto take
-- m7
jaemtri: 회수 건. 정비 구역 어딘가에 서명란이 빈 점검표 원본이 있대. 데쥬레가 엄청 보고 싶어 해.
> set mission = 'm7'
> goto take
-- m8
jaemtri: 시험 층. 벽에 숙제가 적혀 있대. 수호자가 제일 많이 목격된 데야.
jaemtri(smile): 숙제 먼저 읽어. 언니가 시험 기간마다 콘쥬스한테 하는 말이야.
> set mission = 'm8'
> goto take
-- m9
jaemtri(serious): 기록 갱신. B-5까지. 관리국 공식 기록을 새로 쓰는 거야.
jaemtri(serious): …돌아오는 것도 기록에 들어가. 꼭.
> set mission = 'm9'
> goto take
-- take
* 받을게요 -> accept
* 다른 걸 볼게요 -> board
-- accept
jaemtri(smile): 접수. 출동 요원은 사무실에서 골라. 쉬는 사람한테 말 걸면 돼.
> emit mission {mission}
> end
-- rulebook
> goto rules_none if rules < 1
jaemtri: 지금까지 찾은 규칙이 {rules}줄이야. 승강기 공통이 열두 줄쯤 될 거라고 봐.
jaemtri: 브리핑 때 찾은 줄만 읽어 줄게. 많이 채울수록 다음 출동이 편해져.
> emit open rulebook
> goto menu
-- rules_none
jaemtri: 아직 한 줄도 없어. 첫 줄은 이거야. 점검표 서명란이 빈 엘리베이터가 입구다.
jaemtri(smile): 그건 언니가 서비스로 적어 둘게.
> set rules = 1
> emit rule entry
> goto menu
-- coffee
jaemtri(smile): 뭐 마실래? 연유 커피가 제일 맛있는데. 그건 이견이 없어.
* 연유 커피 -> c_milk
* 블랙 -> c_black
* 믹스커피 -> c_mix
-- c_milk
jaemtri(smile): 그치? 탁월한 선택이야.
> set coffee = 'condensed'
> goto c_done
-- c_black
> goto c_black_ok if agent == 'jyaldi' || agent == 'spangdal'
jaemtri: …블랙? 아, 블랙. 응. 탈게.
jaemtri(smile): (살짝 서운한 얼굴) 다음엔 연유 넣어 줄까?
> set coffee = 'black'
> goto c_done
-- c_black_ok
jaemtri(smile): 블랙은 원래 너한테 내리는 거야. 알지?
> set coffee = 'black'
> goto c_done
-- c_mix
jaemtri(smile): 어머, 믹스 파야? 축하해! 지하 연구실 가면 환영받겠다.
> set coffee = 'mix'
-- c_done
jaemtri: 다음 출동에 한 번 힘이 될 거야. 커피는 원래 그래.
> emit coffee {coffee}
> goto menu
-- free
> emit freetalk jaemtri
> end
-- bye
~ jaemtri(smile): 응, 가 봐. 서류는 내일까지.
~ jaemtri(smile): 졸지 마. 찌른다.
~ jaemtri: 가다가 탕비실 문 열지 마. 관계자 외 출입 금지야.
> end

=== briefing
// 출동 버튼을 누르면. 15초 안에 끝나고 건너뛸 수 있다 (기본 기획서 5.3).
> emit briefing start
jaemtri: 브리핑 시작할게. 짧게.
> goto b_m1 if mission == 'm1'
> goto b_m2 if mission == 'm2'
> goto b_m3 if mission == 'm3'
> goto b_m4 if mission == 'm4'
> goto b_m5 if mission == 'm5' || mission == 'm6'
> goto b_m7 if mission == 'm7'
> goto b_m8 if mission == 'm8'
> goto b_m9 if mission == 'm9'
-- b_m1
jaemtri: 입구는 종로 근처 낡은 사무실 건물. 1990년대 준공. 점검표 서명란이 비어 있어.
radio: 생존자 진술: 「띵 소리가 나고 1층이라는데, 로비가 아니었어요. 비슷한데 어딘가 틀렸어요.」
> goto b_rules
-- b_m2
radio: 생존자 진술: 「손전등 불빛이 지나갈 때 기둥 뒤에 있었어요. 그 사람 등만 봤어요. 제복이 너무 낡았더라고요.」
jaemtri: 경로는 바닥에 닳은 자국으로 보일 거야. 그 길 밖에 서. 등 뒤에서 치면 두 배래.
> goto b_rules
-- b_m3
radio: 생존자 진술: 「뒤에 뭐가 있었는지는 몰라요. 안 봤으니까 살았어요.」
jaemtri: 문을 지나면 닫고 가. 그게 뒤에 오는 걸 늦춘대.
> goto b_rules
-- b_m4
radio: 가족 진술: 「그날도 야근이라고 문자가 왔어요. 엘리베이터 탄다고. 그게 마지막이에요.」
jaemtri(serious): 찾으면 다락방 로프까지 데려와. 승객 중에 그 사람 행세를 하는 게 있을 수 있어. 사연이 너무 길면 의심해.
> goto b_rules
-- b_m5
radio: 생존자 진술: 「아이고, 우리 아들이랑 딸이 곧 온다는구먼. 같이 밥 먹고 가. …그렇게 말했어요. 얼굴이 거꾸로였어요.」
jaemtri: 주민한테 먼저 인사해. 복도에서 뛰지 말고. 밥은 잘 먹었다고 하고 먹지 마.
> goto b_rules
-- b_m7
radio: 다락방 메모 사본: 「점검표는 정비 구역 세 번째 해치 근처. 여기 오래 있지 마.」
jaemtri: 다락방은 90초 넘게 있지 마. 메모가 그렇게 말하고, 메모는 대개 맞아.
> goto b_rules
-- b_m8
radio: 생존자 진술: 「벽에 숫자가 적혀 있었어요. 30초. 셋. 뭘 세라는 건지 몰라서 그냥 뛰었어요.」
jaemtri: 숙제부터 읽어. 실패하면 수호자가 나와.
> goto b_rules
-- b_m9
radio: 관리국 기록: 「최저 도달 B-12, 증언 1건. 귀환 경위 미상.」
jaemtri(serious): B-5에서 더 내려가고 싶어져도 로프 타. 기록은 다음에 또 쓰면 돼.
-- b_rules
> goto b_norules if rules < 2
jaemtri: 규칙서에서 찾은 줄은 {rules}줄. 화면에 띄워 줄게.
> emit open rulebook
> goto b_hint
-- b_norules
jaemtri: 아직 아는 규칙이 별로 없어. 들어가면 벽부터 읽어.
-- b_hint
> goto b_hint_none if !variant
jaemtri: 그리고 오늘은 이상한 얘기가 하나 있어. {variant}
-- b_hint_none
> goto b_self if agent == 'jyaldi'
jyaldi(serious): 목표 달성하면 바로 로프. 다들 살아서 와. 이상.
> goto b_answer
-- b_self
jaemtri(smile): 부장님이 직접 가시니까 지시는 생략할게요. …담배는 밖에서 끄고 가세요.
-- b_answer
> agent brief
> emit briefing end
> end

=== offer
// 사무실에서 쉬는 요원에게 말을 걸 때. 고르면 출동 요원이 된다.
> agent offer
* 같이 가자 -> yes
* 다음에 -> no
-- yes
> agent pick
> emit pick {agent}
> end
-- no
> end

=== supply
// 정비·보급실. 콘쥬스. 호칭은 상대와 상황에 따라 바뀐다 (위키 「콘쥬스」 호칭 재협상).
> goto again if met_konjyuce
konjyuce(smile): 안녕하세요! 정비·보급실 콘쥬스예요!
konjyuce(serious): 잠깐만요! 저도 이 팀 정식 멤버거든요! 마스코트 아니에요!
> set met_konjyuce = 1
> goto menu
-- again
> goto hi_m if male
~ konjyuce(smile): 선배님, 오셨어요?
~ konjyuce(smile): 언니! 오늘 뭐 챙겨 가요?
> goto menu
-- hi_m
~ konjyuce: 아저씨, 오셨어요?
~ konjyuce(smile): 오빠, 안녕하세요!
-- menu
* 보급품 챙기기 -> gear
* 지원 요원 정하기 -> support
* 장비 구경 -> look
* 됐어 -> bye
-- gear
konjyuce: 아이템 네 칸, 유물 두 칸이요. 예산 안에서 고르세요. 무거운 건 제가 들어 드릴게요. 상자 열 개까진 괜찮아요.
> emit open gear
> goto menu
-- support
konjyuce: 지원 요원은 필살 게이지 쓰면 잠깐 와서 한 방 쓰고 가요. 누구로 할래요?
> emit open support
> goto menu
-- look
konjyuce(surprise): 우와! 이거 진짜 총이에요? 진짜 총 처음 봐요!
> goto look_gun if agent == 'eileen' || agent == 'jyaldi' || agent == 'deadpole' || agent == 'spangdal'
agent: 만지지 마.
> goto menu
-- look_gun
agent: 만지지 마.
konjyuce: …네. (오늘 들은 「만지지 마」 세 번째)
> goto menu
-- bye
> goto bye_m if male
konjyuce(smile): 언니, 사람 보는 눈 있으시네요? 아, 간식 사다 주시면 더 좋고요!
> end
-- bye_m
konjyuce(smile): 오빠, 사람 보는 눈 있으시네요? …아까 아저씨라고 한 건 잊어 주세요.
> end

=== appraisal
// 감정실. 데쥬레. 회수물 감정·홀로그램 재현.
> goto spang if agent == 'spangdal'
> goto again if met_dejure
dejure(surprise): 으, 음… 안녕하세요… 새, 새로 오신 요원님 맞죠…?
dejure: 감정실이에요… 회수물 주시면 분류해 드릴게요. 살아 있는 건… 그, 그것도 괜찮아요.
> set met_dejure = 1
> goto menu
-- again
~ dejure(surprise): 아, 아와와…! 아, 요원님이시구나… 죄송해요…
~ dejure: 저기… 그… 회수물… 있으세요…?
-- menu
* 회수물 감정 -> appraise [if loot > 0]
* 홀로그램 재현 -> holo
* 괜찮아요 -> bye
-- appraise
dejure: (장갑을 낀다. 손끝이 거짓말처럼 멈춘다)
dejure(serious): 점검표 공백 패턴이네요. 날짜가 세 번 겹쳐요. 이건 연구 자료로 분류할게요.
dejure(smile): …헤헤. 끝났어요. 무, 무섭진 않았어요. 조금밖에.
> set loot = 0
> emit appraise
> goto menu
-- holo
dejure: 본 적 있는 걸 다시 보여 드릴 수 있어요. 진술로 복원한 거라… 조금 달라요.
> emit open holo
> goto menu
-- spang
dejure(surprise): 아, 아와와…!
spangdal(smile): 데쥬레. 그 애, 원래 내 후배였지. 미안해. 후후.
dejure(hurt): 제가 잘못했어요! 제가 잘못했어요! 죄송해요오…!
> goto spang_j if d100 < 50
> goto menu
-- spang_j
jaemtri(smile): 스팡달, 입.
spangdal: (입을 다문다)
dejure: …언니… 고마워요…
> goto menu
-- bye
dejure: 네… 조, 조심히 다녀오세요… 꼭이요…
> end

=== lab
// 격리 연구실. 고그니쟈. 하게체, 최대 음량, 믹스커피 의무.
> goto again if met_gognija
gognija(smile): 오오! 신입 요원인가! 환영하네! 나는 연구 책임자 고그니쟈일세!
gognija: 이곳에서는 누구나 달달한 믹스커피를 마셔야 하네! 연구실 제1법칙이지!
> goto first_black if coffee == 'black'
> set met_gognija = 1
> goto menu
-- first_black
gognija(smile): 블랙? 방문객 명부에 「블랙 요청」 칸이 있네! 체크하게! 설탕 두 스푼 추가일세!
> set met_gognija = 1
> goto menu
-- again
~ gognija(smile): 왔는가! 데쥬레!!! 커피 좀 타 오게! 달달한 걸로, 빨리!!!
~ gognija: (알약을 씹는다) 아아, 몸에 좋은 걸세! 무슨 일인가!
~ gognija(smile): 오오! 살아 돌아왔군! 훌륭하네! 표본은 가져왔나?
-- menu
* 연구 과제 -> research
* 승강기에 대해 묻기 -> elevator
* 저 창문은 뭐예요 -> window
* 나가기 -> bye
-- research
gognija: 감정한 자료가 쌓이면 연구가 진행되네! 유물, 강화, 위험 단계! 전부 여기서 나오지!
> emit open research
> goto menu
-- elevator
gognija(smile): 차원 승강기 말인가! 모든 엘리베이터가 하나의 의식이라는 설이 있지! 흥미롭네!
gognija: 인사하면 대우가 달라진다던데, 그렇다면 그건 예절을 아는 의식이란 말일세! 예절을 아는 건 관찰을 한다는 뜻이고!
gognija(serious): …그러니 거래는 조심하게. 관찰하는 쪽은 언제나 원하는 게 있네.
> goto menu
-- window
gognija(smile): 아, 그건 비상 탈출 장치라네!
> goto menu
-- bye
gognija(smile): 가게! 살아서 오게! 살아서 와야 표본이 늘지!!!
> end

=== breakroom
// 탕비실 대화 사건. 요원에 따라 다른 짝. 한 번 본 대화는 앨범에 남는다 (emit album).
> goto br_spang if agent == 'spangdal'
> goto br_gorgo if agent == 'gorgodio' || agent == 'kyuras'
> goto br_trio if agent == 'deadpole' || agent == 'geshugan' || agent == 'rojemon'
> goto br_eileen if agent == 'eileen'
-- br_jyaldi
jaemtri(smile): 부장님, 연유 커피 한 번만 드셔 보세요. 한 모금만.
jyaldi: 맛은 있겠지.
jaemtri(smile): 그러니까 드셔 보시라니까요.
jyaldi: 블랙.
> emit album jyaldi_jaemtri_coffee
> end
-- br_eileen
eileen: (총을 분해하고 있다)
konjyuce(smile): 언니, 그거 뭐예요? 저도 해 봐도…
eileen: 만지지 마.
konjyuce(serious): 저도 정식 멤버거든요!
eileen: …(장비 목록만 확인한다) 알아.
> emit album eileen_konjyuce
> end
-- br_spang
spangdal(smile): 있잖아, 잼트리. 데쥬레 아직도 나 보면 펄쩍 뛰어?
jaemtri(smile): 응. 오늘 아침에도.
spangdal(smile): 후후. 귀여워. 집밥 해 줄까 봐.
jaemtri(smile): 스팡달, 입.
spangdal: (입을 다문다. 손가락을 꼼지락거린다)
> emit album spangdal_jaemtri
> end
-- br_gorgo
kyuras(smile): 형님이 앞에서 다 받아 주니까 편하지!
gorgodio(smile): 니가 뒤에서 다 태워 주니까 편하지.
kyuras: …근데 형님 오토바이 서스펜션 또 나갔대.
gorgodio: 그건 오토바이가 약한 거다.
> emit album gorgodio_kyuras
> end
-- br_trio
deadpole(smile): (커피를 타며 행복하다) 게슈간 씨, 타자 연습 오늘도 하실 거예요?
geshugan: …안 해.
rojemon: 해. 보고서 나 혼자 쓰기 싫어.
geshugan: …알았어.
deadpole(smile): 거기… 아, 죄송해요, 그 키요.
geshugan: …그래. 미안.
deadpole(smile): 괜찮아요!
rojemon: …또 시작이네. 세 시간 뒤에 또 한다, 이거.
> emit album trio_typing
> end

=== settle
// 귀환·정산 뒤 잼트리 한마디. result: 'return' | 'retreat' | 'evac'
> goto s_evac if result == 'evac'
> goto s_retreat if result == 'retreat'
jaemtri(smile): 어머, 후배, 왔어? 살아서 왔네. 그럼 됐어.
jaemtri: 자, 진술서부터. 찾은 규칙, 회수물, 구조한 사람. 하나씩.
> agent settle
jaemtri(smile): 수고했어. 오늘 커피는 연유 조금 더 넣었어.
> end
-- s_retreat
jaemtri: 철수했구나. 잘했어. 돌아오는 것도 일이야.
jaemtri(smile): 정보는 다 가져왔지? 그럼 반은 성공이야.
> agent settle
> end
-- s_evac
jaemtri: …
jaemtri: (아무것도 묻지 않고 커피만 내민다)
> end

=== evac_wake
// 후송: 의무실 침대에서 깨어남. 옆 동료 대사는 director가 EVAC_PAIRS에서 골라 앞에 넣는다.
narr: 의무실. 형광등. 소독약 냄새.
> agent evac
jaemtri: 송신한 정보는 다 받았어. 나머지는 절반. 괜찮아. 다음에 또 가면 돼.
> end
`;
