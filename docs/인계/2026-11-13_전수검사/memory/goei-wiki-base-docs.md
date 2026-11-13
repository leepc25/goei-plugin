---
name: goei-wiki-base-docs
description: 괴이위키 기본 문서 141개(카드에 압축 내장)의 출처·형식·적용 상태
metadata:
  type: project
---
- 2026-10-18 GPT 결과(docs/wiki_gpt_1018/)는 문체·지침 누설·숨김 정보 문제로 사용자가 버림("GPT는 못 믿겠다"). Claude가 141개 전부 다시 씀: docs/wiki_claude_1018/ (문서당 각주 8~9, 5,500~7,000자). 검수 보고서 docs/위키문서_검수_1018.md.
- 사용자 선호: 위키 문서는 각주(📌)를 넉넉히. 지침 문장을 본문에 쓰지 않기("이 문서에서는 ~하지 않는다" 금지).
- 적용: 사용자 결정 「카드에 넣기」(저장소에서 받기는 저장소를 언젠가 닫을 수 있어 거절, 플러그인 내장은 다른 봇에서도 읽혀서 비추천). card/wiki-base.json → build_lite_card.py가 「📖위키」 폴더의 「📖위키 기본 문서」 항목 하나로 gzip+base64(GOEIWIKI1:) 압축, core/wiki.ts prepareBaseDocs가 창 열 때 풂. 카드 업데이트 13조각(약 2.4MB).
- 브랜치 claude/project-thread-ogrf03에 push(v0.16.27 위), 릴리스 안 함. 다음 릴리스에 합칠 것. See [[goei-bot-plugin-project]].
- v0.16.28(2026-10-18) 릴리스로 나감: 기본 문서 + 각주 창(PC 올리면 창·누르면 목록으로, 모바일은 창만) + 위키 메인 유령 마크. 원본 대비 설정 비교 스레드 브랜치(mos9hx)도 합쳐 같이 나감.
- 2026-10-21 user: the bot's 관리국 is from a DIFFERENT world, not 「괴담에 떨어져도 출근을 해야 하는구나」's 초자연 재난관리국. Never use 재난관리국 material for 관리국 docs. 백일몽·유쾌연구소·무명찬란교 etc. DO come from that novel (user pasted 나무위키 백일몽 text; namu.wiki returns 403 to fetch, ask user to paste). 거점 docs: 백일몽 본사 written (own doc, 백일몽 doc links it); 서울중앙성원→이슬람, 기독교 상점 = own doc (교황청 Korea base, no 교황청 doc), 협회·중림 → existing docs; 관리국 본부 to be written from bot lore + 관리국 doc only.
