#!/bin/bash
# 동시 작업 1개(요원 7명 우선, 2026-10-22 사용자 확정): 몸 하나씩 차례로
cd "$(dirname "$0")"
for i in ${IDS:-haje minseong nasol jaheon seonghae grunt_m grunt_f}; do
  MAXP=${MAXP:-1} python3 -u gen.py $i --resume >> ../gen_$i.out 2>&1
done
