# 게임 소리 (효과음·음악·환경음)

녹음 파일 없이 전부 Web Audio 코드 합성이다. 최소화한 모듈이 약 48KB(압축 전)라 플러그인 팩에 그대로 들어간다.

시험실: `release/demo/goei-sound.html` (폰에서 열어 노란 버튼을 누른 뒤 듣는다).

## 엔진에서 부르는 법

```ts
import { createGameAudio } from './audio';
const audio = createGameAudio({ load: () => storage.get('goei:audio'), save: (s) => storage.set('goei:audio', s) });
audio.setListener(cameraCenterX, viewWidth / 2); // 매 프레임 (좌우·거리감)
audio.event({ type: 'hit', strength: 3, x });   // 사건 → 효과음 (index.ts pickSfx)
audio.floor('dark');                             // 층 들어갈 때: 음악 + 환경음 함께 전환
audio.jingle('clear');                           // 알림곡 한 번, 끝나면 하던 곡으로
audio.pause(); audio.resume(); audio.dispose();
```

사건 이름: hit(strength 1·2·3, kind kick|low|dash|bullet|super), whiff, shot(kind silenced|enemy), empty, reload, guard(perfect), guardBreak, evade, jump, land, hurt, down, wakeup, armor, ability, super(음악 자동 낮춤), heal, item, pickup, enemyDie, enemySpawn, enemyTell, enemyShot, bossTell, bossRoar, step(surface, 없으면 층 기본 바닥), door(kind elevator|wood|slam, open), ding, ruleFound(도장 + 음악 낮춤), ui*, 그리고 `sfx.ts`의 효과음 이름 그대로.

- 모바일: 첫 터치·클릭·키에서 자동 잠금 해제. iOS 17+는 audioSession을 playback으로 두어 무음 스위치에도 들리게 한다. 탭을 떠나면 멈춘다.
- 볼륨 버스: 전체·음악·효과음·환경음·메뉴 + 음소거. 설정은 `load/save` 콜백(없으면 저장 안 함)으로 JSON 저장.
- 같은 소리 연타 제한, 동시 28개 넘으면 발소리·사물 소리부터 버림.

## 파일

| 파일 | 내용 |
| --- | --- |
| `engine.ts` | 믹서(버스·압축기·잔향 2종), 잡음 버퍼, 합성 도우미 |
| `sfx.ts` | 효과음 85종: 전투 30, 적·수호자 14, 발소리 8재질, 승강기 8, 층 사물 13, 메뉴 12 |
| `music.ts` | 글자 악보 트래커, FM 칩 느낌 악기 13종 + 드럼 |
| `songs.ts` | 곡 13개: 제목, 본부, 로비, 추격, 재현·아파트(3박 오르골), 시험, 어둠, 퍼즐(7박), 정비 구역, 수호자 + 알림곡 3. 침묵의 층은 원문대로 음악 없음 |
| `ambience.ts` | 층별 깔리는 소리 + 가끔 사건 소리 |
| `index.ts` | `createGameAudio` 입구, 사건 → 효과음 매핑 |
| `check.ts` | OfflineAudioContext 렌더 검사 (무음·NaN·지나친 크기) |

곡은 전부 이 저장소에서 새로 쓴 것이다. 곡을 고치려면 `songs.ts`의 글자 악보를 바꾼다 (표기법은 `music.ts` 머리 주석).

## 시험

```sh
npm run build
node --test tests/audio.test.mjs     # 악보 길이·사건 매핑·설정
node tests/audio-browser.mjs         # Chromium: 모든 버튼, 모바일 넘침, 효과음 85·곡 13 실제 렌더
```

## 생명주기 2차 수정 (2026-10-22)

기준 `0d43a449`, 브랜치 `codex/audio-lifecycle-round2`. 공용 실행 파일과 캐릭터/음원 자산은 수정하지 않았다.

### 실제 재현과 수정

- 첫 입력 전에 `floor('title'); music(null)`을 호출해도 제목 음악이 재생되었다. 이제 마지막 곡 요청(정지 포함)을 보존한다. `resume()`만으로 첫 입력 전에 컨텍스트를 만들지 않는다.
- 효과음 음량 0에서 `heal`을 OfflineAudioContext로 렌더하면 peak **0.0252168**의 잔향이 남았다. 음악/효과음/환경음/메뉴의 잔향 반환을 각각 해당 버스로 연결해 모든 버스 음량 0에서 peak **0**을 확인했다. 곡/환경음 전환 시 잔향 보내기도 함께 감쇠한다.
- `jingle('clear'); pause()` 후 실제 시간만 지나면 본부 곡으로 바뀌었다. 복귀 시점을 AudioContext 시간으로 관리한다. 정지·숨김 동안 펌프가 음표를 추가 예약하지 않는다.
- 본부/로비 12회 전환 및 효과음 재생 후, 연결 노드 계측값이 **11 → 1,116**이었다. 노드 소유 범위를 도입하고 음원 `ended` 및 오디오 시간 기반 종료 시점에 source/filter/gain/panner/send를 해제한다. 수정 후 고정 믹서 노드 **23 → 23**. 브라우저 GC/메모리 바이트 추정이 아니라 `connect/disconnect` 계측 결과다.
- 환경음 예약 목록은 완료된 타이머를 삭제한다. 비동기 resume 도중 닫기·일시정지·탭 숨김 경쟁을 방어하고 자동재생 거부 후 다음 입력에서 재시도한다. 설정 저장 Promise 거부를 처리하고 종료 직전 마지막 변경은 한 번 저장한다.
- 새 `videoTrack.ts`는 컷씬 미디어의 실제 `play()` 재시도, 버퍼링 대기, 메뉴/숨김 정지, 전체×효과음 음량, 종료 시 src 해제를 담당한다. 컷씬 중 합성 배경음/효과음은 음소거한다.

### 공용 연결 (통합 담당 적용 필요)

`integration-round2.patch`는 **이 브랜치의 공용 파일에는 적용하지 않았다**. 별도 임시 복사본에서만 적용·검증했다.

```sh
git apply --check src/game/action/audio/integration-round2.patch
git apply src/game/action/audio/integration-round2.patch
```

- `story/video.ts`: HTMLAudioElement를 `VideoTrack`으로 대체. 소리 버튼에서 현재 컷씬 시각으로 이동한 뒤 play를 재시도. 버퍼링/종료 연결, 메뉴·숨김 중 영상 시계 정지와 visibility 복귀 시 기준 시간 재설정.
- `engine/modules.ts`: storyRoot의 `goei:video-audio` 등록을 믹서에 연결. 프레임에서 `setPaused(shell.paused && !openingOn)` 및 `setCutscene(story.isVideoPlaying())` 동기화. 제목 오프닝의 메뉴 예외를 유지하며 dispose에서 등록 해제.
- 적용 위치는 패치의 함수/주변 문맥을 기준으로 한다. 통합 담당의 동시 수정으로 문맥이 달라졌으면 위 두 연결만 옮긴다.
- 패치 미적용 상태에서는 기존 컷씬의 별도 오디오가 게임 음량·정지 정책과 계속 분리된다. 이 부분을 완료된 게임 통합으로 보고하지 않는다.

### 재현/검증 명령

```sh
npm ci
npm run typecheck
# 담당 코드만 검증: 자체 HTTP 서버/실제 Web Audio/엄격한 자동재생 정책
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/usr/bin/chromium node tests/audio-lifecycle-round2-browser.mjs
# 아래는 별도 복사본에서 연결 패치를 적용한 뒤 실행 (빌드가 생성 HTML을 갱신함)
npm run typecheck
npm run build
node --test tests/audio.test.mjs tests/story.test.mjs tests/hub-doors.test.mjs tests/run-system.test.mjs
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/usr/bin/chromium node tests/audio-lifecycle-round2-game-browser.mjs
```

산출물은 `/tmp/goei-audio-lifecycle-round2/`의 baseline/results JSON, 검증 로그, `game-redeploy.png`. 생성 HTML/검사 산출물은 커밋하지 않는다. 기존 `tests/audio-browser.mjs`의 file:// 접속은 환경 정책으로 차단되어 새 게임 오디오 검사에서 HTTP로 같은 시험실 버튼/렌더 검사를 수행한다.

검증 범위: 타입 검사, 연결 패치 적용본 빌드, 관련 회귀 27개, 오디오 생명주기 Chromium 9개, 실제 게임 UI 출동/철수 4회·일시정지/재개 4회·컨텍스트 1개 유지·게임 종료 후 close, 실제 VideoPlayer의 소리 켜기/일시정지/음량 0/건너뛰기, HTTP 시험실의 PC/모바일 버튼 및 효과음 88개·곡 13개 렌더. 잼트리까지 이동은 stage.goto 및 상호작용 호출로 단축하고 출동·철수·메뉴는 실제 버튼/키를 사용한다. 컷씬은 회색 SVG/무음 PCM 검사 fixture이며 기존 반려 그림을 새 결과로 만들지 않았다.

남은 검증: 탭 숨김은 실제 Web Audio/HTMLMediaElement에서 document.hidden+visibilitychange를 주입한 정책 검사다. 실제 OS 탭 전환·모바일 Safari/iOS 오디오 인터럽트·장시간 청감 검수는 수행하지 않았다. 노드 계측과 렌더 정상은 청감 품질 최종 승인을 뜻하지 않는다.
