---
name: goei-merge-1101
description: 2026-11-01 state after account move back — merge-1101 branch, 5 parts and what each waits on
metadata:
  type: project
  modified: 2026-11-01T07:16:32.726Z
---
Source of truth from 2026-11-01: branch `claude/merge-1101`, doc `docs/인계/2026-11-01_최종_전체_인계.md` (read CLAUDE.md first; it holds all user rules incl. 7 bg rules from 중림 thread).
Parts: 1 field code (8 features + ally combat AI; waits on 16 arbitrary choices in docs/필드기능_결정_1031.md, ally/enemy marker) · 2 dialogue (52 chars+30 NPC written; 8 user questions; next = game reader code) · 3 PixelLab nude-hit 125×7 (1 sure fail; next = pack/code link) · 4 중림/HQ bg (HQ minimized; 3F drawing, next 휴게실 door type) · 5 shower code on hold.
2026-11-01 07:15 update: branch `claude/project-thread-1h1kah` (from merge-1101) now holds field fixes (user answers to the 16 items, see [[goei-field-no-model]]) + dialogue thread's dialogue2 reader (merged from claude/project-thread-naojjo) + guard expel cues. Tests 556 pass. Not on main.
main v0.18.2 is an ancestor of merge-1101 (fast-forward). Version not bumped. Merge/release only on 「릴리스해」.
**Why:** project memory stopped 10-24; user returned from another account.
**How to apply:** trust repo docs over older memory lines; HQ structure change means field scene ids must be re-linked when new HQ map lands.

**Release plan (coordinator 2026-11-01 07:18):** when user says 「릴리스해」, merge into merge-1101 then main: field+dialogue = `claude/project-thread-1h1kah`, nude-hit = `claude/project-thread-655bxw`, bg (2F·3F in game) = bg thread branch (commit 95a8ee0). Known pre-existing browser-test failures since merge-1101: 엔진·게임 받기·NPC (3 tests). Do not merge before 「릴리스해」.

**Read before release (coordinator 09:17):** handoff doc §6 (10-29~11-01, 578 commits) + `docs/인계/2026-11-01_반성문_빠뜨린것_수습.md`. Unmerged old branches needing user decision at release: `claude/qc-release-2026-10-28` (홍보글 2~8판, 18c), `claude/nice-cannon-5aiwju` (NAI 추가감정 15종·관리국 11명 동작, 17c), `ccr-a2c5bef9-k9zxrz` (인수인계 문서, 1c), `claude/jolly-davinci-e91l7r` leftover code (3D 에일린 시험, 헐값매입 방). `docs/인계서.md` says v0.18.0 but package.json is 0.18.2 — fix at release after user OK. Merge the part branches only after their sessions finish; show conflicts before resolving.
- Also merge at release: `claude/project-thread-cxist7` (badges 1~6판, rank stars rankStarArt.ts, charWindow.ts preview-only, quickSlotArt.ts; end commit be33a98d1a (take branch tip at release) — char window game hookup (` key), touch 「통합창」 button, new pack game-pack/ui-badges → release/game must include ui-badges.pack·bin; 558 tests OK). Received 2026-11-01 12:26 via user 「이제 작업결과 넘겨」.

**11-01 저녁 (필드 기능 스레드):** 샤워장 브랜치 `claude/project-thread-nfk03o`(70커밋, 1718ac2f2e)를 `claude/project-thread-1h1kah`에 합침 → a2d73bd966. bath_f/bath_m 장면에 `sex` 표시 추가(이성 침입 감지 샤워실에서도 동작). 571 테스트·필드 QC 통과. 아직 열린 것: 샤워 중 피격·NPC 샤워 동작(샤워 스레드가 미포함이라 밝힘). 1h1kah → merge-1101 재합치기는 「릴리스해」 전에.
**11-02 03:45:** 1h1kah를 merge-1101에 합침(fast-forward, 충돌 없음) → 793cc122f2 (검수 전 데모 release/demo/goei-action-game.html 갱신 포함). 571 테스트·필드 QC·정보창 QC 통과. 「릴리스해」 대기. 열린 일: 샤워 중 피격·NPC 샤워 동작.
**11-02 04:40:** 샤워 추가분(nfk03o a55c12b733: 샤워 중 피격 nude/dress, 팩 전체 SH_D·SH_E 샤워기 헤드·물줄기 지움 206장, 원본 tools/charpack/orig/)을 merge-1101에 fast-forward → 753f08f84f (데모 갱신 포함). 571 테스트·필드 QC 통과. 열린 일: NPC 샤워 동작. 「릴리스해」 대기.
**11-02 07:30:** 휴게실 탑재(sjj06y)를 필드 기능 스레드가 이어받아 의자 스레드(dgksmu 1698eeb) fit_all.json 최종값 가져오고 장마다 다른 값(fdx/fdy, seats.ts seatFitAt) 게임에 추가, 팩 125개 chairL 재굽기 → sjj06y 푸시 후 merge-1101에 fast-forward → a24bfb8df6 (데모 갱신 포함). 572 테스트·필드 QC 통과. 열린 일: NPC 샤워 동작. 「릴리스해」 대기.
**11-02 07:55 (시연판·인계 수습):** release/demo/goei-action-game.html 은 그림 없는 엔진 시험판(막대기) — 사용자에게 주면 안 됨. 진짜 시연판 = `release/demo/goei-field-demo.html` (src/game/action/engine/fielddemo.ts, 가짜 다리 + 팩을 raw.githubusercontent 의 game-pack/ 원본에서 받음; rawcdn.githack 링크 + 커밋 sha, 첫 화면 「Open the page」 한 번). merge-1101 8b2e619: a38v0b(탈의실·NPC 샤워, kvyr7g 포함)·g6ipoh(사무실 책상 그림·도구) 합침, 579 테스트. qgoupv(사무의자 C01 재맞춤)는 판정 대기라 미합침. 인계표 /mnt/project-files/field/인계_반영표_1102.md.
**11-02 09:00:** 3F 사무실 지도(01muti 4c50463, 사용자 확정 08:52)를 merge-1101에 합침 → 23111f73e5. game-src/mapedit/office/ (map.json·strip·layer 16) 들어왔지만 **게임 연결(import → mapedit.gen.ts, map.ts 장면)은 아직 안 함** — 사용자 지시 있을 때. extend_right.py는 01muti 판(이음선 자르기 DP)으로 통일.
**11-02 09:08:** 사무실 자리 규칙(사용자 09:05): 책상 주인은 평소 앉는 사람(owner)일 뿐, 비어 있으면 유저·공용 NPC 누구나(shared:true), 유저 전용 책상 없음. 01muti 3d3d6f1 merge-1101에 합침 → d9767dda42. 격리팀 사무실은 같은 맵 색만 바꿔 재사용 예정(SCENE·WHO_MAP). 게임 연결은 아직.
**11-02 09:15:** 2F 진압팀 사무실 맵(office_riot, 같은 맵 색만 다름, 고르고디오 desk4·큐라스 desk5, 나머지 공용) 01muti 6058c9d merge-1101에 합침 → 1997745545. 두 사무실 다 게임 연결은 아직(사용자 「연결해」 대기).
**11-02 09:40:** 사무의자 C01 재맞춤(qgoupv 1798532)을 merge-1101에 합침(충돌 187개 모두 11-02 판) + 125명 팩 cfg.chair 갱신(frame_dx→fdx, build_char_packs.py 변환 추가) + 고연지·박민성·아벤샤·브라우니 팩 재굽기 → 69aff677. 579 테스트·필드 QC 통과. 남은 열린 일: 사무실 2곳 게임 연결(「연결해」 대기), NPC 샤워 동작 X(이미 a38v0b에 포함). 모든 인계 브랜치 합쳐짐 — 「릴리스해」 대기.

## v0.19.0 릴리스 (11-02 12:2x, user 「일단 한번 해」)
- main = 7c0afca (ecfe753 v0.19.0 + 7c0afca 마무리). release.yml은 Claude 앱 push로는 안 돌았다(paths 트리거 안 걸림) → workflow_dispatch로 수동 실행 (run 41444729430).
- 7c0afca 고친 것: 플러그인이 optional 팩(인물 126명 등)을 한 번도 내려받지 않던 문제(packs.ts ensure()), 필드 닫기 누수 3건(fieldShop dispose·onBeforeSend 해제·field.ts tails Map+releaseField), 시험 기대값(10-31 Field log 영어 열쇠, 출동 삭제).
- 알려진 낡은 시험: qc-game-plugin 뒷부분(출동 「젖은 복도」 보고서)·qc-mobile (g) 이후(jaemtri 임무창)는 73b0aee 「출동 전부 삭제」로 없어진 기능을 기대 → 아직 안 고침. engine/qc-combat 옛 데모 시험·옛 출동 시험 파일 없음도 그대로.
- 11-02 12:35 d8fab49: 의무실(B2, 관리국) 배경·레이어 자료 합침 (aonpel 29c96cd·b475c68). 배경 game-src/art/pixellab-hq-20261031/hq_b2_infirmary_p9_fix2.png 872x424, 장면 game-src/mapedit/infirmary/map.json (tools/mapedit/author_hq_infirmary.py). 오른쪽 뒤 침대 뒤 틈 아직 열림. 게임 연결(import.py·방 잇기) 안 함 → 사용자 「연결해」 때.
- 11-02 12:36 30b5965: 관리국 종로 거리 그림 장면 합침 (gyutdb bed08303). 장면 id 'street'가 옛 회색 뒷골목을 대체(map.ts floorHall), tools/mapedit/author_hq_street.py. 문: main↔lobby.main, jr(정류장)→jr_entry.west, 파스타집은 사용자 결정으로 뺌(521ab4b, 310802e 합침). npm test 579 통과. 릴리스 v0.19.0(main 7c0afca)에는 안 들어감.
**11-02 14:1x (필드 기능 스레드):** merge-1101 = 94180bb. 2c3bd12 사무실 2곳(3F office·2F swat=office_riot 그림)·의무실(B2 infirmary, 격리팀 사무실 clinic 북문 「의무실」로 출입) 게임 연결 + 옛 자동 시험 정리(출동·Field log 영어·favicon 404·AUTO 절 삭제) + **버그 고침: packs ensure() 늦게 받기 때문에 visitReady 가 늦게 풀리며 본부에 들어간 사람을 제목으로 되돌림(modules.ts boot 가드)**. 협회 거리 gyutdb(7776a24: 영등포 sdra_street, 협회 정문 main↔sdra_lobby, 버스 정류장 bus 문끼리 chooseFloor 창: 종로 jr·영등포 bus·중림 west) 합침, mapedit.gen.ts 는 충돌 시 `python3 tools/mapedit/import.py --rebuild` 로 재생성. 정류장 단추 폭 자동(main.ts CSS).
- **소스에서 사라진 옛 기능(합치기 손실 의심, 사용자 답 대기):** 자동전투 AUTO 두뇌(src/game/action/eileen/autoPilot.ts, v0.18.2 에 있고 v0.19.0 에 없음; 터치 AUTO 단추는 남아 있으나 setAuto 호출자 없음). 전투 「선입력 2칸」(10-29)도 지금 core.ts 는 P.buf 한 칸 → qc-combat 「빠른 연타 약3+강=날리기」만 실패(stun). 나머지 브라우저 시험(engine·qc-mobile·qc-game-plugin·qc-pipeline)은 통과.
- 공유 폴더(/mnt/project-files) 동기화는 Library/goei-plugin 사본(5만 파일 한도)으로 막혀 첨부 실패가 이어짐; 사본은 release/ 만 남기고 지우는 중(사용자 허락 11-02).
**11-02 14:5x:** merge-1101 = d97b4d5. 합침: 백일몽 본사 8evywd eb96f0a(by_lobby·by_f13·by_f15, 엘리베이터 bldg 'by', 정문은 임시로 종로 거리), 사무실 bgScale 2→1(2a84e5b). 새 코드: 책상 owner/shared 가 import.py→gen.ts→HqSpot 로 들어오고 floorHall 이 오브젝트 의자 방(office·office_riot)에 seats 를 만든다(자리 의자 = 발점이 같은 오린 의자 오브젝트, 앉으면 그 오브젝트 안 그리고 C01+사람). actors.ts: 책상 일은 자기 책상(owner) 먼저, 빈 책상은 누구나(freeSeat who). fighter/player.ts sortY: 앉은 동안 의자 발점(seat.cy)이 깊이 — 안 그러면 앞 책상 뒤로 숨음. 시험 580 통과. 백일몽 사무실(by_office·by_elite)은 같은 그림 재사용 + BY_DESK_OWNERS(map.ts).

- 11-02 14:5x: 자동전투(AUTO) 되살림 → commit 5d757ee on claude/merge-1101. src/game/action/fighter/autoPilot.ts (FighterBrain normal, kit per art), player.ts `auto` field applied in tick, modules.ts O 키(CODE.auto)·touch setAuto, window.__goeiAuto. 상대 없으면 못 켬, 스틱 조작 중+1초 멈춤. qc-mobile (i) 절 복구·통과. npm test 통과. 캡처 /mnt/project-files/field/auto_spar_1102.png (thread attach cap 24 reached → not attachable).

- 11-02 15:09 중림 가구 스레드 인계(필드 기능 새 스레드가 받을 것): 브랜치 claude/project-thread-w2hjge (4xyzuf 위, 끝 4f6f7500a), merge-1101 미합침. 내용: 대박 포커 테이블·진료실 침대(점프 발판)·책상 막힘 재따기, 수술실 발판·원근, 중림 바깥 4장면(지상 입구·지하1·뒷골목·지하2) 바닥 뒤끝 + 계단 4곳 + 지상 입구 내려가기 문→계단 입구, 손길 대기실 화분 지운 배경 + C06 서향 대기 의자(오브젝트·막힘·자리 3). 엔진 남은 일: ① C06 긴 의자 앉기(map.json bench 'C06'·seatPt를 import.py가 game.json으로 안 넘김, sdra_counter와 같은 꼴; 가까운 좌석 가림, 앉을 때 C01 안 그리기) ② 대박·헐값·영창 사무의자가 그림 소품(c01_south)이라 앉으면 겹침, chairs 상자는 남향 C01 못 그림. 확인 그림 /mnt/project-files/jr-furniture/ fix_*, floor_*, songil_final_*.

- 11-02 15:14 협회 창구 스레드 인계(필드 기능 새 스레드가 받을 것): 브랜치 claude/project-thread-dgn08g(최신 2fba159fa, x0zdau 이어감), merge-1101 미합침. 내용: 창구 걷는 바닥·가림(손따기 v12, tools/mapedit/author_sdra_counter.py), mapedit.gen.ts sdra_counter + game-pack/jr-field/me_sdra_counter*.webp, map.ts 연결(sdra_f2 'office' 유리문→sdra_counter, 나가기→복도), 직원 자리 clerk1~3(who 서윤지·차여진, 3번 협회 직원 돌림), 대기의자 C06 3개(wait1_1~wait3_3), import.py spots.owner→who. 테스트 579 통과. 남은 일: 직원 3명 NPC 착석 배치(필드 쪽).

**11-02 17:14 릴리스 v0.20.0 (사용자 「그대로 두고 릴리스 해봐」):** merge-1101 325dc54 → main(fast-forward), Actions #84 성공. 내용: 필드 인물 배치 전면 수정(goei-npc-placement-audit-1102), 사람 크기·원근 통일, fb_ 가짜 관리국 본부·백일몽 17층·강남 거리·중림 가구·협회 창구 합침, 로어북 비밀 문단. 브라우저 시험은 push 뒤 계속 돌림(13/30 통과 시점에 push). 공유 폴더 /mnt/project-files/goei-plugin/release 동기화 + README 변경 기록 새로 씀(옛 README는 정리 때 사라짐). 다음 작업은 merge-1101에 이어서.
