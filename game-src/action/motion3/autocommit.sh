#!/bin/bash
# 동작표 3판 결과를 10분마다 작업 브랜치에 커밋·push (CLAUDE.md: 결과물은 생길 때마다 커밋)
cd "$(dirname "$0")/../../.."
while true; do
  git add -A docs/동작표_3판 game-src/action/motion3 >/dev/null 2>&1
  if ! git diff --cached --quiet; then
    git commit -qm "동작표 3판: 생성 결과·표 자동 저장

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016obrnqJRF39tTAFcLTkmj8" && \
    for i in 1 2 3 4; do git push -q origin claude/agent-motion-set && break; sleep $((2**i)); done
  fi
  sleep 600
done
