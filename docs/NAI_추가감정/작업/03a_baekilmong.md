# 03a 백일몽 (백석주·진나솔·이성해·이자헌·은하제·박민성·백사헌·고영은)

> 2026-10-27 수정: 가중치(`1.15::`)와 손에 든 소품(담배·컵·서류·휴대폰·마이크·동물 등)을 전부 뺐다. 아래 「읽은 방식」에 소품 얘기가 남아 있으면 옛 설명이고, 프롬프트 칸이 현재 값이다.
>
> 2026-10-27 재작성: 모든 장면에 팔·손 동작 1개와 몸 자세(권장)를 넣었다. 소품은 버릇 몸짓으로 바꿨다(담배 → 주머니에 손 넣기, 체크리스트 → 손가락 세우고 잔소리 등). 가중치는 묻히기 쉬운 핵심 동작이나 기본 얼굴과 반대인 표정에만 장면당 한 묶음 걸었고, 이유를 「읽은 방식」에 적었다.

기존 그림 확인: 8명 모두 가면 없이 눈이 보이는 정장 상반신 그림이다. 그래서 눈 태그를 그대로 쓴다. 가면은 코드가 얹는다.

## 백석주 (Baek Seok-ju)

성향: 「사람 좋게 웃는 입가」가 기본이고, 화가 나도 입은 웃은 채 눈만 바뀐다(늘어지면 가늘어지고, 조원이 다치면 핏발). 버릇은 감탄할 때 박수, 사과를 받아 주지 않을 때 손 휘휘 젓기, 「내가 네 나이 때는」 잔소리. 자기 조원은 끝까지 지키고 조 밖은 시야에 없다. 이자헌 앞에서는 얼음장 같은 존댓말. 그림 기본 자세는 팔짱·허리에 손.
고정 특징: `ring`(치유 반지). 늘 끼는 장비이고 기존 그림 손가락에도 보여 15장 모두에 붙였다.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, smile, closed mouth, looking at viewer, head tilt, hand on own chin, ring,` | 웃는 채 고개 기울이고 턱 괴고 사람 값 매기기 |
| worried | `1.15::worried::, furrowed brow, closed mouth, looking back, own hands clasped, ring,` | 뒤의 조원을 돌아보며 두 손을 모음. 기본이 웃는 얼굴이라 걱정 표정에 가중치 |
| relieved | `smile, closed eyes, open mouth, sigh, head back, hand on own chest, ring,` | 「우리 애들 다 나왔어?」 확인 후 고개 젖히고 가슴 쓸어내림 |
| disgusted | `disdain, half-closed eyes, light smile, closed mouth, looking down, leaning back, crossed arms, ring,` | 이자헌 앞의 얼음장 존댓말. 몸을 빼고 팔짱, 웃음은 남김 |
| determined | `smile, confident, open mouth, looking at viewer, leaning forward, index finger raised, ring,` | 「규칙과 명령은 지켜」. 손가락 세우고 잔소리 겸 작전 지시 |
| jealous | `smug, raised eyebrow, smile, sideways glance, upper body turned, hand on own hip, ring,` | 질투 대신 「그래도 우리 나솔이가」. 몸 틀고 허리에 손 |
| pleading | `raised inner eyebrows, open mouth, sweat, tired, leaning forward, 1.15::reaching towards viewer::, ring,` | 애원 대신 탈진에서 깨어나 「우리 애들은?」 손 뻗기. 정면으로 뻗는 손은 잘 안 나와 가중치 |
| forced smiling | `forced smile, sweatdrop, looking away, head tilt, hand on own cheek, ring,` | 소원권 이야기를 웃으며 돌림. 뺨에 손 |
| indifferent | `smile, half-closed eyes, closed mouth, looking away, upper body turned, 1.15::waving::, ring,` | 「백 과장 사과 반려」 손 휘휘. 이 캐릭터의 핵심 몸짓이라 가중치 |
| guilty | `sad smile, shaded face, closed mouth, looking down, head down, hand on own face, ring,` | 반지로도 못 끌어낸 조원. 반지 낀 손으로 얼굴을 쓸어내림 |
| pouting | `annoyed, frown, open mouth, looking at viewer, leaning forward, hands on own hips, ring,` | 토라짐 대신 「소원권 언제 쓰세요?」에 잔소리 개시. 양손 허리 |
| angry smile | `smile, 1.2::bloodshot eyes::, glaring, closed mouth, shaded face, leaning forward, clenched hand, ring,` | 「핏발 선 눈으로 웃는 입가」. 핏발은 드문 태그라 묻히지 않게 가중치 |
| expressionless | `1.15::expressionless::, half-closed eyes, closed mouth, looking at viewer, crossed arms, ring,` | 웃음이 꺼진 얼굴은 이자헌 앞에서만. 기본 미소가 새어 나오지 않게 가중치 |
| tormented | `empty eyes, parted lips, tired, shaded face, sweat, looking up, head back, hand on own forehead, ring,` | 갇힌 조원 소식에 「한참 천장만 봤다」. 이마 짚고 고개 젖힘 |
| crazy smile | `crazy smile, constricted pupils, open mouth, looking at viewer, leaning forward, 1.15::clapping::, ring,` | 매뉴얼 없이 던진 사람이 버티는 걸 보며 박수(「아주 좋아」). 박수가 핵심 버릇이라 가중치 |

## 진나솔 (Jin Na-sol)

성향: 지루하고 날카로운 얼굴. 표정 신호는 셋이다. 혀 차기는 경멸, 한쪽 눈썹은 「알아서 해」, 완전한 무표정은 진짜 화남. 화나면 목소리가 오히려 낮아진다. 만성 편두통으로 머리를 짚고, 관자놀이에 핏줄이 선다. 짜증 나면 네일을 만지작거린다. 웃는 건 거의 정산 직후뿐이고, 보상 이야기가 나오면 포식자 눈빛이 된다. 그림 기본 자세는 팔짱·허리에 손·머리 짚기.
고정 특징: `nail art`. 기존 그림에 검정·금 장식 긴 손톱이 분명하고 위키 장비라 15장 모두 유지했다.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, expressionless, closed mouth, looking at viewer, leaning forward, hand on own chin, nail art,` | 몸을 숙여 턱 괴고 동선·비밀 계산 |
| worried | `furrowed brow, annoyed, closed mouth, anger vein, head down, hand on own forehead, nail art,` | 걱정 대신 편두통이 올라옴(「아, 짜증 나. 진짜 번거롭네」). 이마 짚기 |
| relieved | `light smile, half-closed eyes, closed mouth, looking to the side, leaning back, hand in pocket, nail art,` | 웃는 건 정산 직후뿐. 주머니에 손 넣고 몸을 뒤로 |
| disgusted | `disdain, half-closed eyes, closed mouth, looking down, leaning back, crossed arms, nail art,` | 혀 차는 소리. 팔짱 끼고 내려다봄 |
| determined | `serious, narrowed eyes, closed mouth, looking at viewer, leaning forward, pointing at viewer, nail art,` | 「두 번 말하게 하는 거 싫어해」. 목소리 대신 손톱 끝으로 지목 |
| jealous | `annoyed, raised eyebrow, closed mouth, sideways glance, looking back, hand on own hip, nail art,` | 질투 대신 남이 더 큰 보상을 챙길 때. 어깨 너머 곁눈과 눈썹 몇 밀리 |
| pleading | `serious, half-closed eyes, sweat, anger vein, looking at viewer, 1.15::outstretched hand::, nail art,` | 애원 대신 지휘권 이양 「지금 내 판단 믿지 마. 네가 해.」 손을 내밀어 넘김. 핵심 동작이라 가중치 |
| forced smiling | `1.15::forced smile::, half-closed eyes, anger vein, looking away, head tilt, hand on own shoulder, nail art,` | 조장이 두드린 어깨를 짚으며 참는 억지 미소. 웃음이 드문 얼굴이라 가중치 |
| indifferent | `bored, closed eyes, closed mouth, leaning back, crossed arms, nail art,` | 「나 잘 거니까 말 걸지 마」. 팔짱 끼고 눈 감음 |
| guilty | `guilt, frown, averting eyes, closed mouth, head down, hand on own arm, nail art,` | 틀렸을 때 즉시 사과. 1초 1초를 원망하며 팔을 붙잡음(기존 sad 그림의 팔 잡기) |
| pouting | `annoyed, frown, closed mouth, looking at hand, head down, own hands together, nail art,` | 짜증 나면 네일 만지작. 두 손을 모아 손톱을 봄 |
| angry smile | `1.15::light smile::, empty eyes, shaded face, closed mouth, looking at viewer, leaning forward, hand on own hip, nail art,` | 화나면 목소리가 낮아짐. 다가서며 얕은 미소. 웃음에 가중치 |
| expressionless | `expressionless, staring, closed mouth, shaded face, looking at viewer, crossed arms, nail art,` | 완전한 무표정 = 진짜 화남. 팔짱(기존 angry 그림과 같은 자세) |
| tormented | `clenched teeth, furrowed brow, one eye closed, sweat, anger vein, hunched over, hands on own head, nail art,` | 편두통 최악. 몸을 웅크리고 두 손으로 머리를 감쌈 |
| crazy smile | `1.15::grin::, constricted pupils, shaded face, looking at viewer, leaning forward, clenched hand, nail art,` | 비싼 보상 앞 포식자 눈빛, 「매뉴얼 갱신급 정보!」 움켜쥠. 지루한 얼굴이 기본이라 이 드러낸 웃음에 가중치 |

## 이성해 (Lee Seong-hae)

성향: 「늘 웃는 얼굴」이고 돕든 처리하든 미소 각도가 1도도 안 바뀐다. 연기가 아니다. 남의 감정은 읽지만 본인은 거의 느끼지 않는다(가족 상봉 앞에서 갸웃). 버릇은 꾸벅 인사(「죄송해여!」), 손 흔드는 배웅, 고개 갸웃, 「알겠습니다아!」. 기존 그림도 거의 전부 웃는 얼굴이고, 몸을 숙이고 뒷짐을 지거나 두 손을 모은다.
고정 특징: 없음(초록 눈은 기본 그림이 맡음).
바꿔 읽기: 부정 감정 대부분을 「같은 미소 + 그늘·눈빛」으로 내고, 감정 차이는 몸짓으로 갈랐다.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smile, half-closed eyes, closed mouth, looking at viewer, leaning forward, arms behind back,` | 뒷짐 지고 몸을 숙여 들여다봄. 미세한 긴장을 읽는 중(지명 비서 감시) |
| worried | `smile, raised inner eyebrows, open mouth, leaning forward, 1.15::reaching towards viewer::,` | 「괜찮아여? 다친 데 없어여?」 손 내밂. 정면으로 뻗는 손은 잘 안 나와 가중치 |
| relieved | `smile, closed eyes, open mouth, head back, hand on own chest,` | 「다들 데리고 나왔어여!」 |
| disgusted | `smile, half-closed eyes, shaded face, closed mouth, looking down, upper body turned, pointing,` | 「그분은 우리 팀 아니에여.」 같은 미소로 가리키기 |
| determined | `smile, closed eyes, open mouth, head tilt, 1.15::salute::,` | 처형 임무에 「알겠습니다아!」. 경례가 핵심이라 가중치 |
| jealous | `smile, sideways glance, closed mouth, blush, looking back, hand on own cheek,` | 좋아하는 진나솔 곁의 다른 사람을 웃으며 돌아봄 |
| pleading | `smile, raised inner eyebrows, open mouth, looking at viewer, head tilt, own hands together,` | 「나중에 부탁 하나만 해도 돼여? 나쁜 건 아니에여!」 손 모으고 갸웃 |
| forced smiling | `smile, closed eyes, sweatdrop, closed mouth, head down, own hands clasped,` | 억지 미소가 없는 사람. 백석주 잔소리를 끝까지 공손히 웃으며 들음 |
| indifferent | `light smile, empty eyes, closed mouth, looking away, upper body turned, arms behind back,` | 처리한 사람은 관심에서 사라짐. 뒷짐 지고 돌아섬 |
| guilty | `smile, closed eyes, sweatdrop, open mouth, 1.15::bowing::, own hands together,` | 죄책감 대신 「늦어서 죄송해여!」 꾸벅. 인사가 핵심이라 가중치 |
| pouting | `1.15::pout, puffy cheeks::, blush, looking at viewer, head tilt, hands on own hips,` | 진나솔이 간식 대신 혀를 찼을 때 장난스런 볼. 미소가 기본이라 볼에 가중치 |
| angry smile | `smile, glowing eyes, shaded face, closed mouth, looking at viewer, leaning forward, index finger raised,` | 「미친놈이네여」 판결 선고. 손가락 하나 세움 |
| expressionless | `light smile, staring, closed mouth, looking at viewer, own hands clasped,` | 무표정이 없는 사람이라 기본값인 고정 미소(기존 happy 그림의 손 모음) |
| tormented | `smile, tired, shaded face, closed mouth, sweat, looking down, hunched over, hand on own arm,` | 혼자 살아 돌아온 밤. 미소는 그대로, 팔을 붙잡고 웅크림 |
| crazy smile | `smile, closed eyes, shaded face, open mouth, head tilt, 1.2::waving::,` | 닫히는 문 너머로 웃으며 손 흔드는 배웅. 장면의 전부라 가중치 |

## 이자헌 (Lee Ja-heon)

성향: 표정이 없고 조각상처럼 꼿꼿하며 말은 「예」뿐이다. 두려움이 없고 독설은 문자 그대로만 받아들인다. 애정은 행동으로만 보인다(보고서 열두 번 수정, 맨 뒤를 혼자 막기). 괴담이 요구하면 완벽한 미소를 연기했다가 스위치 끄듯 내린다. 괴력이고, 드물게 흰 도마뱀(붉은 세로 동공)으로 보인다는 목격담이 있다. 그림 기본 자세는 팔 잡기·손 모으기·뒷짐.
고정 특징: 없음(그림은 맨손).
바꿔 읽기: 얼굴은 대부분 `expressionless`로 두고, 감정은 몸짓(막아서기·거절의 손·주먹·보고서 쓰던 손)으로 갈랐다. 웃음 세 장(forced smiling·angry smile·crazy smile)은 괴담 안에서 연기하는 미소다.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `expressionless, narrowed eyes, closed mouth, looking down, head tilt, crossed arms,` | 「권장되는 행동이 아닙니다.」 팔짱 끼고 내려다봄 |
| worried | `expressionless, serious, closed mouth, looking back, upper body turned, outstretched arm,` | 걱정은 동선으로. 뒤를 돌아보며 팔로 조원을 막아섬(맨 뒤를 혼자 막은 일화) |
| relieved | `expressionless, half-closed eyes, closed mouth, bowing, hand on own chest,` | 신입이 돌아왔을 때 「확인했습니다」(=고맙다). 가슴에 손 얹고 짧게 숙임 |
| disgusted | `expressionless, frown, closed mouth, looking at viewer, leaning back, outstretched hand,` | 혐오 대신 상대가 누구든 「거절합니다.」 손바닥으로 막음 |
| determined | `expressionless, serious, closed mouth, looking at viewer, 1.15::cracking knuckles::,` | 철문 앞 「잠시 물러나 계십시오.」 손가락 꺾기. 손동작이 작아 묻히기 쉬워 가중치 |
| jealous | `expressionless, sideways glance, closed mouth, looking back, crossed arms,` | 질투는 없음. 백석주 연례행사에 무표정한 곁눈 |
| pleading | `expressionless, raised inner eyebrows, closed mouth, pale skin, looking at viewer, head down, hand on own arm,` | 피 흘리는 팔을 붙잡고 「출구를 찾는 것을 권장합니다」(은하제 번역: 제발) |
| forced smiling | `1.2::light smile::, empty eyes, closed mouth, looking at viewer, head tilt, hand on own chest,` | 괴담이 요구한 연기 미소, 정중히 가슴에 손. 무표정 기본값이라 미소에 가중치 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking at viewer, arms behind back,` | 독설이 그대로 통과. 뒷짐 지고 꼿꼿이 「예.」 |
| guilty | `expressionless, shaded face, closed mouth, looking down, head down, interlocked fingers,` | 조원을 잃고 한 달 넘게 고쳐 쓴 사고 보고서. 깍지 끼고 고개 숙임(기존 happy 그림의 손) |
| pouting | `expressionless, raised eyebrow, closed mouth, head tilt, hand on own chin,` | 토라짐 대신 「무섭게 말하는 방법을 모릅니다」. 턱 짚고 진지하게 생각 |
| angry smile | `1.15::light smile::, glaring, shaded face, closed mouth, leaning forward, clenched hand,` | 괴담 안의 연기 미소와 문을 뜯는 주먹. 미소에 가중치 |
| expressionless | `expressionless, staring, closed mouth, looking at viewer, adjusting necktie,` | 규정 그대로의 정장, 넥타이 고쳐 매기 |
| tormented | `expressionless, sweat, shaded face, closed mouth, looking at hand, head down, clenched hand,` | 주먹이 안 먹힌 날. 주먹을 내려다보며 「다른 방법이 있습니까?」 |
| crazy smile | `1.2::smile::, slit pupils, empty eyes, closed mouth, shaded face, looking at viewer, head tilt, outstretched hand,` | 도마뱀 목격담. 세로 동공에 괴담용 매력 미소, 손을 내밂. 미소에 가중치 |

## 은하제 (Eun Ha-je)

성향: 피곤한 눈에 차가운 무표정, 그런데 눈은 매처럼 밝다. 전직 기자라 일단 의심한다. 시그니처는 담배를 꺼냈다가 안 피우고 도로 넣기(→ 소품 금지라 「주머니에 손」으로 냄). 그 밖에 긴 한숨, 짜증 나면 단발 쓸어 넘기기, 털썩 주저앉기, 온몸 기지개가 있다. 「좀 곤란한데」는 전멸 직전까지 포괄하는 축소 화법이다. 남의 과실은 날짜·시각을 짚어 가며 물어뜯는다. 그림 기본 자세는 팔짱·허리에 손·뺨 괴기.
고정 특징: 없음(맨손).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, skeptical, closed mouth, looking at viewer, leaning back, crossed arms,` | 공식 브리핑의 허점 세 개. 몸 빼고 팔짱 |
| worried | `expressionless, sweat, half-closed eyes, looking to the side, head down, hand in pocket,` | 「좀 곤란한데」 + 주머니 속 담배에 손(꺼내기 직전) = 뛰어야 함 |
| relieved | `light smile, tired, half-closed eyes, sigh, stretching,` | 「왔냐?」 한숨 뒤 온몸 기지개 |
| disgusted | `disgust, narrowed eyes, frown, shaded face, looking away, upper body turned, hand in own hair,` | 회사를 대놓고 경멸. 고개 돌리고 단발 쓸어 넘김 |
| determined | `serious, narrowed eyes, closed mouth, looking at viewer, leaning forward, pointing,` | 「민성아.」 한마디와 손짓으로 지시 끝 |
| jealous | `smirk, half-closed eyes, sideways glance, looking back, crossed arms,` | 질투 대신 남의 조 포상 소식에 코웃음 |
| pleading | `tired, raised inner eyebrows, closed mouth, looking at viewer, head tilt, palm up,` | 「그만두는 것도 나쁜 선택지는 아니야」. 진심으로 손바닥을 펴 선택지를 내밂 |
| forced smiling | `forced smile, half-closed eyes, looking away, head tilt, hand on own neck,` | 「또라이들 뒷조사로 먹고살던 사람이야」. 목 주무르며 뒷문장을 웃음으로 막음 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking away, slouching, hands in pockets,` | 「응, 그래. 됐고.」 구부정하게 양손 주머니 |
| guilty | `empty eyes, shaded face, closed mouth, looking down, head down, hand in pocket,` | 제보자들. 소원 질문에 담배를 꺼냈다가 도로 넣는 손 |
| pouting | `annoyed, frown, half-closed eyes, sigh, head back, hand on own forehead,` | 비꼬는 말이 안 통하는 이자헌 앞에서 고개 젖히고 이마 짚는 한숨 |
| angry smile | `smirk, glaring, shaded face, closed mouth, looking at viewer, leaning forward, 1.15::index finger raised::,` | 날짜·시각을 하나하나 짚는 공개 브리핑(「송골매한테 찍혔다」). 손가락이 작아 가중치 |
| expressionless | `expressionless, tired, half-closed eyes, closed mouth, looking at viewer, slouching, hand on own hip,` | 피곤한 눈의 차가운 기본값, 힘 뺀 구부정한 몸 |
| tormented | `clenched teeth, wide-eyed, shaded face, sweat, looking down, hunched over, clenched hand,` | 괴담 안에서 「배신자」라고 불린 순간 |
| crazy smile | `smirk, glowing eyes, narrowed eyes, shaded face, looking at viewer, head tilt, hand in own hair,` | 매처럼 밝은 눈으로 「그냥 찍을 준비나 해」, 머리를 쓸어 넘김 |

## 박민성 (Park Min-seong)

성향: 덩치 크고 순한 얼굴에 겁이 많다. 땀을 뻘뻘 흘리면서도 자리를 지키다가 결국 씩 웃어 버린다. 들키면 머리를 긁적이고, 출발 전에는 기지개와 한숨, 「아이고, 그래, 내가 간다, 가.」 공은 손사래 치며 남에게 넘긴다. 감정에 솔직해서 제일 크게 웃고 운다. 현장 직전에 동생 사진을 한 번 본다. 그림 기본 자세는 주먹 쥐고 숙이기·엄지·허리에 손.
고정 특징: 없음. 땀(`sweat`)을 대부분 장면에 넣어 「겁먹은 채 버팀」을 살렸다. 가중치는 걸지 않았다(감정이 얼굴에 그대로 나오는 사람이라 지워질 표정이 없고, 몸짓도 큼).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, sweat, frown, sideways glance, leaning back, hand on own chin,` | 옛 상사의 밥 약속이 한탕 섭외라는 걸 눈치챔. 몸을 빼고 턱 짚기 |
| worried | `worried, raised inner eyebrows, sweat, closed mouth, looking down, head down, own hands clasped,` | 돌아오지 않는 신입, 분 단위로 셈. 두 손을 꽉 모음 |
| relieved | `smile, tears, closed eyes, open mouth, head back, spread arms,` | 5분째 기어 나온 신입을 끌어안으려 팔을 벌림. 제일 크게 웃고 운다 |
| disgusted | `disgust, sweat, wavy mouth, looking away, leaning back, hands up,` | 기계인 척 20분 뒤 「다시는 안 해」. 손 들고 질색 |
| determined | `sigh, sweat, smile, closed eyes, stretching,` | 기지개 + 한숨 + 「아이고, 그래, 내가 간다, 가.」 = 출발 신호 |
| jealous | `pout, sideways glance, blush, looking back, scratching cheek,` | 신입들이 다른 선배만 찾을 때. 숨기지 못하는 서운함 |
| pleading | `raised inner eyebrows, tearing up, open mouth, sweat, looking at viewer, leaning forward, own hands together,` | 「5분만요. 딱 5분만.」 손 모아 매달림 |
| forced smiling | `forced smile, sweat, nervous, looking to the side, hunched over, hand on own neck,` | 백석주·이자헌 연례행사 사이에서 어색하게 목 주무르며 웃음 |
| indifferent | `light smile, closed eyes, sweatdrop, head tilt, waving,` | 무관심이 없는 사람. 「에이, 내가 한 거 하나도 없어」 손사래 |
| guilty | `guilt, sweat, wavy mouth, looking down, head down, scratching head,` | 희망을 일찍 놓았다가 은하제에게 「아직 아니거든」. 들키면 머리 긁적 |
| pouting | `pout, sulking, sweatdrop, looking to the side, slouching, hand on own cheek,` | 모방 머플러로 아무도 못 알아봐서 서운. 볼 문지르기 |
| angry smile | `smile, furrowed brow, clenched teeth, sweat, leaning forward, clenched hands,` | 옛 상사의 한탕 제안을 웃으며 거절. 추억이 망가진 분노(기존 angry 그림의 주먹) |
| expressionless | `expressionless, closed mouth, looking down, head down, hand on own chest,` | 현장 직전 동생 사진을 보는 짧은 고요. 안주머니 쪽 가슴에 손 |
| tormented | `streaming tears, clenched teeth, furrowed brow, sweat, hunched over, hands on own head,` | 「살아 있는 애들」 앨범에 못 들어간 신입. 머리 감싸고 웅크림 |
| crazy smile | `grin, wide-eyed, nervous sweating, constricted pupils, trembling, thumbs up,` | 무서워 죽겠는데 결국 씩 웃으며 엄지(기존 happy 그림의 엄지) |

## 백사헌 (Baek Sa-heon)

성향: 마르고 허약해 보이는 「독사」. 표정은 순서가 정해져 있다. 비웃음 → 흰자위를 드러낸 분노 → 이를 악문 억지 미소(줄 갈아타는 중). 얼굴이 쉽게 붉어지거나 창백해진다. 바늘 박힌 존댓말을 쓰다가 진짜 위협 앞에서는 아첨 모드로 뒤집힌다(「사흘 치 월급」). 감사 인사에 약해 멈칫하고 「아직 빚 남았거든요」라고 한다. 숨을 때는 숨소리까지 죽인다. 모퉁이 앞에서 안대를 살짝 들어 확인한다. 그림 기본 자세는 주먹·손 모아 비비기·턱 짚기.
고정 특징: `eyepatch`. 위키 「집에서도 벗지 않는다」, 기존 그림에도 왼쪽 눈 안대가 늘 보여 15장 모두 유지했다. 눈 하나는 보이므로 눈 태그는 쓴다.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, frown, closed mouth, looking to the side, leaning forward, 1.15::hand on own face::, eyepatch,` | 모퉁이 앞 안대 쪽 얼굴에 손 대고 위험 확인(트레이드마크). 손이 안대에 가야 읽히므로 가중치 |
| worried | `nervous sweating, raised inner eyebrows, wavy mouth, pale skin, sideways glance, hunched over, hand on own neck, eyepatch,` | 계산이 안 되는 상대 앞 식은땀, 창백, 움츠림 |
| relieved | `smirk, half-closed eyes, sweat, looking at viewer, head tilt, palm up, eyepatch,` | 덕트 여섯 시간 뒤 「제 몫 포인트는 생존 시간으로 계산되나요?」 손바닥 내밀어 청구 |
| disgusted | `disdain, smirk, half-closed eyes, looking down, leaning back, hand on own hip, eyepatch,` | 힘없는 사람·낙관론을 내려다보며 비웃음 |
| determined | `clenched teeth, glaring, furrowed brow, blush, leaning forward, pointing at viewer, eyepatch,` | 자리를 내준 동료에게 「포기하지 말고 생각 좀 하라고요!」 삿대질, 붉어지는 얼굴 |
| jealous | `smirk, narrowed eyes, sideways glance, head tilt, hand on own chin, eyepatch,` | 강이학과 전리품 협상. 상대가 더 챙긴다고 확신하는 곁눈(기존 thinking 그림의 턱 짚기) |
| pleading | `forced smile, nervous sweating, pale skin, bowing, own hands together, eyepatch,` | 아첨 모드 「사흘 치 월급 더 입금해 드릴까요?」 허리 숙이고 손 비비기 |
| forced smiling | `forced smile, clenched teeth, sweat, shaded face, head down, clenched hands, eyepatch,` | 세 번째 표정: 이 악문 억지 미소, 줄 갈아타는 중(기존 angry 그림의 주먹) |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking away, slouching, hands in pockets, eyepatch,` | 「어차피 죽을 사람들인데요.」 숨긴 물건이 든 주머니에 손 |
| guilty | `blush, wavy mouth, averting eyes, sweatdrop, upper body turned, scratching cheek, eyepatch,` | 죄책감은 없음. 감사 인사에 멈칫, 「아직 빚 남았거든요」 |
| pouting | `annoyed, frown, half-closed eyes, closed mouth, looking to the side, crossed arms, eyepatch,` | 「일을 복잡하게 만드시네.」 |
| angry smile | `smile, constricted pupils, glaring, shaded face, anger vein, head tilt, index finger raised, eyepatch,` | 바늘 박힌 존댓말 「…사회적 약속 아니었나요? 네?」 손가락 세워 훈계, 흰자위 드러냄 |
| expressionless | `expressionless, staring, looking to the side, hunched over, hand over own mouth, eyepatch,` | 은신 중 입을 막고 숨소리까지 죽인 완전한 집중 |
| tormented | `scared, constricted pupils, nervous sweating, clenched teeth, pale skin, trembling, hands up, eyepatch,` | 이해할 수 없는 정신 앞 공포, 즉시 손 들고 고분고분 |
| crazy smile | `crazy smile, wide-eyed, shaded face, looking at viewer, head back, spread arms, eyepatch,` | 입사 첫 한 시간, 눈을 잃고도 살아남아 웃던 얼굴. 팔 벌리고 고개 젖힘 |

## 고영은 (Go Young-eun)

성향: 표정이 정직하다(공포 → 일하는 침착함 → 창백·피로). 긴 작전 뒤에는 눈이 빨갛다. 마음을 다잡을 때 단발을 뒤로 넘긴다. 평소엔 따뜻한 해요체, 위기엔 「영은 쌤 모드」의 엄한 반말. 사람이 먼저라 백사헌 앞에서만 날카로워진다. 자기를 버린 R조 조장에게도 끝까지 해요체로 공손하지만 이름은 안 부른다. 그림 기본 자세는 삿대질하며 숙이기·손 흔들기·입에 손.
고정 특징: 없음. 귀 봉합 자국은 머리에 가려 그림에 안 보이고, 헤드램프·구급상자도 그림에 없어 쓰지 않았다.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `furrowed brow, narrowed eyes, closed mouth, looking to the side, head tilt, hand on own chin,` | 괴담 판본들이 서로 모순된다며 턱 짚고 소리 내어 따지는 중 |
| worried | `worried, raised inner eyebrows, open mouth, leaning forward, 1.15::reaching towards viewer::,` | 「괜찮아요? 어디 다쳤어요?」 다가가 손 뻗기. 정면으로 뻗는 손은 잘 안 나와 가중치 |
| relieved | `smile, tearing up, tired, half-closed eyes, head tilt, hand on own chest,` | 「그래도 사람이 살았잖아요」. 빨개진 눈, 가슴 쓸어내림 |
| disgusted | `disgust, glaring, frown, shaded face, upper body turned, outstretched hand,` | 백사헌의 목 따자는 제안 앞 「손대지 마세요.」 몸으로 막고 손 뻗어 저지 |
| determined | `serious, v-shaped eyebrows, open mouth, looking at viewer, leaning forward, pointing at viewer,` | 영은 쌤 모드 「최선을 다하고, 협조해. 알겠어?」(기존 angry 그림의 삿대질) |
| jealous | `pout, blush, looking to the side, hunched over, hand on own arm,` | 남의 몫을 챙기느라 늘 바닥인 포인트. 정산 자리에서 팔을 잡고 움츠린 정직한 서운함 |
| pleading | `raised inner eyebrows, tearing up, open mouth, looking at viewer, leaning forward, own hands clasped,` | 「그 사람 아직 살아 있어요.」 손 모아 매달림 |
| forced smiling | `forced smile, sweatdrop, looking away, head tilt, scratching cheek,` | 「관리국이 더 어울린다」를 들을 때마다 어색한 웃음 |
| indifferent | `half-closed eyes, sigh, tired, closed mouth, looking away, shrugging,` | 백오십 번째 「관리국」에 한숨과 어깨 으쓱, 「그쪽은 야근 수당 나와요?」 |
| guilty | `guilt, tearing up, looking down, head down, hand over own mouth,` | 못 데려 나온 사람, 전해지지 못한 감사 인사(기존 sad 그림의 입에 손) |
| pouting | `pout, annoyed, half-closed eyes, sideways glance, leaning back, crossed arms,` | 백사헌 앞에서만 날카로워지는 해요체 |
| angry smile | `smile, half-closed eyes, shaded face, closed mouth, bowing, own hands together,` | 자기를 버린 R조 조장에게 끝까지 공손한 미소와 인사. 이름은 안 부름 |
| expressionless | `expressionless, serious, closed mouth, looking down, head down, 1.15::tucking hair::,` | 단발을 넘기며 마음을 다잡음, 중증도 분류의 냉정함. 머리 넘기기가 작아 가중치 |
| tormented | `tears, clenched teeth, furrowed brow, shaded face, looking down, hunched over, clenched hands,` | 임종을 끝까지 지킨 동료 |
| crazy smile | `crazy smile, tired, empty eyes, sweat, head back, hand on own forehead,` | 층 하나를 혼자 정리하고 나와 「이제 진짜 지긋지긋해요」. 이마 짚고 실성한 웃음 |
