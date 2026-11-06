---
name: goei-field-removal-1104
description: 11-04 기존 플러그인(goei-plugin)에서 필드(게임) 기능 제거 작업 — 범위 목록, 브랜치, 확인 대기
metadata:
  type: project
  modified: 2026-11-04T00:45:24.169Z
---
11-04 사용자: 새 게임(v2) 접고 「필드 제거 작업」. Thread 「플러그인에서 필드 기능 제거하기」 cmsg_01SMy6spzkHA3Ttz9fg54ZY82PfKHxXz2eGouvkva6ptNX. Repo leepc25/goei-plugin, branch claude/project-thread-c3oify (from claude/merge-1101 = v0.20.3).
- 필드 = 게임 버튼·게임 창(src/ui/game.ts, src/host/game/*, src/game/*), 본부 방문 대화(core/visit*, ui/visitset·visitgame), 필드 장부(core/field*.ts, body.ts withVisit/fieldIdle/flushGamesBeforeSend), 설정 「필드」칸, 기록의 출동 종료·필드 보고서, 빌드의 게임 팩·시연판.
- NOT field despite name: src/ui/field.ts = 지도·커스텀 임무 탭 (keep).
- Measured: field code in body ≈95KB of 2.34MB (game code/packs already separate downloads).
- Keep game-src/game-pack/docs (no delete). release/game·demo·visit-preview (~540MB) deletion = asked user separately.
- 11-04 00:5x: list posted, waiting user OK.
- 11-04 03:43 USER 「빼」 = approved code removal. 03:44 USER: final release will move to a NEW repo when the game is done (this repo too messy) → do NOT clean/delete release copies or old files here.
- 11-04 ~05:00 DONE on branch claude/project-thread-c3oify (commits 6a7b554b1 + 2 test commits, pushed). Body 2.34MB→2.06MB built. npm test 566 pass; browser tests browser/install/editor/wallet/qc-loader/qc-pipeline/qc-modules/qc-settings-* /qc-static-perf pass. Game tests (qc-game-plugin, qc-mobile) moved to "game" group; 3 field unit tests moved to tests/_field/. Build makes game packs only with GOEI_GAME=1. No PR yet (needs 「합쳐」), no release.
- 11-04 12:24 USER 「합치고 릴리스」 → v0.20.4 merged PR #34 into main (959efcb4d), release Action triggered, release files synced to /mnt/project-files/goei-plugin/release. release/game NOT updated (stays 0.20.3; body no longer fetches it; qc-loader-build test adjusted). merge-1101 branch not updated.
