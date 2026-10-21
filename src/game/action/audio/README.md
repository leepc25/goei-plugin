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
