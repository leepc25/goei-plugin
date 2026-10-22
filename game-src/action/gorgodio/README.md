# 고르고디오 도트 (2026-10-22)

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
