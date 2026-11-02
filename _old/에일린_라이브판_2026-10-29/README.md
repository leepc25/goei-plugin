# 에일린 라이브판(옛 팩·코드) 보관 — 2026-10-29

사용자 지시(10-29): 「옛날 팩은 남길 이유가 없어. 에일린 라이브판에 있는 것은 통째로 떼어내서 보관하고 있다가, 이식판(통합 테스트룸 인물 팩 `game-pack/char-*` + `src/game/action/room3/`)이 라이브판에 안착되면 지운다.」

여기 든 것(원래 자리 그대로 옮김, 게임·빌드는 더 이상 안 씀):
- `game-pack/test-people/` — 옛 에일린 v2 시트(`eileen_*.webp`, `eileen.json`, `eileen_vfx.json`) + Test man·Test woman
- `game-pack/visit-agents/` — 옛 요원 10명 atlas(쟈알디·에일린·스팡달·데드폴·게슈간·로제몬·큐라스·고르고디오·잼트리·데쥬레)
- `src/game/action/eileen/` — 옛 에일린 전투 코어(core.ts)·플레이어·AI, `src/game/action/art/testPeople.ts`·`visitAgents.ts` — 그 그림 로더
- `tools/build_field_eileen.py`·`port_eileen_room.py`·`build_visit_agents.py`, `scripts/build-visit-preview.mjs`
- `game-src/action/eileen/` — 옛 에일린 테스트룸(motion_v3)·PixelLab 생성 원본

지울 때: 이 폴더째 삭제(사용자 허락 뒤).
