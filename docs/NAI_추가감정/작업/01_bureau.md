# 01 관리국 · 추가 감정 15종 (설정 반영)

2026-10-27 · `규칙.md` 기준. 각 인물 위키(`card/wiki-base.json`)·동작표 Subject·기존 표정 그림 3장(angry/happy/sad)을 보고 짬. 쟈알디는 `00_jyaldi.json`.

## 스팡달 (Spangdal)

성향: 기본값은 「입은 낮게 반쯤 웃고, 눈은 깜빡이지도 않고 응시」(light smile + staring). 포식자형 장난: 귓가에 바짝 붙어 「있잖아, 있잖아」, 장난이 먹히면 평평한 「후후후, 농담이야.」. 가시 손질은 손톱 다듬듯. 개인적인 감정을 말해야 하면 손가락 꼼지락 — 걱정·애원·죄책은 이 서툰 쪽으로 읽음. 동작설계상 눈을 감지 않으므로 closed eyes 안 씀. 고정 특징 `hair over one eye`(그림 27장 모두 앞머리가 한쪽 눈을 덮음). GPT의 `no eye highlights`는 단부루 표준 태그가 아니라 빼고, 「빛 없는 눈」은 필요한 장면에만 `empty eyes`로.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::light smile, staring, half-closed eyes::, looking at viewer, head tilt, hair over one eye,` | 웃는 입은 그대로, 깜빡임 없는 응시 + 「그런 거야?」 고개 기울임 |
| worried | `1.15::worried, closed mouth, staring::, shaded face, own hands together, hair over one eye,` | 「후후」가 빠진 걱정. 후배가 진짜로 질렸을 때 게임을 끝내는 얼굴 |
| relieved | `1.15::light smile, half-closed eyes, sigh::, looking down, hair over one eye,` | 눈은 감지 않음(동작설계). 살아 돌아온 후배 앞 평평한 한숨 |
| disgusted | `1.15::disdain, smirk, half-closed eyes::, looking at viewer, hand on own hip, hair over one eye,` | 능력 보여 달라는 요청에 「우습네. 정말.」 |
| determined | `1.15::serious, narrowed eyes::, closed mouth, shaded face, looking at viewer, hair over one eye,` | 웃음을 내린 그림자 속 후방 암살 직전 |
| jealous | `1.15::light smile, narrowed eyes, sideways glance::, shaded face, crossed arms, hair over one eye,` | 데쥬레의 「제가 더 잘 가르쳐 드릴게요」 맞불을 웃으며 곁눈 |
| pleading | `1.15::blush, averting eyes, wavy mouth::, fidgeting, hair over one eye,` | 애원 대신 진급 도시락 건네며 말 못 하고 손가락 꼼지락 |
| forced smiling | `1.15::forced smile, staring::, empty eyes, looking at viewer, hair over one eye,` | 「후후후, 농담이야.」 입만 웃고 눈은 안 웃는 평평한 톤 |
| indifferent | `1.15::expressionless, half-closed eyes::, looking down, spread fingers, hair over one eye,` | 손톱 다듬듯 손끝(가시) 들여다보며 시큰둥 |
| guilty | `1.15::guilt, looking away, closed mouth::, hand on own neck, hair over one eye,` | 장난이 선을 넘었을 때 한 발 물러섬. 감정 표현에 서툰 손 |
| pouting | `1.15::pout, half-closed eyes::, sideways glance, crossed arms, hair over one eye,` | 잼트리 「스팡달, 입.」에 바로 멈춤. 억울함 없이 입만 닫고 곁눈 |
| angry smile | `1.15::light smile, staring, shaded face::, empty eyes, index finger raised, hair over one eye,` | 「진압팀에서 거절당했대」 소문에 손끝 가시 하나 뽑아 들고 웃음 |
| expressionless | `1.15::expressionless, staring::, closed mouth, looking at viewer, hair over one eye,` | 반쯤 웃는 입까지 내린 응시. 가장 무서운 얼굴 |
| tormented | `1.15::clenched teeth, wide-eyed, constricted pupils::, shaded face, sweat, hand on own face, hair over one eye,` | 무너짐 대신 정체 논쟁의 「가면」이 벗겨지려는 걸 손으로 누름 |
| crazy smile | `1.15::crazy smile, staring, empty eyes::, shaded face, leaning forward, hair over one eye,` | 귓가에 붙어 「있잖아, 있잖아. 너는 언제 죽을 것 같아?」 |

## 잼트리 (Jaemtri)

성향: 햇살 같은 미소가 기본값이고, 그 미소 그대로 규정을 집행한다(「스톱. 이름 말하지 마.」). 미소가 꺼지면 독기 서린 눈 「그래서 뭐?」. 다정·장난·오냐오냐, 소문 본사, 쇼핑몰 순찰, 탕비실 권력자. 수년간 다정한 언니 모습을 한 번도 안 무너뜨림 → 괴로움도 웃음으로 버팀. 소품은 연유 커피 잔 2장 + 태블릿 1장. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::smile, narrowed eyes, closed mouth::, head tilt, hand on own cheek,` | 웃는 얼굴 그대로 진술의 빈틈을 짚는 눈 |
| worried | `1.15::worried, raised inner eyebrows::, closed mouth, looking down, holding cup,` | 크게 다쳐 온 후배에게 아무것도 묻지 않고 연유 더 넣은 커피 |
| relieved | `1.15::smile, half-closed eyes, sigh::, open mouth, hand on own chest,` | 「어머, 후배, 왔어?」 살아 돌아온 걸 확인한 안도 |
| disgusted | `1.15::smile, disgust, half-closed eyes::, holding cup,` | 탕비실 침공 사건. 남이 탄 커피 한 모금, 웃음의 온도만 다름 |
| determined | `1.15::light smile, serious, narrowed eyes::, looking at viewer, hand on own hip,` | 다정한 톤 그대로 서류 항목 확인으로 전환 |
| jealous | `1.15::pout, sideways glance, blush::, hand on own cheek,` | 질투 대신 「블랙 파」 신입에게 살짝 서운한 곁눈 |
| pleading | `1.15::smile, raised inner eyebrows::, parted lips, head tilt, beckoning,` | 애원 대신 「뭐 고민 있으면 꼭 언니한테 물어봐.」 손짓 |
| forced smiling | `1.15::forced smile, sweatdrop, half-closed eyes::, head tilt, hand on own hip,` | 부장 「하아. 잼트리. 이것 좀 어떻게 해 봐.」 오늘 n번째 |
| indifferent | `1.15::bored, half-closed eyes::, closed mouth, looking down, holding tablet pc,` | 쇼핑몰(=순찰) 하염없이 구경하는 얼굴 |
| guilty | `1.15::guilt, smile, looking away::, sweatdrop, scratching cheek,` | 사무실 소문 본사가 들킴. 「어머, 무슨 얘기야?」 |
| pouting | `1.15::pout, half-closed eyes, blush::, crossed arms,` | 「선배님」이라 불려 서운한 언니 |
| angry smile | `1.15::smile, narrowed eyes, shaded face::, closed mouth, index finger raised,` | 미소 유지한 채 「스톱. 이름 말하지 마.」 |
| expressionless | `1.15::expressionless, narrowed eyes::, closed mouth, looking at viewer, crossed arms,` | 미소가 꺼짐 → 「그래서 뭐?」 직전의 독기 |
| tormented | `1.15::sad smile, tearing up, furrowed brow::, looking down, own hands clasped,` | 못 지킨 생존자. 다정한 언니 모습을 끝내 안 무너뜨리는 웃음 |
| crazy smile | `1.15::smile, empty eyes, shaded face::, closed mouth, head tilt, looking at viewer,` | 광기 대신 사라진 경매 글 「어머, 무슨 얘기야?」 그 웃음이 대답 |

## 에일린 (Aileen)

성향: 말이 짧고(한두 단어), 빛 빠진 탁한 눈, 글자 읽을 때 눈을 가늘게 뜸. 근속 연수 얘기에 돌아보지도 않고 한숨, 「쓰레기 회사」라 하고 야근, 「쉬었나?」에 「응」(=아니). 교회 얘기엔 더 조용해짐 — 울지 않음. 대화 중 총 손질 버릇은 무기 금지라 「손 안 쓰고 아래를 보며 대꾸」로만 남김. 큰 웃음·눈물 없음. 고정 특징 없음(방탄조끼는 그림에 안 보임).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, expressionless::, closed mouth, looking to the side, crossed arms,` | 사람보다 출구·표지판 먼저. 글자 읽을 때 가늘어지는 눈 |
| worried | `1.15::furrowed brow, serious::, closed mouth, looking down, hand on own chin,` | 걱정 = 사상자 셈. 콘쥬스를 어디까지 떨어뜨려 둘지 |
| relieved | `1.15::half-closed eyes, sigh::, closed mouth, looking down, hands in pockets,` | 나온 사람 수 = 들어간 사람 수. 「됐어. 그래.」 |
| disgusted | `1.15::disgust, half-closed eyes::, frown, looking away,` | 「관리국이 하는 일은 쓰레기 회사랑 다를 게 없어.」(30분 뒤 야근 신청) |
| determined | `1.15::serious, narrowed eyes::, closed mouth, looking at viewer,` | 「증명해.」 한 단어 명령. 총 없이 눈으로 |
| jealous | `1.15::annoyed, half-closed eyes::, sigh, sideways glance,` | 질투 대신 등 뒤 「저 선배 10년 차야」에 돌아보지도 않는 한숨 |
| pleading | `1.15::serious, furrowed brow::, parted lips, looking at viewer, outstretched hand,` | 애원 대신 「손도 안 내밀 만큼 쓸모없는 인간은 아니야. 해.」 |
| forced smiling | `1.15::forced smile, tired, averting eyes::, hand in pocket,` | 부장 「쉬었나?」에 「응」(=아니) |
| indifferent | `1.15::expressionless, half-closed eyes::, closed mouth, looking down,` | 총 부품에서 눈 안 떼고 대꾸. 지휘급 소감 「됐어. 그래.」 |
| guilty | `1.15::shaded face, looking down::, closed mouth, furrowed brow, clenched hand,` | 들어간 수와 나온 수가 다른 날 |
| pouting | `1.15::annoyed, pout::, looking away, crossed arms,` | 휴식 명령에 「알겠어」. 그리고 안 쉼 |
| angry smile | `1.15::smirk, glaring::, shaded face, looking at viewer,` | 데드폴의 죽음이 적힌 계획표에 「다시 짜.」 |
| expressionless | `1.15::expressionless, empty eyes::, closed mouth, looking at viewer,` | 빛 빠진 탁한 눈, 늘 판단 중인 정지된 분위기 |
| tormented | `1.15::empty eyes, clenched teeth::, shaded face, looking down, clenched hand,` | 「교회」 이름이 나올 때. 울지 않고 더 조용해짐 |
| crazy smile | `1.15::light smile, empty eyes, tired::, shaded face, looking at viewer,` | 광기 대신 「그래도 조끼는 챙기는 게 웃기지」 건조한 자조 |

## 고르고디오 (Gorgodio)

성향: 비밀이 없다 — 감정이 숨김없이 그대로 얼굴에 나옴(억지웃음도 티가 남). 호통과 배려가 한 문장(「오지 말라 했잖아요! … 쉬어요.」), 정면 돌파 본능(기둥 보면 손이 근질), 전투 후엔 큰 목소리 수사관(「잠깐, 아까는…?」). 기분 좋으면 사투리. 장갑 상태는 짧고 건조한 집행 모드. 칼은 무기라 안 씀. 고정 특징 없음(민머리·수염은 베이스).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::raised eyebrow, frown::, open mouth, looking at viewer, stroking own chin,` | 전투 후 수사관. 「잠깐, 아까는 왼쪽 계단이라면서요?」 큰 소리로 |
| worried | `1.15::worried, furrowed brow::, closed mouth, looking down, own hands clasped,` | 큰 몸을 숙인 걱정. 생존자 안부 |
| relieved | `1.15::grin, closed eyes::, sweat, hand on own head,` | 작전이 잘 끝난 날 민머리 땀 훔치며, 사투리 나오는 얼굴 |
| disgusted | `1.15::disgust, furrowed brow::, frown, looking at viewer, crossed arms,` | 거짓 진술한 쪽을 숨김없는 얼굴로 내려다봄 |
| determined | `1.15::serious, v-shaped eyebrows, open mouth::, looking at viewer, clenched hand,` | 「적합자 고르고디오! 승인 요청!」 |
| jealous | `1.15::frown, sideways glance::, closed mouth, hand on own hip,` | 숨길 줄 모르는 서운함. 큐라스가 남의 팀 신입에게 들러붙을 때 |
| pleading | `1.15::raised inner eyebrows, open mouth::, looking at viewer, outstretched hand,` | 다정한 호통 「오지 말라 했잖아요! … 쉬어요.」 |
| forced smiling | `1.15::forced smile, sweatdrop::, looking away, scratching head,` | 피해 항목 칸이 모자람. 숨길 줄 몰라 억지웃음이 다 보임 |
| indifferent | `1.15::bored, half-closed eyes::, closed mouth, looking to the side, crossed arms,` | 긴 작전 회의 — 「그냥 이거부터 다 부수는 게 낫지 않나?」 |
| guilty | `1.15::guilt, furrowed brow::, closed mouth, looking down, own hands clasped,` | 무너진 건물 앞에서 큰 몸을 숙임 |
| pouting | `1.15::frown, pout::, looking to the side, clenched hand,` | 기둥 사건. 도면 보고 아쉬운 표정으로 손을 내림 |
| angry smile | `1.15::smirk, glaring, shaded face::, looking at viewer, cracking knuckles,` | 장갑 소환 직전 「그럼 나오는 건 다 죽이면 되겠네.」 |
| expressionless | `1.15::expressionless, serious::, closed mouth, looking at viewer,` | 표정 변화가 수염에 가려 안 보임. 짧고 건조한 집행 모드 |
| tormented | `1.15::clenched teeth, furrowed brow, sweat::, shaded face, looking down, clenched hands,` | 장갑 내구도가 먼저 무너지는 정점급 상대 앞에서 버팀 |
| crazy smile | `1.15::crazy smile, wide-eyed::, sweat, looking up, outstretched hand,` | 하중 받치는 기둥을 보면 손이 근질 — 부수고 싶은 미소 |

## 큐라스 (Kyuras)

성향: 웃는 얼굴이 기본값, 쉬지 않는 수다 속에 전술 보고. 손가락 튕기기(snapping fingers)가 능력이자 버릇, 퇴장할 땐 두 손가락 경례, 영입 멘트로 손가락질. 스팡달 앞에선 하얗게 질리면서도 웃으려 애씀(turn pale). 생존자를 울리고 사과 열두 번, 가슴을 친다. 「큐라스가 안 웃으면 철수 준비」 → 무표정 = 진짜 위기. 무관심은 「드문 침묵 = 체력 아끼는 중」으로 바꿔 읽음. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::smile, narrowed eyes, raised eyebrow::, closed mouth, pointing at viewer,` | 상대가 그 이름 꺼내기 직전 표정부터 읽음 — 「알아, 알아, 그 대령」 |
| worried | `1.15::worried, open mouth::, sweat, looking to the side,` | 「왼쪽 괜찮아? 형님 괜찮아?」 수다 속 위치 확인 |
| relieved | `1.15::smile, open mouth, closed eyes::, sweat, hand on own chest,` | 「아 됐다 됐다, 다음!」 형님 무사 |
| disgusted | `1.15::disgust, open mouth, half-closed eyes::, sweatdrop, hand on own forehead,` | 「로이 머스탱 얘기 내 평생 백 번은 들었어!」 |
| determined | `1.15::confident, grin::, looking at viewer, snapping fingers,` | 「왼쪽으로 돌 테니까 여기서 엄호해!」 웃음 유지한 결단 |
| jealous | `1.15::frown, sideways glance, wavy mouth::, hand on own chest,` | 놓친 생존자가 종합대응팀으로 간 얘기 — 가슴을 친다 |
| pleading | `1.15::smile, open mouth, raised inner eyebrows::, looking at viewer, pointing at viewer,` | 애원 = 영입 멘트 「진압팀엔 너 같은 인재가 필요해!」 |
| forced smiling | `1.15::forced smile, turn pale, nervous sweating::, looking at viewer,` | 스팡달 「큐라스, 여보세요?」 — 질린 채 웃으려 애씀 |
| indifferent | `1.15::half-closed eyes, tired::, closed mouth, looking away, hand in pocket,` | 무관심 대신 드문 침묵 = 체력 아끼는 중 |
| guilty | `1.15::guilt, open mouth, raised inner eyebrows::, sweat, own hands together,` | 생존자를 울려서 사과 열두 번 |
| pouting | `1.15::pout, half-closed eyes::, looking to the side, two-finger salute,` | 영입 실패하고 나가는 두 손가락 경례 |
| angry smile | `1.15::grin, glaring, shaded face::, looking at viewer, snapping fingers,` | 형님 이음새 노린 사수 — 웃는 얼굴로 공중 요격 |
| expressionless | `1.15::expressionless, serious::, closed mouth, looking at viewer,` | 「큐라스가 안 웃으면 철수 준비」 |
| tormented | `1.15::clenched teeth, furrowed brow, sweat::, exhausted, looking down, holding own arm,` | 출력은 체력에 묶임. 백 번 넘게 튕긴 손가락 |
| crazy smile | `1.15::crazy smile, wide-eyed::, sweat, looking at viewer, snapping fingers,` | 드럼 솔로처럼 빨라지는 연속 튕기기(지휘자 vs 물에 빠진 사람) |

## 데드폴 (Deadpole)

성향: 조심스러운 존댓말, 말끝 흐림, 깨어나면 첫마디가 남 걱정, 문제가 생기면 「제가… 혹시 제가…」 자책. 눈 규칙이 위키에 있음: 놀라면 동그래짐(wide-eyed), 잘못됐다 싶으면 가늘고 날카로움(narrowed eyes), 감으면 냄새 맡는 중. 칭찬에 두 가지 웃음(쓸모 = 복잡한 웃음, 사람 = 진짜 웃음). 자기 죽음을 출퇴근 얘기처럼 담담하게. 권총은 무기라 안 씀. 고정 특징 `black gloves`(위키 방검 장갑 + 그림 확인).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, serious::, closed mouth, looking to the side, black gloves,` | 뭔가 잘못됐다 싶으면 가늘고 날카로워지는 눈 |
| worried | `1.15::worried, raised inner eyebrows::, parted lips, looking at viewer, hand on own chest, black gloves,` | 깨어나자마자 「괜찮으세요? 놀라셨죠?」 |
| relieved | `1.15::smile, raised inner eyebrows, half-closed eyes::, sweat, black gloves,` | 「살아남으셨… 아, 저 말고요. 당신이요.」 |
| disgusted | `1.15::disgust, frown, narrowed eyes::, smelling, looking to the side, black gloves,` | 기억 속 달콤함 같은, 익숙한 이상함의 냄새 |
| determined | `1.15::light smile, serious::, closed mouth, looking at viewer, hand on own chest, black gloves,` | 「여기서 제가 한 번 죽으면 시간이 벌리니까요.」 담담하게 |
| jealous | `1.15::sad smile, sideways glance::, closed mouth, black gloves,` | 질투 대신 남들 접시에만 고기 올리는 쪽의 곁눈 |
| pleading | `1.15::tearing up, raised inner eyebrows, parted lips::, looking at viewer, reaching towards viewer, black gloves,` | 기생체 1호 「저… 한 번만… 죽여 주세요. 그럼 나가요.」 |
| forced smiling | `1.15::forced smile, raised inner eyebrows::, looking down, own hands together, black gloves,` | 쓸모를 칭찬받았을 때의 복잡한 웃음 |
| indifferent | `1.15::expressionless, half-closed eyes::, closed mouth, looking to the side, black gloves,` | 무관심 대신 자기 죽음에 덤덤 — 「음… 아파요」 |
| guilty | `1.15::guilt, nervous sweating, raised inner eyebrows::, looking down, bowing, black gloves,` | 「제가… 혹시 제가…」 말리기 전에 사과 세 번 |
| pouting | `1.15::pout, furrowed brow::, blush, looking to the side, black gloves,` | 게슈간과 다정한 투닥거림. 「그래. 미안.」 나오기 직전 |
| angry smile | `1.15::light smile, narrowed eyes, shaded face::, looking at viewer, black gloves,` | 「죄송합니다」 하고 쏘기 직전(총은 안 그림) |
| expressionless | `1.15::expressionless, closed eyes::, closed mouth, black gloves,` | 눈 감음 = 냄새 맡는 중, 조용히 |
| tormented | `1.15::clenched teeth, tears, furrowed brow::, sweat, looking down, clenched hand, black gloves,` | 되살아나며 신음. 죽는 건 매번 아프고, 묻기 전엔 말 안 함 |
| crazy smile | `1.15::smile, wide-eyed, shaded face::, head tilt, looking at viewer, black gloves,` | 「뒤에서 찌르시면 저는 아플 거예요. 물론, 살아남겠지만요.」 |

## 게슈간 (Geshugan)

성향: 무덤덤·경계(위협 평가부터, 문 마주 보는 자리), 말 적음 「그래. 미안.」. 주먹 쥐기 = 염동력 좌표 신호(clenched hand). 독수리 타법 지적엔 노려봄, 데드폴에게만 안 노려봄. 따뜻함은 늦게, 진짜로 — 재회 때 「…해냈어…」 반복. 애원·억지웃음처럼 안 어울리는 감정은 무뚝뚝한 쪽으로 바꿔 읽음. 큐브는 그림에 없어 동작표처럼 안 씀. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, expressionless::, closed mouth, sideways glance, crossed arms,` | 낯선 사람에게 먼저 하는 위협 평가 |
| worried | `1.15::furrowed brow, expressionless::, looking down, holding own arm,` | 말없는 걱정 — 데드폴이 깨어나길 기다림 |
| relieved | `1.15::light smile, tearing up, half-closed eyes::, looking down,` | 재회한 어깨에 대고 「…해냈어. …해냈어…」 |
| disgusted | `1.15::disdain, half-closed eyes::, closed mouth, looking away, hands in pockets,` | 기관 자체를 안 믿음. 의무 복무 얘기에 |
| determined | `1.15::glaring, serious::, closed mouth, looking at viewer, clenched hand,` | 가리키고, 보고, 쥐고, 끝 — 좌표 지정 주먹 |
| jealous | `1.15::annoyed, sideways glance::, closed mouth, crossed arms,` | 로제몬이 다른 사람 팔을 잡아끌 때의 못마땅한 곁눈 |
| pleading | `1.15::raised inner eyebrows, closed mouth::, looking at viewer, index finger raised,` | 애원 대신 독수리 타법(손가락 하나)이 막혀 데드폴을 쳐다봄 — 노려보지 않는 유일한 상대 |
| forced smiling | `1.15::forced smile, half-closed eyes::, looking away, hand in pocket,` | 회식 고깃집, 문 마주 보는 자리에서 사교용 입꼬리 |
| indifferent | `1.15::expressionless, half-closed eyes::, closed mouth, looking away, hands in pockets,` | 고맙다는 말에 대꾸 없이 지나감 |
| guilty | `1.15::guilt, looking away::, closed mouth, hand on own neck,` | 데드폴 사망 사건 — 「그래. 미안.」 |
| pouting | `1.15::glaring, pout::, closed mouth, looking at viewer, crossed arms,` | 독수리 타법 한마디에 노려봄(칭찬해도) |
| angry smile | `1.15::smirk, glaring::, shaded face, looking at viewer, clenched hand,` | 노크 없이 다가온 신입 — 의자째 반 바퀴 |
| expressionless | `1.15::expressionless, staring::, closed mouth, looking at viewer,` | 도망칠지 말지 저울질하는 기본값 얼굴 |
| tormented | `1.15::clenched teeth, glaring, furrowed brow::, shaded face, sweat, looking down, clenched hand,` | 불 꺼진 격리 복도 기억. 무너짐 대신 이 악묾 |
| crazy smile | `1.15::smirk, constricted pupils, glaring::, shaded face, looking at viewer, outstretched hand,` | 격리 탈출 개체를 공중에 띄우는 둔기 — 무덤덤한 입꼬리 |

## 로제몬 (Rojemon)

성향: 가시 돋친 반말과 투덜거림이 기본(「헛소리하지 마」, 「현장 출동이면 난 안 가」 — 그리고 감). 귀여운 얼굴이라 노려봐도 위협이 안 됨. 표현이 전부 반대: 칭찬 두 번 → 빨개짐 → 보라색 → 「죽여 버린다」, 걱정 → 퉁명한 「어땠어? 뭔데?」, 애정 → 팔 붙잡고 「내 옆에 있어」. 「저기!」 손가락질, 기댈 벽, 「못 해. 뭐 어쩌라고」 으쓱, 능력 쓸 때 눈이 반짝(glowing eyes). 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, frown::, closed mouth, leaning forward, looking at viewer,` | 동료 눈을 들여다보며 「너 지금 이상해」 |
| worried | `1.15::worried, furrowed brow, pout::, looking away, crossed arms,` | 걱정은 퉁명한 반말로 — 「어땠어? 뭔데?」 |
| relieved | `1.15::half-closed eyes, sigh::, sweat, against wall,` | 벽에 등 붙이고 「반반이었어. 운 좋았어.」 |
| disgusted | `1.15::disgust, half-closed eyes, tongue out::, looking away,` | 마음을 직접 읽으면 「그건 맛이 없어.」 |
| determined | `1.15::v-shaped eyebrows, open mouth::, looking to the side, pointing,` | 「저기!」 — 3인조 최강 무기인 손가락 |
| jealous | `1.15::pout, glaring, blush::, sideways glance, crossed arms,` | 질투도 반대로 — 노려봐도 귀여워서 위협이 안 됨 |
| pleading | `1.15::frown, blush, raised inner eyebrows::, looking at viewer, reaching towards viewer,` | 애원 대신 팔 붙잡으며 「내 옆에 있어.」(명령형) |
| forced smiling | `1.15::forced smile, tired, half-closed eyes::, sweatdrop, hand on own hip,` | 「현장 출동이면 난 안 가」 하고 출근복 그대로 끌려 나온 얼굴 |
| indifferent | `1.15::bored, half-closed eyes::, closed mouth, looking away, shrugging,` | 「못 해. 뭐 어쩌라고.」 / 「몰라. 묻지 마. 일이나 해.」 |
| guilty | `1.15::blush, wavy mouth, averting eyes::, sweat,` | 죄책감 대신 인형극 화면 오래 보다 들킴 — 「뭘 봐」 |
| pouting | `1.15::pout, puffy cheeks, v-shaped eyebrows::, hands on own hips,` | 「그러니까 내가 사무직이라고!」 |
| angry smile | `1.15::full-face blush, anger vein, smile::, clenched teeth, clenched hands,` | 칭찬 두 번 → 보라색 → 「죽여 버린다」(사실 즐김) |
| expressionless | `1.15::expressionless, glowing eyes::, closed mouth, looking at viewer,` | 최면 순간 목소리가 낮고 평평해짐 — 「돌아가.」 |
| tormented | `1.15::wide-eyed, clenched teeth, tearing up::, sweat, hands on own head,` | 읽히는 것·조종당하는 것 = 개인적 악몽 |
| crazy smile | `1.15::smirk, glowing eyes, wide-eyed::, shaded face, spread fingers,` | 인형술 전력 — 보라 실로 마네킹 여럿을 지휘 |

## 콘쥬스 (Konjyuce)

성향: 밝고 고집 세고 친근. 호칭 재협상(「아저씨」→「오빠」 = 부탁 신호, 들키면 윙크), 논리 감사(고개 갸웃하고 한 문장으로 짚은 뒤 예의 바르게 기다림), 「저도 이 팀 정식 멤버거든요!」 항의, 장비를 관광 명소처럼(「만지지 마」 최다 청취). 밝음이 아직 생생한 슬픔을 덮고 있음 → 무표정·괴로움은 집 얘기로. 총은 무기라 안 그림. 고정 특징 없음. ※ 위키는 20세 대학생·과잠, 그림은 블레이저 교복 — 옷 태그는 안 넣었으므로 영향 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::raised eyebrow, closed mouth::, looking at viewer, head tilt,` | 논리 감사 — 「아내는 사람 이름이 아니잖아요.」 그리고 기다림 |
| worried | `1.15::worried, closed mouth::, looking up, own hands together,` | 위험도 높은 작전 나가는 부장을 올려다봄 |
| relieved | `1.15::smile, closed eyes, open mouth::, sweat, hand on own chest,` | 대피 작전 끝, 마지막 할머니까지 안전선 |
| disgusted | `1.15::disgust, wavy mouth, half-closed eyes::, holding cup,` | 「정식 멤버」인데 또 커피 대신 우유 |
| determined | `1.15::v-shaped eyebrows, confident::, closed mouth, looking at viewer, clenched hands,` | 소매 걷고 콘크리트 더미 들기 직전 |
| jealous | `1.15::pout, sideways glance, puffy cheeks::, crossed arms,` | 질투 대신 혼자 브리핑실 문 밖에 남겨진 막내 |
| pleading | `1.15::smile, one eye closed, blush::, head tilt, own hands together,` | 「아저씨」→「오빠」 전환 = 부탁(대개 간식) + 윙크 |
| forced smiling | `1.15::forced smile, raised inner eyebrows::, looking at viewer, waving,` | 소리친 다음 날 아침 평소처럼 「오빠, 안녕하세요!」 |
| indifferent | `1.15::expressionless, half-closed eyes::, closed mouth, looking at viewer,` | 친근할 이득 없는 상대에게 무미건조한 「아저씨」 |
| guilty | `1.15::guilt, sweatdrop, wavy mouth::, looking away, scratching head,` | 측정 장비에 기댔다가 또 고장 |
| pouting | `1.15::pout, puffy cheeks::, looking to the side, hands behind back,` | 「만지지 마」 n번째 — 손 거두고 볼 부풀림 |
| angry smile | `1.15::smile, anger vein, v-shaped eyebrows::, looking at viewer, pointing at viewer,` | 「잠깐만요! 저도 이 팀 정식 멤버거든요!」 |
| expressionless | `1.15::expressionless, empty eyes::, closed mouth, looking down,` | 집에 대해 물었을 때 밝음이 빠진 순간 |
| tormented | `1.15::tears, open mouth, furrowed brow::, looking down, clenched hands,` | 「부모님 돌아가신 지 얼마 안 됐다고요!」 소리침 |
| crazy smile | `1.15::grin, wide-eyed, sparkling eyes::, blush, leaning forward,` | 광기 대신 「우와! 진짜 총 처음 봐요!」(총은 안 그림) |

## 고그니쟈 (Gognija)

성향: 최대 음량 하게체, 과한 환영(두 팔 벌림), 질문엔 바로 답하지만 정보는 필요한 만큼만, 윗선 질문엔 크게 웃는 게 대답의 전부. 믹스커피 의무(연구실 제1법칙), 알약 씹기, 괴이에 「오오, 상태가 좋군!」 신남. 고정 특징 `round eyewear, sunglasses`: 위키는 「둥근 고글」이지만 그림 27장은 렌즈가 검은 둥근 선글라스(맨눈 안 보임) → GPT의 `goggles`는 버림. **눈이 가려져** 눈·시선 태그 없이 입·고개(`facing viewer`, `head down`, `head tilt`, `head back`)·손으로만 감정을 냄. 소품은 커피 잔 3장.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::frown, closed mouth::, leaning forward, facing viewer, round eyewear, sunglasses,` | 커피를 마저 안 마신 신입을 들여다봄(안 마시면 또 혼남) |
| worried | `1.15::frown, closed mouth::, head down, holding cup, round eyewear, sunglasses,` | 수용실 수치 이상 — 커피잔 든 채 모니터 앞에 나타남 |
| relieved | `1.15::laughing, open mouth::, head back, hand on own chest, round eyewear, sunglasses,` | 수용 사고 수습 뒤 지하 전 층에 울리는 웃음 |
| disgusted | `1.15::disgust, wavy mouth::, head tilt, index finger raised, round eyewear, sunglasses,` | 블랙 요청에 「여기서는 안 되네!」(설탕 두 스푼 추가) |
| determined | `1.15::confident, smirk::, facing viewer, adjusting eyewear, round eyewear, sunglasses,` | 고글을 손가락으로 꾹 밀어 올리고 해결책 지휘 |
| jealous | `1.15::frown, pout::, head tilt, crossed arms, round eyewear, sunglasses,` | 질투 대신 데쥬레가 위층(잼트리 옆)에 가 있어 커피가 안 오는 날 |
| pleading | `1.15::shouting, open mouth::, head back, round eyewear, sunglasses,` | 애원 = 「데쥬레!!! 커피 좀 타 오게! 빨리!!!」 지하 전 층 생중계 |
| forced smiling | `1.15::forced smile, sweatdrop::, head tilt, hands in pockets, round eyewear, sunglasses,` | 윗선·사장 질문 — 크게 웃는 게 대답의 전부 |
| indifferent | `1.15::expressionless, chewing::, head down, hands in pockets, round eyewear, sunglasses,` | 알약 씹기 + 키보드 = 연구실 BGM. 「몸에 좋은 걸세!」 |
| guilty | `1.15::smile, sweatdrop::, closed mouth, scratching head, round eyewear, sunglasses,` | 꽝에도 환호했는데 꽝 처리 서류는 데쥬레 몫 — 머쓱 |
| pouting | `1.15::pout, wavy mouth::, head down, holding cup, round eyewear, sunglasses,` | 자기가 탄 믹스커피는 맛이 없다고 투덜 |
| angry smile | `1.15::grin, shaded face::, teeth, facing viewer, holding cup, round eyewear, sunglasses,` | 연구실 제1법칙 「누구나 달달한 믹스커피를 마셔야 하네!」 |
| expressionless | `1.15::expressionless, closed mouth::, facing viewer, round eyewear, sunglasses,` | 웃음이 꺼지면 고글만 남음 — 인간 연구원 이상이라는 소문 |
| tormented | `1.15::clenched teeth, frown, sweat::, shaded face, hand on own head, round eyewear, sunglasses,` | 시설이 몸의 일부인데 불이 꺼진 날 — 지하가 낯선 미로가 됨 |
| crazy smile | `1.15::crazy smile, open mouth, teeth::, spread arms, round eyewear, sunglasses,` | 목숨 걸고 잡아 온 괴이에 「오오, 상태가 좋군!」 두 팔 벌림 |

## 데쥬레 (Dejure)

성향: 「아, 아와와...!」 펄쩍, 시선은 바닥, 손가락 끝 맞대고 꼼지락(index fingers together)이 기본자세, 시키기 전에 먼저 사과, 말끝 흐림. 다만 「데쥬레 모드」(유물 다룰 때·진짜 위기)엔 손이 안 떨리고 말이 또렷 → 무관심·무표정은 이쪽으로 읽음. 「선배」 소리에 빨개지며 「헤헤」, 스팡달 앞에선 「제가 잘못했어요!」 패닉, 그런데도 「스팡달 선배보다 잘 가르쳐 드릴게요...!」 맞불. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `1.15::narrowed eyes, nervous, sweat::, closed mouth, looking back,` | 엘리베이터 소리 — 스팡달인가?(수용실 괴이보다 먼저 반응) |
| worried | `1.15::worried, raised inner eyebrows, wavy mouth::, sweat, looking down, index fingers together,` | 「저기... 그... 3번 수용실... 수치가... 조금...」 |
| relieved | `1.15::smile, tearing up, raised inner eyebrows::, hand on own chest,` | 잼트리가 「스팡달, 입.」 해 줘서 살았다 |
| disgusted | `1.15::disgust, wavy mouth, tearing up::, leaning back,` | 스캔에 사람 것 같은 실루엣 — 비명이 먼저(1.5초), 분류는 그다음 |
| determined | `1.15::v-shaped eyebrows, blush, open mouth::, nervous sweating, clenched hands,` | 떨면서 맞불 「제가 스팡달 선배보다 더 잘 가르쳐 드릴게요...!」 |
| jealous | `1.15::pout, sideways glance, tearing up::, index fingers together,` | 한쪽에서만 성립하는 스팡달과의 교육 경쟁 |
| pleading | `1.15::streaming tears, open mouth, raised inner eyebrows::, trembling, own hands together,` | 스팡달 귓속말에 「제가 잘못했어요! 죄송해요오...!」 |
| forced smiling | `1.15::forced smile, sweatdrop, raised inner eyebrows::, looking to the side, holding cup,` | 오후 세 시 「데쥬레!!! 커피」 — 또 달려가는 웃음 |
| indifferent | `1.15::expressionless, half-closed eyes::, closed mouth, looking down,` | 무관심 대신 데쥬레 모드 — 「이건 꽝이에요」 평평한 판정 |
| guilty | `1.15::guilt, tearing up, raised inner eyebrows::, looking down, bowing,` | 아무도 뭐라 안 했는데 「죄, 죄송해요...」(떨어진 수화기에도) |
| pouting | `1.15::pout, puffy cheeks, blush::, looking down, index fingers together,` | 업무 중 커피 타기가 제일 유명한 게 약간 억울 |
| angry smile | `1.15::smile, anger vein, tearing up::, sweatdrop, clenched hands,` | 꽝에도 환호하는 상사 — 서류는 내 몫, 웃으며 부글 |
| expressionless | `1.15::expressionless, serious::, closed mouth, looking at viewer,` | 진짜 위급할 땐 떨림이 멈추고 말이 또렷해짐 |
| tormented | `1.15::tears, clenched teeth, furrowed brow::, sweat, looking down, own hands clasped,` | 목격자보다 먼저 울면서도 재현은 끝까지 — 무섭지만 믿을 만함 |
| crazy smile | `1.15::grin, full-face blush, tearing up::, hands on own cheeks,` | 광기 대신 「선배」 소리에 「제가 선배... 헤헤...」 웃음이 샘 |
