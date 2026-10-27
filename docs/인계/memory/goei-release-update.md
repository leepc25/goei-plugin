---
name: goei-release-update
description: 괴이: 이면세계 릴리스 절차와 Risu 안 업데이트(플러그인 update-url, 카드 card-update.json) 구조
metadata:
  type: project
---
- v0.16.0(2026-10-17)부터 Risu 안에서 업데이트(선택지용사 방식). 저장소 leepc25/goei-plugin(공개, 사용자 승인) main의 release/ 폴더, Releases 페이지.
- 플러그인: build.mjs가 package.json goei.updateBase로 `//@update-url .../release/goei-plugin.js`를 머리에 넣음 → Risu 플러그인 탭이 갱신.
- 카드: build_lite_card.py가 release/card-update.json(Risu 캐릭터 필드명, 사진·에셋·이름 제외)과 version.json을 만듦. 창 설정 → 업데이트(ui/update.ts, core/update.ts planUpdate)가 받아 setCharacterToIndex. 로어북·정규식은 이름(+폴더)끼리 교체, 사용자 항목 유지, 명부(Directory, 옛 이름 「괴이봇 명부」) 보호.
- 저장소 구성(2026-10-17 사용자 선택 「선택지용사처럼 전부」): 소스 전체 + card/원본_봇카드.jpeg + release/(plugin·card-update·version) 공개. 클론 /home/claude/goei-plugin, 개발 사본 /home/claude/goei와 같은 구조로 맞출 것.
- 카드 업데이트 데이터는 200KB 조각(card-update.N.txt)+목록(card-update.json). 저장소에 조각을 같이 올릴 것.
- 받기(v0.16.5): 웹 Risu nativeFetch는 모든 GET을 같은 /proxy2 주소로 보내 브라우저가 raw.githubusercontent의 max-age=300 응답을 다른 파일 요청에도 돌려줌(선택지용사는 GitLab API라 no-store). 그래서 risuFetch(plainFetchForce, Content-Type text/plain)로 직접 받고 실패 시 nativeFetch. 정규식 필드는 customscript(s 없음).
- 릴리스 순서: package.json version 올림 → npm run build → build_lite_card.py card/원본_봇카드.jpeg release/괴이_이면세계.charx → **dist/goei-plugin.js를 release/로 복사** → 테스트 → main에 커밋·push. 카드 minPlugin은 package.json goei.minPlugin(카드가 새 플러그인 기능을 요구할 때만 올림; 버전과 같게 두면 옛 플러그인에서 카드 업데이트가 막힘). release/version.json이 바뀌면 Actions(.github/workflows/release.yml)가 v버전 릴리스를 만들고 zip·charx·플러그인을 붙임. 태그 push는 세션 git 프록시가 끊어서 못 씀. 릴리스 파일 이름은 GitHub가 한글을 지워서 영문(goei-imyeonsegye*) + 한글 라벨.
- v0.16.29부터 플러그인 = 시작기(goei-plugin.js) + 본체(goei-body.js, src/body.ts). 릴리스 때 dist/goei-body.json·goei-body.*.txt도 release/로 복사. main.ts 수정은 body.ts로.
- raw.githubusercontent.com은 push 후 약 5분 캐시됨. v0.16.31부터 build_lite_card가 release/pic/지문.ext(카드 사진 전부)를 쓰고, 창 카드 업데이트가 바뀐 사진만 받음 → release/pic/ 도 커밋할 것.
- 공개 문구 원칙(사용자 2026-10-17): 저장소 README는 소개 한 줄·설치·업데이트만. 개발 경위(Lua→플러그인 등)와 변경 기록은 공개하지 않음(개발 중이라). 변경 기록은 프로젝트 공유 폴더 goei-plugin/README.md에만 → 개발 사본 README를 저장소로 복사하지 말 것. 릴리스는 pre-release로 표시(워크플로). 정식 릴리스 때 README·릴리스 페이지를 제대로 꾸미기로 함(사용자 약속).
- 공유 폴더 동기화(rsync 없음, tar 사용) 때 반드시 --exclude=./README.md. 2026-10-19 tar 동기화가 공유 README 변경 기록을 저장소 README로 덮어써 v0.16.1–0.16.32 상세 기록이 사라짐(요약으로 다시 씀). 저장소 4a379a4:README.md에 v0.16.0 이하 원본 있음.
- v0.17.0(2026-10-27)부터 build_lite_card 가 release/ 에 wiki-base.json+wiki-base.N.txt(위키 기본 문서 묶음, 카드에서 뺌)·icon.png 도 쓰고, src/data/install/(인사말·사진 목록·기본 명부·아이콘 지문)을 플러그인 소스에 생성한다(깡통봇 설치용, 같이 커밋). 본체는 조각 17개(약 3.4MB). 카드 minPlugin 0.17.0.
- 다음 릴리스(0.17.2 뒤)부터 토크나이저 o200k_base: build.mjs 가 dist/tok-o200k.json+tok-o200k.N.txt(12조각, js-tiktoken 순위표) 를 쓴다 → 릴리스 때 **dist/tok-o200k.* 도 release/ 로 복사**. 플러그인이 설치·점검에서 받아 저장소(goei:tok-o200k)에 두고, 받기 전엔 어림값.
