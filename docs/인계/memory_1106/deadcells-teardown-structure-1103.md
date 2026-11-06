---
name: deadcells-teardown-structure-1103
description: 데드셀 해체 자료(사용자 PC)에서 읽은 조작·무기·기술·동작·룬 구조 요약과 원문 위치 (11-03 15:25)
metadata:
  type: reference
---
원문: 사용자 PC C:\Users\leepc\DeadCells_measure\데드셀_조작무기기술동작_1103.md (51KB; v2 repo claude/project-thread-190koc docs/ 로 push 요청함). 출처 파일: res\data.cdb(표 54), lang\main.ko.mo, atlas\beheaded.atlas.
- 키 기본값: 자료에 없음(코드). 다이브 공격·아래로 점프 = 점프+아래.
- 무기 칸 2 + 배낭 1. 근접 80·원거리 46·방패 15. strikeChain: 근접 3단 최다(32/79), 원거리 1단 최다(35/46). 단계 필드 charge·coolDown·lockCtrlAfter·hitFrame·dynamicCharge.
- 기술 칸 2: 수류탄 12·덫/포탑 13·힘 52, item.castCD.
- 주인공 동작 572·10234장: idle46 run20 roll 4+15+12 dash6 wallClimb12 wallRun24 stairs24 stun36 등. 2단점프·사다리·내려찍기 전용 그림 없음.
- 룬 11 (덩굴·순간이동·충돌·거미·호문쿨루스·모험가·여행자 …).
See [[goei-no-hallucinated-claims-1103]].

- 11-03 15:50 code teardown done (deadcells.exe HashLink, docs/데드셀_코드측정_1103.md fd42bfe; 추가측정 0d85a71). Keys 37 (Options.configController). Weapon slots 2, no per-slot type check; only DualWeaponBase+Offhand pairs (crossbows 4, lantern, hardlight, tick scythe, snake sword) take both; bows 1 slot (7-4). Parry 0.2s (easy 0.4). No hitstop; Boot.slowMo(dur,speed): hit 0.3s×0.35, elite kill 0.8s×0.3. shakeS only ~53 weapons + landing. MapGenerator: score -√(w²+h²)/10, -200×reuse, pick random from top k=3+tries/50.
