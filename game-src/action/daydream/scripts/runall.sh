#!/bin/bash
# 동시 작업 1개(요원 7명 우선, 2026-10-22 사용자 확정): 몸 하나씩 차례로. 몸 하나 끝날 때마다 커밋·푸시(컨테이너 재시작 대비)
cd "$(dirname "$0")"
save(){ (cd ../../../.. && git add game-src/action/daydream && git commit -qm "백일몽 클립 생성 진행: $1

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01M8c453e66FHmEe8fsMsJKu" && git push -q origin claude/project-thread-74u2c4) ; }
for i in ${IDS:-haje minseong nasol jaheon seonghae grunt_m grunt_f}; do
  MAXP=${MAXP:-1} python3 -u gen.py $i --resume >> ../gen_$i.out 2>&1
  save $i
done
