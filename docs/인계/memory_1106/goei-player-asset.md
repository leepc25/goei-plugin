---
name: goei-player-asset
description: 캐릭터로 플레이 중 주인공 이미지 태그 설정(「주인공 이미지」, $st_asset_player) — 구현 위치와 출시 상태
metadata:
  type: project
  modified: 2026-10-22T15:13:13.531Z
---
- 사용자 요청(2026-10-22, 스레드 캐릭터로 플레이 동작 방식): 설정 → 캐릭터 이미지에 「주인공 이미지」 ON/OFF, 기본 OFF.
- 브랜치 claude/project-thread-5jnuie 8개 커밋 끝, 미출시. 카드 로어북(card/image-lore.json Asset)이 바뀌어서 카드+플러그인을 같이 내야 함.
- 사용자가 정한 방식: ON이면 Asset 로어북의 {{user}} 금지 문구 네 군데만 `{{#if {{notequal::{{getvar::st_asset_player}}::1}}}}…{{/if}}`로 숨김 (지침 문장을 따로 추가하지 말 것, 사용자가 화냄). OFF + 캐릭터로 플레이면 플러그인(core/player.ts hidePlayerTag, body.ts withPlayer)이 요청 직전 「- Characters {name}:」 명단에서 주인공 영문명(agent.english, 예 Jyaldi)을 뺌. 명단에 {{user}}는 넣지 않음: 태그는 영문명이어야 하고 요원 영문명은 이미 명단에 있음.
- 페르소나(캐릭터로 플레이 안 할 때, ON): 명단 끝에 {{user}} (CBS). imgtag.ts가 페르소나이름_표정 → 페르소나이름_default 에셋 → 없으면 {{source::user}} 유저 사진. 사용자: 페르소나 에셋은 나중에 추가할 수 있음. 보조모델도 같은 구조(core/asset.ts withUser).
- 보조모델: host/asset.ts가 OFF일 때 주인공 요원을 planAsset exclude로 뺌.
- CBS 사실: 없는 변수는 getvar가 "null".
- 배경: Risu가 {{user}}를 페르소나 이름으로 바꾸고, 플러그인 applyPlayer가 그 이름을 요원 이름으로 다시 바꿔서, "{{user}} 태그 금지"가 사실상 "쟈알디 금지"가 됐음.
