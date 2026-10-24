---
name: goei-bot-plugin-project
description: 괴이봇(Anomaly Sim 2.4) 플러그인화 프로젝트의 목표, 결정, 자료 위치
metadata:
  type: project
  modified: 2026-10-17T03:50:00.000Z
---
- 렉 때문에 Lua 기능을 진짜 플러그인으로 옮기는 중(최적화만으로는 안 된다는 사용자 결론).
- GPT가 만든 기존 플러그인(괴이플러그인_0.3.4 zip)은 봇 Lua를 Wasmoon VM으로 감싼 래퍼라서 사용자가 실패작으로 봄. 그 방식을 다시 쓰지 말 것.
- 참고 모범: selection-hero-plugin.js. Risu 문서: risuai plugins.md, apiV3/risuai.d.ts.
- 분석/설계 문서: /mnt/project-files/analysis/괴이봇_렉원인_플러그인설계.md (2026-10-16).
- 방식: 원본 카드는 그대로 두고 tools/build_lite_card.py로 Lite 카드 생성(Lua 0, 매니페스트 로어북). 코드 /mnt/project-files/goei-plugin/ (TS+esbuild, README에 구조·명령).
- 명칭: 원본의 "통합관제"는 더 이상 쓰지 않음. 괴이·사건·미스틱 사이트·요원 현황 기능 이름은 「상황판」(2026-10-16 사용자 선택). 창 탭·설정에 이 이름을 쓸 것. 접속 효과 문구는 "ANOMALY SIMULATION"만, 한글 문구 없음(상황판은 기능 중 하나일 뿐).
- 공통 기반: core/cbs.ts·refs.ts·host/llm.ts. 플러그인은 페르소나를 못 읽음 → {{user}}="주인공".
- 괴담톡: core/phone.ts·ui/phone.ts, 저장 $ph_*. 브라우저 테스트는 15번 외 $ph_auto=0.
- 설정: core/settings.ts($st_*), 보조모델 이미지 태그 core/asset.ts.
- 원본 대비 누락 목록 goei-plugin/docs/원본대비_누락목록.md. 원칙: 원본 통째 복원 아님, 나아진 점 유지.
- v0.9.0(2026-10-16): 폴더 자동 분류(🚧괴이·🎁파밍·🙂요원) + 카드 로어북 「괴이봇 명부」(창 설정→카드 명부에서 편집, 공유 시 따라감). 사용자 결정: 요원 소속은 구분선이 아니라 창의 조직 목록에서 고름(구분선은 짐작용). 시작 화면 플레이 세력 추가는 scenarios.json을 카드로 옮겨야 가능(미결정).
- v0.10.0: 첨부(core/attach.ts, 본문 [[ATTACH:kind]]), 괴담넷 끄기·자동 새로고침, 보관 한도, 공지 페이지.
- v0.11.0~0.12.0(2026-10-17): 실제 사진(risuai.saveAsset→assets 경로를 %%ATTACHMENT%%에, 모델엔 multimodals), PC 창 1560×1000, 작전 카드, 요원 카드(images.ts agentInner), 괴담톡 메신저(PC 두 칸·모바일 한 칸·입력창 하단, 설정은 ph-settings 화면), 설정 줄 모양 .ps-group/.ps-row 공통, 명부 「다른 폴더에서 온 후보」+후보 추가(조직·개체 8개는 원본 World catalog 출신). 사용자 원칙: 모바일은 고정 높이 틀 금지·조작부/입력창 하단·좁은 칸 줄바꿈 주의. 새 플레이 세력 v0.13.0(2026-10-17): core/factions.ts, 명부 조직 spec(code·playable·type·title·blurb·photo·gm_name·gm_desc·seed·tab·hidden, codes_used), 🏷️Tag·📜Faction 자리표시자 $fac_codes/$fac_ac/$fac_pool/$fac_extra(Lite 빌드가 넣음, 옛 카드는 명부 버튼). 새 세력 첫 장면은 직접 입력·커스텀 임무만, 전용 괴담톡 탭 T1xx. 설계 docs/조직코드_확장_설계.md. 사용자 수정 요청 목록 docs/수정요청_1017.md.
- v0.14.0~0.15.0(2026-10-17): 상황판 작전 현황판(위협도 한 줄+개수 칩+괴이←투입 요원), 모바일 다듬기, 지도 칸 안 확대(ui/mapzoom.ts), 바깥 클릭 닫기, 창 밖 요소 테마(ui/theme.ts PALETTES, x-goei-theme), 왼쪽 위 간이 상태창, B00 본인 시점 「관리국」. 화면 봇 이름은 「괴이: 이면세계」(v0.15.1, 사용자 결정), ui/brand.ts 한 곳. 모바일 화면 확인용 tests/shots.mjs.
- 테스트 함정: browser.mjs 단언 실패 시 브라우저가 남아 멈춘 듯 보였음 → unhandledRejection 처리 추가. `pkill -f chrom`은 자기 셸까지 죽이니 쓰지 말 것. 설정값은 Settings 로어북 대신 pluginStorage 'goei:prefs'(새 채팅 기본값) + 채팅변수 $st_*/$wg_*.
