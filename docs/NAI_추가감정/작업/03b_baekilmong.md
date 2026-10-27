# 03b 백일몽 · 추가 감정 15종 (강이학 ~ 청달래)

2026-10-27 · 규칙은 `../규칙.md`. 근거: `card/wiki-base.json` 인물 문서, `assets/portraits/<이름>/` 기존 그림, `docs/동작표/3.x_<이름>.md`.

## 강이학 (Kang I-hak)

성향: 「고정 금리」 미소 — 무슨 일에도 웃는 얼굴이 1밀리도 안 바뀐다. 손짓 네 개(엄지 척·두 손 모으기·꾸벅 인사·돈 동그라미)로 대화의 절반을 처리. 협박도 웃으며, 남의 죽음엔 동요 없음, 돈 얘기엔 눈이 순식간에 반짝. 사과는 빠르고 크게(싸게 먹히니까). 고정 특징 없음(안경·장신구 없음, 지갑·동전은 그림에 없어 손짓만 씀). 부정 감정 대부분을 「미소는 그대로, 눈과 땀만 바뀜」으로 읽음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::smile, narrowed eyes::, closed mouth, head tilt, hand on own chin,` | 웃는 채로 값 매기는 감정사 눈 |
| worried | `1.15::forced smile, sweatdrop::, raised inner eyebrows, looking up, finger to cheek,` | 사람 걱정 아니라 손해 계산 — 미소는 유지 |
| relieved | `1.15::open mouth, smile, closed eyes::, blush, hand on own chest,` | 「넵! 네네!」 입금 확인 직후 |
| disgusted | `1.15::smile, half-closed eyes, disdain::, closed mouth, head tilt, looking at viewer,` | 값어치 없는 물건 보는 눈, 입은 웃음 |
| determined | `1.15::smile, v-shaped eyebrows, confident::, looking at viewer, money gesture,` | 「미끼는 제가 할게요! 대신 위험 수당은 얼마?」 |
| jealous | `1.15::smile, sideways glance, narrowed eyes::, closed mouth, jealous, money gesture,` | 남이 더 받은 정산을 곁눈으로 다시 계산 |
| pleading | `1.15::smile, sparkling eyes, raised eyebrows::, blush, leaning forward, own hands clasped,` | 윗사람에게 대놓고 하는 아부(두 손 모으기) |
| forced smiling | `1.15::forced smile, sweatdrop, closed eyes::, head tilt, own hands together,` | 「무료로요? 하하.」 돈 안 되는 부탁 |
| indifferent | `1.15::smile, half-closed eyes::, closed mouth, looking at viewer, thumbs up,` | 「그건 회사가 알아서 할 문제죠!」 조퇴와 엄지 |
| guilty | `1.15::open mouth, smile, closed eyes::, sweatdrop, bowing,` | 죄책감 대신 빠르고 큰 사과(상대가 화내기 0.5초 전) |
| pouting | `1.15::pout, puffy cheeks::, looking to the side, crossed arms,` | 흥정에서 깎였을 때 「에이~ 그건 손해죠」 밝은 볼멘소리 |
| angry smile | `1.15::smile, glaring, shaded face::, closed mouth, looking at viewer, index finger raised,` | 「개인 정보 전부 관리국에… 대출도 하나」 웃으며 조건 하나씩 |
| expressionless | `1.15::expressionless, staring::, closed mouth, looking at viewer,` | 미소가 내려간 드문 순간 — 금 감별·장부 계산 중 |
| tormented | `1.15::forced smile, wide-eyed, sweat::, constricted pupils, trembling, hand on own forehead,` | 금값 폭락·입금 끊김, 그래도 미소는 안 무너짐 |
| crazy smile | `1.15::grin, sparkling eyes, crazy eyes::, blush, leaning forward, money gesture,` | 「포인트」의 「포」에서 이미 바뀐 눈빛 |

## 장허운 (Jang Heo-un)

성향: 고집스럽게 성실하고 공손, 구부정한 큰 키, 조용히 버팀. 충격엔 얼굴이 하얗게 질리고 힘든 일엔 턱이 굳음, 감당을 넘으면 얼어붙음. 「소원권이 필요합니다. 그만둘 수 없습니다.」 — 죽은 사람들을 위해 삶. 친절엔 휘청한 뒤 과하게 갚음. 악의·교활함·광기가 없어서 질투·삐침·웃으며 화내기·광기는 전부 체념·고집·절박한 희망으로 바꿔 읽음. 소 가면은 그림에 없어(코드 처리) 안 붙임, 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, furrowed brow::, closed mouth, looking at viewer, slouching,` | 정예조 앞 경계 — 말수가 더 줄어든 얼굴 |
| worried | `1.15::worried, furrowed brow, raised inner eyebrows::, closed mouth, looking down, own hands clasped,` | 동료 걱정, 손을 모은 채 버팀 |
| relieved | `1.15::light smile, half-closed eyes, tired::, closed mouth, looking down, hand on own chest,` | 업고 나온 사람이 살았을 때 |
| disgusted | `1.15::clenched teeth, shaded face, half-closed eyes::, looking away, clenched hand,` | 「왼손 들어」 장난에 — 직원은 웃었고 장허운은 웃지 않았다 |
| determined | `1.15::serious, furrowed brow::, closed mouth, looking at viewer, clenched hand,` | 진입 서류 서명 — 「그만둘 수 없습니다」 |
| jealous | `1.15::sad smile, half-closed eyes::, closed mouth, looking to the side, crossed arms,` | 질투 대신 돌아갈 가족이 있는 사람을 보는 쓸쓸함 |
| pleading | `1.15::raised inner eyebrows, parted lips, tearing up::, looking at viewer, own hands clasped,` | 「소원으로… 죽은 사람도 살릴 수 있습니까?」 |
| forced smiling | `1.15::forced smile, tired, half-closed eyes::, looking down, hand on own neck,` | 「괜찮습니다」 — 폐 끼치기 싫은 억지 미소 |
| indifferent | `1.15::expressionless, half-closed eyes, empty eyes::, closed mouth, looking away,` | 무관심 대신 「소모품」을 사실로 받아들인 체념 |
| guilty | `1.15::guilt, furrowed brow, looking down::, closed mouth, bowing,` | 얼어붙은 십 초 뒤 — 깊이 고개 숙임 |
| pouting | `1.15::frown, half-closed eyes::, closed mouth, looking away, crossed arms,` | 삐침 대신 퇴사 권유에 한 글자도 안 바뀌는 고집 |
| angry smile | `1.15::light smile, glaring::, shaded face, looking down, clenched hand,` | 명령으로 장난치는 상사 앞에서 웃는 척, 눈은 아님 |
| expressionless | `1.15::expressionless, half-closed eyes::, closed mouth, shaded face, looking down,` | 화재 기일 밤, 빈 사무실에 그냥 앉아 있던 얼굴 |
| tormented | `1.15::wide-eyed, clenched teeth, turn pale::, sweat, arm up,` | 강제 명령 — 얼굴이 하얗게 질리는 동안 왼손이 올라감 |
| crazy smile | `1.15::smile, wide-eyed, tears::, constricted pupils, shaded face, looking at viewer,` | 광기 대신 「조건부 예」에 매달린 절박한 희망 |

## 곽제강 (Kwak Je-gang)

성향: 빠르고 따뜻한 친근함(매력은 진짜, 배려는 가짜), 괴이에 진심으로 미친 연구자 — 흥미로운 공포 앞에서 눈이 반짝이다 황홀경. 버릇: 끔찍한 말 직전 턱 문지르기, 웃으며 서류 톡톡(듣기 좋은 말 끝), 남의 노트, 남의 불행 앞 웃음 참기. 공포는 몇 분 만에 즐거움으로, 반성문도 보고서 형식. 걱정·죄책감·괴로움은 그의 방식(관찰 끊길 걱정, 반성하는 척, 웃음 참기)으로 바꿔 읽음. 안경은 그림·위키 모두 확인 → 15장 고정. 소품(노트·서류)은 3장.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::smile, narrowed eyes::, head tilt, looking at viewer, hand on own chin, glasses,` | 턱 문지르기 — 관찰 대상 분석 중 |
| worried | `1.15::furrowed brow, parted lips::, raised inner eyebrows, looking down, holding notebook, glasses,` | 사람 걱정 대신 관찰 기록이 끊길까 하는 걱정 |
| relieved | `1.15::smile, half-closed eyes, sweat::, open mouth, hand on own chest, glasses,` | 격리 존재 심문 — 겁이 몇 분 만에 풀리고 다시 웃음 |
| disgusted | `1.15::disdain, half-closed eyes, smirk::, looking away, shrugging, glasses,` | 혐오 대신 지식 없는 윗선을 깔봄(「알 게 뭡니까」) |
| determined | `1.15::v-shaped eyebrows, open mouth, sparkling eyes::, looking at viewer, clenched hand, glasses,` | 「기원을 쫓고! 진실을! 이해를!」 |
| jealous | `1.15::pout, sideways glance, narrowed eyes::, holding notebook, glasses,` | 남이 먼저 차지한 흥미로운 대상 — 노트 끼고 시샘 |
| pleading | `1.15::open mouth, smile, raised eyebrows::, sweatdrop, own hands together, glasses,` | 구조팀에 「5분만 더요!」 — 애원도 신나서 |
| forced smiling | `1.15::forced smile, sweatdrop, closed eyes::, head tilt, glasses,` | 「이거 누가 책임져요?」에 3초 말문 막힌 뒤 「좋은 질문이네요!」 |
| indifferent | `1.15::light smile, half-closed eyes::, closed mouth, looking to the side, hand in pocket, glasses,` | 「출구가 희생이 있어야만 열리는 어둠도 있거든요」 가벼운 말투 |
| guilty | `1.15::light smile, looking down, sweatdrop::, scratching head, glasses,` | 죄책감 대신 반성하는 척 — 반성문도 연구 보고서 형식 |
| pouting | `1.15::pout, annoyed::, looking to the side, crossed arms, glasses,` | 현장 견학 반려·구조팀 항의서 |
| angry smile | `1.15::smile, shaded face, half-closed eyes::, closed mouth, looking at viewer, holding paper, glasses,` | 웃으며 서류 톡톡 — 듣기 좋은 말은 끝났다 |
| expressionless | `1.15::expressionless, staring::, closed mouth, looking at viewer, glasses,` | 친근함이 빠진 관찰자 눈 — 실험쥐를 보는 얼굴 |
| tormented | `1.15::tearing up, raised eyebrows, trembling::, blush, covering own mouth, glasses,` | 남의 불행 앞에서 터지는 웃음을 참는 괴로움(참는 게 다 보임) |
| crazy smile | `1.15::crazy smile, crazy eyes, blush::, open mouth, arms up, glasses,` | 흥미로운 공포 앞 황홀경, 「제가 사람을 정말 많이 관찰해 봤거든요!」 두 손 듦 |

## 이연화 (Lee Yeon-hwa)

성향: 지친 양심 — 다크서클·카페인, 떨려도 침착하고 정확한 존댓말. 버릇: 침 삼키기·입술 깨물기·이 악물기, 진짜 잔혹한 걸 보면 손으로 입 가림. 「그거 대가가 뭐예요?」, 이미 아는 걸 질문으로 확인, 「과장님!」. 호기심은 곽제강과 닮았지만 품위가 이김, 장비 앞에서만 눈이 반짝. 안경은 그림·위키 모두 확인 → 15장 고정. 다크서클은 그림에서 옅어 고정 태그로 안 넣고 tired로 냄. 커피는 3장.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, skeptical::, closed mouth, looking at viewer, hand on own chin, glasses,` | 「그거 대가가 뭐예요?」 |
| worried | `1.15::worried, lip biting, raised inner eyebrows::, looking down, own hands together, glasses,` | 입술 깨물기, 손을 모은 채 참음 |
| relieved | `1.15::sigh, half-closed eyes, light smile::, tired, holding cup, glasses,` | 「오늘도 아무도 죽지 않았다」 + 커피 |
| disgusted | `1.15::disgust, wide-eyed, furrowed brow::, shaded face, covering own mouth, glasses,` | 연구1팀 공식 잔혹도 측정기 — 손으로 입 가림 |
| determined | `1.15::serious, furrowed brow, staring::, closed mouth, looking at viewer, outstretched arm, glasses,` | 격리 구역 문 앞을 몸으로 막아섬 |
| jealous | `1.15::half-closed eyes, sideways glance::, tired, closed mouth, holding cup, glasses,` | 질투 대신 브레이크 없이 신난 상사를 보는 지친 곁눈 |
| pleading | `1.15::raised inner eyebrows, parted lips::, worried, looking at viewer, outstretched hand, glasses,` | 「잠깐만요」 — 멈춰 달라는 손 |
| forced smiling | `1.15::forced smile, tired, half-closed eyes::, sweatdrop, own hands together, glasses,` | 과장 사고 뒷수습하며 짓는 억지 미소 |
| indifferent | `1.15::expressionless, half-closed eyes, tired::, looking away, holding cup, glasses,` | 「화낼 기운도 없고요」 커피 한 모금 |
| guilty | `1.15::guilt, looking down, lip biting::, shaded face, holding own arm, glasses,` | 입 다물었던 회사 비밀 |
| pouting | `1.15::annoyed, open mouth, furrowed brow::, looking at viewer, hands on own hips, glasses,` | 「과장님!」 — 존댓말은 끝까지 |
| angry smile | `1.15::light smile, narrowed eyes, shaded face::, closed mouth, looking at viewer, crossed arms, glasses,` | 「…저보다 늦게 들어오셨죠?」 이미 아는 질문 |
| expressionless | `1.15::expressionless, half-closed eyes::, tired, closed mouth, looking at viewer, glasses,` | 화를 안 내는 날 — 지쳐 수동적이 된 얼굴 |
| tormented | `1.15::clenched teeth, furrowed brow, tearing up::, shaded face, looking down, clenched hand, glasses,` | 잘못 아래서 계속 일하는 자신 — 이를 악묾 |
| crazy smile | `1.15::grin, sparkling eyes, shaded face::, sweat, tired, glasses,` | 새벽 4시 장비 앞 「이게 제일 재밌네」, 검열된 진실 앞 흥분 |

## 이병진 (Lee Byeong-jin)

성향: 위로는 굽신 아래로는 반말, 이사 이름 대기. 긴장하면 몸이 먼저 자백: 땀, 굴러가는 눈, 손 비비기·손가락 꺾기, 안경 닦기(시간 벌기). 위기엔 눈 질끈 감고 얼어붙고 빎. 약자 희생을 말한 뒤 쳐다보면 시뻘게짐. 「못 합니다」만은 또박또박, 구조되면 엉엉. 은인 앞에서만 용기. 안경은 그림·위키 확인 → 15장 고정(그래서 안경 벗기 대신 고쳐 쓰기만 씀).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, frown, sweat::, looking at viewer, adjusting eyewear, glasses,` | 심사 결벽 — 애매한 문장을 땀 흘리며 의심 |
| worried | `1.15::worried, sweat, raised inner eyebrows::, wavy mouth, adjusting necktie, glasses,` | 감사철·출장 아침, 넥타이를 꽉 |
| relieved | `1.15::streaming tears, open mouth, smile::, snot, looking up, glasses,` | 「회사가 날 버리지 않았어…!!」 엉엉 |
| disgusted | `1.15::disgust, furrowed brow, sweat::, wavy mouth, leaning back, glasses,` | 어둠 현장의 피·오물에 몸부터 뒤로 |
| determined | `1.15::serious, furrowed brow, clenched teeth::, nervous sweating, holding paper, glasses,` | 은인의 서류를 들고 높은 분 방으로 — 땀범벅 |
| jealous | `1.15::jealous, sideways glance, frown::, sweat, crossed arms, glasses,` | 정예 실적·남의 줄을 곁눈으로 시샘 |
| pleading | `1.15::tears, raised inner eyebrows, open mouth::, nervous sweating, own hands together, glasses,` | 손 비비며 빌기 |
| forced smiling | `1.15::forced smile, nervous sweating, sweatdrop::, looking to the side, interlocked fingers, glasses,` | 「어? 아, 아하하, 그게, 어?」 압박 기본형 |
| indifferent | `1.15::half-closed eyes, bored::, closed mouth, looking away, hand in pocket, glasses,` | 은혜 안 입은 사람에겐 평소대로, 거드름 |
| guilty | `1.15::guilt, full-face blush, looking down::, sweat, wavy mouth, hand on own neck, glasses,` | 약자 희생을 말한 뒤 누가 쳐다보자 시뻘게짐 |
| pouting | `1.15::pout, annoyed::, furrowed brow, looking to the side, crossed arms, glasses,` | 감사 얘기만 나오면 길어지는 불평 |
| angry smile | `1.15::smirk, half-closed eyes, shaded face::, looking at viewer, pointing at viewer, glasses,` | 「자네 고과가 요새 좀… 내가 걱정돼서 하는 말이지」 |
| expressionless | `1.15::expressionless, serious::, closed mouth, looking at viewer, glasses,` | 「못 합니다.」 — 더듬지도 웃지도 않은 유일한 문장 |
| tormented | `1.15::closed eyes, clenched teeth, tears::, nervous sweating, trembling, own hands clasped, glasses,` | 위기에 눈 질끈 감고 얼어붙어 빎 |
| crazy smile | `1.15::crazy smile, wide-eyed, sweat::, blush, adjusting eyewear, glasses,` | 한문 앞 「처음 쓸모 있어진 순간」·복권 당첨급 들뜸 |

## 제이 (Jay)

성향: 느리고 평평하고 기운 없음, 말끝마다 말줄임표. 멍하고 지친 얼굴에 빛 빠진 눈 — 위협이 감지되면 동작이 기계처럼 정확해지고 눈이 노랗게 빛남. 반말은 위협할 때만. 외롭고 자기를 낮추며, 사람 대접해 주는 이를 대가 없이 챙김(무전기). 도넛 앞에서만 환해짐. 버릇: 모자챙 고치기(3장). 그림에서 검은 야구 모자 + 흰 마스크가 늘 있음 → 15장 고정, 마스크가 입을 가려 입 태그는 하나도 안 씀(표정은 눈·눈썹·고개·손으로만).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, staring::, looking at viewer, head tilt, baseball cap, mouth mask,` | 「…냄새가 달라요……」 |
| worried | `1.15::worried, raised inner eyebrows::, half-closed eyes, looking to the side, baseball cap, mouth mask,` | 겁먹은 신입을 말없이 알아챔 |
| relieved | `1.15::closed eyes, blush::, sigh, holding doughnut, baseball cap, mouth mask,` | 도넛 상자 — 「…이거… 저 주시는 거예요……?」 |
| disgusted | `1.15::disgust, half-closed eyes, shaded face::, looking at viewer, baseball cap, mouth mask,` | 사람을 해치려는 놈의 냄새 |
| determined | `1.15::glowing eyes, serious, narrowed eyes::, looking at viewer, adjusting headwear, baseball cap, mouth mask,` | 위협 감지 — 모자챙 고치며 눈빛이 바뀜 |
| jealous | `1.15::half-closed eyes, sideways glance, raised inner eyebrows::, shaded face, baseball cap, mouth mask,` | 질투 대신 낮에 나갈 수 있는 사람들을 보는 외로움 |
| pleading | `1.15::raised inner eyebrows, half-closed eyes::, looking at viewer, walkie-talkie, baseball cap, mouth mask,` | 「위험해지면… 불러 주세요」 무전기를 건넴 |
| forced smiling | `1.15::half-closed eyes, tired, sweatdrop::, head tilt, adjusting headwear, baseball cap, mouth mask,` | 「평생 고용 보장」 농담에 「맞아요……」 |
| indifferent | `1.15::expressionless, half-closed eyes, bored::, shrugging, baseball cap, mouth mask,` | 회사가 위협받아도 어깨 으쓱 |
| guilty | `1.15::looking down, shaded face, half-closed eyes::, adjusting headwear, baseball cap, mouth mask,` | 「B조 조장님」에 반 박자 늦게 「…제이요……」 |
| pouting | `1.15::sulking, half-closed eyes::, looking down, holding own arm, baseball cap, mouth mask,` | 배달해 주는 도넛 가게가 없어서 |
| angry smile | `1.15::glowing eyes, half-closed eyes, shaded face::, looking at viewer, head tilt, baseball cap, mouth mask,` | 「있잖아… 사람은 죽일 수 있어.」 단 한 번의 반말 |
| expressionless | `1.15::expressionless, empty eyes, half-closed eyes::, looking at viewer, baseball cap, mouth mask,` | 기본값 — 빛 빠진 눈 |
| tormented | `1.15::glowing eyes, constricted pupils, furrowed brow::, sweat, trembling, hand on own face, baseball cap, mouth mask,` | 폭주 직전, 안에서 늑대가 들끓음 |
| crazy smile | `1.15::glowing eyes, constricted pupils, wide-eyed::, shaded face, looking at viewer, claw pose, baseball cap, mouth mask,` | 늑대가 움직일 때의 노란 눈(사냥) |

## 호유원 (Ho Yu-won)

성향: 상시 미소, 모두에게 「~님」, 늘 먼저 내미는 따뜻한 손. 놀라도 1초 안에 미소로 복귀, 거절당하면 상처받은 척(연기). 원하는 걸 보면 눈이 번들거리고, 아주 가끔 미소가 떨어지면 텅 빈 정적. 세광 앞에서만 조급(「그래서요? 그다음은요?」). 청 전무에게만 존칭을 뺌. 그림 세 장 모두 주머니에 손 → 3장만 씀. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::light smile, narrowed eyes::, closed mouth, head tilt, looking at viewer, hands in pockets,` | 파일을 읽고 온 눈 — 「참 신기한 우연이네요」 |
| worried | `1.15::worried, raised inner eyebrows::, light smile, looking at viewer, hand on own chest,` | 병문안의 진심 같은 걱정(연기) |
| relieved | `1.15::smile, closed eyes::, open mouth, blush, own hands together,` | 상대가 「네」라고 한 순간 — 「환영합니다!」 |
| disgusted | `1.15::disdain, light smile, half-closed eyes::, shaded face, looking to the side, hands in pockets,` | 「청 전무」 — 존칭을 아플 자리에서만 뺌 |
| determined | `1.15::serious, half-closed eyes::, closed mouth, looking afar, hands in pockets,` | 「잃어버린 걸 되찾고 싶어서요」 세광, 운동장을 바라봄 |
| jealous | `1.15::smile, glaring, sideways glance::, shaded face, closed mouth,` | 세광 정보·인재를 남이 쥐었을 때 |
| pleading | `1.15::wide-eyed, parted lips, raised inner eyebrows::, sweat, leaning forward, own hands clasped,` | 세광 정보원 병상 옆 — 「그래서요? 그다음은요?」 |
| forced smiling | `1.15::forced smile, wide-eyed, sweatdrop::, looking at viewer,` | 놀라서 흐트러진 얼굴이 1초 안에 미소로 돌아오는 중 |
| indifferent | `1.15::light smile, half-closed eyes::, closed mouth, looking down,` | 시체 위에서 구두에 흙이 묻었는지 확인 |
| guilty | `1.15::sad smile, raised inner eyebrows::, closed mouth, looking down, own hands together,` | 죄책감 대신 미안한 척 — 「서류는 제가 잘 봐 둘게요」 |
| pouting | `1.15::pout, raised inner eyebrows, half-closed eyes::, head tilt, hand on own cheek,` | 「어머, 부끄럽고 무섭네요.」 상처받은 척 |
| angry smile | `1.15::smile, half-closed eyes, shaded face::, closed mouth, looking at viewer, outstretched hand,` | 「가장 소중한 것이 저를 만나러 올 거예요」 손을 내밂 |
| expressionless | `1.15::expressionless, empty eyes::, closed mouth, shaded face, looking at viewer,` | 미소가 떨어진 자리 — 「원래 아무것도 없었던 것 같은」 |
| tormented | `1.15::clenched teeth, wide-eyed, constricted pupils::, sweat, shaded face, hand on own face,` | 세광 진입 수십 번 실패, 꺾이지 않는 집착 |
| crazy smile | `1.15::smile, constricted pupils, wide-eyed::, blush, leaning forward, outstretched hand,` | 진짜 세광 정보 앞에서 번들거리는 눈 |

## 청달래 (Cheong Dal-lae)

성향: 자애로운 표정 아래 차가운 침착, 하게체, 목소리를 높이지 않음. 큰 동작 없이 옷매무새만 정리, 검은 눈이 방을 감사하듯 훑다 멈춤. 쓸모 있으면 계약, 계약하면 내 것(소유욕), 칭찬은 감정평가서. 호유원은 애송이로 경멸. 걱정·애원·죄책감·괴로움은 손실 계산·회유·유감·소유물 이탈로 바꿔 읽음. 그림 세 장 모두 팔짱 → 3장. 고정 특징 없음(맨손, 안경 없음).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, light smile::, closed mouth, sideways glance, crossed arms,` | 방을 감사하듯 훑다가 한 사람 위에서 멈춤 |
| worried | `1.15::furrowed brow, half-closed eyes, serious::, closed mouth, looking down, hand on own chin,` | 걱정 대신 자산 손실 계산 |
| relieved | `1.15::light smile, closed eyes::, closed mouth, adjusting necktie,` | 「그럼 이만 된 걸세.」 서명 받고 매무새 정리 |
| disgusted | `1.15::disdain, half-closed eyes::, closed mouth, looking down, crossed arms,` | 「참으로 지저분한 꼴이군. 무슨 소란인가.」 |
| determined | `1.15::serious, light smile, staring::, looking at viewer, holding paper,` | 「계약일세. 서명만 하면 되네. 자, 고르게.」 |
| jealous | `1.15::narrowed eyes, light smile, shaded face::, closed mouth, sideways glance,` | 계약 안 된 유능한 사람 — 남의 것인 상태를 못 견딤 |
| pleading | `1.15::smile, half-closed eyes::, head tilt, looking at viewer, outstretched hand,` | 애원 대신 회유 — 「현명한 선택을 할 줄 아는 아이는 늘 오래 살지」 |
| forced smiling | `1.15::forced smile, half-closed eyes::, closed mouth, looking to the side, crossed arms,` | 호유원과 같은 회의실, 예의상 미소 |
| indifferent | `1.15::expressionless, half-closed eyes::, closed mouth, looking down, holding paper,` | 죽어 가는 부하 앞에서 분할 상환 일정표 |
| guilty | `1.15::closed eyes, serious::, closed mouth, head down,` | 죄책감 대신 「유감이군」 — 손실에 대한 짧은 묵례 |
| pouting | `1.15::annoyed, half-closed eyes::, closed mouth, looking away, hand on own hip,` | 「애송이」 호유원 얘기에 노골적 경멸 |
| angry smile | `1.15::smile, glaring, shaded face::, closed mouth, looking at viewer, outstretched hand,` | 「130666.」 가볍게 뻗은 손 — 전무실 출장 |
| expressionless | `1.15::expressionless, staring::, closed mouth, looking at viewer,` | 자애로운 표정이 걷힌 차가운 침착 |
| tormented | `1.15::clenched teeth, glaring, shaded face::, furrowed brow, clenched hand,` | 소유물이 손을 벗어날 때 — 소리 없는 분노 |
| crazy smile | `1.15::smile, constricted pupils, half-closed eyes::, shaded face, looking at viewer, beckoning,` | 「계약한 것은 내 것」 — 이리 오게 |
