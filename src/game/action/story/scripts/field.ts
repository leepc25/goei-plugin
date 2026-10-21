// 현장 대본: 승강기 탑승(인사·호명·총애·층 안내), 떠도는 승객(정직/거짓), 다락방, 구조, 승강기 거래.
// 근거: 위키 「차원 승강기」, docs/스테이지설계서_차원승강기.md 7·8·9·12장, 기본 기획서 7.3(돕기/무시/뺏기).
// 시작 전에 엔진·층 모듈이 넣어 주는 값: depth, ftype, favor, honest(승객 1/0), liar('a'|'b'), agent, rules_known.passenger
export default String.raw`
=== board
// 승강기에 탈 때마다. 인사(E)는 +0 또는 +1, 닫힘 연타 -1 (설계서 8장).
> line el:board elevator
* 인사한다 -> greet
* 닫힘 버튼을 연타한다 -> spam
* 가만히 있는다 -> quiet
-- greet
> agent greet
> goto greet_up if d100 < 50
> line el:greetFlat elevator
> goto after
-- greet_up
> set favor += 1
> emit favor {favor}
> line el:greetOk elevator
> goto after
-- spam
> set favor -= 1
> emit favor {favor}
> line el:closeSpam elevator
> agent rule_break
> emit rule close
> goto after
-- quiet
-- after
> goto trapped if favor <= -3
> goto call if !called_run
> goto mood
-- call
// 출동마다 첫 탑승에 한 번: 호명
> set called_run = 1
> emit cue call
> line el:call elevator
> agent called
-- mood
> goto lonely if favor >= 3 && !heard_lonely
> goto high if favor >= 2
> goto low if favor <= -2
> goto ride
-- lonely
> set heard_lonely = 1
> line el:lonely elevator
> goto ride
-- high
> line el:favor_high elevator
> goto ride
-- low
> line el:favor_low elevator
> goto ride
-- trapped
> line el:trapped elevator
> emit trapped 10
> goto ride
-- ride
> emit ride
> set announced = depth
> line el:announce elevator
> line el:hint elevator
> agent floor
> end

=== attack_inside
> set favor -= 2
> emit favor {favor}
> line el:attackInside elevator
> end

=== deal
// 다락방 인터폰. 출동마다 한 번. 회수물 1개 또는 미송신 단서 1개를 준다.
> line el:deal elevator
* 회수물 하나를 준다 -> give [if loot > 0]
* 미송신 단서 하나를 준다 -> give_clue [if unsent > 0]
* 거절한다 -> no
-- give
> set loot -= 1
> goto paid
-- give_clue
> set unsent -= 1
-- paid
> line el:dealDone elevator
* 다음 층 유형을 묻는다 -> ask_type
* 갈 수 없는 층을 열어 달라 -> ask_skip
* 보급품 위치를 묻는다 -> ask_supply
-- ask_type
// 총애가 낮으면 거짓이 섞인다 (원문: 틀린 정보를 받아 동료를 잃었다)
> goto lie if favor < 0 && d100 < 60
> goto lie if favor < 2 && d100 < 25
> emit deal type true
> goto deal_end
-- ask_skip
> emit deal skip2
> goto deal_end
-- ask_supply
> goto lie if favor < 0 && d100 < 60
> emit deal supply true
> goto deal_end
-- lie
> emit deal lie
-- deal_end
> set dealt = 1
> end
-- no
elevator: 그래요. 다음에.
> end

=== attic
// 다락방(휴식방) 첫 진입. 「여기 오래 있지 마」
> line el:attic elevator
narr: 덕트 사이 비좁은 공간. 벽에 긁어 쓴 지도, 버려진 배낭. 메모 끝에 한 줄.
narr: 「여기 오래 있지 마」
> agent attic
> goto writer if d100 < 50
> end
-- writer
// 메모 옆에 쓴 사람이 있다 (50%). 있으면 승객 조우로 이어진다.
narr: …메모 옆에 누가 앉아 있다.
> emit encounter passenger
> end

=== attic_stay
// 체류 90초 경고
elevator: (멀리서 덕트가 울린다)
> agent hp_low
narr: 아래에서 무언가 올라온다. 틈새로 떨어진 것들을 먹고 사는 것.
> emit predator
> end

=== passenger_three
// 삼 년째 승객. honest=1이면 짧고 맞는 말, 0이면 사연이 지나치게 길다 (규칙 8의 단서).
passenger: 나 여기 삼 년째야. 그러니까 내 말 들어.
> goto lie_story if !honest
passenger: 저쪽 문 말고 이쪽.
> goto react
-- lie_story
passenger: 처음엔 나도 너희처럼 정장 입은 사람들이랑 같이 왔어. 다섯 명이었지. 첫 층에서 하나, 추격하는 층에서 둘을 잃었어.
passenger: 그 뒤로는 혼자 다니면서 문을 하나하나 다 열어 봤어. 왼쪽 문은 몇 번이나 죽을 뻔했고, 오른쪽 문도 한 번은 그랬지만 그건 내가 잘못 들어간 거고…
passenger(smile): 아무튼 저쪽 문 말고 이쪽. 내가 다 해 봤다니까. 진짜야. 믿어도 돼.
-- react
> goto roje if agent == 'rojemon'
> goto hint if rule_passenger
> goto choose
-- roje
// 로제몬은 정신 간섭 면역, 거짓 승객을 바로 안다 (제작서 08)
> goto roje_true if honest
rojemon: 헛소리하지 마. 머릿속이 텅 비었어. 하는 말이랑 생각이 하나도 안 맞아.
> set p_known = 'lie'
> goto choose
-- roje_true
rojemon: …진짜야. 맛없는 생각인데, 거짓말은 아니야.
> set p_known = 'true'
> goto choose
-- hint
narr: (규칙서: 친절해 보이는 승객이 둘이면, 사연이 긴 쪽이 거짓이다.)
-- choose
* 승객이 가리킨 문으로 -> follow
* 반대쪽 문으로 -> other
* 같이 가자고 한다 -> help
* 가진 걸 내놓으라고 한다 -> rob
-- follow
> goto follow_bad if !honest
passenger: 거봐. 살았지?
> emit passenger right
> end
-- follow_bad
passenger(smile): …미안. 삼 년이면 나도 먹고 살아야지.
> agent rule_break
> emit passenger lure
> end
-- other
> goto other_good if !honest
passenger(hurt): …마음대로 해. 다들 그래.
> emit passenger wrong
> end
-- other_good
passenger: (등 뒤에서 작게 혀를 찬다)
> emit passenger right
> end
-- help
> goto help_lie if !honest
passenger: …나를? 삼 년 만에 처음 듣네. 로프까지만. 그다음은 몰라.
> agent rescue
> set favor += 1
> emit favor {favor}
> emit passenger rescued
> end
-- help_lie
passenger(smile): 좋지. 앞장서. 아니, 내가 앞장설게.
narr: 승객이 문 앞에서 멈춘다. 손이 등 뒤로 간다.
> emit passenger ambush
> end
-- rob
passenger(hurt): …여기서도 사람이 사람한테 이러네.
> emit passenger robbed
> end

=== passenger_pair
// 친절한 승객 둘이 서로 다른 문을 가리킨다. liar = 'a' 또는 'b'. 사연이 긴 쪽이 거짓 (규칙 8).
narr: 승객 둘이 엘리베이터 홀에 서 있다. 둘 다 친절해 보인다.
> goto a_long if liar == 'a'
passenger: (회색 점퍼) 왼쪽. 오른쪽은 아니야.
passenger: (낡은 양복) 오른쪽으로 가. 왼쪽 문 뒤에는 복도가 끝없이 이어지는데, 거기 들어간 사람을 내가 셋이나 봤어. 하나는 내 회사 후배였고, 이름은 말 안 할게. 우리 같이 야근하다 탔거든. 그래서 나는 오른쪽만 써.
> goto pick
-- a_long
passenger: (회색 점퍼) 왼쪽으로 가. 오른쪽 문은 열면 바닥이 없어. 내가 직접 봤어. 처음 여기 왔을 때 같이 온 아주머니가 그 문으로 들어갔는데, 나는 문틈으로 다 봤지. 그래서 그 뒤로는 절대 오른쪽은 안 열어.
passenger: (낡은 양복) 오른쪽. 왼쪽은 아니야.
-- pick
> goto roje if agent == 'rojemon'
> goto pick_hint if rule_passenger
> goto pick2
-- roje
rojemon: 둘 다 친절한 척하네. 근데 한 명은 생각이 텅 비었어. …말 긴 쪽.
> goto pick2
-- pick_hint
narr: (규칙서: 사연이 긴 쪽이 거짓이다.)
-- pick2
* 왼쪽 문 -> left
* 오른쪽 문 -> right
-- left
> goto good if liar == 'b'
> goto bad
-- right
> goto good if liar == 'a'
-- bad
narr: 문 너머에서 누군가 웃는다.
> agent rule_break
> emit passenger lure
> end
-- good
> agent find
> goto learn if !rule_passenger
> emit passenger right
> end
-- learn
narr: 규칙서에 한 줄이 적힌다.
> set rule_passenger = 1
> emit rule passenger
> emit passenger right
> end

=== passenger_supply
// 보급 승객. 정직하면 다락방에 숨긴 보급품 위치, 거짓이면 보급품을 노리고 덮친다.
passenger: 배낭 맨 사람이네. 관리국? 반가워.
> goto lie if !honest
passenger: 정비 구역 두 번째 해치 위에 내가 숨겨 둔 게 있어. 약이랑 손전등. 다 가져가도 돼. 나는 이제 필요 없어.
* 고맙다고 하고 받는다 -> take
* 나눠 갖자고 한다 -> share
* 무시한다 -> ignore
-- take
> agent find_item
> emit supply cache
> end
-- share
passenger(smile): …나눠? 하하. 그래. 반만 줘.
> agent rescue
> set favor += 1
> emit favor {favor}
> emit supply half
> end
-- ignore
passenger: 그래. 조심해.
> end
-- lie
passenger(smile): 그 배낭 무거워 보이네. 좀 들어 줄까?
* 배낭을 맡긴다 -> give
* 거절한다 -> refuse
-- give
narr: 승객이 배낭을 받아 들고 뒷걸음질 친다. 뒤에서 누가 더 나온다.
> emit supply stolen
> emit combat passenger
> end
-- refuse
passenger(hurt): …아깝네.
narr: 승객의 손에 쇠파이프가 들려 있다.
> agent combat
> emit combat passenger
> end

=== passenger_signs
// 표시 체계 무리: 벽 기호 읽는 법을 알려 준다.
passenger: 쉿. 벽 봤어? 우리가 남긴 거야.
passenger: 동그라미는 안전. 세모는 수호자. 가위표는… 거기서 누가 안 돌아왔다는 뜻.
passenger: 너희도 남겨. 다음 사람을 위해서.
> agent find
> emit signs learn
> end

=== passenger_missing
// 구조 대상: 야근하다 들어온 회사원 (임무 m4). late=1이면 「더는 사람이 아닌 것」.
> goto late if late
survivor(hurt): …관리국? 진짜요? 저 그냥 야근하고 집에 가려고…
survivor(hurt): 몇 층인지 모르겠어요. 계속 내려가기만 했어요.
> agent rescue
* 따라오라고 한다 -> lead
* 업는다 -> carry [if agent == 'gorgodio' || agent == 'jyaldi']
-- lead
survivor: 네, 네. 뒤돌아보지 않을게요.
> emit rescue follow
> end
-- carry
survivor(surprise): 어, 어어…
> emit rescue carry
> end
-- late
survivor: …관리국? 진짜요? 저 그냥 야근하고…
narr: 목소리는 그대로인데, 얼굴이 따라오지 않는다.
survivor: …집에. 가려고. 가려고. 가려고.
> agent boss
> emit combat nothuman
> end

=== not_human
// 승객 옷을 입은 것. 규칙 위반 시 깨어난다.
narr: 벽에 기대 선 승객. 숨을 쉬지 않는다.
> goto wake if broke_rule
> end
-- wake
narr: 승객이 고개를 든다. 얼굴이 따라오지 않는다.
> agent combat
> emit combat nothuman
> end

=== mirror
// 엘리베이터 홀의 거울 (규칙 5). 내리면 안전, 타면 예산+30%·보상+30%.
narr: 거울 속 얼굴이 피곤해 보인다.
* 내린다 -> off
* 그래도 탄다 -> on
-- off
> agent find
> emit rule mirror
> end
-- on
> agent boss
> emit mirror risk
> end

=== exit_panel
// 패널에 EXIT. 조건: 규칙 10줄 + 총애 3 + B-12 도달 (설계서 7장)
> goto locked if rules < 10 || favor < 3 || !reached_b12
> emit cutscene exit
> end
-- locked
> line el:exitBlocked elevator
> end
`;
