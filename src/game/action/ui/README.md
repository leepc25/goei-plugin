# 화면 표시와 터치 조작 (`src/game/action/ui/`)

플레이어가 보고 만지는 것 중 그림(도트)을 뺀 전부: 화면 틀, 입력(키보드·터치·게임패드), HUD, 메뉴, 화면 효과.
연결 약속은 `docs/게임_모듈_연결.md` 3·4장. 이 폴더는 다른 게임 폴더를 import 하지 않는다(시연판 `demo*.ts`만 회색 상자 sim 을 빌려 쓴다).

## 한 번에 붙이기

```ts
import { mountGameShell } from './ui';
const shell = mountGameShell(box, { synth: true, onNew, onContinue, hasSave, onRetreat, onTitle, toLocal: bridge.viewport.toLocal });
// 매 화면 프레임
shell.frame(dt);                 // 게임패드 읽기, 효과 시간
if (!shell.paused) { /* 30Hz 틱: shell.input.held('KeyA') 등 또는 window keydown 그대로 */ shell.input.endFrame(); }
drawWorld(shell.ctx, camX + shell.fx.camera().x);   // 엔진 렌더러
shell.fx.drawScreen(shell.ctx, hp / maxHp);          // 필살 암전·섬광·위험 테두리·층 제목
shell.hud.draw(shell.ctx, hudState, dt);             // HudState 는 엔진이 채운다 (compact: shell.touchShown)
shell.fx.drawTransition(shell.ctx);                  // 전환은 맨 위
```

`synth: true` 면 터치·패드 입력이 같은 `KeyboardEvent.code` 의 가짜 keydown/keyup 으로 window 에 나가므로, 키보드만 듣는 엔진이 바뀌지 않고 그대로 동작한다.

## 파일

| 파일 | 내용 |
| --- | --- |
| `keys.ts` | 부록 A 조작표: 행동 → 키 코드, 한글 이름, 게임패드 배치 (A 점프, B 상호작용, X 근접, Y 원거리, LB 가드, RB 회피·달리기, LT 고유기, RT 필살, 십자 아이템 1~4, Start 메뉴, Back 지도, L3 지원, R3 재장전) |
| `input.ts` | `InputHub`: 장치별로 누른 키를 모아 한 번만 눌림/뗌. `held`, `pressed`, `released`, `heldFor`(Shift 짧게/길게), `axis`(아날로그), `endFrame`, `capture`(메뉴가 가로챔), `synth` |
| `stage.ts` | `mountStage(box)`: 1280×720 캔버스를 16:9 로 맞춤(검은 띠), 세로 화면 안내(가로로 돌리기 / 세로로 계속), 전체 화면 + 가로 고정 시도, CRT·밝기·도트 선명 |
| `touch.ts` | `TouchPad`: 왼쪽 떠다니는 스틱(끝까지 밀면 달리기, 최소 0.25초 눌러 회피로 안 읽힘), 오른쪽 버튼 무리(공격 크게, 점프·사격·고유·회피·가드·조사·필살·장전·지원), 아래 아이템 4칸(개수 표시), 지도·메뉴. 멀티터치, 손가락 미끄러뜨려 옆 버튼 누르기, 진동, 크기·진하기·왼손 배치. 세로 화면은 게임 아래에 배치 |
| `gamepad.ts` | `PadReader`: 표준 배치 읽기, 진동 |
| `hud.ts` | `Hud.draw(ctx, HudState, dt)` / `drawHud`: 요원 얼굴·체력(깎인 띠가 늦게 따라옴)·능력·필살(가득 차면 빛남)·상태, 탄약(탄창 눈금·재장전), 아이템 4칸, 층·변형, 재화 4종, 총애 −3~+3, 규칙서(새 줄 반짝임), 수호자 체력, 조사 안내(장치별 글자), 타이머·소리 게이지, 대사 줄, 알림. `drawMap` 지도 |
| `fx.ts` | `Fx`: `onEvent`/`onGameEvent`(엔진 이벤트 그대로), 흔들림, 스파크·충격파(1·2·3타 약·보통·강), 피해 숫자, 필살 암전, 피격 붉은 섬광, 체력 위험 테두리, 층 제목, 전환(`fade`·`doors` 승강기 문·`iris`·`glitch`). 그리기 도구 `Fx.shadow`(땅 그림자), `darkness`(어두운 층 조명), `rim`(림라이트), `tint`(피격 하얀 실루엣) |
| `menu.ts` | `Menu`: 타이틀·일시정지·설정·조작법·확인창·선택지(숫자 키). 키보드·패드·터치 모두 |
| `settings.ts` | 화면·소리·조작 설정과 저장 (기본 localStorage, `store` 로 바꿈) |
| `index.ts` | `mountGameShell`: 위를 전부 묶음 |
| `demo.ts`, `demo-world.ts` | 시연판: 회색 상자 층(차원 승강기)을 이 껍데기로 돌림. 탄약 12발/48발은 시연판이 셈 |

## 빌드와 시험

```sh
node scripts/build-ui.mjs        # dist/goei-ui-demo.html, release/demo/goei-ui-demo.html, dist-test/ui-input.mjs
node --test tests/ui-input.test.mjs
node tests/ui-browser.mjs        # PC 키보드·폰 가로 터치(스틱+공격 동시)·폰 세로·가짜 패드·메뉴, 스크린샷 dist-test/ui-shots
```

`scripts/build.mjs` 에 넣는 일은 통합 담당(게임 전투와 조작)이 한다.

## 확인 못 한 것

실제 폰 실기(진동, 사파리 전체 화면), 실제 게임패드, RisuAI 플러그인 창 안(돌린 화면의 `toLocal`). 소리 설정 값은 저장만 하고 소리 모듈이 읽어 간다.
