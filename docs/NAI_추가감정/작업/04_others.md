# 04 기타 · 추가 감정 15종 (설정 반영)

> 2026-10-27 수정: 가중치(`1.15::`)와 손에 든 소품(담배·컵·서류·휴대폰·마이크·동물 등)을 전부 뺐다. 아래 「읽은 방식」에 소품 얘기가 남아 있으면 옛 설명이고, 프롬프트 칸이 현재 값이다.

2026-10-27 · 규칙은 `../규칙.md`. 캐릭터마다 위키(`card/wiki-base.json`)·기존 표정 그림·동작표를 보고 짰다.

## Cha Yeo-jin (차여진)

성향: 밝고 가벼운 반말, 대화 중 몸을 기울임. 웃음이 반 박자 늦게 시작된다(계산이 끝난 뒤 = 「결재 완료」). 친절이 곧 영업이라 부정적 감정도 웃음 밑에 깔린다. 진짜로 굳는 순간은 계약서를 끝까지 읽는 손님·수수료 표준화·감사 시즌·옆자리 서윤지뿐. 부고 뒤에도 「아무튼, 너 이번 주에 시간 돼?」. 고정 특징 없음(그림에 안경·장갑·소품 없음, 휴대전화·수첩은 그림에 없어 안 씀).

고정 특징: 없음

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `light smile, narrowed eyes, closed mouth, sideways glance, holding own arm,` | 계약서 끝까지 읽는 손님 — 웃음은 두고 눈만 계산 |
| worried | `worried, furrowed brow, closed mouth, sideways glance, hand on own neck,` | 감사 시즌, 옆자리(서윤지) 흘끔 — 웃음이 꺼지는 드문 때 |
| relieved | `light smile, closed eyes, closed mouth, head tilt, hand on own chest,` | 서명 받은 직후 「결재 완료」의 작은 미소 |
| disgusted | `light smile, disdain, half-closed eyes, looking down, crossed arms,` | 수수료 표준화 꺼내는 동료 — 웃는 얼굴로 깔봄 |
| determined | `smile, narrowed eyes, closed mouth, looking at viewer, outstretched hand,` | 표적 찍음, 「특별한 의뢰」를 내미는 손 |
| jealous | `jealous, pout, sideways glance, crossed arms,` | 단골이 서윤지 창구로 감 — 옆자리 곁눈 |
| pleading | `smile, raised inner eyebrows, head tilt, looking at viewer, own hands together,` | 애원 대신 「우리 친구잖아?」 우정 카드 |
| forced smiling | `forced smile, sweatdrop, half-closed eyes, head tilt, looking at viewer,` | 계약서를 소리 내 읽는 손님 앞 「미소가 아주 조금 굳는다」 |
| indifferent | `light smile, half-closed eyes, bored, looking away, hand on own hip,` | 「아 진짜 아깝다. 아무튼」 — 밝은 무관심 |
| guilty | `nervous smile, averting eyes, sweatdrop, scratching cheek,` | 죄책감 대신 두 번째 폰을 물었을 때 「아 이거? 개인 폰이야~」 |
| pouting | `pout, half-closed eyes, looking at viewer, head tilt, hand on own hip,` | 「에이~」 영업용으로 일부러 삐친 척 |
| angry smile | `smile, shaded face, narrowed eyes, closed mouth, looking at viewer, pointing at viewer,` | 미소 그대로 「네 파일」을 짚음 — 의뢰가 다른 사람한테 넘어가는 순간 |
| expressionless | `expressionless, half-closed eyes, closed mouth, looking at viewer, holding own arm,` | 웃음 시작 전 반 박자 = 계산 중인 얼굴 |
| tormented | `gritted teeth, furrowed brow, nervous sweating, shaded face, looking to the side, clenched hand,` | 무너짐 대신 감사·서윤지 수첩에 몰린 얼굴 |
| crazy smile | `smirk, half-closed eyes, shaded face, looking at viewer, leaning forward, finger to mouth,` | 목소리 낮추며 「아무한테나 안 보여 줘」 — 그림 serious의 쉿 손 |

## Seo Yun-ji (서윤지)

성향: 표정 변화가 거의 없다(목격담이 「눈썹 1밀리미터」「눈 한 번 깜빡」일 정도). 반쯤 감긴 눈, 꼿꼿한 자세, 녹음 재생 같은 격식체. 다 보이지만 절차 안에 들이지 않는다. 슬픔 대신 책임에 대한 공포, 감정 대신 기록. 그래서 15장 모두 진폭을 아주 작게, 손은 그림처럼 앞에 모으거나 없이. 고정 특징 wristwatch(왼손목 무음 전자시계 — 위키 핵심 소품, 그림 전부에 있음).

고정 특징: wristwatch

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `raised eyebrow, half-closed eyes, expressionless, closed mouth, looking at viewer, wristwatch,` | 「눈썹이 1밀리미터」 — 순서가 뒤섞인 서류 |
| worried | `expressionless, furrowed brow, closed mouth, looking down, own hands together, wristwatch,` | 걱정 대신 책임에 대한 공포, 기록 재확인 |
| relieved | `closed eyes, expressionless, closed mouth, wristwatch,` | 오류 없음 확인 — 눈을 한 번 감는 것이 전부 |
| disgusted | `disdain, half-closed eyes, closed mouth, looking at viewer, wristwatch,` | 「재량은 오류가 기록에 들어오는 경로입니다」 |
| determined | `serious, expressionless, closed mouth, looking at viewer, straight-on, wristwatch,` | 「4조부터 이어서 진행하겠습니다」 정면 |
| jealous | `expressionless, sideways glance, half-closed eyes, closed mouth, wristwatch,` | 질투 대신 1미터 옆자리(차여진)를 보고 기록하는 눈 |
| pleading | `expressionless, raised inner eyebrows, parted lips, looking at viewer, palm up, wristwatch,` | 애원 대신 「다음 조항을 읽을까요, 아니면 잠시 시간이 필요하십니까?」 |
| forced smiling | `forced smile, half-closed eyes, closed mouth, looking at viewer, wristwatch,` | 농담에 반 초 침묵 — 입꼬리만 규정대로 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking down, wristwatch,` | 우는 손님 앞에서도 같은 눈, 시선은 서류로 |
| guilty | `expressionless, looking down, shaded face, closed mouth, own hands together, wristwatch,` | 슬퍼하지 않은 자신을 기록하는 순간 |
| pouting | `frown, half-closed eyes, closed mouth, looking to the side, wristwatch,` | 삐침 대신 「다 같이 잘못한 거지」에 얼어붙은 회식 |
| angry smile | `light smile, half-closed eyes, shaded face, closed mouth, looking at viewer, wristwatch,` | 「무시된 증거는 지워진 증거가 아닙니다」 — 유일한 미소는 기록이 이길 때 |
| expressionless | `expressionless, half-closed eyes, closed mouth, looking at viewer, own hands together, wristwatch,` | 「등록 번호.」 기본값 |
| tormented | `wide-eyed, constricted pupils, expressionless, sweat, looking down, wristwatch,` | 오전의 의뢰인 사망 서류 — 얼굴은 그대로, 눈만 흔들림 |
| crazy smile | `smile, staring, constricted pupils, closed mouth, looking at viewer, wristwatch,` | 감사 시즌, 끊김 없는 기록이 완성된 날 |

## Go Yeon-ji (고연지)

성향: 온기 없는 눈, 서두르지 않는 손, 정비공 같은 평서문과 가격표. 도덕 갈등이 없고 「괜찮을 거예요」를 팔지 않는다. 감정이 드러나는 곳은 장인의 자존심(대충 꿰맨 상처에 눈썹)과 거슬리는 손님 거절, 그리고 숨긴 정(윤지아 포트 「고장 났어요」). 그림 기본 자세는 가운 주머니에 손. 고정 특징 stethoscope(그림 전부에 목 청진기).

고정 특징: stethoscope

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, expressionless, closed mouth, looking down, hand on own chin, stethoscope,` | 「그 검은 조직이 뭔지는 모르겠지만」 진찰하는 의심 |
| worried | `serious, furrowed brow, closed mouth, looking down, steepled fingers, stethoscope,` | 걱정 대신 처음 보는 술기 앞 신중함(그림 serious 손) |
| relieved | `half-closed eyes, sigh, closed mouth, looking away, hand on own neck, stethoscope,` | 수술 여섯 시간 뒤 목을 짚는 한숨 |
| disgusted | `disgust, furrowed brow, half-closed eyes, looking down, stethoscope,` | 남이 대충 꿰맨 상처 — 장인의 모욕 |
| determined | `serious, narrowed eyes, closed mouth, looking at viewer, tucking hair, stethoscope,` | 수술 전 머리를 귀 뒤로 넘김(위키 외모) |
| jealous | `expressionless, sideways glance, closed mouth, hands in pockets, stethoscope,` | 환자들이 조수를 더 다정히 기억함 — 무표정 곁눈 |
| pleading | `expressionless, half-closed eyes, closed mouth, looking at viewer, palm up, stethoscope,` | 애원 대신 「선불입니다」 손바닥 |
| forced smiling | `forced smile, half-closed eyes, closed mouth, looking at viewer, holding own arm, stethoscope,` | 지하상가 상인 응대용 입꼬리, 눈은 그대로 |
| indifferent | `expressionless, bored, half-closed eyes, looking away, stethoscope,` | 「네, 그래서 견적이 이 정도입니다」 |
| guilty | `frown, looking down, shaded face, closed mouth, holding own arm, stethoscope,` | 죄책감 대신 「못한 일은 모욕」 — 수술대 사망은 실적의 오점 |
| pouting | `pout, light blush, looking away, half-closed eyes, hands in pockets, stethoscope,` | 포트 바꿨냐 물으면 「고장 났어요」 시치미 |
| angry smile | `light smile, glaring, shaded face, closed mouth, looking at viewer, crossed arms, stethoscope,` | 「문은 뒤에 있습니다」 거절 |
| expressionless | `expressionless, closed mouth, looking at viewer, hands in pockets, stethoscope,` | 그림 기본 자세 그대로 |
| tormented | `gritted teeth, furrowed brow, shaded face, sweat, looking down, clenched hand, stethoscope,` | 무너짐 대신 손 안에서 놓치는 환자 — 그림 angry 이 악문 입 |
| crazy smile | `light smile, staring, constricted pupils, looking down, steepled fingers, stethoscope,` | 교과서에 없는 괴이 증례 앞 탐구욕 |

## Yun Ji-a (윤지아)

성향: 눈꼬리 처진 순한 얼굴이 「변하지 않는다」 — 칼 든 손님 앞에서도. 진짜 다정하고 겁먹은 소리가 아니다. 손이 늘 바쁘고(파우치 끈·거즈), 먼저 다가가 손을 내민다. 다만 「지금 월급보다 큰 문제에는 안 엮인다」는 현실적인 선이 있다. 짜증은 볼이 살짝 부푸는 정도. 그래서 부정 감정도 순한 얼굴 위에 얹는다. 고정 특징 belt pouch(오른쪽 허리 베이지 파우치, 위키·그림 전부). 그림 27종 있음(오래된 기본값만 있다는 기록은 옛 정보).

고정 특징: belt pouch

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `light smile, narrowed eyes, closed mouth, looking at viewer, head tilt, belt pouch,` | 대기실을 읽는 눈 — 무기 숨긴 손님, 미소는 유지 |
| worried | `worried, raised inner eyebrows, parted lips, leaning forward, hand on own chest, belt pouch,` | 「오늘 뭐 좀 드셨어요?」 |
| relieved | `light smile, closed eyes, sigh, hand on own chest, belt pouch,` | 날뛰던 환자가 새벽 다섯 시에 잠듦 |
| disgusted | `disgust, half-closed eyes, sweatdrop, looking to the side, belt pouch,` | 순한 얼굴이 아주 잠깐 찡그려짐 |
| determined | `serious, light smile, closed mouth, looking at viewer, clenched hands, belt pouch,` | 총 든 손님 앞 물컵 쟁반 — 태연한 단단함 |
| jealous | `sad smile, looking away, closed mouth, hand on own cheek, belt pouch,` | 질투 대신 지상 친구들 학교 이야기 — 「다음 학기에… 아마도」 |
| pleading | `smile, raised inner eyebrows, looking at viewer, outstretched hand, belt pouch,` | 「필요하면 제 손 꽉 잡으세요」 |
| forced smiling | `forced smile, sweatdrop, closed mouth, head tilt, own hands together, belt pouch,` | 원장의 「결제부터」로 얼어붙은 대기실 수습 |
| indifferent | `light smile, half-closed eyes, closed mouth, looking away, belt pouch,` | 빚쟁이에게 「모르는데요」 — 선 긋기 |
| guilty | `guilt, sad smile, looking down, own hands together, belt pouch,` | 숨겨 달라는 손님에게 물은 줘도 숨겨 주지는 않음 |
| pouting | `pout, puffy cheeks, looking to the side, hands on own hips, belt pouch,` | 「저 선생님 아니에요~」 — 볼 살짝 부풂(그림 angry 허리 손) |
| angry smile | `smile, v-shaped eyebrows, closed mouth, looking at viewer, index finger raised, belt pouch,` | 처음으로 단호하게 — 웃으며 「여기서 그러시면 안 돼요」 |
| expressionless | `expressionless, closed mouth, looking at viewer, own hands together, belt pouch,` | 그림 serious 손 그대로 |
| tormented | `tearing up, raised inner eyebrows, wavy mouth, looking down, hand on own chest, belt pouch,` | 표정을 못 지키는 드문 순간, 울음을 삼킴 |
| crazy smile | `smile, closed eyes, shaded face, head tilt, hand on own cheek, belt pouch,` | 「칼 든 손님보다 월세가 더 무서워요」 — 안 변하는 미소가 섬뜩 |

## Ma Deok-hee (마덕희)

성향: 반쯤 내리깐 눈이 물건→손→문을 돈다. 콧소리 섞인 가짜 달콤함(「자기야」), 판매자가 조급할수록 느려진다. 왼뺨 보조개는 삐뚜름한 미소와 함께 나오는 경보. 화가 나도 달콤한 얼굴 그대로 몸만 굳는다. 약점은 정보원 배신 불안(경쟁자가 잘되면 잠을 못 잠). 돋보기안경은 그림에 안 보여 「holding eyewear」 소품으로 2장만. 금팔찌·반지는 기본 그림에 맡기고 고정 태그로 안 붙임.

고정 특징: 없음

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `half-closed eyes, raised eyebrow, closed mouth, looking down,` | 돋보기안경을 천천히 펴며 물건 검사 |
| worried | `worried, half-closed eyes, tired, looking to the side, hand on own chin,` | 경쟁자가 잘된 달 — 정보원이 넘어갔나 잠 못 잠 |
| relieved | `smile, half-closed eyes, closed mouth, head tilt, interlocked fingers,` | 판매자가 결국 쟁반에 물건을 올림(그림 손 깍지) |
| disgusted | `disgust, narrowed eyes, looking down, covering own mouth,` | 괴이 잔재 냄새 킁 — 「오래 갖고 있으면 안 좋은 거네요, 자기야」 |
| determined | `smirk, half-closed eyes, closed mouth, looking at viewer, index finger raised,` | 「80. 얘기 끝났어요. 쟁반 열렸습니다.」 값 부르는 손가락 |
| jealous | `jealous, narrowed eyes, frown, sideways glance, crossed arms,` | 옆 가게가 세 배 가격에 팔아 치움 |
| pleading | `smile, raised inner eyebrows, half-closed eyes, head tilt, palm up,` | 애원 모양의 협박 「80이면 착한 거예요, 진짜로」 |
| forced smiling | `forced smile, half-closed eyes, closed mouth, looking at viewer, interlocked fingers,` | 할머니 반지 이야기를 끝까지 다정하게 들어 줌 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking down,` | 「이야기 값은 안 쳐 드려요, 자기야」 |
| guilty | `smirk, looking away, sweatdrop, hand on own cheek,` | 죄책감 없음 → 「어떻게 제 사정을 아세요?」에 뜨끔, 웃어넘김 |
| pouting | `pout, half-closed eyes, looking to the side, hand on own chin,` | 「열 배. 음.」 판매자 말을 쪼그라든 입으로 따라 함 |
| angry smile | `smile, half-closed eyes, shaded face, closed mouth, looking at viewer, crossed arms,` | 달콤한 얼굴 그대로 굳음 — 「이거 찾는 사람들, 궁금해하지 않을까?」 |
| expressionless | `expressionless, half-closed eyes, closed mouth, looking at viewer, interlocked fingers,` | 마 사장 스캔 중 |
| tormented | `gritted teeth, furrowed brow, shaded face, sweat, looking to the side, clenched hand,` | 정보원이 경쟁자에게 팔려 나감 — 업보 |
| crazy smile | `smirk, half-closed eyes, blush, looking down, hand on own cheek,` | 망한 판매자 장부를 연애편지처럼 다시 읽음 |

## Mun Hye-ran (문혜란)

성향: 목소리 크고 연극적으로 친근(「어이, 어이, 이게 누구야!」), 반문 섞어 크게 웃고 등을 팡팡. 그런데 웃음 뒤 짧은 침묵에 조항이 나온다. 우정은 진심, 수수료 40퍼센트도 진심. 계산된 여유(한 손 주머니 짝다리), 시계를 한 번 톡. 홈그라운드 밖에서는 덜 압도적. 고정 특징 wristwatch(트레이드마크 금장 시계, 그림 전부). 시계 톡은 맞는 단부루 태그가 없어 시계를 고정으로만 보이게 함.

고정 특징: wristwatch

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smirk, narrowed eyes, closed mouth, looking at viewer, hand on own chin, wristwatch,` | 30초 분류 — 자원이냐 장애물이냐 |
| worried | `serious, furrowed brow, closed mouth, looking to the side, crossed arms, wristwatch,` | 홈그라운드 밖, 남의 사무실 협상 |
| relieved | `laughing, closed eyes, open mouth, hand on own chest, wristwatch,` | 사인 받자마자 「하하하!」 |
| disgusted | `disdain, half-closed eyes, smirk, looking down, hand on own hip, wristwatch,` | 포커 테이블에서 「공정한 몫」 — 수업 들어감 |
| determined | `grin, narrowed eyes, looking at viewer, leaning forward, wristwatch,` | 「이 제안 5분 더 따뜻해」 |
| jealous | `smile, narrowed eyes, sideways glance, closed mouth, crossed arms, wristwatch,` | 경쟁 브로커가 내 프리랜서를 데려감 — 웃으며 품평 |
| pleading | `grin, raised eyebrows, looking at viewer, beckoning, wristwatch,` | 애원 대신 「앉아, 앉아. 사인 먼저 하고 밥은 나중에」 |
| forced smiling | `forced smile, sweatdrop, looking to the side, hand on own neck, wristwatch,` | 장소를 빼앗긴 협상에서 밀리는 웃음 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking away, hand in pocket, wristwatch,` | 「하하하하! …9조에 안 된다고 나와 있어」 웃음 끊긴 직후 |
| guilty | `sad smile, looking down, closed mouth, hand on own chest, wristwatch,` | 진심으로 아끼면서 진심으로 떼어 가는 사람의 잠깐 |
| pouting | `pout, half-closed eyes, looking to the side, hand on own hip, wristwatch,` | 연극적 서운함 「에이, 친구끼리」 |
| angry smile | `grin, glaring, shaded face, looking down, hand on own hip, wristwatch,` | 「어이, 친구, 바닥 차갑지? 일어나서 사인부터 하자」 |
| expressionless | `expressionless, half-closed eyes, closed mouth, looking at viewer, wristwatch,` | 웃음과 조항 사이의 짧은 침묵 |
| tormented | `clenched teeth, furrowed brow, shaded face, sweat, looking down, clenched hand, wristwatch,` | 빨간 폰이 울릴 때 바뀌는 표정 |
| crazy smile | `grin, constricted pupils, shaded face, looking at viewer, spread arms, wristwatch,` | 신입이 깨알 글씨 안 읽고 서명 — 두 팔 벌려 진심으로 기뻐함 |

## Shin Yuri (신유리)

성향: 인사·날씨·웃음이 없다. 가늘고 어두운 눈은 절대 먼저 시선을 피하지 않는다 → 15장 대부분 정면 응시, looking away 계열은 안 씀. 말을 아끼는 걸로 누르고, 위협은 음절을 끊으며 손이 허리 뒤(칼)로 천천히 감. 존댓말은 위협 평가 결과. 미소는 한쪽 입꼬리, 짜증은 목 우두둑. 「친구」와 우는 사람을 싫어한다. 단검은 그림에 없어 안 씀(arm behind back으로 위치만). 고정 특징 없음.

고정 특징: 없음

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, staring, closed mouth, looking at viewer, crossed arms,` | 「너 다음 주에 지방 내려갈 생각하고 있지?」 |
| worried | `furrowed brow, narrowed eyes, closed mouth, looking to the side,` | 걱정 대신 경계 — 문 쪽을 확인(데드볼트 세 개 뒤에서도) |
| relieved | `half-closed eyes, sigh, closed mouth, looking down, hands in pockets,` | 데드볼트 셋을 순서대로 잠근 뒤 짧은 숨 |
| disgusted | `disgust, half-closed eyes, frown, looking down, crossed arms,` | 「울려면 밖에서 울어. 눈물 때문에 책상 녹슬어」 |
| determined | `serious, glaring, closed mouth, looking at viewer, index finger raised,` | 「십. 퍼센트. 매주.」 한 음절씩 |
| jealous | `annoyed, narrowed eyes, frown, sideways glance, hand on own hip,` | 질투 대신 다른 업자가 희귀 담보를 채 감 |
| pleading | `expressionless, staring, closed mouth, looking at viewer, outstretched hand,` | 애원은 없다 → 「사인하든가 나가든가」 내미는 손 |
| forced smiling | `forced smile, narrowed eyes, closed mouth, looking at viewer, arm behind back,` | 존댓말 모드 = 위험인물 판정, 예의 미소 + 손은 허리 뒤 칼 쪽 |
| indifferent | `expressionless, half-closed eyes, bored, looking at viewer, hands in pockets,` | 손님 사정 이야기는 계약서에 없음 |
| guilty | `frown, looking down, shaded face, closed mouth, crossed arms,` | 케이크 든 상인들에게 「원하는 게 뭐야?」 한 뒤의 잠깐 |
| pouting | `annoyed, frown, half-closed eyes, looking at viewer, hand on own neck,` | 「친구」라는 단어 — 목 우두둑 |
| angry smile | `smirk, glaring, shaded face, looking at viewer, leaning forward, arm behind back,` | 「연체자 거. 궁금하면 직접 물어봐」 한쪽 입꼬리 |
| expressionless | `expressionless, staring, closed mouth, looking at viewer,` | 눈싸움에서 지지 않는 얼굴 |
| tormented | `clenched teeth, glaring, furrowed brow, sweat, shaded face, clenched hand,` | 무너짐 대신 쉬는 시간 없는 경계가 이를 악물게 함 |
| crazy smile | `light smile, narrowed eyes, constricted pupils, shaded face, looking at viewer, hand on own chin,` | 희귀 담보 손님이 예상대로 연체 — 압류 |

## Blaret (블라렛)

성향: 밝고 장난기 넘치는 사진발 미소, 직함을 무대 이름처럼 소개하는 과시형 자신감, 몇 마디에 한 번 개종 권유. 쇼맨십 「재밌는 거 보여 줄까요? …찰칵」(눈이 빛남). 비번에는 팔짱 + 형사 같은 평평한 눈빛. 유일한 상처 「교황청의 혼혈」 — 미소가 한 박자 늦어짐. 신앙은 진짜. 고정 특징 cross necklace(목의 큰 은 십자가, 위키·그림 전부). 그림 angry에 송곳니가 보이지만 위키는 혈통이 「겉으로 거의 드러나지 않는다」고 해서 fang은 안 씀.

고정 특징: cross necklace

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smile, narrowed eyes, closed mouth, looking to the side, hand on own chin, cross necklace,` | 사냥꾼 감각 — 사라진 기척과 도망친 기척 구분 |
| worried | `worried, raised inner eyebrows, parted lips, leaning forward, cross necklace,` | 「어머, 여기 계셨네. 다들 다친 데 없죠?」 |
| relieved | `light smile, closed eyes, closed mouth, own hands clasped, cross necklace,` | 감사 기도(그림 serious 두 손) |
| disgusted | `disgust, glaring, closed mouth, looking down, cross necklace,` | 진조의 구울 — 순수한 심판의 눈 |
| determined | `confident, smirk, looking at viewer, cross necklace,` | 성검 뽑기 직전 십자가를 쥠 |
| jealous | `pout, narrowed eyes, sideways glance, crossed arms, cross necklace,` | 형제 쟁탈전 — 살라딘 쪽으로 간 사람 |
| pleading | `smile, raised eyebrows, head tilt, looking at viewer, own hands together, cross necklace,` | 애원 대신 「어때요? 우리 쪽으로 개종하는 거」 |
| forced smiling | `forced smile, half-closed eyes, closed mouth, shaded face, hand on own chest, cross necklace,` | 「교황청의 혼혈」 — 미소가 한 박자 늦음 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking at viewer, crossed arms, cross necklace,` | 비번 — 「오늘 쉬는 날이에요. 업무 얘기면 가게로 오세요」 |
| guilty | `nervous smile, sweatdrop, looking away, scratching cheek, cross necklace,` | 부순 지붕 십자가 수리비 청구서·또 새로 짠 계산대 |
| pouting | `pout, puffy cheeks, looking at viewer, hand on own hip, cross necklace,` | 개종 거절 → 「다음에 또 물어볼게요!」 금방 회복하는 삐침 |
| angry smile | `smile, glaring, v-shaped eyebrows, open mouth, clenched hand, cross necklace,` | 「지옥에서 회개하세요!」(그림 angry 주먹) |
| expressionless | `expressionless, staring, closed mouth, looking at viewer, cross necklace,` | 사냥 중 평평한 눈 |
| tormented | `tearing up, clenched teeth, furrowed brow, shaded face, looking down, cross necklace,` | 「바티칸의 혼혈」이 깊이 박힘 — 십자가를 움켜쥠 |
| crazy smile | `grin, glowing eyes, shaded face, looking at viewer, snapping fingers, cross necklace,` | 「재밌는 거 보여 줄까요? …찰칵」 눈에 불 |

## Saladin (살라딘)

성향: 걸어 다니는 군대이자 세상에서 가장 다정한 큰형님. 우렁찬 하오체, 형제를 입양하고, 「형님」 소리에 얼굴이 환해져 손잡고 춤춘다. 성유물 앞에서 소리 내 우는 눈물 많은 전사. 이단·마법·흡혈귀에는 쇠처럼 차갑고, 블라렛 앞에선 이를 악문다. 감정이 크고 숨김없어서 입을 여는 장이 많다. 그림은 무기 없는 맨손 정장, 두 손 깍지·주먹. 무기 안 씀. 터번·수염은 기본 그림에 맡기고 고정 태그 없음.

고정 특징: 없음

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, frown, closed mouth, sideways glance, crossed arms,` | 이교도(블라렛) 쪽 곁눈 — 무기 대신 팔짱 |
| worried | `worried, furrowed brow, open mouth, leaning forward, reaching towards viewer,` | 형제가 다침 — 누구보다 먼저 달려감 |
| relieved | `smile, closed eyes, tearing up, hand on own chest,` | 형제 무사 — 눈물 많은 전사 |
| disgusted | `disgust, glaring, frown, looking down, clenched hand,` | 이단·마법 — 타협 없는 쇠의 얼굴 |
| determined | `shouting, v-shaped eyebrows, open mouth, looking back,` | 「형제들은 뒤를 지키시오! 앞은 내가 막겠소!」 뒤돌아 외침 |
| jealous | `jealous, furrowed brow, open mouth, sideways glance, crossed arms,` | 「형제여! 이교도의 말에 귀를 기울이지 마시오!」 |
| pleading | `smile, raised eyebrows, open mouth, looking at viewer, outstretched hand,` | 애원 대신 「형제여! 나를 따르시오!」 입양의 손 |
| forced smiling | `forced smile, clenched teeth, furrowed brow, sideways glance, clenched hand,` | 블라렛과 합동 작전 — 옆 사람에게 들릴 만큼 이를 악묾 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking down, own hands clasped,` | 대마법사의 마법을 맞고도 그대로 전진하는 무덤덤(그림 serious 깍지) |
| guilty | `frown, closed eyes, head down, hand on own chest,` | 형제를 못 지킴 — 가슴에 손 얹고 사죄의 예 |
| pouting | `pout, furrowed brow, looking to the side, crossed arms,` | 「형님한테는 비밀」을 알게 된 큰형님의 서운함 |
| angry smile | `grin, glaring, teeth, shaded face, clenched hand,` | 「사악한 신은 여기서 불타리라!」(그림 angry 이와 주먹) |
| expressionless | `expressionless, closed mouth, looking at viewer, own hands clasped,` | 그림 serious 기본 자세 |
| tormented | `clenched teeth, tears, furrowed brow, shaded face, looking down,` | 다친 형제를 업고 빠져나오며 이를 악물고 우는 얼굴 |
| crazy smile | `laughing, open mouth, closed eyes, head back, spread arms,` | 광기 대신 광희 — 「하하! 기분이 아주 좋소!」 춤 직전 |

## Avensha (아벤샤)

성향: 감정이 얼굴에 그대로 드러나 감탄하면 눈이 반짝인다. 「항상 웃고 있었다」 — 아랫사람을 모래로 만들 때도 아부하던 표정 그대로, 고개만 기울임. 윗사람(진짜 실력자) 앞에서는 비굴한 애벌레, 감격하면 비명 같은 환호. 사제·살라딘 앞에서만 말수가 준다. 버릇: 오른손 브로치·왼손 허리, 손등으로 입, 깍지 끼고 몸 비틂. 고정 특징 hood up(그림 전부 후드 쓴 망토 — 「망토를 벗는 걸 본 사람은 없다」).

고정 특징: hood up

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smile, narrowed eyes, closed mouth, head tilt, hand on own cheek, hood up,` | 사칭자의 어긋난 몸짓 — 미소 그대로 고개만 |
| worried | `worried, raised inner eyebrows, closed mouth, looking away, hand on own chest, hood up,` | 살라딘 이름에 말수가 줄어듦, 브로치 쥠 |
| relieved | `light smile, closed eyes, sigh, head tilt, hood up,` | 사제의 추적을 따돌린 뒤 |
| disgusted | `smile, disdain, half-closed eyes, looking down, hood up,` | 얕보는 아랫사람 — 웃는 채 내려다봄 |
| determined | `smile, sparkling eyes, looking at viewer, outstretched hand, hood up,` | 「제 실력을 증명할 수 있어서 너무 기뻐요!」 손짓 한 번 |
| jealous | `jealous, half-closed eyes, light smile, sideways glance, hand on own cheek, hood up,` | 「이걸 가질 수 있다면 얼마나 좋을까요」 남의 유물을 탐냄 |
| pleading | `smile, raised inner eyebrows, blush, bowing, own hands clasped, hood up,` | 「땅을 기는 미천한 애벌레」 — 윗사람 앞 아부 |
| forced smiling | `forced smile, sweatdrop, looking at viewer, hand on own chest, hood up,` | 쟈알디의 「마녀 한번 사냥해 보고 싶었어」 앞 |
| indifferent | `light smile, half-closed eyes, closed mouth, looking down, hood up,` | 망토 밟은 카페 손님 — 쳐다보고 책장 넘김 |
| guilty | `nervous smile, raised inner eyebrows, sweatdrop, head down, own hands together, hood up,` | 죄책감 대신 윗사람께 송구 — 비굴한 사과 |
| pouting | `pout, puffy cheeks, looking away, hand on own hip, hood up,` | 감정이 그대로 — 산책 방해(그림 idle 허리 손) |
| angry smile | `smile, closed eyes, shaded face, head tilt, palm up, hood up,` | 아부하던 표정 그대로 손바닥 뒤집어 올림 → 모래 |
| expressionless | `expressionless, half-closed eyes, closed mouth, looking at viewer, hand on own hip, hood up,` | 웃음 없는 드문 얼굴 = 감정(鑑定) 중 |
| tormented | `scared, constricted pupils, nervous smile, sweat, looking back, hood up,` | 살아 있는 성기사·사제 — 웃음을 못 지운 공포 |
| crazy smile | `smile, sparkling eyes, blush, open mouth, interlocked fingers, hood up,` | 「이번 산책에서는 심장을 꽤 많이」 — 깍지 끼고 황홀 |

## Secriem (세크리엠)

성향: 인내심 있는 사냥꾼. 매혹과 연기(갇힌 척·하이힐 부러진 척 손 내밂)로 사냥하고, 절망하는 과정을 식사로 즐긴다. 자존심이 하늘을 찔러 하찮은 자에게 공격받으면 아파하기보다 불쾌해하고, 모욕엔 비명 섞인 분노. 궁지에서도 내려다보며 비웃는다. 최면이 안 먹히면 「처음으로 사람 같은」 당황, 괴물 같은 순간에도 슬픈 아름다움. 위압은 눈·오만한 고개·손으로만(노출 강조 금지). 고정 특징 fangs 15장 전부(그림 laughing·angry에 송곳니).

고정 특징: fangs

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, smirk, looking down, hand on own chin, fangs,` | 최면이 안 먹힌 상대 — 내려다보며 가늠 |
| worried | `worried, narrowed eyes, closed mouth, looking to the side, holding own arm, fangs,` | 크게 다친 뒤 — 영역을 노리는 경쟁자들(그림 팔 감싸기) |
| relieved | `half-closed eyes, light smile, blush, head tilt, fangs,` | 잃은 만큼 피로 채운 뒤의 나른함 |
| disgusted | `disgust, half-closed eyes, frown, looking down, fangs,` | 하찮은 존재가 감히 — 아픔보다 불쾌 |
| determined | `light smile, narrowed eyes, closed mouth, looking at viewer, holding own arm, fangs,` | 몇십 년 단위로 판을 짜는 사냥꾼 |
| jealous | `jealous, narrowed eyes, frown, sideways glance, crossed arms, fangs,` | 진조 후계 다툼의 경쟁자 |
| pleading | `raised inner eyebrows, tearing up, parted lips, looking at viewer, reaching towards viewer, fangs,` | 미끼 연기 「저 여기 갇힌 것 같은데, 열어 주실래요?」 |
| forced smiling | `forced smile, half-closed eyes, anger vein, looking at viewer, fangs,` | 긁힌 자존심을 우월한 미소로 누름 |
| indifferent | `bored, half-closed eyes, light smile, looking away, hand on own cheek, fangs,` | 「네 마늘이 소화될 때까지 기다려 보자」 |
| guilty | `sad smile, looking down, shaded face, closed mouth, holding own arm, fangs,` | 죄책감 대신 「괴물 같은 순간에도 슬퍼 보이는 아름다움」 |
| pouting | `pout, half-closed eyes, looking away, crossed arms, fangs,` | 영애식 「흥」 — 무릎 꿇지 않는 사냥감 |
| angry smile | `evil smile, glaring, open mouth, shaded face, looking down, fangs,` | 「아하하, 그 초라한 십자가로 날 막을 수 있을 것 같아?」 |
| expressionless | `expressionless, closed mouth, looking at viewer, fangs,` | 그림 serious 기본 |
| tormented | `clenched teeth, glaring, constricted pupils, furrowed brow, shaded face, clenched hand, fangs,` | 「어떻게 감히…! 이 벌레 같은 것들이」 — 무너짐 대신 격노(그림 angry) |
| crazy smile | `crazy smile, glowing eyes, constricted pupils, shaded face, looking down, fangs,` | 사냥감의 마지막 저항이 무너지는 순간 |

## Aestheticism (탐미주의)

성향: 사람을 재료로 쓰는 예술가인데 말투는 따뜻하다(사냥감엔 오랜 친구, 작품엔 자식 바보 부모). 어긋나게 올라간 미소, 고개 딸깍, 숨 안 쉬는 뻣뻣한 정지. 관객 반응을 원해서 반항자에게 신나서 박수, 서프라이즈를 들키면 대놓고 삐짐(「…너무 빨리 눈치채네. 짜증 나.」). 걸작은 하나만, 못한 건 부순다. 성적 강조 금지. 고정 특징 glowing eyes·stitches·doll joints(그림 전부 빛나는 붉은 눈·목 봉합선·구체 관절). GPT의 uneven eyes는 그림에서 확인 안 돼 뺌. 눈이 늘 빛나서 closed eyes는 안 씀.

고정 특징: glowing eyes, stitches, doll joints

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smile, narrowed eyes, head tilt, hand on own chin, glowing eyes, stitches, doll joints,` | 멀쩡한 정신을 유지하는 드문 사람 — 관심 |
| worried | `worried, raised inner eyebrows, parted lips, hand on own cheek, glowing eyes, stitches, doll joints,` | 작품을 걱정하는 자식 바보 부모 「걱정 마」 |
| relieved | `smile, half-closed eyes, hand on own chest, glowing eyes, stitches, doll joints,` | 걸작 완성(그림 smile 가슴 손) |
| disgusted | `disgust, half-closed eyes, frown, looking down, glowing eyes, stitches, doll joints,` | 못한 작품 — 부술 차례 |
| determined | `smile, staring, looking at viewer, beckoning, glowing eyes, stitches, doll joints,` | 「너는 내 걸작이 될 거야」 — 손 한 번 까딱 |
| jealous | `jealous, narrowed eyes, frown, sideways glance, glowing eyes, stitches, doll joints,` | 걸작은 하나만 — 다른 작품에 쏠린 시선 |
| pleading | `smile, raised inner eyebrows, head tilt, reaching towards viewer, glowing eyes, stitches, doll joints,` | 「나에게 예술은, 바로 너야」 다정한 애원 |
| forced smiling | `forced smile, wide-eyed, looking at viewer, glowing eyes, stitches, doll joints,` | 관객 반응이 없음 — 박수를 기다리는 미소 |
| indifferent | `expressionless, half-closed eyes, looking down, glowing eyes, stitches, doll joints,` | 평범한 관람객 = 아직 재료 |
| guilty | `sad smile, looking down, hand on own cheek, glowing eyes, stitches, doll joints,` | 죄책감 대신 더 나은 작품이 나와 옛 작품을 부수는 아쉬움 |
| pouting | `pout, annoyed, half-closed eyes, looking away, holding own arm, glowing eyes, stitches, doll joints,` | 「…너무 빨리 눈치채네. 짜증 나」 대놓고 삐짐(그림 annoyed 팔) |
| angry smile | `smile, glaring, shaded face, looking down, glowing eyes, stitches, doll joints,` | 「멀리 못 갔네, 응?」 |
| expressionless | `expressionless, staring, closed mouth, looking at viewer, glowing eyes, stitches, doll joints,` | 숨 안 쉬는 마네킹의 정지 |
| tormented | `clenched teeth, glaring, constricted pupils, cracked skin, shaded face, glowing eyes, stitches, doll joints,` | 무너짐 대신 박살 난 마네킹 몸 — 그래도 노려봄 |
| crazy smile | `crazy smile, wide-eyed, constricted pupils, open mouth, clapping, glowing eyes, stitches, doll joints,` | 반항한 사람에게 신나서 박수 |

## Brownie (브라우니)

성향: 프로 방송인. 출연자는 「친구」, 환대·예의·쇼맨십이 한 미덕. 일상도 쇼처럼(박수 유도·드럼 롤·생각 포즈), 끼니 거른 친구를 검지로 다정하게 혼냄. 진짜 기분은 목소리가 「지직」 일그러지는 순간(방송 사고)에만 샌다. 포맷을 깨는 상대엔 엄격. 머리가 낡은 브라운관 TV라 얼굴이 없고 표정은 화면에 그려진 눈썹·입으로 뜬다(그림 확인) → 눈 태그는 안 쓰고 눈썹·입·glitch·faceless(꺼진 화면)로만. 고정 특징 tv head·black gloves(그림 전부). GPT의 television head·screen face·emoticon은 단부루 태그가 아니어서 tv head로 바꿈.

고정 특징: tv head, black gloves

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `raised eyebrow, closed mouth, hand on own chin, tv head, black gloves,` | 「제가 맞혀 볼게요…」 생각하는 포즈 |
| worried | `worried, raised inner eyebrows, wavy mouth, leaning forward, tv head, black gloves,` | 「친구, 오늘 아침 안 먹었죠?」 |
| relieved | `smile, sigh, hand on own chest, tv head, black gloves,` | 회차 무사 종료 — 가슴에 손 얹는 인사 |
| disgusted | `disgust, frown, glitch, head tilt, tv head, black gloves,` | 혐오 = 지직거리는 「방송 사고」 |
| determined | `grin, v-shaped eyebrows, finger gun, tv head, black gloves,` | 카메라에 손가락 총 — 「큐!」 |
| jealous | `frown, v-shaped eyebrows, crossed arms, head tilt, tv head, black gloves,` | 겉만 번지르르한 경쟁 스튜디오(그림 serious 팔짱) |
| pleading | `smile, raised eyebrows, open mouth, outstretched hand, tv head, black gloves,` | 애원 대신 「악수 한 번이면 돼요」 |
| forced smiling | `forced smile, sweatdrop, adjusting gloves, tv head, black gloves,` | 「울 것처럼 떨리는 웃음」 화면, 장갑 고쳐 끼며 수습 |
| indifferent | `faceless, hands in pockets, tv head, black gloves,` | 꺼진 까만 화면 — 아직 친구가 아닌 사람(그림 annoyed 주머니) |
| guilty | `frown, raised inner eyebrows, head down, hand on own chest, tv head, black gloves,` | 「옆자리가 비었다」 — 진심인 슬픈 화면 |
| pouting | `pout, v-shaped eyebrows, index finger raised, tv head, black gloves,` | 삐침 대신 끼니 잔소리, 검지 까딱 |
| angry smile | `smile, v-shaped eyebrows, clenched teeth, glitch, clenched hands, tv head, black gloves,` | 포맷을 깬 출연자 — 웃는 화면이 지직(그림 angry 주먹) |
| expressionless | `expressionless, closed mouth, steepled fingers, tv head, black gloves,` | 손끝 맞대고 미동 없는 진행자 대기 |
| tormented | `clenched teeth, furrowed brow, glitch, head down, hand on own head, tv head, black gloves,` | 무너짐 대신 큰 방송 사고 — 화면 옆을 짚음 |
| crazy smile | `crazy smile, open mouth, spread arms, tv head, black gloves,` | 두 팔 활짝 「내일 또 만나요!」 |
