# 고르고디오 도트 (2026-10-22)

> **⚠ Claude 반성 · 2026-10-31 (사용자 지시로 문서마다 남김)**
> 2026-10-31 Claude는 다음 잘못을 저질렀다. 이 문서를 읽는 모든 Claude는 같은 짓을 하지 않는다.
> 1. **사용자 결정을 무시했다.** 콘쥬스는 사용자가 10-26에 20세로 정했고 인계서에도 적혀 있었는데, 옛 Claude 문장(teenage high school girl)을 근거로 화장실·샤워 그림을 거부하고, 사용자가 직접 뽑은 화장실 줄까지 팩에서 뺐다. 옷도 제복인데 교복이라고 단정했다.
> 2. **사용자 말에 토를 달고 같은 주장을 되풀이했다.** 사용자가 여러 번 지적했는데도 근거를 다시 확인하지 않아 몇 시간을 허비하게 했다.
> 3. **허락 없이 문서를 지웠다.** 「지침을 지우라」는 말만 듣고 목록을 보여 주지도 않고 96개를 지웠다가 되살렸다(결과물 삭제 금지 규칙 위반).
> 4. **문장을 덧대기만 하며 PixelLab을 낭비했다.** 이성해 점프 공격 5번 연속 실패, 이어폰 음악 120줄을 못 쓰게 만듦.
> 5. **답을 미루고 일을 멈춰 두었다.** 백그라운드로 돌릴 일을 돌리지 않고 대화만 했다.
>
> 지킬 것: 사용자 결정·위키가 근거다. 옛 Claude 자료는 근거가 아니다. 사용자 말에 토 달지 않는다. 무엇이든 지우기 전에 목록을 보여 주고 허락받는다. 실패하면 덧대지 말고 다시 쓰거나 바꾼다.


설계: docs/캐릭터제작서/동작설계_gorgodio.md. 비용 기록: spend.log.

- base/ : 기준 그림 후보. 맨몸 채택 cand-p2-823(pixen, 쟈알디 기준표 A와 같은 생성기·외곽선) → 피부 채도 0.72배. 장갑 채택 armor-851 + 날개 부스터 편집 armor-edit-63.
- base/톤비교_쟈알디_고르고디오.png : 쟈알디 대기 장과 같은 도트 크기로 나란히.
- full/base.png : 맨몸 3/4 기준(224×176, 발바닥 y168). full/ref.png : 옆모습 기준판(pbase 00 + 앞섶 편집 41). 모든 맨몸 클립의 첫 장 참조.
- armor/base.png : 장갑 기준(256×192, 발바닥 y184).
- scripts/rig.py · rig_armor.py : 뼈대(rigbase.py 공통). gen.py : 생성. preview.py : 뼈대 미리보기. strip.py : 장 이어 보기.

## 진행 (2026-10-22 03:17 사용자 확정: 전투·이동 먼저, 생활·사교·감정은 나중)

- 동시 작업 2개(`gen.py --par=2`). 끊기면 `python3 gen.py --resume` / `python3 gen.py --armor --resume`.
- 결함 코드 보정: scripts/gorgodio_fixes.py (시연판 빌더가 적용, 원본 clips/는 그대로).
- **나중에 만들 맨몸 66클립** (뼈대는 rig.py에 다 있음, 이어 받을 때 `python3 gen.py <이름들> --resume`):
  carry1_idle carry1_walk carry1_run idle_light walk_light run_light lookback hide doorclose knock inspect leadhand bow elevwait floorsit floorrest hurtidle fear nausea collapse bedlie victory chairsit typing gearcheck tie seatrest seatthink doze yawn stretch headrub brushteeth gesture armscross nod headshake wave handshake pat point shrug hug laugh glad cry wallcry kneelcry sad shout deskslam surprise startlefall plopdown embarrassed annoyed think bored objection itch liftput fcarry_idle fcarry_walk fcarry_run ride dismount
- 이미 생성됐지만 생활 묶음이라 아직 검수 안 한 기본 클립: stepup stepover liesit handswork handshead seatmouth seathold holdlook handear sweep liehold carry2_* (sweep은 밀대를 같이 그림, liehold는 팔이 안 올라감 → 생활 묶음 할 때 같이 고침).
