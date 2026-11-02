#!/bin/bash
# 밤샘 감시(2026-10-27): 큐 일꾼·자동 검수·샤워 전원이 꺼지면 다시 켜고, 15분마다 결과를 커밋·푸시. 할 일이 다 끝나면 멈춤.
M=/home/user/goei-plugin/game-src/action/motion3; L=/tmp/claude-0/sup; cd $M
last=0
while true; do
  pend=$(ls queue/pending | wc -l); run=$(ls queue/running | wc -l)
  pgrep -f "^python3 m3.py daemon" >/dev/null || { [ $((pend+run)) -gt 0 ] && setsid nohup python3 m3.py daemon >> $L/daemon.log 2>&1 & }
  pgrep -f "^python3 mwatch.py" >/dev/null || { [ $((pend+run)) -gt 0 ] && T0=$(cat /tmp/claude-0/T0_all) setsid nohup python3 mwatch.py $(cat /tmp/claude-0/sitkeys.txt) >> $L/mwatch.log 2>&1 & }
  sdone=$(ls -d _test/*/샤워2_E 2>/dev/null | wc -l)
  pgrep -f "^python3 _test/shower_all.py" >/dev/null || { [ $sdone -lt 118 ] && setsid nohup python3 _test/shower_all.py >> $L/shower.log 2>&1 & }
  now=$(date +%s)
  if [ $((now-last)) -gt 900 ]; then
    cd /home/user/goei-plugin && git add -A docs game-src >/dev/null 2>&1 && git commit -qm "밤샘 생성 중간 저장(앉기 3판 다시·샤워 세트·굴러떨어지기)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JodrzdJBkmyPR5FWDyivFQ" >/dev/null 2>&1; timeout 300 git push -q origin claude/agent-motion-set >> $L/push.log 2>&1; cd $M; last=$now
  fi
  echo "$(date +%H:%M) pend=$pend run=$run shower=$sdone" >> $L/sup.log
  if [ $((pend+run)) -eq 0 ] && [ $sdone -ge 118 ] && ! pgrep -f "^python3 _test/shower_all.py" >/dev/null; then echo 끝 >> $L/sup.log; break; fi
  sleep 120
done
