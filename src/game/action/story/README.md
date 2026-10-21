# 대사와 컷신 (`src/game/action/story/`)

본부·현장의 대화, 요원 말풍선, 컷신, NPC 자유 대화를 맡는다. 엔진과의 약속은 `docs/게임_모듈_연결.md` 3장 「대사와 컷신」 줄.

## 시연판

- 폰: `release/demo/goei-story.html` (단일 HTML, 얼굴 사진 13장 포함 약 180KB)
- 만들기: `node scripts/build-story.mjs` (통합 빌드 `scripts/build.mjs`는 건드리지 않았다. 통합은 「게임 전투와 조작」이 한 줄 더하면 된다)
- 시험: `node --test tests/story.test.mjs` (스스로 번들), 실제 브라우저 `node tests/story-browser.mjs` (폰 390×844·PC 1280×950을 끝까지 눌러 봄, `SHOTS=폴더`면 화면 저장)

## 파일

| 파일 | 하는 일 |
| --- | --- |
| `index.ts` | `mountStory(root, host, {saved, eager})` → `StoryApi`. 대화창·컷신·자유 대화가 열린 동안 `isBlocking()` true, `host.pause(true)` |
| `script.ts` | 대본 형식 읽기·조건식·실행기 (화면 없음) |
| `scripts/hq.ts` | 본부: 잼트리 자리(임무 9건 접수, 규칙서, 커피), 브리핑, 출동 제안, 정비·보급(콘쥬스), 감정실(데쥬레), 격리 연구실(고그니쟈), 탕비실 대화 사건, 정산, 후송 깨어남 |
| `scripts/field.ts` | 현장: 승강기 탑승(인사·닫힘 연타·호명·총애·층 안내·힌트), 승강기 안 공격, 거래, 다락방, 떠도는 승객 6종, 거울, EXIT |
| `scripts/cutscenes.ts` | 첫 판 컷신 9개(첫 출근·첫 투입·첫 호명·다락방·삼 년째 승객·귀환·후송·출구·회식)와 그 안의 대화 |
| `lines/agents.ts` | 요원 8명 대사표 32태그 (출동 제안~전투 말풍선~정산), 후송 때 옆 동료 주고받기 |
| `lines/elevator.ts` | 승강기 방송: 요원별 호명 3줄, 요원별 총애 높음/낮음, 총애 단계별 탑승 방송, 층 유형별 힌트 |
| `director.ts` | 엔진 사건 → 말풍선. 간격 3.5초, 태그별 쿨다운, 확률, 우선순위 |
| `cutscene.ts` | 컷신 시퀀서 (대기·암전·자막·대화·말풍선·인물 이동·카메라·패널·흔들림·동시 진행·건너뛰기) |
| `ai.ts` | 자유 대화: 인물 지침(위키 사실만) + 상태 → 모델 메시지, 답 다듬기, 실패·25초 지연 시 미리 쓴 답 |
| `risu.ts` | 플러그인에서 `talkModel: risuMainModel` (리스 메인 모델, 사용자가 보낼 때만) |
| `ui.ts`, `style.css` | 대화창(사진·이름·글자 찍기·선택지), 말풍선, 자막, 암전, 자유 대화 창 |
| `stage.ts`, `demo.ts` | 시연판 전용 무대(코드로 그린 배경)와 흐름. 엔진에 붙일 때는 쓰지 않는다 |

## 대본 형식

```
=== 대본id
-- 표지
jaemtri(smile): 어머, 후배, 왔어?        // 말하는 사람(표정): 글. agent는 지금 요원
~ narr: 하나                             // 연달아 쓴 ~ 줄 중 하나만
~ narr: 둘
* 받을게요 -> accept [if !done_m1] [set mission='m1'; x+=1]
> set favor += 1                         // favor는 -3..+3로 묶임
> goto 표지 if 조건                       // 표지 end = 끝
> emit 사건 인자                           // host.emit
> call 다른대본
> agent 태그                              // 요원 대사표 한 줄
> line el:call elevator                   // 승강기 방송표 (el:board, el:call, el:favor_high, el:favor_low, el:announce, el:hint, el:greetOk …)
> end
```

글 안의 `{name}`은 요원 이름, `{키}`는 상태 값. 조건식: 이름·숫자·'글'·true/false, `== != >= <= > < + - ! && || ( )`, 주사위 `d100`(0~99).

## 상태 값 (story.flags, 엔진이 저장)

`agent`, `male`, `favor`(-3..3), `rules`(찾은 줄 수), `rule_<id>`, `depth`, `ftype`, `mission`, `done_m1`…`done_m9`, `called_run`(이번 출동 호명 했나), `calls.<요원>`(호명 순번), `heard_lonely`, `coffee`, `met_<npc>`, `loot`, `unsent`, `dealt`, `honest`·`liar`(승객 대본 시작 전에 층 모듈이 넣음), `late`(구조 대상이 늦었나), `result`(return/retreat/evac), `reached_b12`, `seen.<대본>`, `seen.cs.<컷신>`.

## 엔진 사건 → 말풍선

`combat:start`, `combat:boss`, `combat:kill`(enemyDie), `combat:clear`(data.final이면 win), `combat:combo`, `combat:dodge`(evade), `combat:ult`(super), `combat:guardbreak`(guardBreak), `ammo:low`, `ammo:empty`(empty), `weapon:pickup`(pickup), `item:use`(item), `hp:low`, `find:rule`(ruleFound, data.id), `find:item`, `rule:break`, `intrude:fake`, `intrude:daydream`, `rescue`, `win`, `enter:floor`(data.floor.depth/type → 승강기 안내, 이미 탑승 대본이 안내했으면 생략), `attic:enter`, `down`, `revive`, `run:end`(data.result).

## 대본이 내보내는 사건 (host.emit)

`mission m1…m9`, `pick <요원>`, `coffee condensed|black|mix`, `freetalk <npc>`, `open rulebook|gear|support|holo|research`, `rule <id>`, `favor <값>`, `cue call`, `trapped 10`, `ride`, `passenger right|wrong|lure|rescued|ambush|robbed`, `combat passenger|nothuman`, `supply cache|half|stolen`, `signs learn`, `rescue follow|carry`, `deal type true|skip2|supply true|lie`, `encounter passenger`, `predator`, `mirror risk`, `cutscene exit`, `album <id>`, `appraise`, `briefing start|end`, `buddy <id>`.

## 근거와 지키는 것

- 말투·사실은 위키 기본 문서(`card/wiki-base.json`)와 `docs/캐릭터제작서/0N_*.md` 9장. 호명은 위키 여담·인간관계에 있는 사적인 사실만 쓴다.
- 승강기 규칙·총애·승객·수호자는 `docs/스테이지설계서_차원승강기.md` 7~13장.
- 자유 대화는 기본 기획서 18.1(미리 쓴 대사)을 바꾼 사용자 결정(2026-10-21)이다. 사용자가 글을 보낼 때만 모델을 부르고, 본편 채팅에는 쓰지 않는다.
- 얼굴은 명부 기본 사진(`assets/agents/*_default.avif`)을 `tools/story_photos.py`로 줄인 것. 새 그림은 만들지 않았다.
