---
name: goei-directory-photos
description: 명부 괴이·특수·요원·조직 사진 규칙(대표·얼굴 두 가지, 얼굴 틀 crop)과 에셋 모듈 이미지 찾기 — read before touching photos or 명부 fields
metadata:
  type: project
  modified: 2026-10-19T02:46:41.928Z
---
- 사용자 결정(2026-10-19, 스레드 "괴이 플러그인 수정"): 사진은 종류 무관 두 규칙. 목표 = "이미지 1장만 올리면 어디든 맞게".
  - 대표(큰 사진: 위키 문서 정보표, 시작 화면 세력 카드, ID카드 배경): 고른 대표(photo) → 「영문명_default」 → 「영문명」. host/assets.ts mainPic.
  - 얼굴(작은 사진: 요원 카드, 명부 목록, 위키 서랍·카드·분류 타일, 괴담톡, 인물 칩): 고른 얼굴(face) → 「영문명」 → 대표 사진을 얼굴 틀(crop "가로,세로,크기" %)로 자른 것. facePic. 틀 미설정 시 요원만 DEFAULT_CROP '50,16,44'(사용자가 Jyaldi_default 비교에서 고름; 50,19,40은 머리끝 잘림), 다른 종류는 대표 그대로.
  - 자른 사진은 이름 「이름#x,y,w」로 ui/images.ts imageUrl이 canvas로 256px 네모로 잘라 캐시.
- f01~f05 기본 세력 그림 규칙은 사용자가 폐기(2026-10-19). 다시 넣지 말 것.
- 명부 사진 칸: 대표·얼굴 두 줄 + 「틀 맞추기」(대표 사진 위 네모 틀 끌기 + 크기 막대). 저장 필드 photo·face·crop (요원·괴이·특수 행, 조직 spec).
- 얼굴 자동 인식은 안 넣음(브라우저 FaceDetector는 일부 크롬만, 애니 그림에 약함). 사용자가 원하면 실측 후 재검토.
- 표정 세트(_default)는 사용자가 따로 까는 에셋 모듈에 있음 → getDatabase(['modules','enabledModules'])로 모듈 에셋도 찾음(loadModuleAssets, 창 열 때). 모듈 이름 색인 있음.
- 조직 영문명 기본값은 📜Faction 이름(ORG_ENGLISH in core/world/directory.ts). 세력 사진은 ui/images.ts factionPic(명부 조직 spec 기준).
- 명부 수정은 덮어쓰기 전 draft지만 거점은 임무 지도에 바로 반영(draftBases). See [[goei-bot-plugin-project]].
- 시험: tests/browser.mjs 17d (픽스처 옆 face-test.avif가 있으면 실제 그림으로 찍음).
- 정리 결과(커밋 b0b8457, 우리 브랜치): assets/wiki/{Anomalies 62, Mystic Sites 10, Factions 15 영문명(_default 안 붙임, 사용자 2026-10-19: _default는 요원 큰 사진에만), Unused 10}, AVIF q50(사용자 확정). 세력 선택: 발푸르기스 B·흡혈귀 B·병원 A(괴이 그림)·극단 B·무명찬란교 B. Civilian_default·Freelancer_default도 추가(사용자 그림, 832px). 세력 16 중 미분류 빼고 전부 그림 있음. 요원 _default는 사용자 모듈에 있음. 거점 사진은 보류(사용자). 위키 이미지는 카드 에셋에 넣음(사용자 결정, build_lite_card add_wiki_assets, f01~f05 카드에서 뺌). 품질 50 확정(사용자, 평균 46KB, 87장 4.0MB, 카드 10.2MB).
- 2026-10-21 사용자 뒤집음: 괴이·특수의 「다른 폴더에서 온 후보」(세력·요원 로어북 10개) 전부 뺌 (commit cb2a9dd, migrateLore + 0.16.37 미만 카드 업데이트 때 dropOldOutsidePlaces). 다시 기본으로 넣지 말 것. UI로 직접 넣는 기능은 남김. 위키에서만 인물·조직 항목으로 보이게 함. 위키 조직 = 명부 조직 전부(orgLoreName으로 세력 폴더 문서 이름).
- 지도(2026-10-19 사용자 확정): assets/maps 1100px AVIF q50 (창이 1100을 확대해 보여 흐려 보였던 것, q50 충분). build_lite_card shrink_maps가 원본 지도를 바꿔 넣음. 카드 8.3MB.
- 사진 업데이트(커밋 53fcc36): 처음엔 사진 다 든 릴리스 카드, 이후는 창 카드 업데이트가 매니페스트 pictures [이름,지문,확장자,크기] 비교로 바뀐·새 카드 사진만 UPDATE_BASE/pic/지문.ext에서 받아 saveAsset (host/picpack.ts, core/pictures.ts). 이름 같다고 두지 않음(사용자). 다 못 받으면 카드도 안 바꿈. 릴리스 때 빌드 결과 pic/ 를 release/pic/ 로 함께 올려야 함.
- v0.16.33: 요원 기본 그림 55장 assets/agents/*_default.avif(832×1216)를 카드에 넣음(build_lite_card add_wiki_assets). 요원별 얼굴 틀은 host/assets.ts AGENT_CROPS. 사람은 고른 대표가 없으면 얼굴 = 영문명_default를 personCrop으로 자른 것이 옛 200px 「영문명」 아이콘보다 먼저(화풍이 달라서). Yeon-ji-a → Yun Ji-a.
