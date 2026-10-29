> **2026-10-29 바뀜 (이 절이 아래보다 우선)**: 테스트룸 페이지(room.html)는 은퇴했다(`_old/테스트룸_변환기_2026-10-29/room.html`).
> 전투·이펙트·판정 엔진의 원본은 게임 코드 `src/game/action/fighter/core.ts`이고, 시험장은 그 게임을 그대로 띄우는 `dist/goei-testroom.html`이다.
> - 만들기·열기: `npm run build` → 저장소 맨 위에서 `python3 -m http.server 8765` → `http://localhost:8765/dist/goei-testroom.html?char=이름`
> - 무대: `?start=stage=dummy`(허수아비, 기본) · `stage=spar&ai=easy|normal|hard|nightmare`(AI 대련) · `stage=training`. 옆 판에 인물 고르기·장면·생활 줄·동작 하나씩·필살 게이지 무시.
> - 인물 설정(`chars/<키>.json`)·그림 측정(`build.py`)은 그대로 여기서 하고, 인물 팩은 `python3 tools/build_char_packs.py --only 키 --all`로 다시 만든다.
> - 아직 옛 페이지에 묶인 도구: `qa/tools/dmg.cjs`·`dmg1.cjs`·`reach.cjs`·`review_all.cjs`·`trace.cjs`(out/index.html 안을 들여다봄). 밸런스를 다시 잴 때 새 시험장으로 옮겨야 한다. `qa/check_skills.py`는 게임 엔진을 읽게 고침.

# 통합 테스트룸 (인물을 바꿔 가며 시연)

에일린 테스트룸을 일반화한 판. 화면 위 목록이나 `[` `]` 키로 인물을 바꾸면 조작·콤보·회피·막기·피격·점프·생활 동작이 그 인물 그림으로 바뀌고, 고유기술·충전·필살기도 그 인물 설정대로 돈다.

- 만들기(저장소 맨 위): `python3 game-src/action/testroom3/build.py`. 표 상태가 「뽑음」인 인물과 에일린이 들어간다. 그림이 바뀐 인물만 다시 처리하고(`.cache/`), `--all`은 전부 다시 만든다.
- 열기: `out/index.html`(file://에서도 됨). 인물 그림은 `out/chars/<키>.js`에 있고, 고를 때만 불러온다.
- 인물 설정: `chars/<키>.json`. 없으면 build가 표의 「테스트룸」 절(반복 구간·타격 장·좌우 반전·W판)과 `picks.json`(고른 장·통과 목록), `docs/요원_기술안.md`(색·기술 이름·필살기 글씨·효과 초안)를 읽어 만든다. 파일에 적힌 값이 늘 이긴다. 자동값으로 되돌리기: `build.py --reset <키>`.
- 그림 방향: build가 모든 그림을 오른쪽(동·남동)을 보게 뒤집어 둔다. 줄마다 `anims.<줄>.mirror`로 바꿀 수 있다.
- 장 번호는 설정에서 1부터(동작표와 같음).
- 그 밖의 칸: `loops`(반복 구간) · `hit`(타격 장) · `start`(첫 장이 앞 줄 끝 장과 어긋날 때 이 장부터 틂, 예 `{"20": 2}`) · `skip`(뺄 장) · `clean`(지울 것: `[장, 픽셀 수]` = 몸에서 떨어진 그만큼 작은 덩어리, `[장, [x0,y0,x1,y1]]` = 그 칸) · `ranged.proj`(원거리 부품) · `picks`(기준 장) · `jitter`(그 줄을 틀 때 코드 흔들림 px).
- fail 줄 대신 쓰기: `anims.<줄>`에 `folder`(다른 폴더·`_old/18_1` 같은 옛 판도 됨)와 `frames`(쓸 장만, 1부터, 되풀이 가능)를 적는다. 예: 곽성주 맞기 = `{"folder": "3", "frames": [1,2,1,2,1]}` + `jitter`.
- 줄이 없으면 대신 씀: 주저앉아 뒤로 기기(40)가 없으면 앉아 떠는 장 반복 + 코드로 뒤로.

## 기술 설정(`skills`)

`skill`(고유기술, S 짧게), `charge`(S 길게 또는 D, 떼면 방출), `super`(F), `skill2`(Y, 있는 인물만). `skill.alt`: 버프 중이면 그 이름의 기술로(고르고디오 장갑 → 초음속 돌격). `charge.releaseLv`·`fireLv`: 단계마다 방출 동작·발사 장을 바꿈.

```json
"skill": {"name": "근접 폭파", "anim": "22", "fps": 11, "armor": [3, 5],
  "events": [{"f": 4, "fx": [{"t": "blast", "at": "hand", "hit": {"dmg": 40, "kind": "blow"}}]}]}
"charge": {"hold": "23", "release": "24", "levels": [0.5, 1.2], "fire": 1, "lv": {"0": [], "1": [...], "2": [...]}}
"super": {"name": "...", "sub": "「...」", "anim": "25", "events": [...]}   // 여러 동작이면 "steps": [{anim, events}, ...]
```

이벤트: `f`(장), `to`(여기까지 같은 효과), `rep`(그 장 반복 수), `loop`(f~to 구간을 통째로 되풀이), `d`(한 장 시간), `alt`(f와 to를 번갈아), `hold`(그 장에 머무는 시간).

부품(`t`): `blast` 폭발 · `chain` 앞 일직선 연쇄 폭발 · `circle` 둘레 원형 범위 · `pillar` 폭발 기둥 · `screen` 화면 전체(샌드백+무작위 자리에 `each`) · `proj` 투사체(bullet·orb·spike·pen·card·knife) · `beam` 광선 · `melee` 앞 범위 타격 · `spikes` 바닥 가시 · `grid` 가시 격자(+구속) · `puddle` 그림자 웅덩이 · `hide` 몸 가라앉기/드러내기 · `teleport` 등 뒤로 · `bind` 구속 · `mark` 표식 · `buff` 버프 테두리 · `heal` 회복 · `summon` 소환·설치(cup·tablet·turret·box…, `tick`으로 반복 효과) · `pull` 끌어당김 · `launch` 띄우기 · `slash` 베기(x·arc) · `rain` 쏟아짐 · `scan` 훑기(line·grid) · `text` 글씨 · `flash`·`shake`·`dark`·`zoom` · `later` 지연 · `dash` 돌진 · `hop` 뒤로 펄쩍 · `lift` 띄워 고정 · `tether` 실 · `shock` 바닥 충격파 · `barrage` 연속 포격 · `firewall` 불 벽 · `sweep` 괴이 그림자 휩쓸기 · `wave` 잔해 파도 · `ring` 고리 · `gray` 흑백 · `chance` 확률 갈림 · `repeat` 되풀이 · `flame` 화염 방사 · `lob` 포물선 던지기(수류탄) · `waves` 소리 고리 · `slash`의 `dark`(검은 선)·`style: "h"`(화면 가로 베기) · `suppress`·`artillery`(에일린).

위치 `at`: `hand`(손·총구, 기본) · `front`(앞 바닥, `dx`) · `self` · `target`. 맞음 `hit`: `dmg`, `kind`(light·heavy·launch·blow·down·stun·spike·pull), `n`(히트 수), `stop`, `shake`, `text`. 멈춤·흔들림은 맞았을 때만 든다.

이펙트 그림은 `game-src/action/eileen/vfx/`와 `testroom3/vfx/`(같은 꼴 png+json)를 읽는다. 이름이 같은 그림이 생기면 부품의 `vfx`로 바꿔 끼운다.

## 검사

`node game-src/action/testroom3/qa/shots.cjs [키…]` → `qa/`에 인물마다 대기·걷기·약1~3·강·회피·원거리·고유기술·충전·필살기·막기·맞기·점프·쓰러짐·끄덕이기·주저앉기 스크린샷.
