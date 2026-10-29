#!/bin/bash
# 내려받기(curl) 실패로 떨어진 줄을 다시 큐에 넣는다. 큐 기록은 failed_old로 옮겨 보관.
cd /home/user/goei-plugin/game-src/action/motion3; mkdir -p queue/failed_old
for f in queue/failed/*.json; do [ -e "$f" ] || continue
  if grep -q curl "$f"; then read k r < <(python3 -c "import json,sys;j=json.load(open(sys.argv[1]));print(j['key'],j['row'])" "$f"); mv "$f" queue/failed_old/; python3 m3.py enq "$k" "$r"; fi
done
