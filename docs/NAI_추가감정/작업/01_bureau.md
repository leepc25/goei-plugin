# 01 관리국 · 추가 감정 15종 (설정 반영)

> 2026-10-27 수정: 가중치(`1.15::`)와 손에 든 소품(담배·컵·서류·휴대폰·마이크·동물 등)을 전부 뺐다.

> 2026-10-27 개정 2: 장면마다 팔·손 동작 1개 + 몸 자세 1개를 넣어 다시 짰다(멀뚱히 서 있던 문제). 가중치는 작은 핵심 동작이나 기본 얼굴과 반대인 표정에만, 이유는 「읽은 방식」에 적음.

2026-10-27 · `규칙.md` 기준. 각 인물 위키(`card/wiki-base.json`)·동작표 Subject·기존 표정 그림 3장(angry/happy/sad)을 보고 짬. 쟈알디는 `00_jyaldi.json`.

## 스팡달 (Spangdal)

성향: 기본값은 「입은 낮게 반쯤 웃고, 눈은 깜빡이지도 않고 응시」(light smile + staring). 포식자형 장난: 귓가에 바짝 붙어 「있잖아, 있잖아」, 장난이 먹히면 평평한 「후후후, 농담이야.」. 가시 손질은 손톱 다듬듯. 개인적인 감정을 말해야 하면 손가락 꼼지락 — 걱정·애원·죄책은 이 서툰 쪽으로 읽음. 동작설계상 눈을 감지 않으므로 closed eyes 안 씀. 고정 특징 `hair over one eye`(그림 27장 모두 앞머리가 한쪽 눈을 덮음). GPT의 `no eye highlights`는 단부루 표준 태그가 아니라 빼고, 「빛 없는 눈」은 필요한 장면에만 `empty eyes`로.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `light smile, staring, half-closed eyes, looking at viewer, leaning forward, hand on own hip, hair over one eye,` | 누구도 원하지 않는 거리까지 다가와 서서, 웃는 입 그대로 「그런 거야?」 |
| worried | `1.15::worried::, closed mouth, staring, looking down, head down, hand on own arm, hair over one eye,` | 걱정을 말로 못 해 제 팔을 붙잡음. 반쯤 웃는 기본 얼굴과 반대라 worried에 가중치 |
| relieved | `light smile, half-closed eyes, sigh, head back, hand on own chest, hair over one eye,` | 살아 돌아온 후배 앞 평평한 한숨. 동작설계상 눈을 감지 않음 |
| disgusted | `disdain, smirk, half-closed eyes, looking at viewer, leaning back, crossed arms, hair over one eye,` | 능력 보여 달라는 요청에 몸을 빼며 「우습네. 정말.」 |
| determined | `serious, narrowed eyes, closed mouth, shaded face, looking at viewer, leaning forward, outstretched hand, hair over one eye,` | 그림자 속 후방 암살 직전, 손끝(가시는 안 그림)을 뻗음 |
| jealous | `light smile, narrowed eyes, sideways glance, shaded face, looking back, crossed arms, hair over one eye,` | 데쥬레의 「제가 더 잘 가르쳐 드릴게요」를 어깨 너머로 웃으며 곁눈 |
| pleading | `1.2::blush, wavy mouth::, averting eyes, head down, own hands together, hair over one eye,` | 애원 대신 진급 도시락 건네며 말 못 하고 손 모아 꼼지락. 기본 얼굴과 정반대라 붉힘·물결 입에 가중치 |
| forced smiling | `forced smile, staring, empty eyes, looking at viewer, leaning back, palm up, hair over one eye,` | 신입이 질리면 한 발 물러서며 「후후후, 농담이야.」 입만 웃음 |
| indifferent | `expressionless, half-closed eyes, looking away, head tilt, head rest, hair over one eye,` | 「우습네」류 시큰둥 — 턱 괴고 딴 데 봄 |
| guilty | `1.15::guilt::, looking away, closed mouth, head down, hand on own neck, hair over one eye,` | 장난이 선을 넘었을 때 고개 숙이고 목덜미. 거의 안 보이는 감정이라 guilt에 가중치 |
| pouting | `half-closed eyes, sideways glance, blush, head tilt, hand over own mouth, hair over one eye,` | 잼트리 「스팡달, 입.」에 억울한 기색 없이 제 손으로 입을 막음(입 모양 태그 안 씀) |
| angry smile | `light smile, staring, shaded face, empty eyes, leaning forward, 1.2::index finger raised::, hair over one eye,` | 「진압팀에서 거절당했대」에 손끝 가시 하나 뽑아 들고 웃음. 손가락 하나라 묻혀서 가중치 |
| expressionless | `expressionless, staring, closed mouth, looking at viewer, head tilt, arms behind back, hair over one eye,` | 그림자에서 일어나 뒷짐 지고 깜빡임 없이 응시 |
| tormented | `clenched teeth, wide-eyed, constricted pupils, shaded face, sweat, hunched over, hand on own face, hair over one eye,` | 무너짐 대신 정체 논쟁의 「가면」이 벗겨지려는 걸 웅크려 손으로 누름 |
| crazy smile | `crazy smile, staring, empty eyes, shaded face, leaning forward, beckoning, hair over one eye,` | 「있잖아, 있잖아. 너는 언제 죽을 것 같아?」 귓가로 오라는 손짓 |

## 잼트리 (Jaemtri)

성향: 햇살 같은 미소가 기본값이고, 그 미소 그대로 규정을 집행한다(「스톱. 이름 말하지 마.」). 미소가 꺼지면 독기 서린 눈 「그래서 뭐?」. 다정·장난·오냐오냐, 소문 본사, 쇼핑몰 순찰, 탕비실 권력자. 수년간 다정한 언니 모습을 한 번도 안 무너뜨림 → 괴로움도 웃음으로 버팀. 커피·태블릿은 소품 금지라 손짓(입 가림, 턱 괴기)으로만 남김. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smile, narrowed eyes, closed mouth, head tilt, leaning forward, hand on own cheek,` | 웃는 얼굴 그대로 몸을 기울여 진술의 빈틈을 짚음 |
| worried | `1.15::worried::, raised inner eyebrows, closed mouth, looking down, head tilt, hand on own chest,` | 크게 다쳐 온 후배에게 아무것도 묻지 않는 얼굴. 햇살 미소 기본값과 반대라 가중치 |
| relieved | `smile, half-closed eyes, open mouth, leaning forward, waving,` | 문간에서 손 흔들며 「어머, 후배, 왔어?」 |
| disgusted | `disgust, half-closed eyes, sweatdrop, head tilt, covering own mouth,` | 탕비실 침공 사건 — 남이 탄 커피 한 모금에 입을 가림(잔은 안 그림) |
| determined | `light smile, serious, narrowed eyes, looking at viewer, leaning forward, hand on own hip,` | 다정한 톤 그대로 서류 항목 확인으로 전환 |
| jealous | `pout, sideways glance, blush, head tilt, crossed arms,` | 질투 대신 「블랙 파」 신입에게 서운한 팔짱 |
| pleading | `smile, raised inner eyebrows, parted lips, leaning forward, beckoning,` | 애원 대신 「뭐 고민 있으면 꼭 언니한테 물어봐.」 이리 오라는 손짓 |
| forced smiling | `forced smile, sweatdrop, half-closed eyes, head tilt, hand on own cheek,` | 부장 「하아. 잼트리. 이것 좀 어떻게 해 봐.」 오늘 n번째, 볼 짚기 |
| indifferent | `bored, half-closed eyes, closed mouth, looking down, slouching, head rest,` | 쇼핑몰(=순찰) 하염없이 보는 얼굴, 턱 괴고 늘어짐(화면은 안 그림) |
| guilty | `guilt, smile, looking away, sweatdrop, head tilt, scratching cheek,` | 소문 본사가 들킴 — 「어머, 무슨 얘기야?」 볼 긁기 |
| pouting | `pout, half-closed eyes, blush, looking away, crossed arms,` | 「선배님」이라 불려 서운한 언니 |
| angry smile | `smile, narrowed eyes, shaded face, closed mouth, leaning forward, outstretched hand,` | 미소 유지한 채 손바닥 내밀어 「스톱. 이름 말하지 마.」 |
| expressionless | `1.2::expressionless::, narrowed eyes, closed mouth, looking at viewer, leaning back, crossed arms,` | 미소가 꺼짐 → 「그래서 뭐?」. 미소 기본값과 반대라 가중치 |
| tormented | `sad smile, tearing up, furrowed brow, looking down, head down, own hands clasped,` | 못 지킨 생존자. 다정한 언니 모습을 끝내 안 무너뜨리는 웃음, 손을 꼭 쥠 |
| crazy smile | `smile, empty eyes, shaded face, closed mouth, head tilt, hand on own chin,` | 광기 대신 사라진 경매 글 「어머, 무슨 얘기야?」 그 웃음이 대답 |

## 에일린 (Aileen)

성향: 말이 짧고(한두 단어), 빛 빠진 탁한 눈, 글자 읽을 때 눈을 가늘게 뜸. 근속 연수 얘기에 돌아보지도 않고 한숨, 「쓰레기 회사」라 하고 야근, 「쉬었나?」에 「응」(=아니). 교회 얘기엔 더 조용해짐 — 울지 않음. 대화 중 총 손질 버릇은 무기 금지라 「손 안 쓰고 아래를 보며 대꾸」로만 남김. 큰 웃음·눈물 없음. 고정 특징 없음(방탄조끼는 그림에 안 보임).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, expressionless, closed mouth, looking to the side, leaning forward, hand on own chin,` | 안내문을 한 줄 한 줄 — 몸을 내밀고 눈을 가늘게 |
| worried | `furrowed brow, serious, closed mouth, looking down, head down, crossed arms,` | 걱정 = 사상자 셈. 팔짱 끼고 고개 숙여 계산 |
| relieved | `half-closed eyes, sigh, closed mouth, head back, hands in pockets,` | 나온 수 = 들어간 수. 「됐어. 그래.」 고개 젖히는 한숨 |
| disgusted | `disgust, half-closed eyes, frown, looking away, shrugging,` | 「관리국이 하는 일은 쓰레기 회사랑 다를 게 없어.」(30분 뒤 야근 신청) |
| determined | `serious, narrowed eyes, closed mouth, looking at viewer, head down, 1.15::adjusting clothes::,` | 출동 전 조끼·권총·장총·점검 — 조끼 여밈(장비는 안 그림). 작은 손동작이라 가중치 |
| jealous | `annoyed, half-closed eyes, sigh, sideways glance, head down, hand on own forehead,` | 질투 대신 등 뒤 「저 선배 10년 차야」에 돌아보지도 않고 이마 짚는 한숨 |
| pleading | `serious, furrowed brow, parted lips, looking at viewer, leaning forward, 1.15::reaching towards viewer::,` | 「손도 안 내밀 만큼 쓸모없는 인간은 아니야. 해.」 정면 손은 잘 안 나와 가중치 |
| forced smiling | `1.15::forced smile::, tired, averting eyes, head tilt, hand in pocket,` | 부장 「쉬었나?」에 「응」(=아니). 무표정 기본값이라 미소에 가중치 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking down, slouching, hands in pockets,` | 질문에 작업에서 눈 안 떼고 대꾸 — 「됐어. 그래.」 |
| guilty | `shaded face, looking down, closed mouth, furrowed brow, head down, hand on own face,` | 들어간 수와 나온 수가 다른 날, 얼굴 쓸어내림 |
| pouting | `annoyed, pout, looking away, looking back, crossed arms,` | 휴식 명령에 「알겠어」 하고 돌아서서 일하러 감 |
| angry smile | `1.15::smirk::, glaring, shaded face, looking at viewer, leaning forward, pointing at viewer,` | 데드폴 죽음이 적힌 계획표에 「다시 짜.」 무표정 기본이라 입꼬리에 가중치 |
| expressionless | `expressionless, empty eyes, closed mouth, looking at viewer, crossed arms,` | 빛 빠진 탁한 눈, 늘 판단 중(기존 그림과 같은 팔짱) |
| tormented | `empty eyes, clenched teeth, shaded face, looking down, head down, clenched hands, trembling,` | 「교회」 이름이 나올 때. 울지 않고 주먹 쥐고 떪 |
| crazy smile | `1.15::light smile::, empty eyes, tired, shaded face, head tilt, hand on own chest,` | 광기 대신 조끼를 툭 치며 「그래도 조끼는 챙기는 게 웃기지」 건조한 자조. 미소에 가중치 |

## 고르고디오 (Gorgodio)

성향: 비밀이 없다 — 감정이 숨김없이 그대로 얼굴에 나옴(억지웃음도 티가 남). 호통과 배려가 한 문장(「오지 말라 했잖아요! … 쉬어요.」), 정면 돌파 본능(기둥 보면 손이 근질), 전투 후엔 큰 목소리 수사관(「잠깐, 아까는…?」). 기분 좋으면 사투리. 장갑 상태는 짧고 건조한 집행 모드. 칼은 무기라 안 씀. 고정 특징 없음(민머리·수염은 베이스).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `raised eyebrow, frown, open mouth, looking at viewer, leaning forward, 1.15::index finger raised::,` | 갑자기 손 들고 「잠깐만요, 아까는 혼자 있었다면서요?」 손가락 하나라 가중치 |
| worried | `worried, furrowed brow, closed mouth, looking down, head down, own hands clasped,` | 큰 몸을 숙인 걱정(기존 sad 그림의 깍지) |
| relieved | `grin, closed eyes, sweat, head back, hand on own head,` | 작전 잘 끝난 날 민머리 땀 훔치며, 사투리 나오는 얼굴 |
| disgusted | `disgust, furrowed brow, frown, looking at viewer, leaning back, crossed arms,` | 거짓 진술한 쪽을 숨김없는 얼굴로 내려다봄 |
| determined | `serious, v-shaped eyebrows, open mouth, looking at viewer, leaning forward, clenched hands,` | 「적합자 고르고디오! 승인 요청!」 두 주먹 |
| jealous | `frown, sideways glance, closed mouth, looking back, hands on own hips,` | 숨길 줄 모르는 서운함 — 큐라스가 남의 팀 신입에게 들러붙을 때 |
| pleading | `raised inner eyebrows, open mouth, looking at viewer, leaning forward, outstretched hand,` | 「오지 말라 했잖아요! … 쉬어요.」 막아서는 손 |
| forced smiling | `forced smile, sweatdrop, looking away, head tilt, scratching head,` | 피해 항목 칸이 모자람 — 민머리 긁는 억지웃음이 다 보임 |
| indifferent | `bored, half-closed eyes, closed mouth, looking to the side, slouching, crossed arms,` | 긴 작전 회의 — 「그냥 이거부터 다 부수는 게 낫지 않나?」 |
| guilty | `guilt, furrowed brow, closed mouth, looking down, bowing, own hands clasped,` | 무너진 건물 앞에서 큰 몸을 숙임 |
| pouting | `frown, 1.15::pout::, looking to the side, head down, clenched hand,` | 기둥 사건 — 도면 보고 아쉬운 표정으로 주먹을 내림. 자신감 얼굴·큰 체구에 묻혀 pout에 가중치 |
| angry smile | `smirk, glaring, shaded face, looking at viewer, leaning forward, cracking knuckles,` | 장갑 소환 직전 「그럼 나오는 건 다 죽이면 되겠네.」 |
| expressionless | `expressionless, serious, closed mouth, looking at viewer, crossed arms,` | 수염에 가려 표정 변화가 안 보임. 짧고 건조한 집행 모드 |
| tormented | `clenched teeth, furrowed brow, sweat, shaded face, hunched over, clenched hand,` | 장갑 내구도가 먼저 무너지는 상대 앞에서 웅크려 버팀 |
| crazy smile | `crazy smile, wide-eyed, sweat, looking up, leaning forward, fist in hand,` | 하중 받치는 기둥을 보면 손이 근질 — 주먹을 손바닥에 |

## 큐라스 (Kyuras)

성향: 웃는 얼굴이 기본값, 쉬지 않는 수다 속에 전술 보고. 손가락 튕기기(snapping fingers)가 능력이자 버릇, 퇴장할 땐 두 손가락 경례, 영입 멘트로 손가락질. 스팡달 앞에선 하얗게 질리면서도 웃으려 애씀(turn pale). 생존자를 울리고 사과 열두 번, 가슴을 친다. 「큐라스가 안 웃으면 철수 준비」 → 무표정 = 진짜 위기. 무관심은 「드문 침묵 = 체력 아끼는 중」으로 바꿔 읽음. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `smile, narrowed eyes, raised eyebrow, closed mouth, head tilt, pointing at viewer,` | 상대가 그 이름 꺼내기 직전에 먼저 가리킴 — 「알아, 알아, 그 대령」 |
| worried | `1.15::worried::, open mouth, sweat, looking to the side, leaning forward, outstretched hand,` | 「왼쪽 괜찮아? 형님 괜찮아?」 엄호하는 손. 웃는 기본값과 반대라 가중치 |
| relieved | `smile, open mouth, closed eyes, sweat, head back, hand on own chest,` | 「아 됐다 됐다, 다음!」 형님 무사 |
| disgusted | `disgust, open mouth, half-closed eyes, sweatdrop, head back, facepalm,` | 「로이 머스탱 얘기 내 평생 백 번은 들었어!」 |
| determined | `confident, grin, looking at viewer, leaning forward, 1.2::snapping fingers::,` | 「왼쪽으로 돌 테니까 여기서 엄호해!」 핑거 스냅은 작고 드문 태그라 가중치 |
| jealous | `frown, sideways glance, wavy mouth, head down, hand on own chest,` | 놓친 생존자가 종합대응팀으로 간 얘기 — 가슴을 친다 |
| pleading | `smile, open mouth, raised inner eyebrows, looking at viewer, leaning forward, pointing at viewer,` | 애원 = 영입 멘트 「진압팀엔 너 같은 인재가 필요해!」 |
| forced smiling | `forced smile, turn pale, nervous sweating, looking at viewer, leaning back, hands up,` | 스팡달 「큐라스, 여보세요?」 — 질려서 물러나며 웃으려 애씀 |
| indifferent | `half-closed eyes, tired, closed mouth, looking away, slouching, hands in pockets,` | 무관심 대신 드문 침묵 = 체력 아끼는 중 |
| guilty | `guilt, open mouth, raised inner eyebrows, sweat, bowing, own hands together,` | 생존자를 울려서 비는 손으로 사과 열두 번 |
| pouting | `pout, sulking, half-closed eyes, looking back, 1.15::two-finger salute::,` | 영입 실패하고 나가는 두 손가락 경례. 흔한 경례로 뭉개지기 쉬워 가중치 |
| angry smile | `grin, glaring, shaded face, looking at viewer, leaning forward, snapping fingers,` | 형님 이음새 노린 사수 — 웃는 얼굴로 딱 |
| expressionless | `1.2::expressionless::, serious, closed mouth, looking at viewer, crossed arms,` | 「큐라스가 안 웃으면 철수 준비」. 웃는 기본값과 반대라 가중치 |
| tormented | `clenched teeth, furrowed brow, sweat, exhausted, looking down, hunched over, holding own arm,` | 출력은 체력에 묶임 — 백 번 넘게 튕긴 팔을 붙잡음 |
| crazy smile | `crazy smile, wide-eyed, sweat, looking at viewer, leaning forward, outstretched arms,` | 드럼 솔로처럼 빨라지는 연속 튕기기 — 지휘자인지 물에 빠진 사람인지 |

## 데드폴 (Deadpole)

성향: 조심스러운 존댓말, 말끝 흐림, 깨어나면 첫마디가 남 걱정, 문제가 생기면 「제가… 혹시 제가…」 자책. 눈 규칙이 위키에 있음: 놀라면 동그래짐(wide-eyed), 잘못됐다 싶으면 가늘고 날카로움(narrowed eyes), 감으면 냄새 맡는 중. 칭찬에 두 가지 웃음(쓸모 = 복잡한 웃음, 사람 = 진짜 웃음). 자기 죽음을 출퇴근 얘기처럼 담담하게. 권총은 무기라 안 씀. 고정 특징 `black gloves`(위키 방검 장갑 + 그림 확인).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, serious, closed mouth, looking to the side, head tilt, hand on own chin, black gloves,` | 뭔가 잘못됐다 싶으면 가늘고 날카로워지는 눈 |
| worried | `worried, raised inner eyebrows, parted lips, looking at viewer, leaning forward, reaching towards viewer, black gloves,` | 깨어나자마자 남에게 손 뻗으며 「괜찮으세요? 놀라셨죠?」 |
| relieved | `smile, raised inner eyebrows, half-closed eyes, sweat, head tilt, hand on own chest, black gloves,` | 「살아남으셨… 아, 저 말고요. 당신이요.」 |
| disgusted | `disgust, narrowed eyes, smelling, leaning back, covering own mouth, black gloves,` | 기억 속 달콤함 같은, 익숙한 이상함의 냄새에 입·코를 가림 |
| determined | `light smile, serious, closed mouth, looking at viewer, head tilt, 1.15::adjusting gloves::, black gloves,` | 「여기서 제가 한 번 죽으면 시간이 벌리니까요.」 방검 장갑 고쳐 낌. 작은 동작이라 가중치 |
| jealous | `sad smile, sideways glance, closed mouth, head down, own hands together, black gloves,` | 질투 대신 남들 접시에만 고기 올리는 쪽의 곁눈 |
| pleading | `tearing up, raised inner eyebrows, parted lips, looking at viewer, leaning forward, hand on own chest, black gloves,` | 기생체 1호 — 제 가슴을 짚으며 「한 번만… 죽여 주세요. 그럼 나가요.」 |
| forced smiling | `forced smile, raised inner eyebrows, looking down, head tilt, hand on own arm, black gloves,` | 쓸모를 칭찬받았을 때의 복잡한 웃음, 팔을 감쌈 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking to the side, head tilt, hand on own neck, black gloves,` | 무관심 대신 자기 죽음에 덤덤 — 「음… 아파요」 |
| guilty | `guilt, nervous sweating, raised inner eyebrows, looking down, bowing, own hands together, black gloves,` | 「제가… 혹시 제가…」 말리기 전에 고개 숙여 사과 세 번 |
| pouting | `pout, furrowed brow, blush, looking to the side, leaning forward, clenched hands, black gloves,` | 게슈간과 다정한 투닥거림, 작은 두 주먹 |
| angry smile | `light smile, narrowed eyes, shaded face, looking at viewer, leaning forward, hand on own hip, black gloves,` | 「죄송합니다」 하고 뽑기 직전 — 손이 권총집 쪽으로(총은 안 그림) |
| expressionless | `expressionless, closed eyes, smelling, head tilt, 1.15::finger to mouth::, black gloves,` | 눈 감음 = 냄새 맡는 중이니 조용히. 손가락이라 묻혀서 가중치 |
| tormented | `clenched teeth, tears, furrowed brow, sweat, hunched over, hand on own stomach, black gloves,` | 되살아나며 신음. 죽는 건 매번 아프고, 묻기 전엔 말 안 함 |
| crazy smile | `smile, wide-eyed, shaded face, looking at viewer, looking back, hand on own cheek, black gloves,` | 등을 보이며 「뒤에서 찌르시면 저는 아플 거예요. 물론, 살아남겠지만요.」 |

## 게슈간 (Geshugan)

성향: 무덤덤·경계(위협 평가부터, 문 마주 보는 자리), 말 적음 「그래. 미안.」. 주먹 쥐기 = 염동력 좌표 신호(clenched hand). 독수리 타법 지적엔 노려봄, 데드폴에게만 안 노려봄. 따뜻함은 늦게, 진짜로 — 재회 때 「…해냈어…」 반복. 애원·억지웃음처럼 안 어울리는 감정은 무뚝뚝한 쪽으로 바꿔 읽음. 큐브는 그림에 없어 동작표처럼 안 씀. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, expressionless, closed mouth, sideways glance, leaning back, crossed arms,` | 낯선 사람에게 먼저 하는 위협 평가 |
| worried | `furrowed brow, expressionless, looking down, head down, holding own arm,` | 말없는 걱정 — 데드폴이 깨어나길 기다림(기존 그림의 팔 붙잡기) |
| relieved | `light smile, 1.15::tearing up::, half-closed eyes, head tilt, outstretched arms,` | 재회 — 끌어안으려는 팔, 「…해냈어. …해냈어…」. 무덤덤 기본값이라 눈물에 가중치 |
| disgusted | `disdain, half-closed eyes, closed mouth, looking away, leaning back, hands in pockets,` | 기관 자체를 안 믿음. 의무 복무 얘기에 |
| determined | `glaring, serious, closed mouth, looking at viewer, leaning forward, 1.15::clenched hand::,` | 보고, 쥐고, 끝 — 허공에 내미는 좌표 주먹. 주먹이 작게 묻혀 가중치 |
| jealous | `annoyed, sideways glance, closed mouth, looking back, crossed arms,` | 로제몬이 다른 사람 팔을 잡아끌 때의 못마땅한 곁눈 |
| pleading | `raised inner eyebrows, closed mouth, looking at viewer, head tilt, palm up,` | 애원 대신 독수리 타법이 막혀 데드폴에게 손바닥 내밂 — 노려보지 않는 유일한 상대 |
| forced smiling | `forced smile, half-closed eyes, looking away, slouching, hand in pocket,` | 회식 고깃집, 문 마주 보는 자리에서 사교용 입꼬리 |
| indifferent | `expressionless, half-closed eyes, closed mouth, looking away, head tilt, hands in pockets,` | 고맙다는 말에 대꾸 없이 지나감 |
| guilty | `guilt, looking away, closed mouth, head down, hand on own neck,` | 데드폴 사망 사건 — 「그래. 미안.」 |
| pouting | `glaring, 1.15::pout::, closed mouth, looking at viewer, crossed arms,` | 독수리 타법 한마디에 노려봄(칭찬해도). 무덤덤 기본값이라 pout에 가중치 |
| angry smile | `smirk, glaring, shaded face, looking at viewer, leaning forward, outstretched hand,` | 노크 없이 다가온 신입 — 손짓 하나로 의자째 반 바퀴 |
| expressionless | `expressionless, staring, closed mouth, looking at viewer, head tilt, hand in pocket,` | 도망칠지 말지 저울질하는 기본값 얼굴 |
| tormented | `clenched teeth, glaring, furrowed brow, shaded face, sweat, hunched over, clenched hands,` | 불 꺼진 격리 복도 기억. 무너짐 대신 이 악묾 |
| crazy smile | `1.15::smirk::, constricted pupils, glaring, shaded face, head tilt, clenched hand,` | 격리 탈출 개체를 보고 쥐고 끝 — 무덤덤한 얼굴의 드문 입꼬리라 가중치 |

## 로제몬 (Rojemon)

성향: 가시 돋친 반말과 투덜거림이 기본(「헛소리하지 마」, 「현장 출동이면 난 안 가」 — 그리고 감). 귀여운 얼굴이라 노려봐도 위협이 안 됨. 표현이 전부 반대: 칭찬 두 번 → 빨개짐 → 보라색 → 「죽여 버린다」, 걱정 → 퉁명한 「어땠어? 뭔데?」, 애정 → 팔 붙잡고 「내 옆에 있어」. 「저기!」 손가락질, 기댈 벽, 「못 해. 뭐 어쩌라고」 으쓱, 능력 쓸 때 눈이 반짝(glowing eyes). 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, frown, closed mouth, looking at viewer, leaning forward, hand on own hip,` | 동료 눈을 들여다보며 「너 지금 이상해」 |
| worried | `worried, furrowed brow, pout, looking away, head down, crossed arms,` | 걱정은 퉁명한 반말로 — 「어땠어? 뭔데?」 |
| relieved | `half-closed eyes, sigh, sweat, head back, hand on own forehead,` | 「반반이었어. 운 좋았어.」 땀 훔치는 한숨 |
| disgusted | `disgust, half-closed eyes, tongue out, looking away, leaning back, hand on own hip,` | 마음을 직접 읽으면 「그건 맛이 없어.」 |
| determined | `v-shaped eyebrows, open mouth, looking to the side, leaning forward, pointing,` | 「저기!」 — 3인조 최강 무기인 손가락질 |
| jealous | `pout, glaring, blush, sideways glance, looking back, crossed arms,` | 질투도 반대로 — 노려봐도 귀여워서 위협이 안 됨 |
| pleading | `frown, blush, raised inner eyebrows, looking at viewer, leaning forward, 1.15::reaching towards viewer::,` | 팔 붙잡으며 「내 옆에 있어.」(명령형). 정면 손은 잘 안 나와 가중치 |
| forced smiling | `forced smile, tired, half-closed eyes, sweatdrop, slouching, hand on own neck,` | 「현장 출동이면 난 안 가」 하고 출근복 그대로 끌려 나온 얼굴 |
| indifferent | `bored, half-closed eyes, closed mouth, looking away, head tilt, shrugging,` | 「못 해. 뭐 어쩌라고.」 으쓱 |
| guilty | `blush, wavy mouth, averting eyes, sweat, leaning back, pointing at viewer,` | 죄책감 대신 인형극 화면 보다 들킴 — 「뭘 봐」 |
| pouting | `pout, puffy cheeks, v-shaped eyebrows, leaning forward, hands on own hips,` | 「그러니까 내가 사무직이라고!」 |
| angry smile | `full-face blush, anger vein, smile, clenched teeth, leaning forward, clenched hands,` | 칭찬 두 번 → 보라색 → 「죽여 버린다」(사실 즐김) |
| expressionless | `1.15::expressionless::, glowing eyes, closed mouth, looking at viewer, outstretched hand,` | 최면 — 목소리가 낮고 평평해지며 「돌아가.」 투덜거리는 기본값과 반대라 가중치 |
| tormented | `wide-eyed, clenched teeth, tearing up, sweat, hunched over, hands on own head,` | 읽히는 것·조종당하는 것 = 개인적 악몽 |
| crazy smile | `smirk, glowing eyes, wide-eyed, shaded face, head tilt, outstretched arms,` | 인형술 전력 — 두 팔로 보라 실(안 그림)을 펼쳐 마네킹 여럿을 지휘 |

## 콘쥬스 (Konjyuce)

성향: 밝고 고집 세고 친근. 호칭 재협상(「아저씨」→「오빠」 = 부탁 신호, 들키면 윙크), 논리 감사(고개 갸웃하고 한 문장으로 짚은 뒤 예의 바르게 기다림), 「저도 이 팀 정식 멤버거든요!」 항의, 장비를 관광 명소처럼(「만지지 마」 최다 청취). 밝음이 아직 생생한 슬픔을 덮고 있음 → 무표정·괴로움은 집 얘기로. 총은 무기라 안 그림. 고정 특징 없음. ※ 위키는 20세 대학생·과잠, 그림은 블레이저 교복 — 옷 태그는 안 넣었으므로 영향 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `raised eyebrow, closed mouth, looking at viewer, head tilt, arms behind back,` | 「아내는 사람 이름이 아니잖아요.」 그리고 예의 바르게 기다림 |
| worried | `worried, closed mouth, looking up, head tilt, own hands together,` | 위험도 높은 작전 나가는 부장을 올려다봄(기존 sad 그림의 손 모음) |
| relieved | `smile, closed eyes, open mouth, sweat, head back, hand on own chest,` | 대피 작전 끝, 마지막 할머니까지 안전선 |
| disgusted | `disgust, wavy mouth, half-closed eyes, leaning back, outstretched hand,` | 「정식 멤버」인데 또 커피 대신 우유 — 밀어내는 손(잔은 안 그림) |
| determined | `v-shaped eyebrows, confident, closed mouth, looking at viewer, leaning forward, clenched hands,` | 소매 걷고 콘크리트 더미 들기 직전 |
| jealous | `pout, sideways glance, puffy cheeks, looking back, crossed arms,` | 질투 대신 혼자 브리핑실 문 밖에 남겨진 막내 |
| pleading | `smile, one eye closed, blush, head tilt, own hands together,` | 「아저씨」→「오빠」 전환 = 부탁(대개 간식) + 윙크 |
| forced smiling | `1.15::forced smile::, raised inner eyebrows, looking at viewer, leaning forward, waving,` | 소리친 다음 날 아침 평소처럼 「오빠, 안녕하세요!」 밝은 기본 웃음에 묻혀 가중치 |
| indifferent | `1.15::expressionless::, half-closed eyes, closed mouth, looking at viewer, hand on own hip,` | 친근할 이득 없는 상대에게 무미건조한 「아저씨」. 밝은 기본값과 반대라 가중치 |
| guilty | `guilt, sweatdrop, wavy mouth, looking away, head tilt, scratching head,` | 측정 장비에 기댔다가 또 고장 |
| pouting | `pout, puffy cheeks, looking to the side, leaning forward, hands behind back,` | 「만지지 마」 n번째 — 손을 등 뒤로 거두고 볼 부풀림 |
| angry smile | `smile, anger vein, v-shaped eyebrows, looking at viewer, leaning forward, pointing at viewer,` | 「잠깐만요! 저도 이 팀 정식 멤버거든요!」(기존 angry 그림의 손가락질) |
| expressionless | `1.2::expressionless, empty eyes::, closed mouth, looking down, head down, hand on own arm,` | 집에 대해 물었을 때 밝음이 빠진 순간. 밝은 기본값과 정반대라 가중치 |
| tormented | `tears, open mouth, furrowed brow, looking down, leaning forward, clenched hands,` | 「부모님 돌아가신 지 얼마 안 됐다고요!」 소리침 |
| crazy smile | `grin, wide-eyed, sparkling eyes, blush, leaning forward, 1.15::reaching towards viewer::,` | 광기 대신 「우와! 진짜 총 처음 봐요!」 손 뻗음(총은 안 그림). 정면 손은 잘 안 나와 가중치 |

## 고그니쟈 (Gognija)

성향: 최대 음량 하게체, 과한 환영(두 팔 벌림), 질문엔 바로 답하지만 정보는 필요한 만큼만, 윗선 질문엔 크게 웃는 게 대답의 전부. 믹스커피 의무(연구실 제1법칙), 알약 씹기, 괴이에 「오오, 상태가 좋군!」 신남. 고정 특징 `round eyewear, sunglasses`: 위키는 「둥근 고글」이지만 그림 27장은 렌즈가 검은 둥근 선글라스(맨눈 안 보임) → GPT의 `goggles`는 버림. **눈이 가려져** 눈·시선 태그 없이 입·고개(`facing viewer`, `head down`, `head tilt`, `head back`)·손으로만 감정을 냄. 커피·알약은 소품 금지라 손짓으로만. 눈이 가려져 몸동작을 크게(허리 짚기·두 팔 벌림·고개 젖힘·웅크림).

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `frown, closed mouth, leaning forward, hands on own hips, round eyewear, sunglasses,` | 커피를 마저 안 마신 신입을 허리 짚고 들여다봄 |
| worried | `frown, closed mouth, head down, hand on own chin, round eyewear, sunglasses,` | 수용실 수치 이상 — 모니터 앞에서 턱 짚음 |
| relieved | `laughing, open mouth, head back, hand on own chest, round eyewear, sunglasses,` | 수용 사고 수습 뒤 지하 전 층에 울리는 웃음 |
| disgusted | `disgust, wavy mouth, leaning back, outstretched hand, round eyewear, sunglasses,` | 블랙 요청에 손바닥 내밀며 「여기서는 안 되네!」 |
| determined | `confident, smirk, leaning forward, 1.2::adjusting eyewear::, round eyewear, sunglasses,` | 고글을 손가락으로 꾹 밀어 올리고 해결책 지휘. 작은 동작이라 가중치 |
| jealous | `frown, pout, head tilt, crossed arms, round eyewear, sunglasses,` | 질투 대신 데쥬레가 위층(잼트리 옆)에 가 있어 커피가 안 오는 날 |
| pleading | `shouting, open mouth, head back, hands on own hips, round eyewear, sunglasses,` | 애원 = 「데쥬레!!! 커피 좀 타 오게! 빨리!!!」 지하 전 층 생중계 |
| forced smiling | `forced smile, sweatdrop, head tilt, scratching head, round eyewear, sunglasses,` | 윗선·사장 질문 — 크게 웃는 게 대답의 전부 |
| indifferent | `expressionless, closed mouth, head down, slouching, hands in pockets, round eyewear, sunglasses,` | 알약 씹으며 키보드 치는 연구실 BGM 얼굴(알약은 안 그림) |
| guilty | `smile, sweatdrop, closed mouth, head down, hand on own head, round eyewear, sunglasses,` | 꽝에도 환호했는데 꽝 처리 서류는 데쥬레 몫 — 머쓱 |
| pouting | `pout, wavy mouth, head down, hand on own cheek, round eyewear, sunglasses,` | 「내가 타면 맛이 없네」 볼 괴고 투덜 |
| angry smile | `grin, teeth, shaded face, leaning forward, pointing at viewer, round eyewear, sunglasses,` | 연구실 제1법칙 「누구나 달달한 믹스커피를 마셔야 하네!」 |
| expressionless | `expressionless, closed mouth, facing viewer, arms behind back, round eyewear, sunglasses,` | 웃음이 꺼지면 고글만 남음 — 인간 연구원 이상이라는 소문 |
| tormented | `clenched teeth, frown, sweat, shaded face, hunched over, hands on own head, round eyewear, sunglasses,` | 시설이 몸의 일부인데 불이 꺼진 날 — 지하가 낯선 미로 |
| crazy smile | `crazy smile, open mouth, teeth, head back, spread arms, round eyewear, sunglasses,` | 목숨 걸고 잡아 온 괴이에 「오오, 상태가 좋군!」 두 팔 벌림 |

## 데쥬레 (Dejure)

성향: 「아, 아와와...!」 펄쩍, 시선은 바닥, 손가락 끝 맞대고 꼼지락(index fingers together)이 기본자세, 시키기 전에 먼저 사과, 말끝 흐림. 다만 「데쥬레 모드」(유물 다룰 때·진짜 위기)엔 손이 안 떨리고 말이 또렷 → 무관심·무표정은 이쪽으로 읽음. 「선배」 소리에 빨개지며 「헤헤」, 스팡달 앞에선 「제가 잘못했어요!」 패닉, 그런데도 「스팡달 선배보다 잘 가르쳐 드릴게요...!」 맞불. 고정 특징 없음.

| 감정 | 프롬프트 | 읽은 방식 |
| --- | --- | --- |
| suspicious | `narrowed eyes, nervous, sweat, closed mouth, looking back, hand on own chest,` | 엘리베이터 소리 — 스팡달인가? 어깨 너머로 돌아봄 |
| worried | `worried, raised inner eyebrows, wavy mouth, sweat, head down, 1.15::index fingers together::,` | 「저기... 3번 수용실... 수치가... 조금...」 손끝 맞대기 기본자세. 작아서 가중치 |
| relieved | `smile, tearing up, raised inner eyebrows, head tilt, hand on own chest,` | 잼트리가 「스팡달, 입.」 해 줘서 살았다 |
| disgusted | `disgust, tearing up, wide-eyed, leaning back, covering own mouth,` | 스캔에 사람 것 같은 실루엣 — 비명부터(1.5초), 분류는 그다음 |
| determined | `v-shaped eyebrows, blush, open mouth, nervous sweating, leaning forward, clenched hands,` | 떨면서 맞불 「제가 스팡달 선배보다 더 잘 가르쳐 드릴게요...!」 |
| jealous | `pout, sideways glance, tearing up, head down, index fingers together,` | 한쪽에서만 성립하는 스팡달과의 교육 경쟁 |
| pleading | `streaming tears, open mouth, raised inner eyebrows, trembling, hunched over, own hands together,` | 스팡달 귓속말에 무너져 「제가 잘못했어요! 죄송해요오...!」 |
| forced smiling | `forced smile, sweatdrop, raised inner eyebrows, looking to the side, leaning forward, hands up,` | 오후 세 시 「데쥬레!!! 커피」 — 「아와와」 하며 또 달려감 |
| indifferent | `1.15::expressionless::, half-closed eyes, closed mouth, looking down, head down, cupping hands,` | 데쥬레 모드 — 유물(안 그림)을 받쳐 든 손, 「이건 꽝이에요」. 겁먹은 기본값과 반대라 가중치 |
| guilty | `guilt, tearing up, raised inner eyebrows, looking down, bowing, own hands clasped,` | 아무도 뭐라 안 했는데 「죄, 죄송해요...」 |
| pouting | `pout, puffy cheeks, blush, looking down, head tilt, index fingers together,` | 업무 중 커피 타기가 제일 유명한 게 약간 억울 |
| angry smile | `smile, anger vein, tearing up, sweatdrop, leaning forward, clenched hands,` | 꽝에도 환호하는 상사 — 서류는 내 몫, 웃으며 부글 |
| expressionless | `1.15::expressionless, serious::, closed mouth, looking at viewer, leaning forward, pointing,` | 진짜 위급할 땐 떨림이 멈추고 말이 또렷 — 정확히 가리킴. 겁먹은 기본값과 반대라 가중치 |
| tormented | `tears, clenched teeth, furrowed brow, sweat, head down, wiping tears,` | 목격자보다 먼저 울면서도 재현은 끝까지 — 눈물 훔치며 |
| crazy smile | `grin, full-face blush, tearing up, head tilt, hands on own cheeks,` | 광기 대신 「선배」 소리에 「제가 선배... 헤헤...」 웃음이 샘 |
